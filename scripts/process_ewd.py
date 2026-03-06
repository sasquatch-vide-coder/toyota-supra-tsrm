"""Process an Electrical Wiring Diagram (EWD) PDF into website content.

Steps:
  1. Split PDF into page PNGs using PyMuPDF
  2. Detect sections from TOC page(s) using Claude vision
  3. OCR each page using Claude vision
  4. Generate website content files

Usage:
  python scripts/process_ewd.py --model mk3 --pdf data/ewd/mk3_ewd.pdf
  python scripts/process_ewd.py --model mk3 --pdf data/ewd/mk3_ewd.pdf --step split
  python scripts/process_ewd.py --model mk3 --pdf data/ewd/mk3_ewd.pdf --step toc
  python scripts/process_ewd.py --model mk3 --pdf data/ewd/mk3_ewd.pdf --step ocr
  python scripts/process_ewd.py --model mk3 --step generate
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from claude_code_api import (
    AsyncClaudeClient,
    ClaudeClient,
    OverloadedError,
    RateLimitError,
)

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WEBSITE_DIR = Path(__file__).resolve().parent.parent / "website"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 4096

TOC_PROMPT = """You are looking at a page from a Toyota Electrical Wiring Diagram (EWD) book.
This may be a table of contents, index, or section listing page.

If this page contains a table of contents or list of sections/systems, extract them.
If it does NOT contain a table of contents (e.g., it's a cover page, wiring diagram, or other content),
respond with: {"is_toc": false}

For TOC pages, output valid JSON:
{
  "is_toc": true,
  "sections": [
    {"name": "Charging System", "start_page": 5},
    {"name": "Starting System", "start_page": 8}
  ]
}

Rules:
- Use the exact section/system names as printed
- start_page is the page number shown in the TOC (the printed page number, not the PDF page)
- Include ALL sections listed
- Output ONLY JSON, no markdown fences or explanation"""

OCR_PROMPT = """You are reading a page from a Toyota Electrical Wiring Diagram (EWD) book.
Extract ALL text from this page exactly as written, preserving reading order.

This page likely contains electrical circuit diagrams, connector charts, relay locations,
ground point locations, or wire color reference tables.

Output valid JSON:
{
  "page_id": "CHG-1",
  "section_header": "CHARGING SYSTEM",
  "title": "CHARGING SYSTEM CIRCUIT",
  "ocr_text": "All text from the page in reading order"
}

Rules:
- page_id: section code + page number within section
- section_header: the system/section name (e.g. "CHARGING SYSTEM")
- title: the main title on the page, if any
- ocr_text: ALL visible text including wire colors, connector numbers, component labels,
  pin numbers, ground point names, relay names. Preserve reading order.
  For circuit diagrams, include component labels and wire color codes.

Output ONLY the JSON, no markdown fences or explanation."""


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [ewd] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def image_to_base64(path: Path, max_b64_bytes: int = 5_000_000) -> str:
    """Encode image to base64, resizing if it exceeds the size limit."""
    data = path.read_bytes()
    b64 = base64.standard_b64encode(data).decode("ascii")
    if len(b64) <= max_b64_bytes:
        return b64

    # Resize to fit within limit
    from PIL import Image
    import io

    img = Image.open(path)
    # Try progressively smaller scales until it fits
    for scale in [0.75, 0.6, 0.5, 0.4, 0.3]:
        new_size = (int(img.width * scale), int(img.height * scale))
        resized = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, format="PNG", optimize=True)
        b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
        if len(b64) <= max_b64_bytes:
            print(f"    Resized {path.name} to {scale*100:.0f}% ({len(b64)/1e6:.1f}MB b64)")
            return b64

    # Last resort: JPEG at lower quality
    buf = io.BytesIO()
    resized.save(buf, format="JPEG", quality=80)
    b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
    print(f"    Converted {path.name} to JPEG ({len(b64)/1e6:.1f}MB b64)")
    return b64


# ── Step 1: Split PDF ──────────────────────────────────────────────────────

def split_pdf(pdf_path: Path, output_dir: Path, dpi: int = 300) -> int:
    """Split a PDF into individual page PNGs. Returns page count."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("PyMuPDF is required: pip install PyMuPDF", file=sys.stderr)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    page_count = len(doc)

    print(f"Splitting {page_count} pages at {dpi} DPI...")
    for i, page in enumerate(doc):
        out_path = output_dir / f"{i + 1:03d}.png"
        if out_path.exists():
            continue
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        pix.save(str(out_path))
        if (i + 1) % 10 == 0 or i + 1 == page_count:
            print(f"  {i + 1}/{page_count} pages split")

    doc.close()
    print(f"Split complete: {page_count} pages in {output_dir}")
    return page_count


# ── Step 2: Detect TOC ────────────────────────────────────────────────────

def detect_toc(raw_dir: Path, manifest_path: Path, scan_pages: int = 10) -> None:
    """Scan the first N pages for a table of contents using Claude vision."""
    pages = sorted(raw_dir.glob("*.png"))[:scan_pages]
    if not pages:
        print("No page images found. Run --step split first.", file=sys.stderr)
        return

    if manifest_path.exists():
        print(f"Manifest already exists: {manifest_path}")
        print("Delete it to re-detect, or edit it manually.")
        return

    print(f"Scanning first {len(pages)} pages for table of contents...")
    client = ClaudeClient()
    all_sections = []

    try:
        for page_path in pages:
            page_num = int(page_path.stem)
            print(f"  Checking page {page_num}...")

            b64 = image_to_base64(page_path)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": TOC_PROMPT},
                    ],
                }
            ]

            retries = 0
            while retries <= 3:
                try:
                    response = client.messages.create(
                        model=CLAUDE_MODEL,
                        max_tokens=MAX_TOKENS,
                        messages=messages,
                    )
                    break
                except (RateLimitError, OverloadedError):
                    retries += 1
                    time.sleep(10 * retries)
            else:
                log_error(f"TOC page {page_num}: max retries exceeded")
                continue

            text = response.text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                if lines[-1].strip() == "```":
                    lines = lines[1:-1]
                else:
                    lines = lines[1:]
                text = "\n".join(lines)

            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                print(f"    Page {page_num}: Could not parse response")
                continue

            if data.get("is_toc"):
                sections = data.get("sections", [])
                print(f"    Found TOC with {len(sections)} sections!")
                all_sections.extend(sections)
    finally:
        client.close()

    if not all_sections:
        print("\nNo table of contents found in the scanned pages.")
        print("You can create the manifest manually:")
        print(f"  {manifest_path}")
        # Write a template
        template = [
            {"code": "SEC1", "name": "Section Name", "start_page": 1, "end_page": 10}
        ]
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(template, indent=2) + "\n", encoding="utf-8")
        print("  Template written — edit it with your section definitions.")
        return

    # Generate section codes from names and calculate page ranges
    total_pages = len(list(raw_dir.glob("*.png")))

    # Filter to sections with numeric page numbers
    numeric_sections = []
    for sec in all_sections:
        try:
            start = int(sec.get("start_page", 0))
            if start > 0:
                numeric_sections.append({**sec, "start_page": start})
        except (ValueError, TypeError):
            print(f"  Skipping section with non-numeric page: {sec.get('name', '?')} (page: {sec.get('start_page')})")

    # Sort by start_page and deduplicate
    numeric_sections.sort(key=lambda s: s["start_page"])
    seen = set()
    deduped = []
    for sec in numeric_sections:
        key = (sec["name"], sec["start_page"])
        if key not in seen:
            seen.add(key)
            deduped.append(sec)
    numeric_sections = deduped

    manifest = []
    for i, sec in enumerate(numeric_sections):
        # Generate a short code from the name
        words = sec["name"].upper().split()
        if len(words) == 1:
            code = words[0][:4]
        else:
            code = "".join(w[0] for w in words[:4])

        start = sec["start_page"]
        if i + 1 < len(numeric_sections):
            end = numeric_sections[i + 1]["start_page"] - 1
        else:
            end = total_pages

        manifest.append({
            "code": code,
            "name": sec["name"],
            "start_page": start,
            "end_page": end,
        })

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nManifest written: {manifest_path}")
    print(f"  {len(manifest)} sections detected")
    print("  Review and edit the manifest before running --step ocr")


# ── Step 3: OCR Pages ─────────────────────────────────────────────────────

def load_manifest(manifest_path: Path) -> list[dict]:
    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        print("Run --step toc first, or create it manually.", file=sys.stderr)
        sys.exit(1)
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def find_section_for_page(page_num: int, manifest: list[dict]) -> dict | None:
    for sec in manifest:
        if sec["start_page"] <= page_num <= sec["end_page"]:
            return sec
    return None


async def ocr_page(
    client: AsyncClaudeClient,
    semaphore: asyncio.Semaphore,
    image_path: Path,
    section: dict,
    processed_dir: Path,
    force: bool = False,
) -> bool:
    """OCR a single EWD page."""
    page_num = int(image_path.stem)
    page_in_section = page_num - section["start_page"] + 1
    code = section["code"]
    out_path = processed_dir / code / f"{code}_{page_in_section:03d}.json"

    if out_path.exists() and not force:
        return True

    async with semaphore:
        print(f"  OCR {code} p.{page_in_section} (PDF page {page_num})...")
        b64 = image_to_base64(image_path)
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": OCR_PROMPT},
                ],
            }
        ]

        retries = 0
        while retries <= 3:
            try:
                response = await client.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=MAX_TOKENS,
                    messages=messages,
                )
                break
            except RateLimitError as e:
                retries += 1
                wait = e.retry_after or (5 * (2 ** retries))
                wait = min(wait, 60)
                await asyncio.sleep(wait)
            except OverloadedError:
                retries += 1
                await asyncio.sleep(30)
        else:
            log_error(f"EWD {code}-{page_in_section}: max retries exceeded")
            return False

        text = response.text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[-1].strip() == "```":
                lines = lines[1:-1]
            else:
                lines = lines[1:]
            text = "\n".join(lines)

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            log_error(f"EWD {code}-{page_in_section}: JSON parse failed")
            raw_path = processed_dir / code / f"{code}_{page_in_section:03d}.raw.txt"
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            raw_path.write_text(response.text, encoding="utf-8")
            return False

        # Ensure section info is set
        data.setdefault("section_header", section["name"])
        data["page_id"] = f"{code}-{page_in_section}"

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return True


async def ocr_all_pages(raw_dir: Path, manifest: list[dict], processed_dir: Path, force: bool = False) -> None:
    """OCR all EWD pages grouped by section."""
    pages = sorted(raw_dir.glob("*.png"))
    tasks_info = []

    for image_path in pages:
        page_num = int(image_path.stem)
        section = find_section_for_page(page_num, manifest)
        if section is None:
            continue
        tasks_info.append((image_path, section))

    if not tasks_info:
        print("No pages to OCR.")
        return

    print(f"OCR processing {len(tasks_info)} pages...")
    semaphore = asyncio.Semaphore(3)
    async with AsyncClaudeClient() as client:
        tasks = [
            ocr_page(client, semaphore, img, sec, processed_dir, force=force)
            for img, sec in tasks_info
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    succeeded = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is not True)
    print(f"\nOCR complete: {succeeded} succeeded, {failed} failed")


# ── Step 4: Generate Website Content ──────────────────────────────────────

def generate_content(model: str, manifest: list[dict], raw_dir: Path, processed_dir: Path) -> None:
    """Generate website content files from processed EWD data."""
    content_dir = WEBSITE_DIR / "src" / "content" / f"{model}-ewd"
    public_images = WEBSITE_DIR / "public" / "images" / f"{model}-ewd"

    sections_index = []
    total_pages = 0

    for sec in manifest:
        code = sec["code"]
        sec_processed = processed_dir / code
        if not sec_processed.exists():
            print(f"  No processed data for section {code}")
            continue

        json_files = sorted(
            f for f in sec_processed.glob("*.json")
            if ".raw." not in f.name
        )
        if not json_files:
            continue

        # Copy JSON content files
        content_section = content_dir / code
        content_section.mkdir(parents=True, exist_ok=True)
        page_index = []

        for json_file in json_files:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            stem = json_file.stem
            parts = stem.rsplit("_", 1)
            page_num = int(parts[1])

            out = content_section / f"{page_num}.json"
            out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

            page_index.append({
                "page": page_num,
                "title": data.get("title", ""),
                "section_header": data.get("section_header", ""),
            })

        # Copy page images
        img_dest = public_images / code
        img_dest.mkdir(parents=True, exist_ok=True)
        for pdf_page in range(sec["start_page"], sec["end_page"] + 1):
            page_in_section = pdf_page - sec["start_page"] + 1
            src_img = raw_dir / f"{pdf_page:03d}.png"
            if src_img.exists():
                dst_img = img_dest / f"{code}_{page_in_section:03d}.png"
                shutil.copy2(src_img, dst_img)

        sections_index.append({
            "code": code,
            "name": sec["name"],
            "pages": len(page_index),
            "page_index": page_index,
        })
        total_pages += len(page_index)
        print(f"  Section {code}: {len(page_index)} pages")

    # Write sections.json
    content_dir.mkdir(parents=True, exist_ok=True)
    sections_out = content_dir / "sections.json"
    sections_out.write_text(json.dumps(sections_index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nGenerated: {total_pages} pages across {len(sections_index)} sections")
    print(f"  Content: {content_dir}")
    print(f"  Images:  {public_images}")


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Process EWD PDF into website content")
    parser.add_argument("--model", required=True, help="Vehicle model (e.g., mk3)")
    parser.add_argument("--pdf", help="Path to the EWD PDF file")
    parser.add_argument("--step", choices=["split", "toc", "ocr", "generate"],
                        help="Run a single step (default: all steps)")
    parser.add_argument("--force", action="store_true", help="Reprocess existing files")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for PDF rendering (default: 300)")
    parser.add_argument("--toc-pages", type=int, default=10,
                        help="Number of initial pages to scan for TOC (default: 10)")
    args = parser.parse_args()

    data_dir = ROOT_DATA_DIR / f"{args.model}-ewd"
    raw_dir = data_dir / "raw"
    processed_dir = data_dir / "processed"
    manifest_path = data_dir / "sections_manifest.json"

    steps = [args.step] if args.step else ["split", "toc", "ocr", "generate"]

    if "split" in steps:
        if not args.pdf:
            print("--pdf is required for the split step", file=sys.stderr)
            sys.exit(1)
        pdf_path = Path(args.pdf)
        if not pdf_path.exists():
            print(f"PDF not found: {pdf_path}", file=sys.stderr)
            sys.exit(1)
        split_pdf(pdf_path, raw_dir, dpi=args.dpi)

    if "toc" in steps:
        detect_toc(raw_dir, manifest_path, scan_pages=args.toc_pages)
        if "ocr" in steps or "generate" in steps:
            print("\n--- Review the manifest before continuing ---")
            print(f"    {manifest_path}")
            if args.step is None:
                # Running all steps — pause for user review
                input("Press Enter to continue with OCR, or Ctrl+C to stop and edit the manifest...")

    if "ocr" in steps:
        manifest = load_manifest(manifest_path)
        asyncio.run(ocr_all_pages(raw_dir, manifest, processed_dir, force=args.force))

    if "generate" in steps:
        manifest = load_manifest(manifest_path)
        generate_content(args.model, manifest, raw_dir, processed_dir)


if __name__ == "__main__":
    main()
