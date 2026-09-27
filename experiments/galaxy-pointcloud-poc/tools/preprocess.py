from pathlib import Path
import argparse
import csv
import hashlib
import json
from PIL import Image
from common import load_image, detect_stars, star_measurements, sample_nebula, WORLD_WIDTH, SEED

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description='Single-image artistic 2.5D reconstruction; deterministic offline preprocessing.')
    parser.add_argument('--source', type=Path, default=ROOT/'public/galaxy/source.png')
    parser.add_argument('--stars', type=int, default=6000)
    parser.add_argument('--nebula', type=int, default=100000)
    parser.add_argument('--thickness', type=float, default=5)
    args = parser.parse_args()
    if args.stars < 1:
        parser.error('--stars must be positive')
    out = ROOT/'public/galaxy'
    out.mkdir(parents=True, exist_ok=True)
    rgb, width, height = load_image(args.source)
    stars = detect_stars(rgb, args.stars)
    nebula = sample_nebula(rgb, args.nebula, args.thickness)
    stars.tofile(out/'stars.bin')
    nebula.tofile(out/'nebula.bin')
    xs, ys, radius, lum, contrast, emissive = star_measurements(rgb, args.stars)
    with (out/'star-catalog.csv').open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['imageX','imageY','r','g','b','luminance','estimatedRadiusPixels','localContrast','emissive'])
        for i, (x,y) in enumerate(zip(xs,ys)):
            writer.writerow([int(x),int(y),*[round(float(v),6) for v in (*rgb[y,x],lum[i],radius[i],contrast[i],emissive[i])]])
    Image.open(args.source).convert('RGB').save(out/'residual.webp', 'WEBP', lossless=True, method=6)
    metadata = {
        'formatVersion':2, 'byteOrder':'little-endian', 'componentType':'float32', 'colorSpace':'linear-srgb',
        'source':{'file':'source.png','width':width,'height':height,'aspect':width/height,'sha256':hashlib.sha256(args.source.read_bytes()).hexdigest()},
        'world':{'width':WORLD_WIDTH,'height':WORLD_WIDTH*height/width,'referenceZ':-22,'referenceCameraZ':28},
        'seed':SEED,
        'stars':{'file':'stars.bin','count':len(stars),'stride':8,'fields':['x','y','z','size','r','g','b','emissive'],'catalog':'star-catalog.csv'},
        'nebula':{'file':'nebula.bin','count':len(nebula),'stride':10,'fields':['x','y','z','size','r','g','b','alpha','density','seed'],'thickness':args.thickness},
        'residual':{'file':'residual.webp','lossless':True},
        'depthNote':'Artistic single-image reconstruction, not recovered astronomical distances.'
    }
    for key in ('stars','nebula'):
        asset = out/metadata[key]['file']
        metadata[key]['bytes']=asset.stat().st_size
        metadata[key]['sha256']=hashlib.sha256(asset.read_bytes()).hexdigest()
    (out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(metadata,indent=2))

if __name__ == '__main__':
    main()
