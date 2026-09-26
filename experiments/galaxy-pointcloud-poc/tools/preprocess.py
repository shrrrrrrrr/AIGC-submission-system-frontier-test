from pathlib import Path
import argparse
import json
from PIL import Image
from common import load_image, detect_stars, sample_nebula, WORLD_WIDTH, SEED

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, default=ROOT / "public/galaxy/source.png")
parser.add_argument("--stars", type=int, default=6000)
parser.add_argument("--nebula", type=int, default=80000)
parser.add_argument("--thickness", type=float, default=5.0)
args = parser.parse_args()
out = ROOT / "public/galaxy"
out.mkdir(parents=True, exist_ok=True)
rgb, width, height = load_image(args.source)
stars = detect_stars(rgb, max_stars=args.stars, seed=SEED)
nebula = sample_nebula(rgb, count=args.nebula, thickness=args.thickness, seed=SEED)
stars.astype("<f4").tofile(out / "stars.bin")
nebula.astype("<f4").tofile(out / "nebula.bin")
Image.fromarray((rgb * 255).astype("uint8")).save(out / "residual.webp", "WEBP", quality=86, method=6)
metadata = {
    "source": {"file": "source.png", "width": width, "height": height, "aspect": width / height},
    "world": {"width": WORLD_WIDTH, "height": WORLD_WIDTH * height / width},
    "seed": SEED,
    "stars": {"file": "stars.bin", "count": len(stars), "stride": 8, "fields": ["x","y","z","size","r","g","b","emissive"]},
    "nebula": {"file": "nebula.bin", "count": len(nebula), "stride": 10, "fields": ["x","y","z","size","r","g","b","alpha","density","seed"], "thickness": args.thickness},
    "residual": {"file": "residual.webp"}
}
(out / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
print(json.dumps(metadata, indent=2))
