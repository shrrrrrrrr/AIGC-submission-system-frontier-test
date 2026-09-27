from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, maximum_filter, median_filter, map_coordinates

WORLD_WIDTH = 26.0
REFERENCE_Z = -22.0
CAMERA_Z = 28.0
SEED = 20260927


def load_image(path: Path):
    rgb = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255
    h, w = rgb.shape[:2]
    return rgb, w, h


def luminance(rgb):
    return rgb[..., 0] * .2126 + rgb[..., 1] * .7152 + rgb[..., 2] * .0722


def linear_rgb(rgb):
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)


def robust_normalize(values):
    low, high = np.percentile(values, (2, 98))
    return np.clip((values - low) / max(1e-6, high - low), 0, 1)


def image_to_world(xs, ys, width, height, z=None):
    world_height = WORLD_WIDTH * height / width
    x = ((xs + .5) / width - .5) * WORLD_WIDTH
    y = (.5 - (ys + .5) / height) * world_height
    if z is not None:
        scale = (CAMERA_Z - z) / (CAMERA_Z - REFERENCE_Z)
        x, y = x * scale, y * scale
    return x, y, world_height


def analyze_structure(rgb):
    # Median filtering removes isolated stars from the continuous nebula field.
    starless = gaussian_filter(median_filter(rgb, size=(3, 3, 1)), sigma=(1, 1, 0))
    lum = luminance(starless)
    large = gaussian_filter(lum, 18)
    medium = gaussian_filter(lum, 5)
    contrast = np.abs(medium - large)
    chroma = starless.max(axis=2) - starless.min(axis=2)
    density = np.clip(.55 * robust_normalize(large) + .30 * robust_normalize(medium) + .10 * robust_normalize(contrast) + .05 * robust_normalize(chroma), 0, 1)
    return starless, density


def star_measurements(rgb, max_stars=6000):
    lum = luminance(rgb)
    highpass = np.maximum(0, lum - gaussian_filter(lum, 2.2))
    median = np.median(highpass)
    mad = np.median(np.abs(highpass - median)) / .6745
    threshold = max(.035, float(np.percentile(highpass, 99.15)), float(median + 5 * mad))
    peaks = (highpass >= threshold) & (maximum_filter(highpass, size=5) == highpass)
    ys, xs = np.nonzero(peaks)
    if not len(xs):
        raise ValueError('No detectable stars in input image')
    score = highpass[ys, xs] * .7 + lum[ys, xs] * .3
    order = np.argsort(-score, kind='stable')[:max_stars]
    xs, ys = xs[order], ys[order]
    radius = np.empty(len(xs))
    for i, (x, y) in enumerate(zip(xs, ys)):
        y0, y1, x0, x1 = max(0, y-3), min(lum.shape[0], y+4), max(0, x-3), min(lum.shape[1], x+4)
        patch = highpass[y0:y1, x0:x1]
        yy, xx = np.mgrid[y0:y1, x0:x1]
        weight = np.maximum(0, patch - highpass[y, x] * .35)
        radius[i] = np.clip(np.sqrt(np.sum(weight * ((xx-x)**2 + (yy-y)**2)) / max(1e-8, weight.sum())), .55, 2.4)
    contrast = highpass[ys, xs]
    normalized = np.clip((contrast - threshold) / max(1e-6, contrast.max() - threshold), 0, 1)
    emissive = .7 + normalized * 2.8
    return xs, ys, radius, lum[ys, xs], contrast, emissive


def detect_stars(rgb, max_stars=6000, seed=SEED):
    xs, ys, radius, lum, contrast, emissive = star_measurements(rgb, max_stars)
    rng = np.random.default_rng(seed)
    z = -12 - rng.random(len(xs)) ** .45 * 50 + lum * 5 + radius * .6
    z = np.clip(z + rng.normal(0, 1, len(xs)), -64, -8)
    h, w = rgb.shape[:2]
    x, y, _ = image_to_world(xs, ys, w, h, z)
    size = (1.2 + radius * 1.6) * WORLD_WIDTH / w * (CAMERA_Z-z)/50
    return np.column_stack((x, y, z, size, linear_rgb(rgb[ys, xs]), emissive)).astype('<f4')


def sample_star_layer(rgb, count, layer, seed=SEED):
    _, density = analyze_structure(rgb)
    lum = robust_normalize(luminance(rgb))
    h, w = density.shape
    if layer == 'medium':
        weights = .015 + density ** 1.35
        z = -20 - np.random.default_rng(seed).random(count) ** .65 * 26
        size_base, emissive_base = .55, .10
    else:
        weights = .025 + density * .45 + lum * .12
        z = -50 - np.random.default_rng(seed).random(count) ** .7 * 42
        size_base, emissive_base = .24, .025
    rng = np.random.default_rng(seed + 9)
    indexes = rng.choice(w * h, count, replace=True, p=(weights / weights.sum()).ravel())
    iy, ix = np.divmod(indexes, w)
    xs = np.clip(ix + rng.uniform(-.5, .5, count), 0, w-1)
    ys = np.clip(iy + rng.uniform(-.5, .5, count), 0, h-1)
    d = map_coordinates(density, [ys, xs], order=1)
    brightness = map_coordinates(lum, [ys, xs], order=1)
    z += rng.normal(0, 1.2 if layer == 'medium' else 2.4, count)
    x, y, _ = image_to_world(xs, ys, w, h, z)
    size = (size_base + rng.random(count) * size_base * .8 + d * size_base * .8) * WORLD_WIDTH / w * (CAMERA_Z-z)/50
    colors = rgb[iy, ix]
    emissive = np.clip(emissive_base + brightness * (.18 if layer == 'medium' else .045) + d * (.08 if layer == 'medium' else .02), .01, .34)
    return np.column_stack((x, y, z, size, linear_rgb(colors), emissive)).astype('<f4')


def sample_nebula_layer(rgb, count, layer, thickness=5.0, seed=SEED):
    color_field, density = analyze_structure(rgb)
    h, w = density.shape
    weights = .06 + density ** 1.25
    rng = np.random.default_rng(seed + {'front': 1, 'mid': 2, 'back': 3}[layer])
    indexes = rng.choice(w * h, count, replace=True, p=(weights / weights.sum()).ravel())
    iy, ix = np.divmod(indexes, w)
    xs = np.clip(ix + rng.uniform(-.5, .5, count), 0, w-1)
    ys = np.clip(iy + rng.uniform(-.5, .5, count), 0, h-1)
    d = map_coordinates(density, [ys, xs], order=1)
    if layer == 'front':
        base = -7 - d * 7
        spread, size_base = .20, .34
    elif layer == 'mid':
        base = -22 - d * 20
        spread, size_base = .48, .24
    else:
        base = -53 - d * 32
        spread, size_base = .72, .13
    low_noise = robust_normalize(gaussian_filter(rng.normal(size=(h, w)), 26)) - .5
    fine_noise = robust_normalize(gaussian_filter(rng.normal(size=(h, w)), 7)) - .5
    ribbon = base + map_coordinates(low_noise * 2 + fine_noise * .7, [ys, xs], order=1)
    z = ribbon + np.clip(rng.normal(size=count), -2.5, 2.5) * thickness * spread * (.25 + .45 * d)
    x, y, _ = image_to_world(xs, ys, w, h, z)
    size = (size_base + rng.random(count) * size_base * .8 + d * size_base * .7) * (CAMERA_Z-z)/50
    colors = np.column_stack([map_coordinates(color_field[:, :, c], [ys, xs], order=1) for c in range(3)])
    alpha_base = {'front': .10, 'mid': .14, 'back': .055}[layer]
    alpha_scale = {'front': .20, 'mid': .34, 'back': .13}[layer]
    alpha = np.clip(alpha_base + d * alpha_scale, .012, .42)
    return np.column_stack((x, y, z, size, linear_rgb(colors), alpha, d, rng.random(count))).astype('<f4')

def sample_foreground_dust(rgb, count=7000, seed=SEED):
    _, density = analyze_structure(rgb)
    h, w = density.shape
    rng = np.random.default_rng(seed + 77)
    weights = .02 + density * .55
    indexes = rng.choice(w * h, count, replace=True, p=(weights / weights.sum()).ravel())
    iy, ix = np.divmod(indexes, w)
    xs = np.clip(ix + rng.uniform(-.5, .5, count), 0, w-1)
    ys = np.clip(iy + rng.uniform(-.5, .5, count), 0, h-1)
    z = -2.0 - rng.random(count) * 6.0
    x, y, _ = image_to_world(xs, ys, w, h, z)
    x += rng.normal(0, .45, count)
    y += rng.normal(0, .45, count)
    colors = rgb[iy, ix]
    size = (.05 + rng.power(2.0, count) * .16) * (CAMERA_Z-z)/50
    alpha = np.clip(.025 + density[iy, ix] * .10 + rng.random(count) * .018, .012, .16)
    return np.column_stack((x, y, z, size, linear_rgb(colors), alpha)).astype('<f4')
