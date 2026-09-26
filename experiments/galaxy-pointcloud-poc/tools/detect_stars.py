from pathlib import Path
import argparse
import json
import numpy as np
from common import load_image, detect_stars

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path("stars.bin"))
parser.add_argument("--max-stars", type=int, default=6000)
args = parser.parse_args()
rgb, width, height = load_image(args.source)
stars = detect_stars(rgb, max_stars=args.max_stars)
args.output.parent.mkdir(parents=True, exist_ok=True)
stars.astype("<f4").tofile(args.output)
print(json.dumps({"count": len(stars), "stride": 8, "width": width, "height": height}, indent=2))
