"""Convert TSRM page GIFs to PNGs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def parse_page_id(path: Path) -> tuple[str, int]:
    stem = path.stem
    parts = stem.rsplit("_", 1)
    return parts[0], int(parts[1])


def convert_page(image_path: Path, diagrams_dir: Path, force: bool = False) -> int:
    """Convert a GIF/PNG page to PNG in diagrams dir. Returns 1 on success."""
    code, page = parse_page_id(image_path)
    png_path = diagrams_dir / code / f"{code}_{page:03d}.png"

    if png_path.exists() and not force:
        print(f"  Skipping {code}-{page} (already exists)")
        return 0

    png_path.parent.mkdir(parents=True, exist_ok=True)

    if image_path.suffix.lower() == ".png":
        # Already PNG — just copy instead of re-encoding
        import shutil
        shutil.copy2(image_path, png_path)
        img = Image.open(png_path)
        print(f"  Copied {code}-{page} -> {png_path.name} ({img.width}x{img.height})")
        img.close()
    else:
        img = Image.open(image_path).convert("RGB")
        img.save(png_path, format="PNG")
        print(f"  Converted {code}-{page} -> {png_path.name} ({img.width}x{img.height})")
    return 1


def find_images(raw_dir: Path, section: str | None = None) -> list[Path]:
    if section:
        section_dir = raw_dir / section
        if not section_dir.exists():
            return []
        return sorted(
            list(section_dir.glob("*.gif")) + list(section_dir.glob("*.png"))
        )
    return sorted(
        list(raw_dir.glob("*/*.gif")) + list(raw_dir.glob("*/*.png"))
    )


def process_batch(images: list[Path], diagrams_dir: Path, force: bool = False) -> None:
    """Convert multiple GIF pages to PNG."""
    total = 0
    for image_path in images:
        total += convert_page(image_path, diagrams_dir, force=force)
    print(f"\nBatch complete: {total} page(s) converted")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert TSRM page GIFs to PNGs")
    parser.add_argument("--model", default="mk3", help="Vehicle model (default: mk3)")
    parser.add_argument("--file", help="Convert a single GIF file")
    parser.add_argument("--section", help="Convert all pages in a section")
    parser.add_argument("--all", action="store_true", help="Convert all downloaded pages")
    parser.add_argument("--force", action="store_true", help="Re-convert existing PNGs")
    args = parser.parse_args()

    data_dir = ROOT_DATA_DIR / args.model
    raw_dir = data_dir / "raw"
    diagrams_dir = data_dir / "diagrams"

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"File not found: {path}", file=sys.stderr)
            sys.exit(1)
        count = convert_page(path, diagrams_dir, force=args.force)
        print(f"Converted {count} page(s)")
        return

    if args.section:
        images = find_images(raw_dir, section=args.section)
    elif args.all:
        images = find_images(raw_dir)
    else:
        parser.print_help()
        return

    if not images:
        print("No images found to convert.")
        return

    process_batch(images, diagrams_dir, force=args.force)


if __name__ == "__main__":
    main()
