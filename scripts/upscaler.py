"""Upscale TSRM diagrams to high-resolution PNGs."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from PIL import Image
from realesrgan import RealESRGANer

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
DIAGRAMS_DIR = DATA_DIR / "diagrams"
ERRORS_LOG = DATA_DIR / "errors.log"


_upsampler: RealESRGANer | None = None


def _get_upsampler() -> RealESRGANer:
    """Lazy-initialize the Real-ESRGAN upsampler (once per batch)."""
    global _upsampler
    if _upsampler is not None:
        return _upsampler

    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64,
        num_block=6, num_grow_ch=32, scale=4,
    )
    use_gpu = torch.cuda.is_available()
    _upsampler = RealESRGANer(
        scale=4,
        model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
        model=model,
        tile=400,
        tile_pad=20,
        half=False,
        gpu_id=0 if use_gpu else None,
    )
    device = "GPU" if use_gpu else "CPU"
    print(f"  Real-ESRGAN loaded ({device}, fp32)")
    return _upsampler


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [upscaler] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def parse_page_id(path: Path) -> tuple[str, int]:
    stem = path.stem
    parts = stem.rsplit("_", 1)
    return parts[0], int(parts[1])


def crop_diagram(img: Image.Image, bbox: dict | None) -> Image.Image:
    """Crop a diagram region with content-aware edge expansion."""
    img_width, img_height = img.size

    if bbox is None:
        return img.convert("RGB")

    top_pct = bbox.get("top", 0)
    left_pct = bbox.get("left", 0)
    width_pct = bbox.get("width", 100)
    height_pct = bbox.get("height", 100)

    if width_pct * height_pct > 8000:
        return img.convert("RGB")

    left = int(left_pct / 100 * img_width)
    top = int(top_pct / 100 * img_height)
    right = int((left_pct + width_pct) / 100 * img_width)
    bottom = int((top_pct + height_pct) / 100 * img_height)

    # Content-aware edge expansion
    gray = np.array(img.convert("L"))
    edge_strip = 10         # pixels to sample at each edge
    dark_thresh = 200       # pixel brightness considered "dark"
    density_thresh = 0.03   # 3% dark pixels = content at edge
    step_x = int(img_width * 0.02)
    step_y = int(img_height * 0.02)
    max_steps = 5

    for _ in range(max_steps):
        expanded = False
        # Check top
        if top > 0:
            strip = gray[top:min(top + edge_strip, bottom), left:right]
            if strip.size > 0 and np.mean(strip < dark_thresh) > density_thresh:
                top = max(0, top - step_y)
                expanded = True
        # Check bottom
        if bottom < img_height:
            strip = gray[max(bottom - edge_strip, top):bottom, left:right]
            if strip.size > 0 and np.mean(strip < dark_thresh) > density_thresh:
                bottom = min(img_height, bottom + step_y)
                expanded = True
        # Check left
        if left > 0:
            strip = gray[top:bottom, left:min(left + edge_strip, right)]
            if strip.size > 0 and np.mean(strip < dark_thresh) > density_thresh:
                left = max(0, left - step_x)
                expanded = True
        # Check right
        if right < img_width:
            strip = gray[top:bottom, max(right - edge_strip, left):right]
            if strip.size > 0 and np.mean(strip < dark_thresh) > density_thresh:
                right = min(img_width, right + step_x)
                expanded = True
        if not expanded:
            break

    # Minimum 1% breathing room on all sides
    min_pad_x = int(img_width * 0.01)
    min_pad_y = int(img_height * 0.01)
    left = max(0, left - min_pad_x)
    top = max(0, top - min_pad_y)
    right = min(img_width, right + min_pad_x)
    bottom = min(img_height, bottom + min_pad_y)

    cropped = img.crop((left, top, right, bottom)).convert("RGB")

    if cropped.width < 50 or cropped.height < 50:
        print(f"  WARNING: tiny crop ({cropped.width}x{cropped.height}), using full page")
        return img.convert("RGB")

    return cropped


def upscale_diagram(img: Image.Image) -> Image.Image:
    """Upscale a diagram image 4x using Real-ESRGAN anime_6B model.

    Pre- and post-processing sharpen text that the anime model tends to
    smooth, then Otsu-threshold to clean binary B&W output.
    """
    upsampler = _get_upsampler()

    # 1. Convert to grayscale numpy
    gray = np.array(img.convert("L"))

    # 2. Pre-process: light unsharp mask to steepen text edges before upscale
    blurred = cv2.GaussianBlur(gray, (0, 0), sigmaX=1.0)
    sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)

    # 3. Convert gray -> BGR for Real-ESRGAN (expects 3-channel input)
    bgr = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)

    # 4. Real-ESRGAN 4x upscale
    output, _ = upsampler.enhance(bgr)

    # 5. Convert output to grayscale
    output_gray = cv2.cvtColor(output, cv2.COLOR_BGR2GRAY)

    # 6. Post-process: stronger unsharp mask to re-crisp softened text edges
    blur_post = cv2.GaussianBlur(output_gray, (0, 0), sigmaX=1.5)
    sharp = cv2.addWeighted(output_gray, 2.0, blur_post, -1.0, 0)

    # 7. Otsu threshold -> clean binary B&W (eliminates gray haze)
    _, binary = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 8. Return as PIL grayscale
    return Image.fromarray(binary, mode="L")


def convert_page(image_path: Path, force: bool = False) -> int:
    """Convert a GIF page to PNG (no crop, no upscale). Returns 1 on success."""
    code, page = parse_page_id(image_path)
    png_path = DIAGRAMS_DIR / code / f"{code}_{page:03d}.png"

    if png_path.exists() and not force:
        print(f"  Skipping {code}-{page} (already exists)")
        return 0

    img = Image.open(image_path).convert("RGB")
    png_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(png_path, format="PNG")
    print(f"  Converted {code}-{page} -> {png_path.name} ({img.width}x{img.height})")
    return 1


def process_page(image_path: Path, force: bool = False) -> int:
    """Process diagrams for a single page. Returns count of diagrams processed."""
    code, page = parse_page_id(image_path)
    json_path = PROCESSED_DIR / code / f"{code}_{page:03d}.json"

    if not json_path.exists():
        print(f"  Skipping {code}-{page} (no processed JSON)")
        return 0

    data = json.loads(json_path.read_text(encoding="utf-8"))
    diagrams = [b for b in data.get("content", []) if b.get("type") == "diagram"]

    if not diagrams:
        return 0

    img = Image.open(image_path)
    count = 0

    for block in diagrams:
        index = block.get("index", count + 1)
        bbox = block.get("bbox")

        png_path = DIAGRAMS_DIR / code / f"{code}_{page:03d}_{index}.png"
        svg_path = DIAGRAMS_DIR / code / f"{code}_{page:03d}_{index}.svg"

        if png_path.exists() and not force:
            print(f"  Skipping diagram {code}_{page:03d}_{index} (already exists)")
            count += 1
            continue

        cropped = crop_diagram(img, bbox)
        print(f"  Upscaling {code}-{page} diagram {index} ({cropped.width}x{cropped.height})...")

        try:
            upscaled = upscale_diagram(cropped)

            png_path.parent.mkdir(parents=True, exist_ok=True)
            upscaled.save(png_path, format="PNG")
            print(f"  Saved {png_path.name} ({png_path.stat().st_size} bytes)")

            # Remove stale SVG if it exists
            if svg_path.exists():
                svg_path.unlink()
                print(f"  Removed stale {svg_path.name}")
        except Exception as e:
            log_error(f"{code}-{page} diagram {index}: Upscaling failed: {e}")

        count += 1

    return count


def find_images(section: str | None = None) -> list[Path]:
    if section:
        section_dir = RAW_DIR / section
        if not section_dir.exists():
            return []
        return sorted(section_dir.glob("*.gif"))
    return sorted(RAW_DIR.glob("*/*.gif"))


def process_batch(images: list[Path], force: bool = False, convert: bool = False) -> None:
    """Process diagrams from multiple pages."""
    total = 0
    func = convert_page if convert else process_page
    label = "page(s) converted" if convert else "diagram(s) processed"
    for image_path in images:
        count = func(image_path, force=force)
        total += count
    print(f"\nBatch complete: {total} {label}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upscale TSRM diagrams to high-resolution PNGs")
    parser.add_argument("--file", help="Process diagrams from a single GIF file")
    parser.add_argument("--section", help="Process all pages in a section")
    parser.add_argument("--all", action="store_true", help="Process all downloaded pages")
    parser.add_argument("--force", action="store_true", help="Re-process existing diagrams")
    parser.add_argument("--convert", action="store_true", help="Convert GIF to PNG (no crop/upscale)")
    args = parser.parse_args()

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"File not found: {path}", file=sys.stderr)
            sys.exit(1)
        if args.convert:
            count = convert_page(path, force=args.force)
            print(f"Converted {count} page(s)")
        else:
            count = process_page(path, force=args.force)
            print(f"Processed {count} diagram(s)")
        return

    if args.section:
        images = find_images(section=args.section)
    elif args.all:
        images = find_images()
    else:
        parser.print_help()
        return

    if not images:
        print("No images found to process.")
        return

    process_batch(images, force=args.force, convert=args.convert)


if __name__ == "__main__":
    main()
