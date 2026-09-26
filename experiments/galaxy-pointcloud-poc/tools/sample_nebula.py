from pathlib import Path
import argparse
import json
from common import load_image, sample_nebula

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path("nebula.bin"))
parser.add_argument("--count", type=int, default=80000)
parser.add_argument("--thickness", type=float, default=5.0)
args = parser.parse_args()
rgb, width, height = load_image(args.source)
points = sample_nebula(rgb, count=args.count, thickness=args.thickness)
args.output.parent.mkdir(parents=True, exist_ok=True)
points.astype("<f4").tofile(args.output)
print(json.dumps({"count": len(points), "stride": 10, "width": width, "height": height, "thickness": args.thickness}, indent=2))
