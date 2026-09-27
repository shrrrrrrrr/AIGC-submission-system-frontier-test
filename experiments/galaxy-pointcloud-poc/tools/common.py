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
    height, width = rgb.shape[:2]
    return rgb, width, height


def luminance(rgb):
    return rgb[..., 0] * .2126 + rgb[..., 1] * .7152 + rgb[..., 2] * .0722


def linear_rgb(rgb):
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)


def robust_normalize(values):
    low, high = np.percentile(values, (2, 98))
    return np.clip((values - low) / max(1e-6, high - low), 0, 1)


def image_to_world(xs, ys, width, height, z=None):
    # Pixel centres. Lift along the reference camera rays, preserving image registration.
    world_height = WORLD_WIDTH * height / width
    x = ((xs + .5) / width - .5) * WORLD_WIDTH
    y = (.5 - (ys + .5) / height) * world_height
    if z is not None:
        scale = (CAMERA_Z - z) / (CAMERA_Z - REFERENCE_Z)
        x, y = x * scale, y * scale
    return x, y, world_height


def star_measurements(rgb, max_stars=6000):
    lum = luminance(rgb)
    highpass = np.maximum(0, lum - gaussian_filter(lum, 2.2))
    median = np.median(highpass)
    mad = np.median(np.abs(highpass - median)) / .6745
    threshold = max(.035, float(np.percentile(highpass, 99.15)), float(median + 5 * mad))
    ys, xs = np.nonzero((highpass >= threshold) & (maximum_filter(highpass, size=5) == highpass))
    if not len(xs):
        raise ValueError('No detectable stars in input image')
    score = highpass[ys, xs] * .7 + lum[ys, xs] * .3
    order = np.argsort(-score, kind='stable')[:max_stars]
    xs, ys = xs[order], ys[order]
    # Estimate radius from actual local positive contrast, rather than random sizes.
    radius = np.empty(len(xs))
    for i, (x, y) in enumerate(zip(xs, ys)):
        y0, y1 = max(0, y-3), min(lum.shape[0], y+4)
        x0, x1 = max(0, x-3), min(lum.shape[1], x+4)
        patch = highpass[y0:y1, x0:x1]
        yy, xx = np.mgrid[y0:y1, x0:x1]
        weight = np.maximum(0, patch - highpass[y, x] * .35)
        radius[i] = np.clip(np.sqrt(np.sum(weight*((xx-x)**2+(yy-y)**2)) / max(1e-8, weight.sum())), .55, 2.4)
    contrast = highpass[ys, xs]
    normalized = np.clip((contrast-threshold) / max(1e-6, contrast.max()-threshold), 0, 1)
    emissive = .7 + normalized * 2.8
    return xs, ys, radius, lum[ys, xs], contrast, emissive


def detect_stars(rgb, max_stars=6000, seed=SEED):
    xs, ys, radius, lum, contrast, emissive = star_measurements(rgb, max_stars)
    rng = np.random.default_rng(seed)
    # Most stars far away; a minority near. Brightness is only a weak overlapping prior.
    z = -12 - rng.random(len(xs)) ** .45 * 50 + lum * 5 + radius * .6
    z = np.clip(z + rng.normal(0, 1, len(xs)), -64, -8)
    h, w = rgb.shape[:2]
    x, y, _ = image_to_world(xs, ys, w, h, z)
    size = (1.2 + radius * 1.6) * WORLD_WIDTH / w * (CAMERA_Z-z)/50
    return np.column_stack((x, y, z, size, linear_rgb(rgb[ys, xs]), emissive)).astype('<f4')


def analyze_structure(rgb):
    # Suppress discrete peaks before sampling the continuous ribbon.
    starless = gaussian_filter(median_filter(rgb, size=(3, 3, 1)), sigma=(1.0, 1.0, 0))
    lum = luminance(starless)
    large = gaussian_filter(lum, 18)
    medium = gaussian_filter(lum, 5)
    contrast = np.abs(medium-large)
    chroma = starless.max(axis=2)-starless.min(axis=2)
    density = np.clip(.55*robust_normalize(large)+.30*robust_normalize(medium)+.10*robust_normalize(contrast)+.05*robust_normalize(chroma), 0, 1)
    return starless, density


def sample_nebula(rgb, count=100000, thickness=5.0, seed=SEED):
    if count < 1000 or count > 500000 or not 0 <= thickness <= 12:
        raise ValueError('Use 1000..500000 nebula points and thickness 0..12')
    color_field, density = analyze_structure(rgb)
    h, w = density.shape
    weights = .06 + density ** 1.25
    probabilities = (weights / weights.sum()).ravel()
    rng = np.random.default_rng(seed+1)
    indexes = rng.choice(w*h, count, replace=True, p=probabilities)
    iy, ix = np.divmod(indexes, w)
    # Subpixel jitter avoids piles of coincident points at individual pixel centres.
    xs = np.clip(ix + rng.uniform(-.5, .5, count), 0, w-1)
    ys = np.clip(iy + rng.uniform(-.5, .5, count), 0, h-1)
    d = map_coordinates(density, [ys, xs], order=1)
    low_noise = robust_normalize(gaussian_filter(rng.normal(size=(h,w)), 26)) - .5
    fine_noise = robust_normalize(gaussian_filter(rng.normal(size=(h,w)), 7)) - .5
    ribbon = -22 + 2.4*np.sin(xs/w*4.5+ys/h*3.2) + (d-.5)*3
    ribbon += map_coordinates(low_noise*2+fine_noise*.7, [ys,xs], order=1)
    z = ribbon + np.clip(rng.normal(size=count), -2.5, 2.5)*thickness*(.2+.28*d)
    x, y, world_height = image_to_world(xs, ys, w, h, z)
    diameter = (.34 + rng.random(count)*.20)  # soft overlapping kernels, in reference world units
    # Importance correction prevents sampling density from washing out image colour/contrast.
    area_per_sample = WORLD_WIDTH*world_height/count / (weights[iy,ix]/weights.mean())
    alpha = np.clip(area_per_sample / (np.pi*diameter**2/24), .005, 1.8)
    colors = np.column_stack([map_coordinates(color_field[:,:,c], [ys,xs], order=1) for c in range(3)])
    output = np.column_stack((x,y,z,diameter*(CAMERA_Z-z)/50,linear_rgb(colors),alpha,d,rng.random(count)))
    return output.astype('<f4')
