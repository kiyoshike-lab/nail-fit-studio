"""Offline, deterministic single-nail extraction. Never samples random photo patches.

Inputs are reviewed polygons in EXIF-oriented coordinates and verified Commons
originals. Pillow/numpy are authoring tools, not production dependencies.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageFilter, PngImagePlugin


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def build(args):
    repo = Path(__file__).resolve().parents[1]
    labels = json.loads((repo / 'docs/preset-source-polygons-v2.json').read_text(encoding='utf-8'))
    metadata = json.loads(args.metadata.read_text(encoding='utf-8'))
    sources = {s['datasetFileId']: s for s in metadata['sources'] if s['status'] == 'accepted'}
    out = args.out.resolve()
    public = (repo / 'public').resolve()
    if out.is_relative_to(public) and not args.publish_reviewed:
        raise ValueError('Review candidates outside public before publishing')
    result = []
    for ident, a in labels['annotations'].items():
        s = sources[a['sourceId']]
        path = (args.source_dir / Path(s['localPath']).name) if args.source_dir else Path(s['localPath'])
        if sha(path) != s['sha256'] or not s['officialSha1Matched']:
            raise ValueError('Original bytes do not match verified metadata')
        im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        rw, rh = a['referenceSize']
        if abs(im.width / im.height - rw / rh) > .004:
            raise ValueError(f'Orientation/aspect mismatch {ident}')
        sx, sy = im.width / rw, im.height / rh
        poly = [(round(x*sx), round(y*sy)) for x, y in a['polygon']]
        mask = Image.new('L', im.size)
        ImageDraw.Draw(mask).polygon(poly, fill=255)
        # Remove boundary antialias/skin, at native resolution, before rotation.
        mask = mask.filter(ImageFilter.MinFilter(3))
        crop = Image.new('RGBA', im.size)
        crop.paste(im, mask=mask)
        crop = crop.crop(mask.getbbox())
        dx, dy = (a['tip'][0]-a['root'][0])*sx, (a['tip'][1]-a['root'][1])*sy
        crop = crop.rotate(math.degrees(math.atan2(dy, dx))+90,
                           expand=True, resample=Image.Resampling.BICUBIC)
        crop = crop.crop(crop.getbbox())
        pixels = np.asarray(crop)
        widths = (pixels[:, :, 3] >= 254).sum(axis=1)
        valid = np.flatnonzero(widths >= max(8, widths.max()*.42))
        if len(valid) < 24 or widths.max() < 24:
            raise ValueError(f'Too little nail detail: {ident}')
        top, bottom = int(valid[0]), int(valid[-1])
        w, h = min(384, int(widths.max())), min(768, bottom-top+1)
        surface = np.zeros((h, w, 3), dtype=np.uint8)
        rows = []
        # One monotonic scanline per v: contiguous nail pixels, never a tile grid.
        # Nearest native samples stay inside the mask; browser smoothing is enabled.
        for y, source_y in enumerate(np.linspace(top, bottom, h).round().astype(int)):
            xs = np.flatnonzero(pixels[source_y, :, 3] >= 254)
            # Require a single contiguous interior; no holes or background jumps.
            groups = np.split(xs, np.where(np.diff(xs) > 1)[0]+1)
            xs = max(groups, key=len)
            if len(xs) < 4:
                raise ValueError(f'Discontinuous nail polygon {ident}')
            cols = np.linspace(xs[0], xs[-1], w).round().astype(int)
            surface[y] = pixels[source_y, cols, :3]
            rows.append([int(source_y), int(xs[0]), int(xs[-1])])
        changes = ('Single nail polygon cutout; EXIF orientation; tip-up rotation; '
                   'inward boundary trim; continuous row-wise surface unwrap; '
                   'PNG conversion; no generative reconstruction or random patches.')
        info = PngImagePlugin.PngInfo()
        for k, v in {'Author':s['authors'], 'Source':s['canonicalFilePage'],
                     'License':s['license']['url'], 'Changes':changes}.items():
            info.add_text(k, v)
        tex = out / 'preset-textures' / f'nail_texture_{ident}_v2.png'
        cut = out / 'preset-cutouts' / f'nail_{ident}_v2.png'
        preview = out / 'preset-previews' / f'nail_{ident}_v2.png'
        for p in (tex, cut, preview): p.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(surface).save(tex, pnginfo=info, optimize=True)
        crop.save(cut, pnginfo=info, optimize=True)
        # Contain the real, tip-up nail rather than cropping the entire hand photo.
        thumb = crop.copy(); thumb.thumbnail((160, 196), Image.Resampling.LANCZOS)
        card = Image.new('RGBA', (180, 220), '#fff9fb')
        card.alpha_composite(thumb, ((180-thumb.width)//2, (220-thumb.height)//2))
        card.convert('RGB').save(preview, pnginfo=info, optimize=True)
        # Old bookmarked preview paths stay valid, without shipping the old
        # whole-photo/unknown-source previews. Preserve their actual JPEG format.
        exif = Image.Exif(); exif[315] = s['authors']; exif[33432] = s['license']['url']
        exif[270] = s['canonicalFilePage'] + ' | ' + changes
        card.convert('RGB').save(preview.with_name(f'design_{ident}.jpg'), quality=95,
                                 subsampling=0, exif=exif)
        alias = tex.with_name(f'texture_{ident}.png')
        alias.write_bytes(tex.read_bytes())
        # Both Next/image and browsers may cache optimized images across builds.
        # New photo bytes must produce a new URL, not just a new name/version flag.
        fingerprint_tex = tex.with_name(f'nail_texture_{ident}_v2_{sha(tex)[:12]}.png')
        fingerprint_preview = preview.with_name(f'nail_{ident}_v2_{sha(preview)[:12]}.png')
        fingerprint_tex.write_bytes(tex.read_bytes()); fingerprint_preview.write_bytes(preview.read_bytes())
        result.append(dict(id=ident, name=a['name'], sourceId=a['sourceId'],
            sourceUrl=s['canonicalFilePage'], originalUrl=s['originalImageUrl'],
            author=s['authors'], license=s['license']['name'], licenseUrl=s['license']['url'],
            sourceSha256=s['sha256'], sourceSize=list(im.size), cutoutSize=list(crop.size),
            surfaceSize=[w,h], sourceRows=len(rows), sampledPixelsInsideMask=True,
            texture=f'assets/preset-textures/{fingerprint_tex.name}', preview=f'assets/preset-previews/{fingerprint_preview.name}',
            cutout=f'assets/preset-cutouts/{cut.name}', textureSha256=sha(tex),
            cutoutSha256=sha(cut), previewSha256=sha(preview),
            reselectReason=a.get('reason'), changes=changes,
            derivativeLicense=s['license']['name'], reviewStatus='reviewed' if args.publish_reviewed else 'candidate'))
    manifest = dict(schema=2, generated='2026-11-07',
                    method='reviewed-single-nail-continuous-unwrap', materials=result)
    (out / 'preset-materials-v2.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    # Six full-photo paths are also the unchanged home-page reference photos,
    # not try-on textures. Keep those photographs at useful display resolution.
    # Never replace them with enlarged 180px nail cards.
    reference_photos = []
    for ident in ['001','005','007','016','024','025']:
        s = sources[ident]
        source_path=(args.source_dir / Path(s['localPath']).name) if args.source_dir else Path(s['localPath'])
        im = ImageOps.exif_transpose(Image.open(source_path)).convert('RGB')
        im.thumbnail((960,960), Image.Resampling.LANCZOS)
        changes = 'EXIF orientation; resized within 960px; JPEG quality 92. Whole reference photo, not a try-on surface.'
        exif=Image.Exif();exif[315]=s['authors'];exif[33432]=s['license']['url'];exif[270]=s['canonicalFilePage']+' | '+changes
        filename=f'preset-previews/design_{ident}.jpg'
        im.save(out/filename,quality=92,subsampling=0,exif=exif)
        full = out/filename; fingerprint_full=full.with_name(f'reference_{ident}_{sha(full)[:12]}.jpg');fingerprint_full.write_bytes(full.read_bytes())
        reference_photos.append(dict(id=ident,file='assets/preset-previews/'+fingerprint_full.name,author=s['authors'],sourceUrl=s['canonicalFilePage'],license=s['license']['name'],licenseUrl=s['license']['url'],changes=changes))
    manifest['referencePhotos'] = reference_photos
    (out / 'preset-materials-v2.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    if args.publish_reviewed:
        # A small typed map keeps runtime alias resolution independent of an
        # extra network request, including offline saved designs and old schemas.
        generated = '// Generated by scripts/build-preset-surfaces.py; do not edit by hand.\n'
        generated += 'export const presetTextureUrls: Readonly<Record<string, string>> = '+json.dumps({e['id']:'/'+e['texture'] for e in result},indent=2)+';\n'
        generated += 'export const presetReferencePhotoUrls: Readonly<Record<string, string>> = '+json.dumps({e['id']:'/'+e['file'] for e in reference_photos},indent=2)+';\n'
        presets_path = repo / 'public/assets/design-presets.json'
        payload = json.loads(presets_path.read_text(encoding='utf-8'))
        by_id = {e['id']: e for e in result}
        for preset in payload['presets']:
            # real_ IDs skip missing files and include extra variants: never
            # assume real_014 is design_014. File identity is the stable key.
            ident = re.search(r'design_(\d{3})\.', preset['exampleImage']).group(1)
            e = by_id[ident]
            mean = np.asarray(Image.open(out/e['texture'].removeprefix('assets/'))).mean(axis=(0,1))
            color_hint = '#%02x%02x%02x' % tuple(int(round(v)) for v in mean[:3])
            preset.update(name=e['name']+' / '+preset['id'], textureImage=e['texture'],
                          previewImage=e['preview'], genre=e['name'], material='cream',
                          pattern='patterned', finish='gloss', motif='none', proRecommended=False,
                          colorHint=color_hint,
                          **{k:e[k] for k in ['author','sourceUrl','license','licenseUrl','changes']})
        presets_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        fingerprint_manifest=presets_path.with_name(f'design-presets_v2_{sha(presets_path)[:12]}.json')
        fingerprint_manifest.write_bytes(presets_path.read_bytes())
        generated += 'export const presetManifestUrl = "/assets/'+fingerprint_manifest.name+'";\n'
        (repo/'src/lib/presetTextureMap.ts').write_text(generated,encoding='utf-8')
    # QA only: native crops and surfaces side by side, never part of preset output.
    if not out.is_relative_to(public):
        atlas = Image.new('RGB', (8*180, math.ceil(len(result)/8)*270), 'white')
        draw = ImageDraw.Draw(atlas)
        for i, e in enumerate(result):
            x,y = i%8*180, i//8*270
            atlas.paste(Image.open(out / e['preview'].removeprefix('assets/')), (x,y))
            draw.text((x+4,y+223), f"{e['id']} <- {e['sourceId']}  {e['surfaceSize']}", fill='black')
        atlas.save(out/'cutout-atlas.jpg')
    print(json.dumps({'materials':len(result),'minWidth':min(e['surfaceSize'][0] for e in result),
                      'out':str(out)}, ensure_ascii=True))


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--metadata',type=Path,required=True)
    p.add_argument('--source-dir',type=Path,help='Directory of unmodified verified originals (optional local-path override)')
    p.add_argument('--out',type=Path,required=True);p.add_argument('--publish-reviewed',action='store_true')
    build(p.parse_args())
