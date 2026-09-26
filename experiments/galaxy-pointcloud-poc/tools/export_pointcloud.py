from pathlib import Path
import argparse
import json
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--stars", type=Path, required=True)
parser.add_argument("--nebula", type=Path, required=True)
parser.add_argument("--metadata", type=Path, required=True)
args = parser.parse_args()
meta = json.loads(args.metadata.read_text(encoding="utf-8"))
for name, path, stride in [("stars", args.stars, 8), ("nebula", args.nebula, 10)]:
    data = np.fromfile(path, dtype="<f4")
    meta[name]["bytes"] = int(data.nbytes)
    meta[name]["stride"] = stride
args.metadata.write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(json.dumps(meta, indent=2))
