"""Download MK4 Supra TSRM PDFs and extract pages as PNG images."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
import httpx

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"
REQUEST_DELAY = 1.0

BASE_URL = "http://shoarmateam.nl/upload/MKIVSupra/Supra-MKIV-Repair-Manual"

# Section code -> (section name, relative PDF path from BASE_URL)
SECTIONS = {
    "IN": ("Introduction", "Introduction.pdf"),
    "MA": ("Maintenance", "Maintenance.pdf"),
    "EM": ("Engine Mechanical", "Engines/Mechanical.pdf"),
    "EMS": ("Engine Mechanical 1997 Supplement", "supplements/1997 Engine Mechanical.pdf"),
    "CO": ("Cooling System", "Engines/Cooling System.pdf"),
    "LU": ("Lubrication System", "Engines/Lubrication System.pdf"),
    "EGE": ("Emission System 2JZ-GE", "Engines/Emissions System - 2JZ-GE.pdf"),
    "EGTE": ("Emission System 2JZ-GTE", "Engines/Emissions System - 2JZ-GTE.pdf"),
    "SFGE": ("SFI System 2JZ-GE", "Engines/SFI System - 2JZ-GE.pdf"),
    "SFTE": ("SFI System 2JZ-GTE", "Engines/SFI System - 2JZ-GTE.pdf"),
    "TGE": ("Troubleshooting 2JZ-GE", "Engines/Troubleshooting - 2JZ-GE.pdf"),
    "TGTE": ("Troubleshooting 2JZ-GTE", "Engines/Troubleshooting - 2JZ-GTE.pdf"),
    "TC": ("Turbocharger System 2JZ-GTE", "Engines/Turbocharger System - 2JZ-GTE.pdf"),
    "IGE": ("Ignition System 2JZ-GE", "Ignition Systems/Ignition Systems - 2JZ-GE.pdf"),
    "IGTE": ("Ignition System 2JZ-GTE", "Ignition Systems/Ignition Systems - 2JZ-GTE.pdf"),
    "IGS": ("Ignition 1997 Supplement", "supplements/1997 Ignition.pdf"),
    "ST": ("Starting System", "Starting System.pdf"),
    "CH": ("Charging System", "Charging System.pdf"),
    "ATGE": ("A340 Automatic Trans (GE)", "Transmissions/Auto A340e 2JZ-GE.pdf"),
    "ATTE": ("A340 Automatic Trans (GTE)", "Transmissions/Auto A340e 2JZ-GTE.pdf"),
    "W58": ("W58 Manual Transmission", "Transmissions/Manual W58.pdf"),
    "V160": ("V160/V161 Manual Transmission", "Transmissions/Manual V160.pdf"),
    "CL": ("Clutch System", "Clutch (GE and GTE).pdf"),
    "PR": ("Propeller Shaft", "Propeller Shaft.pdf"),
    "SA": ("Suspension & Axle", "Suspension & Axle.pdf"),
    "BAT": ("Brakes, ABS & TRAC Systems", "Brake, ABS, and TRAC Systems (GE and GTE).pdf"),
    "PS": ("Steering", "Steering.pdf"),
    "SRS": ("Supplemental Restraint System", "Supplemental Restraint System.pdf"),
    "AC": ("Air Conditioning", "Air Conditioning.pdf"),
    "BE": ("Body Electrical Systems", "Body - Electrical Systems.pdf"),
    "BO": ("Body Mechanical", "Body - Mechanical.pdf"),
    "WH": ("Wire Harness", "Wire Harness.pdf"),
    "WD": ("Wiring Diagrams", "Wiring Diagrams.pdf"),
    "CR": ("Collision Repair", "Collision Repair.pdf"),
    "ATR": ("ATM Unit Repair", "ATM Unit Repair.pdf"),
}

DPI = 200


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [pdf_crawler] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def load_sections(sections_file: Path) -> dict:
    if sections_file.exists():
        return json.loads(sections_file.read_text(encoding="utf-8"))
    return {}


def save_sections(sections: dict, sections_file: Path) -> None:
    sections_file.parent.mkdir(parents=True, exist_ok=True)
    sections_file.write_text(json.dumps(sections, indent=2) + "\n", encoding="utf-8")


def download_pdf(client: httpx.Client, code: str, pdf_dir: Path, force: bool = False) -> Path | None:
    """Download a PDF for the given section code. Returns path on success."""
    name, rel_path = SECTIONS[code]
    url = f"{BASE_URL}/{rel_path}"
    dest = pdf_dir / f"{code}.pdf"

    if dest.exists() and not force:
        print(f"  PDF already exists: {dest.name}")
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading {url} ...")
    try:
        resp = client.get(url)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        print(f"  Saved {dest.name} ({len(resp.content):,} bytes)")
        return dest
    except httpx.HTTPError as e:
        log_error(f"Failed to download {url}: {e}")
        return None


def extract_pages(pdf_path: Path, code: str, raw_dir: Path, force: bool = False) -> int:
    """Render each page of the PDF to a PNG image. Returns page count."""
    out_dir = raw_dir / code
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    page_count = len(doc)
    extracted = 0

    for i in range(page_count):
        # Pages are 1-indexed in our naming convention
        page_num = i + 1
        png_path = out_dir / f"{code}_{page_num:03d}.png"

        if png_path.exists() and not force:
            continue

        page = doc[i]
        mat = fitz.Matrix(DPI / 72, DPI / 72)
        pix = page.get_pixmap(matrix=mat)
        pix.save(str(png_path))
        extracted += 1

    doc.close()
    print(f"  Extracted {page_count} pages ({extracted} new) -> {out_dir}")
    return page_count


def process_section(client: httpx.Client, code: str, sections_meta: dict,
                    pdf_dir: Path, raw_dir: Path, sections_file: Path,
                    force: bool = False) -> None:
    """Download PDF and extract pages for one section."""
    name, _ = SECTIONS[code]
    print(f"Processing section {code}: {name}")

    pdf_path = download_pdf(client, code, pdf_dir, force=force)
    if pdf_path is None:
        return

    page_count = extract_pages(pdf_path, code, raw_dir, force=force)

    sections_meta[code] = {
        "name": name,
        "pages": page_count,
    }
    save_sections(sections_meta, sections_file)


def list_sections(sections_file: Path) -> None:
    """Show all available sections with page counts if known."""
    existing = load_sections(sections_file)
    print(f"{'Code':<6} {'Pages':>5}  Name")
    print("-" * 60)
    for code in sorted(SECTIONS.keys()):
        name, _ = SECTIONS[code]
        pages = existing.get(code, {}).get("pages", "-")
        print(f"{code:<6} {str(pages):>5}  {name}")
    print(f"\nTotal: {len(SECTIONS)} sections")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download MK4 Supra TSRM PDFs and extract page PNGs")
    parser.add_argument("--section", help="Process one section by code (e.g. CO)")
    parser.add_argument("--all", action="store_true", help="Process all 35 sections")
    parser.add_argument("--list-sections", action="store_true", help="Show all available sections")
    parser.add_argument("--force", action="store_true", help="Re-download and re-extract even if files exist")
    args = parser.parse_args()

    data_dir = ROOT_DATA_DIR / "mk4"
    pdf_dir = data_dir / "pdfs"
    raw_dir = data_dir / "raw"
    sections_file = data_dir / "sections.json"

    if args.list_sections:
        list_sections(sections_file)
        return

    if not args.section and not args.all:
        parser.print_help()
        return

    if args.section and args.section not in SECTIONS:
        print(f"Unknown section code: {args.section}", file=sys.stderr)
        print(f"Valid codes: {', '.join(sorted(SECTIONS.keys()))}")
        sys.exit(1)

    sections_meta = load_sections(sections_file)
    client = httpx.Client(timeout=120, follow_redirects=True)

    try:
        if args.section:
            process_section(client, args.section, sections_meta, pdf_dir, raw_dir, sections_file, force=args.force)
        elif args.all:
            codes = sorted(SECTIONS.keys())
            print(f"Processing all {len(codes)} sections...")
            for i, code in enumerate(codes, 1):
                print(f"\n[{i}/{len(codes)}]")
                process_section(client, code, sections_meta, pdf_dir, raw_dir, sections_file, force=args.force)
                time.sleep(REQUEST_DELAY)
    finally:
        client.close()


if __name__ == "__main__":
    main()
