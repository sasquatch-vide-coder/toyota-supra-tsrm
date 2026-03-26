"""Ingest extracted forum fixes into Supabase."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EXTRACTED_DIR = ROOT_DATA_DIR / "forum" / "extracted"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def load_fix(path: Path) -> dict | None:
    """Load an extracted fix card JSON file, returning None on error."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        # Validate required fields
        required = ["thread_id", "title", "category", "problem", "fix", "confidence", "confirmation_type"]
        missing = [f for f in required if f not in data]
        if missing:
            print(f"  WARNING: {path.name} missing fields: {missing}, skipping", file=sys.stderr)
            return None
        return data
    except (json.JSONDecodeError, OSError) as e:
        print(f"  WARNING: Failed to load {path.name}: {e}", file=sys.stderr)
        return None


def fix_to_record(fix: dict) -> dict:
    """Map an extracted fix card to a Supabase forum_fixes table record."""
    problem = fix.get("problem", {})
    fix_data = fix.get("fix", {})

    return {
        "thread_id": fix["thread_id"],
        "model": fix.get("model", "mk3"),
        "source_urls": fix.get("source_urls", []),
        "title": fix["title"],
        "category": fix["category"],
        "subcategory": fix.get("subcategory"),
        "problem_description": problem.get("description", ""),
        "symptoms": problem.get("symptoms", []),
        "root_cause": fix.get("root_cause"),
        "fix_summary": fix_data.get("summary", ""),
        "fix_steps": fix_data.get("steps", []),
        "parts_needed": fix_data.get("parts_needed", []),
        "tools_needed": fix_data.get("tools_needed", []),
        "difficulty": fix_data.get("difficulty", "intermediate"),
        "estimated_time": fix_data.get("estimated_time"),
        "confidence": fix["confidence"],
        "confirmation_type": fix["confirmation_type"],
        "thread_date": fix.get("thread_date"),
    }


def collect_fixes() -> list[dict]:
    """Collect all extracted fix cards and convert to table records."""
    records = []
    if not EXTRACTED_DIR.exists():
        return records

    for fix_file in sorted(EXTRACTED_DIR.glob("*.json")):
        fix = load_fix(fix_file)
        if fix is not None:
            records.append(fix_to_record(fix))

    return records


def ingest(dry_run: bool = False) -> None:
    """Ingest all extracted fixes into Supabase."""
    records = collect_fixes()
    if not records:
        print("No extracted fix files found to ingest.")
        print(f"Run forum_extract.py first to populate {EXTRACTED_DIR}")
        return

    print(f"Collected {len(records)} fix records.")

    if dry_run:
        print("\n--- DRY RUN (no writes) ---\n")
        for rec in records:
            print(
                f"  [{rec['category']}] {rec['title']} "
                f"(thread: {rec['thread_id']}, confidence: {rec['confidence']:.2f}, "
                f"difficulty: {rec['difficulty']})"
            )
        print(f"\nWould upsert {len(records)} records into forum_fixes.")
        return

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Upsert in batches
    batch_size = 50
    total_upserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        supabase.table("forum_fixes").upsert(
            batch, on_conflict="thread_id"
        ).execute()
        total_upserted += len(batch)
        print(f"  Upserted batch {i // batch_size + 1} ({len(batch)} rows)")

    print(f"\nDone! Upserted {total_upserted} rows into forum_fixes.")

    # Print category summary
    categories: dict[str, int] = {}
    for rec in records:
        cat = rec["category"]
        categories[cat] = categories.get(cat, 0) + 1

    print("\nFixes by category:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest forum fixes into Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be ingested without writing")
    args = parser.parse_args()
    ingest(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
