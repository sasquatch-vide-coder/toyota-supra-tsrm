"""Extract OCR text from scanned TSRM pages using Claude Sonnet 4.5 vision."""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
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
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

MODEL_YEAR = {
    "mk2": "1986",
    "mk3": "1990",
}

MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 4096

PROMPT = """You are reading a scanned page from a {year} Toyota Supra Technical Service Repair Manual.
Extract ALL text from this page exactly as written, preserving reading order.

Output valid JSON in this format:
{
  "page_id": "CO-2",
  "section_header": "COOLING SYSTEM — Description",
  "title": "DESCRIPTION",
  "ocr_text": "All text from the page in reading order, preserving line breaks as newlines"
}

Rules:
- page_id: section code + page number (from the header/footer)
- section_header: the section name from the page header (e.g. "COOLING SYSTEM — Description")
- title: the main title/heading on the page, if any (empty string if none)
- ocr_text: ALL visible text including headings, paragraphs, labels, captions, table content,
  part numbers, torque specs, warnings, and any text within diagrams. Preserve the reading order.
  Use newlines to separate logical sections. Include text exactly as printed.

Output ONLY the JSON, no markdown fences or explanation."""


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [processor] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def image_to_base64(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode("ascii")


def parse_page_id(path: Path) -> tuple[str, int]:
    """Extract section code and page number from a file path like CO_002.gif."""
    stem = path.stem  # e.g. CO_002
    parts = stem.rsplit("_", 1)
    code = parts[0]
    page = int(parts[1])
    return code, page


def output_path(code: str, page: int, processed_dir: Path) -> Path:
    return processed_dir / code / f"{code}_{page:03d}.json"


def raw_output_path(code: str, page: int, processed_dir: Path) -> Path:
    return processed_dir / code / f"{code}_{page:03d}.raw.txt"


def build_messages(image_path: Path, year: str) -> list[dict]:
    b64 = image_to_base64(image_path)
    prompt = PROMPT.replace("{year}", year)
    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/gif",
                        "data": b64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }
    ]


def process_response(text: str, code: str, page: int, processed_dir: Path) -> dict | None:
    """Parse Claude's response as JSON. Returns parsed dict or None on failure."""
    # Strip markdown fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        cleaned = "\n".join(lines)

    try:
        data = json.loads(cleaned)
        return data
    except json.JSONDecodeError as e:
        log_error(f"{code}-{page}: JSON parse failed: {e}")
        # Save raw response for debugging
        raw_path = raw_output_path(code, page, processed_dir)
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(text, encoding="utf-8")
        return None


def process_file_sync(image_path: Path, processed_dir: Path, force: bool = False, year: str = "1990") -> bool:
    """Process a single image file synchronously."""
    code, page = parse_page_id(image_path)
    out = output_path(code, page, processed_dir)

    if out.exists() and not force:
        print(f"  Skipping {code}-{page} (already processed)")
        return True

    print(f"  Processing {code}-{page}...")
    messages = build_messages(image_path, year=year)

    client = ClaudeClient()
    try:
        retries = 0
        max_retries = 3
        while retries <= max_retries:
            try:
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    messages=messages,
                )
                break
            except RateLimitError as e:
                retries += 1
                wait = e.retry_after or (5 * (2 ** retries))
                wait = min(wait, 60)
                print(f"  Rate limited, waiting {wait:.0f}s (attempt {retries}/{max_retries})...")
                time.sleep(wait)
            except OverloadedError:
                retries += 1
                wait = 30
                print(f"  API overloaded, waiting {wait}s (attempt {retries}/{max_retries})...")
                time.sleep(wait)
        else:
            log_error(f"{code}-{page}: Max retries exceeded")
            return False

        text = response.text
        data = process_response(text, code, page, processed_dir)
        if data is None:
            return False

        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  Saved {out.name}")
        return True
    finally:
        client.close()


async def process_file_async(
    client: AsyncClaudeClient,
    semaphore: asyncio.Semaphore,
    image_path: Path,
    processed_dir: Path,
    force: bool = False,
    year: str = "1990",
) -> bool:
    """Process a single image file asynchronously."""
    code, page = parse_page_id(image_path)
    out = output_path(code, page, processed_dir)

    if out.exists() and not force:
        print(f"  Skipping {code}-{page} (already processed)")
        return True

    async with semaphore:
        print(f"  Processing {code}-{page}...")
        messages = build_messages(image_path, year=year)

        retries = 0
        max_retries = 3
        while retries <= max_retries:
            try:
                response = await client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    messages=messages,
                )
                break
            except RateLimitError as e:
                retries += 1
                wait = e.retry_after or (5 * (2 ** retries))
                wait = min(wait, 60)
                print(f"  {code}-{page}: Rate limited, waiting {wait:.0f}s...")
                await asyncio.sleep(wait)
            except OverloadedError:
                retries += 1
                print(f"  {code}-{page}: API overloaded, waiting 30s...")
                await asyncio.sleep(30)
        else:
            log_error(f"{code}-{page}: Max retries exceeded")
            return False

        text = response.text
        data = process_response(text, code, page, processed_dir)
        if data is None:
            return False

        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  Saved {out.name}")
        return True


def find_images(raw_dir: Path, section: str | None = None) -> list[Path]:
    """Find all GIF images to process."""
    if section:
        section_dir = raw_dir / section
        if not section_dir.exists():
            print(f"Section directory not found: {section_dir}", file=sys.stderr)
            return []
        return sorted(section_dir.glob("*.gif"))
    return sorted(raw_dir.glob("*/*.gif"))


def find_failed(processed_dir: Path, raw_dir: Path) -> list[Path]:
    """Find pages that have raw.txt files (failed JSON parse) but no .json output."""
    failed = []
    for raw_file in processed_dir.glob("*/*.raw.txt"):
        code = raw_file.parent.name
        stem = raw_file.stem.replace(".raw", "")
        json_file = raw_file.parent / f"{stem}.json"
        if not json_file.exists():
            gif_file = raw_dir / code / f"{stem}.gif"
            if gif_file.exists():
                failed.append(gif_file)
    # Also check errors.log for processor errors
    if ERRORS_LOG.exists():
        log_text = ERRORS_LOG.read_text(encoding="utf-8")
        for line in log_text.splitlines():
            if "[processor]" in line:
                match = __import__("re").search(r"(\w+)-(\d+)", line)
                if match:
                    code, page = match.group(1), int(match.group(2))
                    out = output_path(code, page, processed_dir)
                    gif = raw_dir / code / f"{code}_{page:03d}.gif"
                    if gif.exists() and not out.exists() and gif not in failed:
                        failed.append(gif)
    return sorted(set(failed))


async def process_batch(images: list[Path], processed_dir: Path, force: bool = False, year: str = "1990") -> None:
    """Process multiple images concurrently."""
    semaphore = asyncio.Semaphore(3)
    async with AsyncClaudeClient() as client:
        tasks = [
            process_file_async(client, semaphore, img, processed_dir, force=force, year=year)
            for img in images
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    succeeded = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is not True)
    print(f"\nBatch complete: {succeeded} succeeded, {failed} failed out of {len(images)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract text from TSRM scanned pages")
    parser.add_argument("--file", help="Process a single GIF file")
    parser.add_argument("--section", help="Process all pages in a section")
    parser.add_argument("--page", type=int, help="Process a specific page (requires --section)")
    parser.add_argument("--all", action="store_true", help="Process all downloaded pages")
    parser.add_argument("--retry", action="store_true", help="Retry previously failed pages")
    parser.add_argument("--force", action="store_true", help="Reprocess existing output files")
    parser.add_argument("--model", choices=list(MODEL_YEAR.keys()), default="mk3", help="Vehicle model (default: mk3)")
    parser.add_argument("--validate", action="store_true", help="Run validation after processing")
    args = parser.parse_args()

    data_dir = ROOT_DATA_DIR / args.model
    raw_dir = data_dir / "raw"
    processed_dir = data_dir / "processed"
    sections_file = data_dir / "sections.json"
    year = MODEL_YEAR[args.model]

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"File not found: {path}", file=sys.stderr)
            sys.exit(1)
        success = process_file_sync(path, processed_dir, force=args.force, year=year)
        if args.validate and success:
            code, page = parse_page_id(path)
            print(f"\nRunning validation for {code}-{page}...")
            import subprocess
            subprocess.run(
                [sys.executable, str(Path(__file__).parent / "validator.py"), "--file", str(path)],
                check=False,
            )
        sys.exit(0 if success else 1)

    if args.section and args.page:
        gif = raw_dir / args.section / f"{args.section}_{args.page:03d}.gif"
        if not gif.exists():
            print(f"File not found: {gif}", file=sys.stderr)
            sys.exit(1)
        success = process_file_sync(gif, processed_dir, force=args.force, year=year)
        sys.exit(0 if success else 1)

    if args.retry:
        images = find_failed(processed_dir, raw_dir)
        if not images:
            print("No failed pages to retry.")
            return
        print(f"Retrying {len(images)} failed pages...")
        asyncio.run(process_batch(images, processed_dir, force=True, year=year))
        return

    if args.section:
        images = find_images(raw_dir, section=args.section)
    elif args.all:
        images = find_images(raw_dir)
    else:
        parser.print_help()
        return

    if not images:
        print("No images found to process.")
        return

    print(f"Processing {len(images)} images...")
    asyncio.run(process_batch(images, processed_dir, force=args.force, year=year))


if __name__ == "__main__":
    main()
