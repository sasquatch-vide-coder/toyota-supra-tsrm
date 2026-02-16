"""Generate FAQ Q&A pairs from manual content using Claude, insert into Supabase."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from claude_code_api import (
    AsyncClaudeClient,
    OverloadedError,
    RateLimitError,
)

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WEBSITE_DIR = Path(__file__).resolve().parent.parent / "website"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

MODEL_YEAR = {"mk2": "1986", "mk3": "1990"}

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 2048

FAQ_PROMPT = """You are analyzing a page from a {year} Toyota Supra Technical Service Repair Manual.

Based on the following page content, generate 1-3 frequently asked questions that a mechanic or enthusiast might search for. Each FAQ should:
- Be a natural question someone would type into a search box
- Have a concise answer (1-2 sentences) based on the page content
- Be categorized as one of: procedure, troubleshooting, specification, general

If the page has very little useful content (table of contents, blank pages, index pages), return an empty array.

Page: {section} - {section_name}, Page {page}
Content:
{content_text}

Output ONLY valid JSON in this format, no markdown fences:
[
  {{
    "question": "How do I adjust valve clearance on a {year} Toyota Supra?",
    "answer": "Valve clearance is adjusted using shims...",
    "category": "procedure"
  }}
]"""


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [faq_gen] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def build_content_text(data: dict) -> str:
    """Build searchable text from a page's content."""
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
    """Collect pages with enough text for FAQ generation."""
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
            # Skip pages with too little text (TOC, blank, index)
            if len(content_text) < 50:
                continue
            pages.append({
                "section": code,
                "page": page_num,
                "section_name": section_name,
                "content_text": content_text,
                "model": model,
            })
    return pages


def parse_faq_response(text: str) -> list[dict] | None:
    """Parse Claude's FAQ response as JSON."""
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
        if isinstance(data, list):
            return data
        return None
    except json.JSONDecodeError:
        return None


async def generate_faqs_for_page(
    client: AsyncClaudeClient,
    semaphore: asyncio.Semaphore,
    page: dict,
    faq_prompt: str,
) -> list[dict]:
    """Generate FAQs for a single page using Claude."""
    async with semaphore:
        prompt = faq_prompt.format(
            section=page["section"],
            section_name=page["section_name"],
            page=page["page"],
            content_text=page["content_text"][:3000],  # Limit to avoid token overflow
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
                print(f"  {page['section']}-{page['page']}: Rate limited, waiting {wait:.0f}s...")
                await asyncio.sleep(wait)
            except OverloadedError:
                retries += 1
                print(f"  {page['section']}-{page['page']}: API overloaded, waiting 30s...")
                await asyncio.sleep(30)
        else:
            log_error(f"{page['section']}-{page['page']}: Max retries exceeded for FAQ gen")
            return []

        faqs = parse_faq_response(response.text)
        if faqs is None:
            log_error(f"{page['section']}-{page['page']}: Failed to parse FAQ response")
            return []

        # Attach page metadata to each FAQ
        results = []
        for faq in faqs:
            if not faq.get("question") or not faq.get("answer"):
                continue
            results.append({
                "question": faq["question"],
                "answer": faq["answer"],
                "section": page["section"],
                "page": page["page"],
                "section_name": page["section_name"],
                "category": faq.get("category", "general"),
                "model": page["model"],
            })

        if results:
            print(f"  {page['section']}-{page['page']}: Generated {len(results)} FAQs")
        return results


async def run(model: str = "mk3") -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    data_dir = ROOT_DATA_DIR / model
    sections_file = data_dir / "sections.json"
    content_dir = WEBSITE_DIR / "src" / "content" / model
    year = MODEL_YEAR.get(model, "1990")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    sections = load_sections(sections_file)
    pages = collect_pages(content_dir, sections, model)
    print(f"Collected {len(pages)} pages for FAQ generation.")

    # Generate FAQs using Claude
    faq_prompt = FAQ_PROMPT.replace("{year}", year)
    semaphore = asyncio.Semaphore(10)
    async with AsyncClaudeClient() as client:
        tasks = [
            generate_faqs_for_page(client, semaphore, page, faq_prompt)
            for page in pages
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Flatten results
    all_faqs = []
    for result in results:
        if isinstance(result, list):
            all_faqs.extend(result)
        elif isinstance(result, Exception):
            log_error(f"Task exception: {result}")

    print(f"\nGenerated {len(all_faqs)} total FAQs.")

    if not all_faqs:
        print("No FAQs generated. Exiting.")
        return

    # Insert into Supabase in batches
    batch_size = 100
    for i in range(0, len(all_faqs), batch_size):
        batch = all_faqs[i : i + batch_size]
        supabase.table("faqs").insert(batch).execute()
        print(f"  Inserted FAQ batch {i // batch_size + 1} ({len(batch)} rows)")

    print(f"\nDone! Inserted {len(all_faqs)} FAQs into the faqs table.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate FAQs from manual content via Claude")
    parser.add_argument("--model", default="mk3", help="Vehicle model (default: mk3)")
    args = parser.parse_args()
    asyncio.run(run(model=args.model))


if __name__ == "__main__":
    main()
