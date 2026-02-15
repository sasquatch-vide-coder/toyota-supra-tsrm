"""Download TSRM page images from cygnusx1.net and build a section index."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import httpx

MODEL_CONFIGS = {
    "mk2": {
        "base_url": "http://www.cygnusx1.net/Supra/Library/TSRM/MK2",
        "image_pattern": r'src="(/Media/Supra/Library/TSRM/MK2/[^"]+)"',
    },
    "mk3": {
        "base_url": "http://www.cygnusx1.net/Supra/Library/TSRM/MK3",
        "image_pattern": r'src="(/Media/Supra/Library/TSRM/MK3/[^"]+)"',
    },
}

IMAGE_BASE = "http://www.cygnusx1.net"
ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"
REQUEST_DELAY = 0.5


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [crawler] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def save_sections(sections: dict, sections_file: Path) -> None:
    sections_file.parent.mkdir(parents=True, exist_ok=True)
    sections_file.write_text(json.dumps(sections, indent=2) + "\n", encoding="utf-8")


def discover_sections(client: httpx.Client, base_url: str) -> list[tuple[str, str]]:
    """Fetch the main index page and extract section codes + names."""
    manual_url = f"{base_url}/manual.aspx"
    resp = client.get(manual_url)
    resp.raise_for_status()
    html = resp.text

    # Pattern: href="manual.aspx?S=CO&amp;P=1" with link text
    pattern = r'href="manual\.aspx\?S=([^&]+)&amp;P=1"[^>]*>([^<]+)<'
    matches = re.findall(pattern, html)
    if not matches:
        # Try without &amp; encoding
        pattern = r'href="manual\.aspx\?S=([^&]+)&P=1"[^>]*>([^<]+)<'
        matches = re.findall(pattern, html)

    sections = []
    seen = set()
    for code, name in matches:
        code = code.strip()
        name = name.strip().replace("&amp;", "&")
        if code not in seen:
            seen.add(code)
            sections.append((code, name))
    return sections


def fetch_page(client: httpx.Client, code: str, page: int, base_url: str, image_pattern: str) -> tuple[str | None, int | None]:
    """Fetch a manual page and return (image_url, total_pages).

    Returns (None, None) on failure.
    """
    manual_url = f"{base_url}/manual.aspx"
    url = f"{manual_url}?S={code}&P={page}"
    try:
        resp = client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        log_error(f"Failed to fetch {url}: {e}")
        return None, None

    html = resp.text

    # Extract image URL
    img_match = re.search(image_pattern, html)
    if not img_match:
        log_error(f"No image URL found on {url}")
        return None, None
    image_url = IMAGE_BASE + img_match.group(1)

    # Extract total page count from alt text
    alt_match = re.search(r'alt="[A-Za-z]+ - Page (\d+)/(\d+)"', html)
    total = None
    if alt_match:
        total = int(alt_match.group(2))

    return image_url, total


def download_image(client: httpx.Client, image_url: str, dest: Path, force: bool = False) -> bool:
    """Download an image to dest. Skip if exists and not force."""
    if dest.exists() and not force:
        print(f"  Skipping {dest.name} (already exists)")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp = client.get(image_url)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        print(f"  Downloaded {dest.name} ({len(resp.content)} bytes)")
        return True
    except httpx.HTTPError as e:
        log_error(f"Failed to download {image_url}: {e}")
        return False


def download_page(client: httpx.Client, code: str, page: int, raw_dir: Path, base_url: str, image_pattern: str, force: bool = False) -> int | None:
    """Download a single page. Returns total page count if discovered."""
    dest = raw_dir / code / f"{code}_{page:03d}.gif"

    if dest.exists() and not force:
        print(f"  Skipping {dest.name} (already exists)")
        # Still need to fetch total if we don't know it
        image_url, total = fetch_page(client, code, page, base_url, image_pattern)
        return total

    image_url, total = fetch_page(client, code, page, base_url, image_pattern)
    if image_url:
        download_image(client, image_url, dest, force=force)
    return total


def download_section(client: httpx.Client, code: str, sections: dict, raw_dir: Path, sections_file: Path, base_url: str, image_pattern: str, force: bool = False) -> None:
    """Download all pages for a section."""
    print(f"Downloading section {code}...")

    # First, fetch page 1 to discover total page count
    total = download_page(client, code, 1, raw_dir, base_url, image_pattern, force=force)
    time.sleep(REQUEST_DELAY)

    if total is None:
        log_error(f"Could not determine page count for section {code}")
        return

    # Update sections metadata
    if code not in sections:
        sections[code] = {}
    sections[code]["pages"] = total

    # Download remaining pages
    for page in range(2, total + 1):
        download_page(client, code, page, raw_dir, base_url, image_pattern, force=force)
        time.sleep(REQUEST_DELAY)

    save_sections(sections, sections_file)
    print(f"  Section {code}: {total} pages")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download TSRM page images")
    parser.add_argument("--model", choices=list(MODEL_CONFIGS.keys()), default="mk3", help="Vehicle model (default: mk3)")
    parser.add_argument("--section", help="Download only this section (e.g. CO)")
    parser.add_argument("--page", type=int, help="Download only this page number (requires --section)")
    parser.add_argument("--list-sections", action="store_true", help="Discover and print all sections")
    parser.add_argument("--force", action="store_true", help="Re-download existing files")
    args = parser.parse_args()

    if args.page and not args.section:
        parser.error("--page requires --section")

    config = MODEL_CONFIGS[args.model]
    base_url = config["base_url"]
    image_pattern = config["image_pattern"]
    data_dir = ROOT_DATA_DIR / args.model
    raw_dir = data_dir / "raw"
    sections_file = data_dir / "sections.json"

    client = httpx.Client(timeout=30, follow_redirects=True)
    sections = load_sections(sections_file)

    try:
        if args.list_sections:
            discovered = discover_sections(client, base_url)
            print(f"Found {len(discovered)} sections:")
            for code, name in discovered:
                print(f"  {code}: {name}")
            # Save to sections.json
            for code, name in discovered:
                if code not in sections:
                    sections[code] = {}
                sections[code]["name"] = name
            save_sections(sections, sections_file)
            return

        if args.section and args.page:
            # Single page
            total = download_page(client, args.section, args.page, raw_dir, base_url, image_pattern, force=args.force)
            if total and args.section not in sections:
                sections[args.section] = {"pages": total}
                save_sections(sections, sections_file)
            elif total and "pages" not in sections.get(args.section, {}):
                sections.setdefault(args.section, {})["pages"] = total
                save_sections(sections, sections_file)
            return

        if args.section:
            # Single section
            download_section(client, args.section, sections, raw_dir, sections_file, base_url, image_pattern, force=args.force)
            return

        # All sections
        discovered = discover_sections(client, base_url)
        print(f"Found {len(discovered)} sections, downloading all...")
        for code, name in discovered:
            sections.setdefault(code, {})["name"] = name
            save_sections(sections, sections_file)
            download_section(client, code, sections, raw_dir, sections_file, base_url, image_pattern, force=args.force)

    finally:
        client.close()


if __name__ == "__main__":
    main()
