"""Ingest manual page content into Supabase for FTS search."""

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
WEBSITE_DIR = Path(__file__).resolve().parent.parent / "website"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def build_content_text(data: dict) -> str:
    """Build searchable text from a page's content — mirrors generate_content.py logic."""
    texts = []
    if data.get("title"):
        texts.append(data["title"])
    if data.get("section_header"):
        texts.append(data["section_header"])
    if data.get("ocr_text"):
        texts.append(data["ocr_text"])
    for block in data.get("content", []):
        btype = block.get("type")
        if btype in ("text", "heading", "caution", "notice"):
            texts.append(block.get("text", ""))
        elif btype == "torque_spec":
            texts.append(f"{block.get('component', '')} {block.get('value', '')}")
        elif btype == "part_number":
            texts.append(
                f"{block.get('label', '')} {block.get('number', '')} {block.get('description', '')}"
            )
        elif btype == "table":
            if block.get("caption"):
                texts.append(block["caption"])
            for row in block.get("rows", []):
                texts.extend(str(c) for c in row)
        elif btype == "list":
            texts.extend(block.get("items", []))
    return " ".join(texts)


def collect_pages(content_dir: Path, sections: dict, model: str) -> list[dict]:
    """Collect all page records from content files."""
    pages = []
    for section_dir in sorted(content_dir.iterdir()):
        if not section_dir.is_dir():
            continue
        code = section_dir.name
        section_name = sections.get(code, {}).get("name", code)
        for json_file in sorted(section_dir.glob("*.json")):
            try:
                page_num = int(json_file.stem)
            except ValueError:
                continue
            data = json.loads(json_file.read_text(encoding="utf-8"))
            content_text = build_content_text(data)
            if not content_text.strip():
                continue
            pages.append({
                "section": code,
                "page": page_num,
                "title": data.get("title", ""),
                "section_header": data.get("section_header", ""),
                "section_name": section_name,
                "content_text": content_text,
                "model": model,
            })
    return pages


def ingest(model: str = "mk3") -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    data_dir = ROOT_DATA_DIR / model
    sections_file = data_dir / "sections.json"
    content_dir = WEBSITE_DIR / "src" / "content" / model

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    sections = load_sections(sections_file)
    pages = collect_pages(content_dir, sections, model)
    print(f"Collected {len(pages)} pages from content files.")

    # Upsert in batches
    batch_size = 100
    for i in range(0, len(pages), batch_size):
        batch = pages[i : i + batch_size]
        records = [
            {
                "model": page["model"],
                "section": page["section"],
                "page": page["page"],
                "title": page["title"],
                "section_header": page["section_header"],
                "section_name": page["section_name"],
                "content_text": page["content_text"],
            }
            for page in batch
        ]

        supabase.table("manual_pages").upsert(
            records, on_conflict="model,section,page"
        ).execute()
        print(f"  Upserted batch {i // batch_size + 1} ({len(records)} rows)")

    print(f"\nDone! Inserted/updated {len(pages)} rows in manual_pages.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest manual pages into Supabase")
    parser.add_argument("--model", default="mk3", help="Vehicle model (default: mk3)")
    args = parser.parse_args()
    ingest(model=args.model)


if __name__ == "__main__":
    main()
