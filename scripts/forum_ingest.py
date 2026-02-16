"""Ingest processed forum threads into Supabase for hybrid search."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FORUM_PROCESSED_DIR = DATA_DIR / "forum" / "processed"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def collect_threads() -> list[dict]:
    """Read all processed forum thread JSON files."""
    threads = []
    if not FORUM_PROCESSED_DIR.exists():
        print(f"No processed forum data found at {FORUM_PROCESSED_DIR}", file=sys.stderr)
        return []
    for json_file in sorted(FORUM_PROCESSED_DIR.glob("*.json")):
        data = json.loads(json_file.read_text(encoding="utf-8"))
        threads.append(data)
    return threads


def ingest() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    threads = collect_threads()
    print(f"Collected {len(threads)} processed forum threads.")

    if not threads:
        print("No threads to ingest. Run forum_processor.py first.")
        return

    # Upsert in batches
    batch_size = 100
    for i in range(0, len(threads), batch_size):
        batch = threads[i : i + batch_size]
        records = [
            {
                "thread_id": thread["thread_id"],
                "title": thread["title"],
                "url": thread["url"],
                "author": thread.get("author", ""),
                "date_posted": thread.get("date_posted") or None,
                "reply_count": thread.get("reply_count", 0),
                "issue_summary": thread.get("issue_summary", ""),
                "symptoms": thread.get("symptoms", []),
                "fix_summary": thread.get("fix_summary", ""),
                "related_systems": thread.get("related_systems", []),
                "parts_mentioned": thread.get("parts_mentioned", []),
                "thread_type": thread.get("thread_type", "general_discussion"),
                "is_resolved": thread.get("is_resolved", False),
                "key_takeaway": thread.get("key_takeaway", ""),
                "searchable_text": thread.get("searchable_text", ""),
            }
            for thread in batch
        ]

        supabase.table("forum_threads").upsert(
            records, on_conflict="thread_id"
        ).execute()
        print(f"  Upserted batch {i // batch_size + 1} ({len(records)} rows)")

    print(f"\nDone! Inserted/updated {len(threads)} rows in forum_threads.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest forum threads into Supabase")
    args = parser.parse_args()
    ingest()


if __name__ == "__main__":
    main()
