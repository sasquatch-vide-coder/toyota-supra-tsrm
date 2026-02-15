"""Automated AI comparison of extracted JSON vs original scan using Claude Haiku."""

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

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 2048

VALIDATION_PROMPT = """You are a quality checker. I'll show you an original scanned manual page and the JSON
text that was extracted from it. Compare them and report any issues.

Check for:
1. MISSING TEXT — any text visible in the scan that's not in the JSON
2. WRONG TEXT — text that was misread or garbled (OCR errors)
3. MISSING DIAGRAMS — illustrations in the scan not identified in the JSON
4. WRONG STRUCTURE — tables, lists, or specs that were incorrectly categorized
5. READING ORDER — content extracted out of order vs. the original page layout

Output JSON:
{
  "page_id": "CO-2",
  "score": 95,
  "issues": [
    {"severity": "minor", "type": "wrong_text", "detail": "'pressurized' was extracted as 'presurized'"},
    {"severity": "major", "type": "missing_text", "detail": "Footer reference number CO0561 not captured"}
  ],
  "pass": true
}

A score of 90+ with no major issues = pass. Flag anything that would confuse a mechanic.
Output ONLY the JSON."""


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [validator] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def parse_page_id(path: Path) -> tuple[str, int]:
    stem = path.stem
    parts = stem.rsplit("_", 1)
    return parts[0], int(parts[1])


def validation_path(processed_dir: Path, code: str, page: int) -> Path:
    return processed_dir / code / f"{code}_{page:03d}.validation.json"


def processed_path(processed_dir: Path, code: str, page: int) -> Path:
    return processed_dir / code / f"{code}_{page:03d}.json"


def build_messages(image_path: Path, extracted_json: dict) -> list[dict]:
    b64 = base64.standard_b64encode(image_path.read_bytes()).decode("ascii")
    json_text = json.dumps(extracted_json, indent=2, ensure_ascii=False)
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
                {
                    "type": "text",
                    "text": f"Here is the extracted JSON:\n\n{json_text}\n\n{VALIDATION_PROMPT}",
                },
            ],
        }
    ]


def parse_validation(text: str) -> dict | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        cleaned = "\n".join(lines)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def validate_file_sync(image_path: Path, processed_dir: Path, force: bool = False) -> dict | None:
    """Validate a single page synchronously."""
    code, page = parse_page_id(image_path)
    val_path = validation_path(processed_dir, code, page)
    proc_path = processed_path(processed_dir, code, page)

    if val_path.exists() and not force:
        print(f"  Skipping {code}-{page} (already validated)")
        return json.loads(val_path.read_text(encoding="utf-8"))

    if not proc_path.exists():
        print(f"  Skipping {code}-{page} (not yet processed)")
        return None

    extracted = json.loads(proc_path.read_text(encoding="utf-8"))
    messages = build_messages(image_path, extracted)

    print(f"  Validating {code}-{page}...")
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
                print(f"  Rate limited, waiting {wait:.0f}s...")
                time.sleep(wait)
            except OverloadedError:
                retries += 1
                print(f"  API overloaded, waiting 30s...")
                time.sleep(30)
        else:
            log_error(f"{code}-{page}: Validation max retries exceeded")
            return None

        result = parse_validation(response.text)
        if result is None:
            log_error(f"{code}-{page}: Validation JSON parse failed")
            return None

        val_path.parent.mkdir(parents=True, exist_ok=True)
        val_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

        score = result.get("score", 0)
        passed = result.get("pass", False)
        issues = result.get("issues", [])
        major = sum(1 for i in issues if i.get("severity") == "major")

        status = "PASS" if passed else "FAIL"
        print(f"  {code}-{page}: score={score} {status} ({len(issues)} issues, {major} major)")

        if not passed or score < 90:
            log_error(f"{code}-{page}: Validation failed (score={score}, {major} major issues)")

        return result
    finally:
        client.close()


async def validate_file_async(
    client: AsyncClaudeClient,
    semaphore: asyncio.Semaphore,
    image_path: Path,
    processed_dir: Path,
    force: bool = False,
) -> dict | None:
    """Validate a single page asynchronously."""
    code, page = parse_page_id(image_path)
    val_path = validation_path(processed_dir, code, page)
    proc_path = processed_path(processed_dir, code, page)

    if val_path.exists() and not force:
        return json.loads(val_path.read_text(encoding="utf-8"))

    if not proc_path.exists():
        return None

    async with semaphore:
        extracted = json.loads(proc_path.read_text(encoding="utf-8"))
        messages = build_messages(image_path, extracted)

        print(f"  Validating {code}-{page}...")
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
                await asyncio.sleep(wait)
            except OverloadedError:
                retries += 1
                await asyncio.sleep(30)
        else:
            log_error(f"{code}-{page}: Validation max retries exceeded")
            return None

        result = parse_validation(response.text)
        if result is None:
            log_error(f"{code}-{page}: Validation JSON parse failed")
            return None

        val_path.parent.mkdir(parents=True, exist_ok=True)
        val_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        return result


def find_images(raw_dir: Path, section: str | None = None) -> list[Path]:
    if section:
        section_dir = raw_dir / section
        if not section_dir.exists():
            return []
        return sorted(section_dir.glob("*.gif"))
    return sorted(raw_dir.glob("*/*.gif"))


async def validate_batch(images: list[Path], processed_dir: Path, force: bool = False) -> list[dict | None]:
    semaphore = asyncio.Semaphore(5)  # Haiku can handle more concurrency
    async with AsyncClaudeClient() as client:
        tasks = [
            validate_file_async(client, semaphore, img, processed_dir, force=force)
            for img in images
        ]
        return await asyncio.gather(*tasks, return_exceptions=True)


def print_report(processed_dir: Path, sections_file: Path) -> None:
    """Print a summary of all validation results."""
    sections = load_sections(sections_file)
    total_processed = 0
    total_passed = 0
    total_need_review = 0
    section_reports = []

    for section_dir in sorted(processed_dir.iterdir()):
        if not section_dir.is_dir():
            continue
        code = section_dir.name
        val_files = sorted(section_dir.glob("*.validation.json"))
        json_files = sorted(section_dir.glob("*.json"))
        # Exclude validation files from json count
        json_files = [f for f in json_files if ".validation." not in f.name]

        processed = len(json_files)
        passed = 0
        failed_pages = []

        for vf in val_files:
            data = json.loads(vf.read_text(encoding="utf-8"))
            if data.get("pass", False) and data.get("score", 0) >= 90:
                passed += 1
            else:
                page_id = data.get("page_id", vf.stem.replace(".validation", ""))
                score = data.get("score", 0)
                issues = data.get("issues", [])
                major = [i for i in issues if i.get("severity") == "major"]
                detail = major[0]["detail"] if major else "low score"
                failed_pages.append(f"    {page_id}: score {score} — {detail}")

        need_review = len(val_files) - passed
        total_processed += processed
        total_passed += passed
        total_need_review += need_review

        section_name = sections.get(code, {}).get("name", code)
        report = f"  Section {code} ({section_name}): {processed} pages processed, {passed} passed, {need_review} needs review"
        if failed_pages:
            report += "\n" + "\n".join(failed_pages)
        section_reports.append(report)

    print("Validation Report")
    print("=" * 60)
    for r in section_reports:
        print(r)
    print("-" * 60)
    total = total_passed + total_need_review
    pct = (total_passed / total * 100) if total > 0 else 0
    print(f"  Overall: {total_passed}/{total} passed ({pct:.1f}%), {total_need_review} need review")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate extracted TSRM content")
    parser.add_argument("--model", default="mk3", help="Vehicle model (default: mk3)")
    parser.add_argument("--file", help="Validate extraction for a single GIF file")
    parser.add_argument("--section", help="Validate all pages in a section")
    parser.add_argument("--all", action="store_true", help="Validate all processed pages")
    parser.add_argument("--report", action="store_true", help="Print validation summary")
    parser.add_argument("--force", action="store_true", help="Re-validate existing results")
    args = parser.parse_args()

    data_dir = ROOT_DATA_DIR / args.model
    raw_dir = data_dir / "raw"
    processed_dir = data_dir / "processed"
    sections_file = data_dir / "sections.json"

    if args.report:
        print_report(processed_dir, sections_file)
        return

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"File not found: {path}", file=sys.stderr)
            sys.exit(1)
        validate_file_sync(path, processed_dir, force=args.force)
        return

    if args.section:
        images = find_images(raw_dir, section=args.section)
    elif args.all:
        images = find_images(raw_dir)
    else:
        parser.print_help()
        return

    if not images:
        print("No images found to validate.")
        return

    print(f"Validating {len(images)} pages...")
    asyncio.run(validate_batch(images, processed_dir, force=args.force))
    print()
    print_report(processed_dir, sections_file)


if __name__ == "__main__":
    main()
