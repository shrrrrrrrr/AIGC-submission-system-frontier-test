from __future__ import annotations

from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, maximum_filter


WORLD_WIDTH = 26.0
WORLD_HEIGHT = 0.0
SEED = 20260927


def load_image(path: Path) -> tuple[np.ndarray, int, int]:
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32) / 255.0
    height, width = rgb.shape[:2]
    return rgb, width, height


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def robust_normalize(values: np.ndarray) -> np.ndarray:
    low, high = np.percentile(values, (2.0, 98.0))
    return np.clip((values - low) / max(1e-6, high - low), 0.0, 1.0)


def image_to_world(xs, ys, width: int, height: int, world_width: float = WORLD_WIDTH):
    world_height = world_width * height / width
    x = (xs / max(1, width - 1) - 0.5) * world_width
    y = (0.5 - ys / max(1, height - 1)) * world_height
    return x, y, world_height


def analyze_structure(rgb: np.ndarray) -> dict[str, np.ndarray]:
    lum = luminance(rgb)
    large = gaussian_filter(lum, sigma=18.0)
    medium = gaussian_filter(lum, sigma=6.0)
    contrast = np.clip(medium - large, 0.0, None)
    chroma = np.max(rgb, axis=2) - np.min(rgb, axis=2)
    return {
        "lum": lum,
        "large": robust_normalize(large),
        "medium": robust_normalize(medium),
        "contrast": robust_normalize(contrast),
        "chroma": robust_normalize(chroma),
    }


def detect_stars(rgb: np.ndarray, max_stars: int = 6000, seed: int = SEED) -> np.ndarray:
    lum = luminance(rgb)
    smooth = gaussian_filter(lum, sigma=2.2)
    highpass = np.clip(lum - smooth, 0.0, None)
    median = np.median(highpass)
    mad = np.median(np.abs(highpass - median)) / 0.6745
    threshold = max(0.035, float(np.percentile(highpass, 99.15)), float(median + 5.0 * mad))
    peaks = (highpass >= threshold) & (maximum_filter(highpass, size=5, mode="nearest") == highpass)
    ys, xs = np.nonzero(peaks)
    if len(xs) == 0:
        raise RuntimeError("star detector found no peaks")
    scores = highpass[ys, xs] * 0.7 + lum[ys, xs] * 0.3
    order = np.argsort(scores)[::-1][:max_stars]
    xs, ys, scores = xs[order], ys[order], scores[order]
    height, width = lum.shape
    x, y, world_height = image_to_world(xs.astype(np.float32), ys.astype(np.float32), width, height)
    rng = np.random.default_rng(seed)
    normalized = np.clip((scores - threshold) / max(1e-6, scores.max() - threshold), 0.0, 1.0)
    radius = np.clip(0.025 + normalized * 0.15 + rng.random(len(xs)) * 0.018, 0.02, 0.22)
    brightness = np.clip(lum[ys, xs] * 0.8 + normalized * 0.7, 0.0, 1.0)
    # Brightness and radius are weak priors only; jitter keeps this artistic, not astronomical.
    z = -9.0 - rng.random(len(xs)) * 52.0 - brightness * 3.0 - radius * 2.0
    z += rng.normal(0.0, 1.1, len(xs))
    output = np.empty((len(xs), 8), dtype=np.float32)
    output[:, 0:3] = np.column_stack((x, y, z))
    output[:, 3] = radius
    output[:, 4:7] = rgb[ys, xs]
    output[:, 7] = np.clip(0.2 + normalized * 0.8, 0.0, 1.0)
    return output


def sample_nebula(
    rgb: np.ndarray,
    count: int = 80000,
    thickness: float = 5.0,
    seed: int = SEED,
) -> np.ndarray:
    structure = analyze_structure(rgb)
    density = (
        structure["large"] * 0.58
        + structure["medium"] * 0.20
        + structure["contrast"] * 0.12
        + structure["chroma"] * 0.10
    )
    density = np.clip(density, 0.0, 1.0)
    weights = 0.008 + np.power(density, 1.65)
    probabilities = (weights / weights.sum()).reshape(-1)
    rng = np.random.default_rng(seed)
    height, width = density.shape
    indexes = rng.choice(width * height, size=count, replace=True, p=probabilities)
    ys, xs = np.divmod(indexes, width)
    x, y, _ = image_to_world(xs.astype(np.float32), ys.astype(np.float32), width, height)
    d = density[ys, xs]
    # A thick ribbon follows the image's low-frequency structure rather than becoming a sphere.
    base_z = -18.0 - d * 7.0
    z_jitter = rng.normal(0.0, thickness * (0.18 + d * 0.45), count)
    z = base_z + z_jitter
    size = 0.018 + rng.power(2.4, count) * (0.07 + d * 0.11)
    alpha = np.clip(0.035 + d * 0.30, 0.025, 0.34)
    output = np.empty((count, 10), dtype=np.float32)
    output[:, 0:3] = np.column_stack((x, y, z))
    output[:, 3] = size
    output[:, 4:7] = rgb[ys, xs]
    output[:, 7] = alpha
    output[:, 8] = d
    output[:, 9] = rng.random(count)
    return output
