"""Convert processed JSON to Next.js content files and copy assets."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WEBSITE_DIR = Path(__file__).resolve().parent.parent / "website"


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def generate_section(code: str, sections: dict, processed_dir: Path, diagrams_dir: Path, raw_dir: Path, content_dir: Path, public_images: Path, public_originals: Path) -> int:
    """Generate content files for a section. Returns page count."""
    section_dir = processed_dir / code
    if not section_dir.exists():
        print(f"  No processed data for section {code}")
        return 0

    json_files = sorted(
        f for f in section_dir.glob("*.json")
        if ".validation." not in f.name and ".raw." not in f.name
    )

    if not json_files:
        print(f"  No JSON files for section {code}")
        return 0

    # Create content directory
    content_section = content_dir / code
    content_section.mkdir(parents=True, exist_ok=True)

    page_index = []
    for json_file in json_files:
        data = json.loads(json_file.read_text(encoding="utf-8"))
        stem = json_file.stem  # e.g. CO_002
        parts = stem.rsplit("_", 1)
        page_num = int(parts[1])

        # Write page content file
        out = content_section / f"{page_num}.json"
        out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        page_index.append({
            "page": page_num,
            "title": data.get("title", ""),
            "section_header": data.get("section_header", ""),
        })

    # Copy diagrams (SVGs and fallback PNGs)
    diagrams_section = diagrams_dir / code
    if diagrams_section.exists():
        dest = public_images / code
        dest.mkdir(parents=True, exist_ok=True)
        for f in diagrams_section.glob("*.svg"):
            shutil.copy2(f, dest / f.name)
        for f in diagrams_section.glob("*.png"):
            shutil.copy2(f, dest / f.name)

    # Copy original GIFs
    raw_section = raw_dir / code
    if raw_section.exists():
        dest = public_originals / code
        dest.mkdir(parents=True, exist_ok=True)
        for gif in raw_section.glob("*.gif"):
            shutil.copy2(gif, dest / gif.name)

    print(f"  Section {code}: {len(page_index)} pages generated")
    return len(page_index)


def generate_sections_index(sections: dict, content_dir: Path) -> None:
    """Generate the master sections.json for the website."""
    content_dir.mkdir(parents=True, exist_ok=True)

    index = []
    for code in sorted(sections.keys()):
        meta = sections[code]
        section_content_dir = content_dir / code
        pages = []
        if section_content_dir.exists():
            for f in sorted(section_content_dir.glob("*.json"), key=lambda p: int(p.stem)):
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    pages.append({
                        "page": int(f.stem),
                        "title": data.get("title", ""),
                        "section_header": data.get("section_header", ""),
                    })
                except (json.JSONDecodeError, ValueError):
                    pass

        index.append({
            "code": code,
            "name": meta.get("name", code),
            "pages": meta.get("pages", len(pages)),
            "page_index": pages,
        })

    out = content_dir / "sections.json"
    out.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  Wrote sections index ({len(index)} sections)")


def build_search_index(content_dir: Path) -> None:
    """Build a search index from all content files."""
    entries = []
    for section_dir in sorted(content_dir.iterdir()):
        if not section_dir.is_dir():
            continue
        code = section_dir.name
        for json_file in sorted(section_dir.glob("*.json")):
            try:
                page_num = int(json_file.stem)
            except ValueError:
                continue
            data = json.loads(json_file.read_text(encoding="utf-8"))
            # Collect all searchable text
            texts = []
            if data.get("title"):
                texts.append(data["title"])
            if data.get("section_header"):
                texts.append(data["section_header"])
            # Use ocr_text if available, fall back to content blocks
            if data.get("ocr_text"):
                texts.append(data["ocr_text"])
            for block in data.get("content", []):
                if block.get("type") in ("text", "heading", "caution", "notice"):
                    texts.append(block.get("text", ""))
                elif block.get("type") == "torque_spec":
                    texts.append(f"{block.get('component', '')} {block.get('value', '')}")
                elif block.get("type") == "part_number":
                    texts.append(f"{block.get('label', '')} {block.get('number', '')} {block.get('description', '')}")
                elif block.get("type") == "table":
                    if block.get("caption"):
                        texts.append(block["caption"])
                    for row in block.get("rows", []):
                        texts.extend(str(c) for c in row)
                elif block.get("type") == "list":
                    texts.extend(block.get("items", []))

            entries.append({
                "section": code,
                "page": page_num,
                "title": data.get("title", ""),
                "section_header": data.get("section_header", ""),
                "text": " ".join(texts),
            })

    out = content_dir / "search-index.json"
    out.write_text(json.dumps(entries, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  Built search index ({len(entries)} entries)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Next.js content files")
    parser.add_argument("--section", help="Generate for one section")
    parser.add_argument("--all", action="store_true", help="Generate for all sections")
    parser.add_argument("--model", default="mk3", help="Vehicle model (default: mk3)")
    args = parser.parse_args()

    data_dir = ROOT_DATA_DIR / args.model
    raw_dir = data_dir / "raw"
    processed_dir = data_dir / "processed"
    diagrams_dir = data_dir / "diagrams"
    sections_file = data_dir / "sections.json"
    content_dir = WEBSITE_DIR / "src" / "content" / args.model
    public_images = WEBSITE_DIR / "public" / "images" / args.model
    public_originals = WEBSITE_DIR / "public" / "originals" / args.model

    sections = load_sections(sections_file)

    if args.section:
        generate_section(args.section, sections, processed_dir, diagrams_dir, raw_dir, content_dir, public_images, public_originals)
        generate_sections_index(sections, content_dir)
        build_search_index(content_dir)
        return

    if args.all:
        total = 0
        for code in sorted(sections.keys()):
            total += generate_section(code, sections, processed_dir, diagrams_dir, raw_dir, content_dir, public_images, public_originals)
        generate_sections_index(sections, content_dir)
        build_search_index(content_dir)
        print(f"\nTotal: {total} pages generated")
        return

    # Default: generate for all sections that have processed data
    total = 0
    for section_dir in sorted(processed_dir.iterdir()):
        if section_dir.is_dir():
            code = section_dir.name
            total += generate_section(code, sections, processed_dir, diagrams_dir, raw_dir, content_dir, public_images, public_originals)
    generate_sections_index(sections, content_dir)
    build_search_index(content_dir)
    print(f"\nTotal: {total} pages generated")


if __name__ == "__main__":
    main()
