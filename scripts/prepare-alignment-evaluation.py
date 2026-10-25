"""Prepare local CC0 image/mask pairs; no assets are copied into public/."""
import argparse
import base64
import json
from pathlib import Path
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('--data-root', type=Path, default=Path('..'))
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
records = json.loads((args.data_root / 'downloads/web100_landmarks.json').read_text(encoding='utf-8-sig'))
dataset = args.data_root / 'data-import/nails-segmentation'
cases = []
for record in records:
    image_path = dataset / 'images' / record['image']
    mask_path = dataset / 'labels' / record['image']
    if not image_path.exists() or not mask_path.exists():
        continue
    with Image.open(image_path) as source, Image.open(mask_path) as labels:
        image = ImageOps.exif_transpose(source).convert('RGBA')
        mask = labels.convert('L')
        if image.size != mask.size:
            continue
        scale = min(1, 640 / max(image.size))
        size = tuple(max(1, round(value * scale)) for value in image.size)
        image = image.resize(size, Image.Resampling.LANCZOS)
        mask = mask.resize(size, Image.Resampling.NEAREST).point(lambda value: 255 if value >= 128 else 0)
        cases.append({
            'file': record['image'], 'width': size[0], 'height': size[1],
            'landmarks': record['landmarks'],
            'pixels': base64.b64encode(image.tobytes()).decode(),
            'mask': base64.b64encode(mask.tobytes()).decode(),
        })
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({'source': 'https://github.com/vpapenko/nails-segmentation-dataset',
    'license': 'CC0-1.0', 'landmarks': 'existing local IMAGE-mode export; not human annotations', 'cases': cases}), encoding='utf-8')
print(f'prepared {len(cases)} paired real images/masks: {args.output}')
