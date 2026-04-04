"""Triage forum threads to identify those containing confirmed fixes using Claude CLI."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

RAW_DIR = ROOT_DATA_DIR / "forum" / "raw"
TRIAGED_DIR = ROOT_DATA_DIR / "forum" / "triaged"

TRIAGE_MODEL = "sonnet"

# Truncation thresholds for long threads
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

TRIAGE_SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "has_fix": {"type": "boolean"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reason": {"type": "string"},
    },
    "required": ["has_fix", "confidence", "reason"],
})


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_triage] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_thread(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


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
            post_num = total_posts - TAIL_POSTS + i + 1
            lines.append(format_post(post, post_num))
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


def call_claude(prompt: str, model: str = TRIAGE_MODEL, schema: str | None = None) -> str | None:
    """Call Claude CLI in print mode and return the result text."""
    cmd = [
        "claude", "-p",
        "--model", model,
        "--output-format", "json",
        "--no-session-persistence",
    ]
    if schema:
        cmd.extend(["--json-schema", schema])

    # Write prompt to a temp file to avoid shell escaping issues
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(prompt)
        prompt_file = f.name

    try:
        result = subprocess.run(
            cmd + ["--system-prompt", "You output only valid JSON. No markdown, no explanation.", prompt],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(ROOT_DATA_DIR.parent),
        )

        if result.returncode != 0:
            log_error(f"Claude CLI failed (exit {result.returncode}): {result.stderr[:200]}")
            return None

        # Parse the JSON envelope from --output-format json
        try:
            envelope = json.loads(result.stdout)
            if envelope.get("is_error"):
                log_error(f"Claude CLI error: {envelope.get('result', 'unknown')}")
                return None
            return envelope.get("result", "")
        except json.JSONDecodeError:
            # Might be plain text output
            return result.stdout.strip()

    except subprocess.TimeoutExpired:
        log_error("Claude CLI timed out (120s)")
        return None
    except FileNotFoundError:
        log_error("'claude' command not found. Is Claude Code CLI installed?")
        sys.exit(1)
    finally:
        Path(prompt_file).unlink(missing_ok=True)


def call_ollama(prompt: str, model: str = "gemma4:26b") -> str | None:
    """Call Ollama local model and return the result text."""
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": "You output only valid JSON. No markdown, no explanation, no code fences."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1},
    }).encode()

    req = urllib.request.Request(
        "http://localhost:11434/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = json.loads(resp.read().decode())
            return data.get("message", {}).get("content", "")
    except urllib.error.URLError as e:
        log_error(f"Ollama request failed: {e}")
        return None
    except json.JSONDecodeError as e:
        log_error(f"Ollama JSON decode error: {e}")
        return None
    except TimeoutError:
        log_error("Ollama request timed out (600s)")
        return None


def parse_triage_response(text: str, thread_id: str) -> dict | None:
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

        # Normalize variant field names (e.g. "has_pop_fix" -> "has_fix")
        if "has_fix" not in data:
            for key in data:
                if "fix" in key.lower() and isinstance(data[key], bool):
                    data["has_fix"] = data[key]
                    break

        if "has_fix" not in data or "confidence" not in data or "reason" not in data:
            log_error(f"Thread {thread_id}: Missing required fields in response: {cleaned[:200]}")
            return None
        return data
    except json.JSONDecodeError as e:
        log_error(f"Thread {thread_id}: JSON parse failed: {e}\nRaw: {cleaned[:200]}")
        return None


def triage_thread(thread_path: Path, model: str = TRIAGE_MODEL, force: bool = False,
                   ollama_model: str | None = None) -> bool:
    thread_id = thread_path.stem
    out_path = TRIAGED_DIR / f"{thread_id}.json"

    if out_path.exists() and not force:
        print(f"  Skipping {thread_id} (already triaged)")
        return True

    print(f"  Triaging thread {thread_id}...")

    try:
        thread = load_thread(thread_path)
    except (json.JSONDecodeError, OSError) as e:
        log_error(f"Thread {thread_id}: Failed to load: {e}")
        return False

    thread_text = format_thread_for_prompt(thread)
    prompt = f"{TRIAGE_PROMPT}\n\n---\n\n{thread_text}"

    if ollama_model:
        response_text = call_ollama(prompt, model=ollama_model)
        model = ollama_model
    else:
        response_text = call_claude(prompt, model=model)
    if response_text is None:
        return False

    result = parse_triage_response(response_text, thread_id)
    if result is None:
        return False

    output = {
        "thread_id": thread_id,
        "has_fix": result["has_fix"],
        "confidence": result["confidence"],
        "reason": result["reason"],
        "model": model,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    status = "HAS FIX" if output["has_fix"] else "no fix"
    print(f"  {thread_id}: {status} (confidence: {output['confidence']:.2f}) - {output['reason']}")
    return True


def find_raw_threads() -> list[Path]:
    if not RAW_DIR.exists():
        return []
    return sorted(RAW_DIR.glob("*.json"))


def find_fix_threads(min_confidence: float = 0.7) -> list[Path]:
    """Find raw thread paths for threads already triaged as having fixes."""
    fix_paths = []
    for triaged_path in sorted(TRIAGED_DIR.glob("*.json")):
        data = json.loads(triaged_path.read_text(encoding="utf-8"))
        if data.get("has_fix") and data.get("confidence", 0) >= min_confidence:
            raw_path = RAW_DIR / f"{triaged_path.stem}.json"
            if raw_path.exists():
                fix_paths.append(raw_path)
    return fix_paths


def main() -> None:
    parser = argparse.ArgumentParser(description="Triage forum threads for confirmed fixes")
    parser.add_argument("--force", action="store_true", help="Re-triage all threads (overwrite existing)")
    parser.add_argument("--max", type=int, default=None, help="Process max N threads")
    parser.add_argument("--model", default=TRIAGE_MODEL, help=f"Claude model to use (default: {TRIAGE_MODEL})")
    parser.add_argument("--recheck-fixes", action="store_true",
                        help="Only re-triage threads previously marked as having fixes (use with --model to confirm with a different model)")
    parser.add_argument("--workers", type=int, default=1, help="Number of parallel workers (default: 1)")
    parser.add_argument("--ollama", type=str, default=None, metavar="MODEL",
                        help="Use local Ollama model instead of Claude (e.g. --ollama gemma4:26b)")
    args = parser.parse_args()

    model_name = args.ollama or args.model

    if args.recheck_fixes:
        threads = find_fix_threads()
        if not threads:
            print("No threads with confirmed fixes found to recheck.")
            return
        print(f"Rechecking {len(threads)} fix threads with {model_name}...")
    else:
        threads = find_raw_threads()
        if not threads:
            print(f"No raw thread files found in {RAW_DIR}")
            print("Run the forum crawler first to populate data/forum/raw/")
            return

    if args.max:
        threads = threads[: args.max]

    force = args.force or args.recheck_fixes

    if not args.recheck_fixes:
        print(f"Triaging {len(threads)} threads with {model_name} ({args.workers} workers)...")

    succeeded = 0
    failed = 0

    if args.workers > 1:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(triage_thread, tp, args.model, force, args.ollama): tp
                for tp in threads
            }
            for future in as_completed(futures):
                if future.result():
                    succeeded += 1
                else:
                    failed += 1
    else:
        for thread_path in threads:
            if triage_thread(thread_path, model=args.model, force=force, ollama_model=args.ollama):
                succeeded += 1
            else:
                failed += 1

    print(f"\nTriage complete: {succeeded} succeeded, {failed} failed out of {len(threads)}")

    fixes_found = 0
    for thread_path in threads:
        triaged_path = TRIAGED_DIR / f"{thread_path.stem}.json"
        if triaged_path.exists():
            data = json.loads(triaged_path.read_text(encoding="utf-8"))
            if data.get("has_fix") and data.get("confidence", 0) >= 0.7:
                fixes_found += 1

    print(f"Threads with confirmed fixes (confidence >= 0.7): {fixes_found}")


if __name__ == "__main__":
    main()
