"""Deterministic SINGLE-nail cutouts from explicitly reviewed source polygons.

No color-threshold mining, random patches, background quilting or generative AI.
Drafts cannot be written under public/. Pillow is an offline authoring tool only;
Next.js/Vercel do not execute this script or acquire a new runtime dependency.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, PngImagePlugin


def build(source_dir, manifest_file, output_dir):
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    output_dir = output_dir.resolve()
    public = Path(__file__).resolve().parents[1] / "public"
    entries = manifest["entries"]
    if output_dir.is_relative_to(public) and any(e["reviewStatus"] != "approved" for e in entries):
        raise ValueError("Unapproved candidates must stay outside public/")
    output_dir.mkdir(parents=True, exist_ok=True)
    result = []
    for e in entries:
        source = (source_dir / e["file"]).resolve()
        if not source.is_relative_to(source_dir.resolve()):
            raise ValueError("Source path escapes source directory")
        if hashlib.sha256(source.read_bytes()).hexdigest() != e["sourceSha256"]:
            raise ValueError(f"Source changed: {e['id']}")
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGBA")
        if list(image.size) != e["sourceSize"]:
            raise ValueError("Source orientation/dimensions differ from annotations")
        poly = e["polygon"]
        if not 3 <= len(poly) <= 64 or not all(len(p) == 2 and all(isinstance(v, (float, int)) and math.isfinite(v) for v in p) and 0 <= p[0] < image.width and 0 <= p[1] < image.height for p in poly):
            raise ValueError("Invalid nail polygon")
        mask = Image.new("L", image.size)
        ImageDraw.Draw(mask).polygon([tuple(p) for p in poly], fill=255)
        if sum(mask.histogram()[128:]) < 120:
            raise ValueError("Nail too small; reselect a sharper source")
        # Copy only masked pixels. RGB outside the cutout is zero, not hand data.
        nail = Image.new("RGBA", image.size)
        nail.paste(image, mask=mask)
        nail = nail.crop(mask.getbbox())
        dx, dy = [e["tip"][i] - e["root"][i] for i in (0, 1)]
        if math.hypot(dx, dy) < 8:
            raise ValueError("Invalid tip/root orientation")
        nail = nail.rotate(math.degrees(math.atan2(dy, dx)) + 90,
                           expand=True, resample=Image.Resampling.BICUBIC)
        nail = nail.crop(nail.getbbox())
        # Preserve native pixels; do not pretend a small source is high resolution.
        info = PngImagePlugin.PngInfo()
        for k, v in {"Author": e["author"], "Source": e["sourceUrl"],
                     "License": e["licenseUrl"], "Changes": "Single nail polygon cutout; rotated tip-up; transparent background. Draft, not production-approved."}.items():
            info.add_text(k, v)
        target = output_dir / f"{e['id']}.png"
        if target.parent != output_dir or not e["id"].replace("-", "").isalnum():
            raise ValueError("Invalid output ID")
        nail.save(target, pnginfo=info)
        result.append({"id": e["id"], "size": list(nail.size), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "reviewStatus": e["reviewStatus"], "author": e["author"], "sourceUrl": e["sourceUrl"], "license": e["license"], "licenseUrl": e["licenseUrl"]})
    (output_dir / "manifest.json").write_text(json.dumps({"draftsOnly": any(e["reviewStatus"] != "approved" for e in entries), "entries": result}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"single-nail candidates={len(result)}; no app presets changed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    a = parser.parse_args()
    build(a.source_dir, a.manifest, a.out_dir)
