"""Process crawled forum threads with Claude to extract structured data."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from claude_code_api import (
    AsyncClaudeClient,
    OverloadedError,
    RateLimitError,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FORUM_RAW_DIR = DATA_DIR / "forum" / "raw"
FORUM_PROCESSED_DIR = DATA_DIR / "forum" / "processed"
ERRORS_LOG = DATA_DIR / "errors.log"

MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 2048

FORUM_EXTRACT_PROMPT = """You are analyzing a forum thread from SupraForums.com about the 1986.5-1992 Toyota Supra (MK3/A70).

Thread title: {title}
Thread URL: {url}
Number of replies: {reply_count}

Thread content (all posts):
{thread_text}

Extract structured data from this thread. Output ONLY valid JSON:
{{
  "issue_summary": "Brief 1-2 sentence summary of the main issue discussed",
  "symptoms": ["symptom 1", "symptom 2"],
  "fix_summary": "Brief summary of the fix/solution, or empty string if unresolved",
  "related_systems": ["Engine", "Cooling"],
  "parts_mentioned": ["head gasket", "thermostat"],
  "thread_type": "troubleshooting|modification|general_discussion|how_to|parts_question",
  "is_resolved": true,
  "key_takeaway": "One-sentence summary of the most useful information"
}}"""

# Keywords that indicate a post may contain a solution
SOLUTION_KEYWORDS = ["solution", "fix", "fixed", "resolved", "figured it out", "solved", "answer"]


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_processor] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def build_thread_text(thread_data: dict, max_chars: int = 8000) -> str:
    """Build text from thread posts, prioritizing first post and solution posts."""
    posts = thread_data.get("posts", [])
    if not posts:
        return ""

    # Always include the first post
    first_post = posts[0]
    first_text = f"[Post #1 by {first_post['author']}]\n{first_post['content']}\n\n"

    remaining_budget = max_chars - len(first_text)
    if remaining_budget <= 0:
        return first_text[:max_chars]

    # Sort remaining posts: solution-keyword posts first, then by post number
    other_posts = posts[1:]
    prioritized = []
    regular = []

    for post in other_posts:
        content_lower = post["content"].lower()
        if any(kw in content_lower for kw in SOLUTION_KEYWORDS):
            prioritized.append(post)
        else:
            regular.append(post)

    ordered = prioritized + regular

    # Build remaining text within budget
    parts = [first_text]
    chars_used = len(first_text)
    for post in ordered:
        entry = f"[Post #{post['post_number']} by {post['author']}]\n{post['content']}\n\n"
        if chars_used + len(entry) > max_chars:
            # Add truncated version if there's room
            remaining = max_chars - chars_used
            if remaining > 100:
                parts.append(entry[:remaining])
            break
        parts.append(entry)
        chars_used += len(entry)

    return "".join(parts)


def parse_json_response(text: str) -> dict | None:
    """Parse Claude's JSON response, stripping markdown fences if present."""
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
        if isinstance(data, dict):
            return data
        return None
    except json.JSONDecodeError:
        return None


def collect_raw_threads(thread_id: str | None = None) -> list[dict]:
    """Collect raw thread JSON files."""
    threads = []
    if thread_id:
        path = FORUM_RAW_DIR / f"{thread_id}.json"
        if path.exists():
            threads.append(json.loads(path.read_text(encoding="utf-8")))
        else:
            print(f"Thread file not found: {path}", file=sys.stderr)
    else:
        if not FORUM_RAW_DIR.exists():
            print(f"No raw forum data found at {FORUM_RAW_DIR}", file=sys.stderr)
            return []
        for json_file in sorted(FORUM_RAW_DIR.glob("*.json")):
            threads.append(json.loads(json_file.read_text(encoding="utf-8")))
    return threads


async def process_thread(
    client: AsyncClaudeClient,
    semaphore: asyncio.Semaphore,
    thread_data: dict,
) -> dict | None:
    """Process a single thread through Claude to extract structured data."""
    meta = thread_data["meta"]
    thread_id = meta["thread_id"]
    title = meta["title"]

    async with semaphore:
        thread_text = build_thread_text(thread_data)
        if not thread_text.strip():
            log_error(f"Thread {thread_id}: No text content to process")
            return None

        prompt = FORUM_EXTRACT_PROMPT.format(
            title=title,
            url=meta["url"],
            reply_count=meta.get("reply_count", 0),
            thread_text=thread_text,
        )

        retries = 0
        max_retries = 3
        while retries <= max_retries:
            try:
                response = await client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    messages=[{"role": "user", "content": prompt}],
                )
                break
            except RateLimitError as e:
                retries += 1
                wait = e.retry_after or (5 * (2 ** retries))
                wait = min(wait, 60)
                print(f"  {thread_id}: Rate limited, waiting {wait:.0f}s...")
                await asyncio.sleep(wait)
            except OverloadedError:
                retries += 1
                print(f"  {thread_id}: API overloaded, waiting 30s...")
                await asyncio.sleep(30)
        else:
            log_error(f"Thread {thread_id}: Max retries exceeded")
            return None

        extracted = parse_json_response(response.text)
        if extracted is None:
            log_error(f"Thread {thread_id}: Failed to parse Claude response")
            return None

        # Build output record
        result = {
            **meta,
            "issue_summary": extracted.get("issue_summary", ""),
            "symptoms": extracted.get("symptoms", []),
            "fix_summary": extracted.get("fix_summary", ""),
            "related_systems": extracted.get("related_systems", []),
            "parts_mentioned": extracted.get("parts_mentioned", []),
            "thread_type": extracted.get("thread_type", "general_discussion"),
            "is_resolved": extracted.get("is_resolved", False),
            "key_takeaway": extracted.get("key_takeaway", ""),
        }

        # Build searchable_text
        searchable_parts = [
            title,
            result["issue_summary"],
            " ".join(result["symptoms"]),
            result["fix_summary"],
            result["key_takeaway"],
            " ".join(result["parts_mentioned"]),
        ]
        result["searchable_text"] = " ".join(p for p in searchable_parts if p)

        print(f"  {thread_id}: Processed - {result['thread_type']}, resolved={result['is_resolved']}")
        return result


def save_processed(result: dict) -> None:
    """Save processed thread data to JSON."""
    FORUM_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    dest = FORUM_PROCESSED_DIR / f"{result['thread_id']}.json"
    dest.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


async def run(
    thread_id: str | None = None,
    force: bool = False,
    process_all: bool = False,
) -> None:
    raw_threads = collect_raw_threads(thread_id)
    if not raw_threads:
        print("No threads to process.")
        return

    # Filter already-processed unless force
    if not force:
        filtered = []
        for t in raw_threads:
            tid = t["meta"]["thread_id"]
            dest = FORUM_PROCESSED_DIR / f"{tid}.json"
            if dest.exists():
                print(f"  Skipping {tid} (already processed)")
            else:
                filtered.append(t)
        raw_threads = filtered

    if not raw_threads:
        print("All threads already processed. Use --force to reprocess.")
        return

    print(f"Processing {len(raw_threads)} threads with Claude...")

    semaphore = asyncio.Semaphore(5)
    async with AsyncClaudeClient() as client:
        tasks = [
            process_thread(client, semaphore, thread_data)
            for thread_data in raw_threads
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    success = 0
    for result in results:
        if isinstance(result, dict):
            save_processed(result)
            success += 1
        elif isinstance(result, Exception):
            log_error(f"Task exception: {result}")

    print(f"\nDone! Processed {success}/{len(raw_threads)} threads.")
    print(f"Output: {FORUM_PROCESSED_DIR}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Process forum threads with Claude AI")
    parser.add_argument("--all", action="store_true", help="Process all raw threads")
    parser.add_argument("--thread", help="Process a single thread by ID")
    parser.add_argument("--force", action="store_true", help="Reprocess existing threads")
    parser.add_argument("--retry", action="store_true", help="Retry previously failed threads")
    args = parser.parse_args()

    if not args.all and not args.thread:
        parser.error("Specify --all or --thread THREAD_ID")

    asyncio.run(run(
        thread_id=args.thread,
        force=args.force or args.retry,
        process_all=args.all,
    ))


if __name__ == "__main__":
    main()
