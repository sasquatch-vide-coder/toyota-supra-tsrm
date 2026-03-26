"""Extract structured fix cards from triaged forum threads using Claude CLI."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

RAW_DIR = ROOT_DATA_DIR / "forum" / "raw"
TRIAGED_DIR = ROOT_DATA_DIR / "forum" / "triaged"
EXTRACTED_DIR = ROOT_DATA_DIR / "forum" / "extracted"

EXTRACT_MODEL = "opus"

# Must match triage thresholds
LONG_THREAD_THRESHOLD = 150
HEAD_POSTS = 20
TAIL_POSTS = 30

# Minimum confidence from triage to qualify for extraction
MIN_CONFIDENCE = 0.7

EXTRACTION_PROMPT = """You are extracting a structured repair fix from a SupraForums.com thread about the Toyota Supra MKIII (1986.5-1992).

This thread has been identified as containing a confirmed fix. Read the entire thread carefully and extract the fix into a structured format.

Respond with ONLY valid JSON matching this schema:
{
  "title": "Concise, descriptive title for the fix (e.g., 'Rough Idle After 7MGTE Rebuild - Base Timing Reset')",
  "category": "One of: Engine, Turbo, Electrical, Fuel System, Cooling, Transmission, Suspension, Brakes, Body/Interior, Exhaust",
  "subcategory": "More specific grouping (e.g., 'Idle/Running Issues', 'Boost Leaks', 'Wiring')",
  "problem": {
    "description": "Clear description of the problem the person was experiencing",
    "symptoms": ["list", "of", "specific", "symptoms"]
  },
  "root_cause": "What was actually causing the problem",
  "fix": {
    "summary": "One-sentence summary of the fix",
    "steps": ["Step 1...", "Step 2...", "Step 3..."],
    "parts_needed": ["Part name ~$price if mentioned"],
    "tools_needed": ["Tool 1", "Tool 2"],
    "difficulty": "beginner OR intermediate OR advanced",
    "estimated_time": "e.g., '15 minutes', '2 hours'"
  },
  "confidence": 0.0 to 1.0,
  "confirmation_type": "op_confirmed OR community_consensus"
}

Guidelines:
- Write the fix steps as clear, actionable instructions someone could follow
- Include specific part numbers, torque specs, or measurements if mentioned in the thread
- Difficulty: beginner = hand tools only, no lifting; intermediate = some mechanical knowledge needed; advanced = specialized tools or significant disassembly
- Be accurate - only include information actually stated in the thread, do not fabricate details"""


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_extract] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_json(path: Path) -> dict:
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


def call_claude(prompt: str, model: str = EXTRACT_MODEL) -> str | None:
    """Call Claude CLI in print mode and return the result text."""
    cmd = [
        "claude", "-p",
        "--model", model,
        "--output-format", "json",
        "--no-session-persistence",
    ]

    try:
        result = subprocess.run(
            cmd + ["--system-prompt", "You output only valid JSON. No markdown, no explanation.", prompt],
            capture_output=True,
            text=True,
            timeout=300,  # 5 min for Opus
            cwd=str(ROOT_DATA_DIR.parent),
        )

        if result.returncode != 0:
            log_error(f"Claude CLI failed (exit {result.returncode}): {result.stderr[:200]}")
            return None

        try:
            envelope = json.loads(result.stdout)
            if envelope.get("is_error"):
                log_error(f"Claude CLI error: {envelope.get('result', 'unknown')}")
                return None
            return envelope.get("result", "")
        except json.JSONDecodeError:
            return result.stdout.strip()

    except subprocess.TimeoutExpired:
        log_error("Claude CLI timed out (300s)")
        return None
    except FileNotFoundError:
        log_error("'claude' command not found. Is Claude Code CLI installed?")
        sys.exit(1)


def parse_extract_response(text: str, thread_id: str) -> dict | None:
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
        required = ["title", "category", "problem", "fix"]
        for field in required:
            if field not in data:
                log_error(f"Thread {thread_id}: Missing required field '{field}'")
                return None
        return data
    except json.JSONDecodeError as e:
        log_error(f"Thread {thread_id}: JSON parse failed: {e}\nRaw: {cleaned[:300]}")
        # Save raw response for debugging
        raw_path = EXTRACTED_DIR / f"{thread_id}.raw.txt"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(text, encoding="utf-8")
        return None


def find_qualifying_threads() -> list[tuple[str, Path, dict]]:
    """Find threads that passed triage with sufficient confidence."""
    qualifying = []
    if not TRIAGED_DIR.exists():
        return qualifying

    for triaged_path in sorted(TRIAGED_DIR.glob("*.json")):
        triage = load_json(triaged_path)
        if triage.get("has_fix") and triage.get("confidence", 0) >= MIN_CONFIDENCE:
            thread_id = triaged_path.stem
            raw_path = RAW_DIR / f"{thread_id}.json"
            if raw_path.exists():
                qualifying.append((thread_id, raw_path, triage))
    return qualifying


def extract_thread(thread_id: str, raw_path: Path, triage: dict, model: str, force: bool = False) -> bool:
    out_path = EXTRACTED_DIR / f"{thread_id}.json"

    if out_path.exists() and not force:
        print(f"  Skipping {thread_id} (already extracted)")
        return True

    print(f"  Extracting thread {thread_id} (triage confidence: {triage['confidence']:.2f})...")

    try:
        thread = load_json(raw_path)
    except (json.JSONDecodeError, OSError) as e:
        log_error(f"Thread {thread_id}: Failed to load: {e}")
        return False

    thread_text = format_thread_for_prompt(thread)
    prompt = f"{EXTRACTION_PROMPT}\n\n---\n\n{thread_text}"

    response_text = call_claude(prompt, model=model)
    if response_text is None:
        return False

    result = parse_extract_response(response_text, thread_id)
    if result is None:
        return False

    # Enrich with metadata
    result["thread_id"] = thread_id
    result["model"] = "mk3"
    result["source_urls"] = [thread.get("url", "")]
    result["thread_date"] = thread.get("date", "")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"  {thread_id}: {result['title']} [{result['category']}]")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract structured fix cards from triaged threads")
    parser.add_argument("--force", action="store_true", help="Re-extract all (overwrite existing)")
    parser.add_argument("--max", type=int, default=None, help="Process max N threads")
    parser.add_argument("--model", default=EXTRACT_MODEL, help=f"Claude model to use (default: {EXTRACT_MODEL})")
    args = parser.parse_args()

    qualifying = find_qualifying_threads()
    if not qualifying:
        print(f"No qualifying threads found in {TRIAGED_DIR}")
        print("Run forum_triage.py first.")
        return

    if args.max:
        qualifying = qualifying[: args.max]

    print(f"Extracting {len(qualifying)} threads with {args.model}...")

    succeeded = 0
    failed = 0
    for thread_id, raw_path, triage in qualifying:
        if extract_thread(thread_id, raw_path, triage, model=args.model, force=args.force):
            succeeded += 1
        else:
            failed += 1

    print(f"\nExtraction complete: {succeeded} succeeded, {failed} failed out of {len(qualifying)}")

    # Category summary
    categories: dict[str, int] = {}
    for thread_id, _, _ in qualifying:
        path = EXTRACTED_DIR / f"{thread_id}.json"
        if path.exists():
            data = load_json(path)
            cat = data.get("category", "Unknown")
            categories[cat] = categories.get(cat, 0) + 1

    if categories:
        print("\nCategory breakdown:")
        for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
