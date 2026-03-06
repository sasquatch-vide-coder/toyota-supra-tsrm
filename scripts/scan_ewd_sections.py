"""Quick scan of EWD pages to detect section numbers on each page.

Builds an accurate sections_manifest.json by asking Claude to identify
just the section number/letter on each page header.
"""

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
    OverloadedError,
    RateLimitError,
)

CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

SCAN_PROMPT = """Look at the top-left and top-right corners of this page from a Toyota Electrical Wiring Diagram book.

What is the section/page number shown? Toyota EWDs use formats like:
- "1-1" (section 1, sub-page 1)
- "3-2" (section 3, sub-page 2)
- "A" or "B" or "C" or "D" (introduction pages)
- A number alone like "2" (section number without sub-page)
- No number (cover page, TOC, etc.)

Also, what is the section TITLE if visible (e.g., "POWER SOURCE", "EFI SYSTEM", "CHARGING SYSTEM")?

Respond with ONLY this JSON:
{"section": "3", "subpage": "2", "title": "EFI SYSTEM"}

Rules:
- section: the main section number or letter (e.g., "1", "3", "A", "D"). Use "" if no section number visible.
- subpage: the sub-page number if present (e.g., "1", "2"). Use "" if none.
- title: the section title if visible on this page. Use "" if none.
- Output ONLY JSON, no fences."""


def downscale_image(image_path: Path, max_bytes: int = 3_500_000) -> bytes:
    """Downscale a PNG if it exceeds max_bytes for the API."""
    data = image_path.read_bytes()
    if len(data) <= max_bytes:
        return data
    # Use PIL to resize
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(data))
    # Scale down proportionally
    scale = (max_bytes / len(data)) ** 0.5
    new_size = (int(img.width * scale), int(img.height * scale))
    img = img.resize(new_size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def scan_page(
    client: AsyncClaudeClient,
    semaphore: asyncio.Semaphore,
    image_path: Path,
) -> dict:
    pdf_page = int(image_path.stem)
    async with semaphore:
        img_bytes = downscale_image(image_path)
        b64 = base64.standard_b64encode(img_bytes).decode("ascii")
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": b64},
                    },
                    {"type": "text", "text": SCAN_PROMPT},
                ],
            }
        ]

        retries = 0
        while retries <= 3:
            try:
                response = await client.messages.create(
                    model=CLAUDE_MODEL, max_tokens=256, messages=messages,
                )
                break
            except (RateLimitError, OverloadedError):
                retries += 1
                await asyncio.sleep(10 * retries)
        else:
            return {"pdf_page": pdf_page, "section": "", "subpage": "", "title": "ERROR"}

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
            return {"pdf_page": pdf_page, "section": "", "subpage": "", "title": f"PARSE_ERROR: {text[:100]}"}

        data["pdf_page"] = pdf_page
        return data


async def scan_all(raw_dir: Path) -> list[dict]:
    pages = sorted(raw_dir.glob("*.png"))
    print(f"Scanning {len(pages)} pages for section numbers...")

    semaphore = asyncio.Semaphore(5)
    async with AsyncClaudeClient() as client:
        tasks = [scan_page(client, semaphore, p) for p in pages]
        results = await asyncio.gather(*tasks)

    results.sort(key=lambda r: r["pdf_page"])
    return results


def build_manifest(scan_results: list[dict]) -> list[dict]:
    """Group scan results into sections."""
    # Known section names from TOC
    SECTION_NAMES = {
        "1": "Power Source",
        "2": "Starting and Ignition Systems",
        "3": "EFI System",
        "4": "Charging System",
        "5": "Light Auto Turn Off System",
        "6": "Turn Signal and Hazard Warning Lights",
        "7": "Headlights",
        "8": "Fog Lights",
        "9": "Interior Lights",
        "10": "Back-Up Lights",
        "11": "Stop Lights",
        "12": "Taillights and Illumination",
        "13": "Remote Control Mirrors",
        "14": "Rear Window Defogger and Mirror Heater",
        "15": "Front Wiper and Washer",
        "16": "Door Locks",
        "17": "Rear Wiper and Washer",
        "18": "Power Windows",
        "19": "Power Seat",
        "20": "Cruise Control",
        "21": "ECT System",
        "22": "A.B.S.",
        "23": "Headlight Cleaner",
        "24": "Cigarette Lighter and Clock",
        "25": "TEMS",
        "26": "Unlock and Seat Belt Warning",
        "27": "Super Monitor",
        "28": "Horns",
        "29": "Theft Deterrent System",
        "30": "Auto Antenna",
        "31": "Radio and Tape Player",
        "32": "Combination Meter",
        "33": "Automatic Air Conditioner",
        "34": "Ground Points",
    }

    # Group pages by section
    sections: dict[str, list[int]] = {}
    intro_pages: list[int] = []

    for r in scan_results:
        sec = str(r.get("section", "")).strip()
        pdf_page = r["pdf_page"]

        if not sec or sec in ("", "COVER", "TOC"):
            intro_pages.append(pdf_page)
        elif sec.isalpha() and len(sec) == 1:
            # Intro pages A, B, C, D
            sections.setdefault(f"INTRO_{sec}", []).append(pdf_page)
        elif sec.replace(".", "").isdigit():
            # Numeric section
            sec_num = sec.split(".")[0]
            sections.setdefault(sec_num, []).append(pdf_page)
        else:
            # Unknown — try to extract a number
            import re
            m = re.match(r"(\d+)", sec)
            if m:
                sections.setdefault(m.group(1), []).append(pdf_page)
            else:
                intro_pages.append(pdf_page)

    # Build manifest
    manifest = []

    # Add intro sections
    for key in sorted(k for k in sections if k.startswith("INTRO_")):
        letter = key.replace("INTRO_", "")
        pages = sorted(sections[key])
        names = {"A": "Introduction", "B": "How to Use This Manual", "C": "Troubleshooting", "D": "Glossary of Terms and Symbols"}
        manifest.append({
            "code": letter,
            "name": names.get(letter, f"Introduction {letter}"),
            "start_page": pages[0],
            "end_page": pages[-1],
        })

    # Add numbered sections
    for sec_num in sorted((k for k in sections if not k.startswith("INTRO_")), key=lambda x: int(x)):
        pages = sorted(sections[sec_num])
        name = SECTION_NAMES.get(sec_num, f"Section {sec_num}")
        # Use title from scan if available
        for r in scan_results:
            if str(r.get("section", "")).split(".")[0] == sec_num and r.get("title"):
                name = r["title"].title()
                break
        manifest.append({
            "code": f"S{sec_num}",
            "name": name,
            "start_page": pages[0],
            "end_page": pages[-1],
        })

    return manifest


def main():
    parser = argparse.ArgumentParser(description="Scan EWD pages for section numbers")
    parser.add_argument("--model", required=True, help="Vehicle model (e.g., mk3)")
    args = parser.parse_args()

    data_dir = Path(__file__).resolve().parent.parent / "data" / f"{args.model}-ewd"
    raw_dir = data_dir / "raw"
    scan_path = data_dir / "section_scan.json"
    manifest_path = data_dir / "sections_manifest.json"

    if not raw_dir.exists():
        print(f"No raw images found: {raw_dir}", file=sys.stderr)
        sys.exit(1)

    # Run scan
    results = asyncio.run(scan_all(raw_dir))

    # Save raw scan results
    scan_path.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(f"\nScan saved: {scan_path}")

    # Print summary
    for r in results:
        sec = r.get("section", "")
        sub = r.get("subpage", "")
        title = r.get("title", "")
        label = f"{sec}-{sub}" if sub else sec if sec else "---"
        print(f"  PDF {r['pdf_page']:3d}: {label:6s} {title}")

    # Build manifest
    manifest = build_manifest(results)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nManifest written: {manifest_path} ({len(manifest)} sections)")


if __name__ == "__main__":
    main()
