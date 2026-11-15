#!/usr/bin/env python3
"""Rebuild product media from clean sources, never from a previous correction.

Requires Pillow (pip install Pillow). Run from any directory. Originals remain
in git; the input revision predates the aggressive colour/sharpening pass.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageCms, ImageEnhance, ImageFilter, ImageOps, __version__

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REV = "75d3fdd5007132c015353605a17b6957b6fdac6e"
ANIMATIONS = {
    "deck-bunker-opening": "deck-bunker-commander-opening-960x768",
    "deck-bunker-80": "deck-bunker-80-animated-square-640",
    "deck-bunker-green": "deck-bunker-green-square-640",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--portfolio", type=Path, default=ROOT.parent / "hubert-portfolio")
    args = parser.parse_args()
    source_assets = args.portfolio / "public/assets/cults-2026"
    # Check all motion sources before modifying anything.
    for stem in ANIMATIONS.values():
        if not (source_assets / f"{stem}.mp4").is_file():
            parser.error(f"Missing portfolio animation: {stem}.mp4")

    output = ROOT / "images/products"
    records = []
    for path in sorted(output.glob("*.webp")):
        relative = path.relative_to(ROOT).as_posix()
        original = subprocess.check_output(["git", "-C", str(ROOT), "show", f"{SOURCE_REV}:{relative}"])
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(original)))
        profile = image.info.get("icc_profile")
        if profile:
            image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                              ImageCms.createProfile("sRGB"), outputMode="RGB")
        else:
            image = image.convert("RGB")
        # Adjust luminance alone: per-channel stretching previously turned
        # neutral backgrounds cyan. Keep the original size and composition.
        y, cb, cr = image.convert("YCbCr").split()
        y = ImageOps.autocontrast(y, cutoff=0.2)
        image = Image.merge("YCbCr", (y, cb, cr)).convert("RGB")
        image = ImageEnhance.Contrast(image).enhance(1.04)
        image = ImageEnhance.Brightness(image).enhance(1.03)
        image = ImageEnhance.Color(image).enhance(1.10)
        image = image.filter(ImageFilter.UnsharpMask(radius=0.6, percent=35, threshold=3))
        clean = Image.new("RGB", image.size)
        clean.paste(image)
        clean.save(path, "WEBP", quality=85, method=6)
        records.append({"path": relative, "sourceRevision": SOURCE_REV, "sourceSha256": digest(original),
                        "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size,
                        "width": image.width, "height": image.height})

    for target, source in ANIMATIONS.items():
        src = source_assets / f"{source}.mp4"
        path = output / f"{target}.mp4"
        shutil.copyfile(src, path)
        records.append({"path": path.relative_to(ROOT).as_posix(),
                        "source": f"hubert-portfolio/public/assets/cults-2026/{source}.mp4",
                        "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size})

    manifest = {"pillow": __version__, "recipe": {"luminanceCutoffPercent": 0.2, "contrast": 1.04,
                "brightness": 1.03, "colour": 1.10, "webpQuality": 85,
                "unsharpMask": {"radius": 0.6, "percent": 35, "threshold": 3}}, "files": records}
    (ROOT / "data/product-media.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared {len(records)} assets; {sum(r['bytes'] for r in records):,} bytes")


if __name__ == "__main__":
    main()
