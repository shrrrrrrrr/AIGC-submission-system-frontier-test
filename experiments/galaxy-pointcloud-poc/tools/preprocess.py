from pathlib import Path
import argparse
import csv
import hashlib
import json
from PIL import Image
from common import load_image, detect_stars, sample_star_layer, sample_nebula_layer, sample_foreground_dust, star_measurements, WORLD_WIDTH, REFERENCE_Z, CAMERA_Z, SEED

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description='Deterministic image-derived galaxy volume preprocessing.')
    parser.add_argument('--source', type=Path, default=ROOT/'public/galaxy/source.png')
    parser.add_argument('--output', type=Path, default=None)
    parser.add_argument('--asset-id', type=str, default='galaxy-a')
    parser.add_argument('--config-file', type=Path, default=None)
    parser.add_argument('--stars', type=int, default=6000)
    parser.add_argument('--medium-stars', type=int, default=24000)
    parser.add_argument('--dust-stars', type=int, default=60000)
    parser.add_argument('--front', type=int, default=18000)
    parser.add_argument('--mid', type=int, default=65000)
    parser.add_argument('--back', type=int, default=22000)
    parser.add_argument('--thickness', type=float, default=5)
    parser.add_argument('--foreground', type=int, default=7000)
    args = parser.parse_args()
    out = args.output if args.output else ROOT/'public/galaxy'; out.mkdir(parents=True, exist_ok=True)
    config = {}
    if args.config_file and args.config_file.exists():
        config = json.loads(args.config_file.read_text(encoding='utf-8'))
    rgb, width, height = load_image(args.source)
    stars = detect_stars(rgb, args.stars)
    star_layers = {'bright': stars, 'medium': sample_star_layer(rgb, args.medium_stars, 'medium'), 'dust': sample_star_layer(rgb, args.dust_stars, 'dust')}
    nebula_layers = {'front': sample_nebula_layer(rgb, args.front, 'front', args.thickness), 'mid': sample_nebula_layer(rgb, args.mid, 'mid', args.thickness), 'back': sample_nebula_layer(rgb, args.back, 'back', args.thickness)}
    foreground = sample_foreground_dust(rgb, args.foreground)
    for layer, data in {**star_layers, **nebula_layers}.items():
        data.tofile(out/f'{"stars" if layer in star_layers else "nebula"}-{layer}.bin')
    npacked = __import__('numpy').vstack(list(nebula_layers.values()))
    npacked.tofile(out/'nebula.bin')
    foreground.tofile(out/'foreground-dust.bin')
    Image.open(args.source).convert('RGB').save(out/'residual.webp', 'WEBP', lossless=True, method=6)
    xs, ys, radius, lum, contrast, emissive = star_measurements(rgb, args.stars)
    with (out/'star-catalog.csv').open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f); writer.writerow(['imageX','imageY','r','g','b','luminance','estimatedRadiusPixels','localContrast','emissive'])
        for i, (x, y) in enumerate(zip(xs, ys)):
            writer.writerow([int(x), int(y), *[round(float(v), 6) for v in (*rgb[y, x], lum[i], radius[i], contrast[i], emissive[i])]])
    def asset_info(file, count, stride, fields):
        p = out/file
        return {'file': file, 'count': count, 'stride': stride, 'fields': fields, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    metadata = {
      'assetId': args.asset_id, 'formatVersion': 3, 'byteOrder': 'little-endian', 'componentType': 'float32', 'colorSpace': 'linear-srgb', 'seed': SEED,
      'source': {'file':'source.png','width':width,'height':height,'aspect':width/height,'sha256':hashlib.sha256(args.source.read_bytes()).hexdigest()},
      'world': {'width':WORLD_WIDTH,'height':WORLD_WIDTH*height/width,'referenceZ':REFERENCE_Z,'referenceCameraZ':CAMERA_Z},
      'stars': {'layers': {k: asset_info(f'stars-{k}.bin', len(v), 8, ['x','y','z','size','r','g','b','emissive']) for k,v in star_layers.items()}, 'count': sum(len(v) for v in star_layers.values())},
      'nebula': {'layers': {k: asset_info(f'nebula-{k}.bin', len(v), 10, ['x','y','z','size','r','g','b','alpha','density','seed']) for k,v in nebula_layers.items()}, 'file':'nebula.bin','count':len(npacked),'stride':10,'thickness':args.thickness},
      'foreground': asset_info('foreground-dust.bin', len(foreground), 8, ['x','y','z','size','r','g','b','alpha']),
      'residual': {'file':'residual.webp','lossless':True}, 'config': config, 'depthNote':'Artistic single-image reconstruction, not recovered astronomical distances.'
    }
    (out/'metadata.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(metadata, indent=2))

if __name__ == '__main__': main()
