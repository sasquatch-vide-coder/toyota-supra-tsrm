"""Parallel forum triage - runs multiple Claude CLI instances concurrently."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

RAW_DIR = ROOT_DATA_DIR / "forum" / "raw"
TRIAGED_DIR = ROOT_DATA_DIR / "forum" / "triaged"

TRIAGE_MODEL = "sonnet"

LONG_THREAD_THRESHOLD = 150
HEAD_POSTS = 20
TAIL_POSTS = 30

TRIAGE_PROMPT = """You are analyzing a forum thread from SupraForums.com about the Toyota Supra MKIII (1986.5-1992).

Determine if this thread contains a CONFIRMED FIX for a mechanical, electrical, or maintenance problem.

A "confirmed fix" means EITHER:
1. The original poster came back and explicitly confirmed a solution worked
2. Multiple experienced members agreed on the same solution with confidence

This is NOT a confirmed fix if:
- The thread is just a question with no resolution
- People offered suggestions but nobody confirmed they worked
- The thread is about modifications/upgrades, not fixing a problem
- The thread is a "how-to" without addressing a specific problem

Respond with ONLY valid JSON:
{
  "has_fix": true/false,
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation of your classification"
}"""

_log_lock = threading.Lock()
_stats_lock = threading.Lock()
stats = {"succeeded": 0, "failed": 0, "fixes_found": 0}


def log_info(msg: str) -> None:
    with _log_lock:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def log_error(msg: str) -> None:
    with _log_lock:
        ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(ERRORS_LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_triage] {msg}\n")
        print(f"[{time.strftime('%H:%M:%S')}] ERROR: {msg}", file=sys.stderr)


def format_thread_for_prompt(thread: dict) -> str:
    title = thread.get("title", "Unknown Thread")
    posts = thread.get("posts", [])
    total_posts = len(posts)
    lines = [f"Thread Title: {title}", f"Total Posts: {total_posts}", ""]

    if total_posts > LONG_THREAD_THRESHOLD:
        lines.append(
            f"[NOTE: This thread has {total_posts} posts. Showing first {HEAD_POSTS} "
            f"and last {TAIL_POSTS} posts. {total_posts - HEAD_POSTS - TAIL_POSTS} "
            f"middle posts omitted.]"
        )
        lines.append("")
        for i, post in enumerate(posts[:HEAD_POSTS]):
            lines.append(format_post(post, i + 1))
        lines.append(f"\n--- {total_posts - HEAD_POSTS - TAIL_POSTS} posts omitted ---\n")
        for i, post in enumerate(posts[-TAIL_POSTS:]):
            lines.append(format_post(post, total_posts - TAIL_POSTS + i + 1))
    else:
        for i, post in enumerate(posts):
            lines.append(format_post(post, i + 1))

    return "\n".join(lines)


def format_post(post: dict, number: int) -> str:
    author = post.get("author", "Unknown")
    date = post.get("date", "")
    content = post.get("content", "")
    date_str = f" ({date})" if date else ""
    return f"Post #{number} by {author}{date_str}:\n{content}\n"


CLAUDE_BIN = r"C:\Users\jason\.local\bin\claude.exe"


def call_claude(prompt: str, model: str = TRIAGE_MODEL) -> str | None:
    cmd = [
        CLAUDE_BIN, "-p",
        "--model", model,
        "--output-format", "json",
        "--no-session-persistence",
        "--system-prompt", "You output only valid JSON. No markdown, no explanation.",
    ]
    try:
        # Pipe prompt via stdin with explicit UTF-8 to handle emoji in forum posts
        result = subprocess.run(
            cmd, capture_output=True, timeout=120,
            input=prompt.encode("utf-8"),
            cwd=str(ROOT_DATA_DIR.parent),
            env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"},
        )
        stdout = result.stdout.decode("utf-8", errors="replace") if isinstance(result.stdout, bytes) else result.stdout
        stderr = result.stderr.decode("utf-8", errors="replace") if isinstance(result.stderr, bytes) else (result.stderr or "")

        if result.returncode != 0:
            log_error(f"Claude CLI exit {result.returncode}: {stderr[:200]}")
            return None
        try:
            envelope = json.loads(stdout)
            if envelope.get("is_error"):
                log_error(f"Claude error: {envelope.get('result', 'unknown')[:200]}")
                return None
            return envelope.get("result", "")
        except json.JSONDecodeError:
            return stdout.strip()
    except subprocess.TimeoutExpired:
        log_error("Claude CLI timed out (120s)")
        return None
    except FileNotFoundError:
        log_error("'claude' not found in PATH")
        return None


def parse_response(text: str, thread_id: str) -> dict | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        cleaned = "\n".join(lines)
    try:
        data = json.loads(cleaned)
        if "has_fix" not in data or "confidence" not in data:
            log_error(f"{thread_id}: Missing fields in response")
            return None
        return data
    except json.JSONDecodeError as e:
        log_error(f"{thread_id}: JSON parse failed: {e}")
        return None


def triage_one(thread_path: Path, model: str) -> bool:
    thread_id = thread_path.stem
    out_path = TRIAGED_DIR / f"{thread_id}.json"

    if out_path.exists():
        return True  # already done

    try:
        thread = json.loads(thread_path.read_text(encoding="utf-8"))
    except Exception as e:
        log_error(f"{thread_id}: Failed to load: {e}")
        return False

    thread_text = format_thread_for_prompt(thread)
    prompt = f"{TRIAGE_PROMPT}\n\n---\n\n{thread_text}"

    response = call_claude(prompt, model=model)
    if response is None:
        return False

    result = parse_response(response, thread_id)
    if result is None:
        return False

    output = {
        "thread_id": thread_id,
        "has_fix": result.get("has_fix", False),
        "confidence": result.get("confidence", 0),
        "reason": result.get("reason", ""),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    with _stats_lock:
        stats["succeeded"] += 1
        is_fix = output["has_fix"] and output["confidence"] >= 0.7
        if is_fix:
            stats["fixes_found"] += 1
        total = stats["succeeded"] + stats["failed"]
        if total % 25 == 0:
            log_info(f"Progress: {total} done ({stats['succeeded']} ok, {stats['failed']} failed, "
                     f"{stats['fixes_found']} fixes found)")

    status = "FIX" if output["has_fix"] and output["confidence"] >= 0.7 else "no fix"
    log_info(f"{thread_id}: {status} (conf={output['confidence']:.2f})")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Parallel forum triage")
    parser.add_argument("--workers", type=int, default=5, help="Concurrent Claude CLI calls (default: 5)")
    parser.add_argument("--max", type=int, default=None, help="Process max N threads")
    parser.add_argument("--force", action="store_true", help="Re-triage all (overwrite existing)")
    parser.add_argument("--model", default=TRIAGE_MODEL, help=f"Model (default: {TRIAGE_MODEL})")
    args = parser.parse_args()

    if args.force:
        import shutil
        if TRIAGED_DIR.exists():
            shutil.rmtree(TRIAGED_DIR)
            print("Cleared existing triage results.")

    threads = sorted(RAW_DIR.glob("*.json"))
    if not threads:
        print(f"No raw threads in {RAW_DIR}. Run the crawler first.")
        return

    # Filter already-triaged
    pending = [t for t in threads if not (TRIAGED_DIR / f"{t.stem}.json").exists()]
    already_done = len(threads) - len(pending)

    if args.max:
        pending = pending[:args.max]

    print(f"Threads: {len(threads)} total, {already_done} already triaged, {len(pending)} to process")
    print(f"Workers: {args.workers}, Model: {args.model}")
    print()

    TRIAGED_DIR.mkdir(parents=True, exist_ok=True)

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(triage_one, t, args.model): t for t in pending}
        try:
            for future in as_completed(futures):
                try:
                    if not future.result():
                        with _stats_lock:
                            stats["failed"] += 1
                except Exception as e:
                    with _stats_lock:
                        stats["failed"] += 1
                    log_error(f"Unexpected: {e}")
        except KeyboardInterrupt:
            print("\nInterrupted! Waiting for in-flight requests to finish...")
            executor.shutdown(wait=True, cancel_futures=True)

    print(f"\n=== TRIAGE COMPLETE ===")
    print(f"Succeeded: {stats['succeeded']}")
    print(f"Failed: {stats['failed']}")
    print(f"Fixes found (confidence >= 0.7): {stats['fixes_found']}")

    # Final count
    all_triaged = list(TRIAGED_DIR.glob("*.json"))
    total_fixes = sum(1 for t in all_triaged
                      if json.loads(t.read_text(encoding="utf-8")).get("has_fix")
                      and json.loads(t.read_text(encoding="utf-8")).get("confidence", 0) >= 0.7)
    print(f"Total triaged: {len(all_triaged)}, Total qualifying fixes: {total_fixes}")


if __name__ == "__main__":
    main()
