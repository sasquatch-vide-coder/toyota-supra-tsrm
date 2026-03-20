"""Build downloadable ZIP archives with images and offline HTML viewer."""

from __future__ import annotations

import argparse
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPTS_DIR.parent
WEBSITE_DIR = ROOT_DIR / "website"
CONTENT_DIR = WEBSITE_DIR / "src" / "content"
IMAGES_DIR = WEBSITE_DIR / "public" / "images"
OUTPUT_DIR = WEBSITE_DIR / "public" / "downloads"
TEMPLATE_PATH = SCRIPTS_DIR / "templates" / "viewer_template.html"

MODELS = {
    "mk2": {"name": "MK2 Supra", "year": "1982\u20131986", "generation": "A60"},
    "mk3": {"name": "MK3 Supra", "year": "1986.5\u20131992", "generation": "A70"},
    "mk4": {"name": "MK4 Supra", "year": "1993\u20132002", "generation": "A80"},
}

# Content directory names for each doc type per model
DOC_DIRS = {
    "mk2": {"tsrm": "mk2", "ewd": "mk2-ewd"},
    "mk3": {"tsrm": "mk3", "ewd": "mk3-ewd"},
    "mk4": {"tsrm": "mk4", "ewd": "mk4-ewd"},
}


def load_sections(content_dir_name: str) -> list:
    """Load sections.json for a content directory."""
    path = CONTENT_DIR / content_dir_name / "sections.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return []


def build_viewer_html(model: str, tsrm_sections: list, ewd_sections: list) -> str:
    """Generate the self-contained HTML viewer for a model."""
    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    model_info = MODELS[model]
    html = template.replace("{{MODEL_INFO}}", json.dumps(model_info))
    html = html.replace("{{MODEL_NAME}}", model_info["name"])
    html = html.replace("{{TSRM_SECTIONS}}", json.dumps(tsrm_sections))
    html = html.replace("{{EWD_SECTIONS}}", json.dumps(ewd_sections))

    return html


def add_images_to_zip(zf: zipfile.ZipFile, images_dir: Path, zip_prefix: str) -> int:
    """Add all PNG images from a directory tree to the ZIP. Returns image count."""
    count = 0
    if not images_dir.exists():
        return 0

    for section_dir in sorted(images_dir.iterdir()):
        if not section_dir.is_dir():
            continue
        section_code = section_dir.name
        png_files = sorted(section_dir.glob("*.png"))
        for png in png_files:
            arcname = f"{zip_prefix}/{section_code}/{png.name}"
            zf.write(png, arcname)
            count += 1
        if png_files:
            print(f"    {section_code}: {len(png_files)} images")

    return count


def build_zip(model: str) -> dict | None:
    """Build ZIP archive for one model. Returns manifest entry or None."""
    if model not in MODELS:
        print(f"Unknown model: {model}")
        return None

    doc_dirs = DOC_DIRS[model]
    tsrm_sections = load_sections(doc_dirs["tsrm"])
    ewd_sections = load_sections(doc_dirs["ewd"])

    if not tsrm_sections and not ewd_sections:
        print(f"No content found for {model}, skipping")
        return None

    folder_name = f"{MODELS[model]['name'].replace(' ', '-')}-Manual"
    zip_filename = f"{folder_name}.zip"
    zip_path = OUTPUT_DIR / zip_filename

    print(f"\nBuilding {zip_filename}...")

    # Generate viewer HTML
    viewer_html = build_viewer_html(model, tsrm_sections, ewd_sections)

    total_images = 0
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED) as zf:
        # Add viewer.html
        zf.writestr(f"{folder_name}/viewer.html", viewer_html)

        # Add TSRM images
        tsrm_images_dir = IMAGES_DIR / doc_dirs["tsrm"]
        if tsrm_sections and tsrm_images_dir.exists():
            print(f"  Adding TSRM images from {tsrm_images_dir.name}/...")
            count = add_images_to_zip(zf, tsrm_images_dir, f"{folder_name}/tsrm")
            total_images += count
            print(f"  TSRM total: {count} images")

        # Add EWD images
        ewd_images_dir = IMAGES_DIR / doc_dirs["ewd"]
        if ewd_sections and ewd_images_dir.exists():
            print(f"  Adding EWD images from {ewd_images_dir.name}/...")
            count = add_images_to_zip(zf, ewd_images_dir, f"{folder_name}/ewd")
            total_images += count
            print(f"  EWD total: {count} images")

    file_size = zip_path.stat().st_size
    size_str = format_bytes(file_size)
    print(f"  Created {zip_filename}: {size_str} ({total_images} images)")

    return {
        "filename": zip_filename,
        "size": file_size,
        "images": total_images,
        "built": datetime.now(timezone.utc).isoformat(),
    }


def format_bytes(b: int) -> str:
    if b >= 1_000_000_000:
        return f"{b / 1_000_000_000:.1f} GB"
    if b >= 1_000_000:
        return f"{b / 1_000_000:.0f} MB"
    return f"{b} B"


def write_manifest(manifest: dict) -> None:
    """Write manifest.json with download metadata."""
    manifest_path = OUTPUT_DIR / "manifest.json"

    # Merge with existing manifest if present
    if manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text(encoding="utf-8"))
            existing.update(manifest)
            manifest = existing
        except (json.JSONDecodeError, ValueError):
            pass

    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nManifest written to {manifest_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build downloadable ZIP archives")
    parser.add_argument("--model", help="Build for one model (mk2, mk3, mk4)")
    parser.add_argument("--all", action="store_true", help="Build for all models")
    args = parser.parse_args()

    if not args.model and not args.all:
        parser.error("Specify --model or --all")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    models_to_build = list(MODELS.keys()) if args.all else [args.model]
    manifest = {}

    for model in models_to_build:
        entry = build_zip(model)
        if entry:
            manifest[model] = entry

    if manifest:
        write_manifest(manifest)

    print("\nDone!")


if __name__ == "__main__":
    main()
