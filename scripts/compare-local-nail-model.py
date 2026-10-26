import sys, json, base64, time, hashlib, argparse, csv
from pathlib import Path
import numpy as np
from PIL import Image
import torch
parser = argparse.ArgumentParser(description='Offline-only local segmentation comparison; never loads a model into the website')
parser.add_argument('--input', type=Path, required=True)
parser.add_argument('--poses', type=Path, required=True)
parser.add_argument('--research-dir', type=Path, required=True)
parser.add_argument('--checkpoint', type=Path, required=True)
parser.add_argument('--training-manifest', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
sys.path.insert(0, str(args.research_dir.resolve()))
from models.mobile_unet import MobileUNet
data = json.loads(args.input.read_text())['cases']
if not data:
    parser.error('No detected hand images to compare; missing evidence is not zero error.')
by_file = {p['file']: p for p in json.loads(args.poses.read_text())}
poses = [by_file[c['file']] for c in data]
checkpoint = args.checkpoint
p = torch.load(checkpoint, map_location='cpu', weights_only=True)
model = MobileUNet()
model.load_state_dict(p['model_state'])
model.eval()
torch.set_num_threads(2)
rows = []
timings = []
with torch.inference_mode():
    model(torch.zeros(5, 3, 192, 192))
    for case, pose in zip(data, poses):
        w, h = (case['width'], case['height'])
        im = Image.frombytes('RGBA', (w, h), base64.b64decode(case['pixels'])).convert('RGB')
        gt = Image.frombytes('L', (w, h), base64.b64decode(case['mask']))
        batch = []
        meta = []
        for f, n in enumerate(pose['coarse']):
            a = np.deg2rad(n['rotation'] - 90)
            ax, ay = (np.cos(a), np.sin(a))
            nw = n['width'] / 100 * w
            nh = n['height'] / 100 * h
            x = n['x'] / 100 * w + ax * nh / 2
            y = n['y'] / 100 * h + ay * nh / 2
            cw = (abs(ay) * nw + abs(ax) * nh) * 2.8
            ch = (abs(ax) * nw + abs(ay) * nh) * 2.8
            box = (max(0, int(x - cw / 2)), max(0, int(y - ch / 2)), min(w, int(x + cw / 2) + 1), min(h, int(y + ch / 2) + 1))
            if box[2] <= box[0] or box[3] <= box[1]:
                raise ValueError(f"Off-frame ROI in {case['file']}, finger {f}; no valid model comparison")
            crop = im.crop(box).resize((192, 192), Image.Resampling.BILINEAR)
            batch.append(torch.from_numpy(np.array(crop, dtype=np.float32).transpose(2, 0, 1) / 255))
            meta.append(box)
        t = time.perf_counter()
        probs = torch.sigmoid(model(torch.stack(batch))['mask'])[:, 0].numpy()
        timings.append((time.perf_counter() - t) * 1000)
        for f, (box, prob, n) in enumerate(zip(meta, probs, pose['nails'])):
            target = np.asarray(gt.crop(box).resize((192, 192), Image.Resampling.NEAREST)) > 0
            yy, xx = np.mgrid[:192, :192]
            xx = box[0] + (xx + 0.5) * (box[2] - box[0]) / 192
            yy = box[1] + (yy + 0.5) * (box[3] - box[1]) / 192
            angle = np.deg2rad(n['rotation'] - 90)
            dx = xx - n['x'] / 100 * w
            dy = yy - n['y'] / 100 * h
            nw = n['width'] / 100 * w
            nh = n['height'] / 100 * h
            ellipse = ((-np.sin(angle) * dx + np.cos(angle) * dy) / (nw / 2)) ** 2 + ((np.cos(angle) * dx + np.sin(angle) * dy - nh / 2) / (nh / 2)) ** 2 <= 1
            predicted = prob > p['best_threshold']
            iou = lambda m: float(np.count_nonzero(m & target) / max(1, np.count_nonzero(m | target)))
            if target.sum() < 8:
                continue
            rows.append(dict(file=case['file'], finger=f, pixelEllipseROIiOU=iou(ellipse), modelROIiOU=iou(predicted)))
if not rows:
    parser.error('No labelled ROI has enough pixels for a comparison.')
report = dict(modelSizeBytes=checkpoint.stat().st_size, sha256=hashlib.sha256(checkpoint.read_bytes()).hexdigest(), checkpointMetrics={k: v for k, v in p.items() if not isinstance(v, dict)}, images=len(data), evaluatedROIs=len(rows), beforeMeanROIiOU=float(np.mean([r['pixelEllipseROIiOU'] for r in rows])), modelMeanROIiOU=float(np.mean([r['modelROIiOU'] for r in rows])), cpuBatch5MedianMs=float(np.median(timings)), cpuBatch5P95Ms=float(np.percentile(timings, 95)), rows=rows)
report['methodology'] = 'Landmark-prior-only axis-aligned crops, 192px, threshold from checkpoint. ROI semantic mask IoU includes every labelled nail in the crop; heuristic uses a nail ellipse. This is not an end-to-end alignment or independent accuracy benchmark. CPU forward plus sigmoid timing, batch of five, two threads, excludes preprocessing. No model is deployed.'
report['torchVersion'] = torch.__version__
report['parameters'] = sum((p.numel() for p in model.parameters()))
report['modelRedistributionLicense'] = 'Not established by checkpoint metadata; source dataset notices alone do not establish model provenance.'
if args.training_manifest:
    manifest = list(csv.DictReader(args.training_manifest.open(encoding='utf-8-sig')))
    normalize = lambda name: Path(name).stem.split('_jpg.rf.')[0].lower().replace('-', '')
    train = {normalize(r['source_file']) for r in manifest if r['split'] == 'train'}
    validation = {normalize(r['source_file']) for r in manifest if r['split'] == 'val'}
    report['trainingOverlap'] = {'trainImages': sum((normalize(c['file']) in train for c in data)), 'validationImages': sum((normalize(c['file']) in validation for c in data)), 'unseenImages': sum((normalize(c['file']) not in train | validation for c in data)), 'rule': 'basename, remove RF suffix and hyphens; approximate source identity, not person-level split'}
args.output.write_text(json.dumps(report, indent=2) + '\n')
print({k: v for k, v in report.items() if k != 'rows'})
