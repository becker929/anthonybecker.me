"""Turns the generated material pictures into the small tiling textures the model uses.

    <bpy venv>/bin/python blender/textures.py

Reads the originals from the image wall's store (never in git), writes blender/tex/*.jpg.
For each: flatten uneven lighting, make the edges wrap, resize, and derive a roughness map.
assets/ART.md lists which generated image each texture came from.
"""

import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser(os.environ.get("HARNESS_IMAGES", "~/_agent_scratch/studio/images")) + "/files"
OUT = os.path.join(HERE, "tex")

# name: (image id, output size, flatten radius as a fraction of the width or None, gain, contrast,
#        roughness range, metal). Roughness runs from the first value at the darkest tones to the
# second at the lightest.
TEXTURES = {
    "walnut": ("20261112-203448-771c38", 1024, None, (0.92, 0.90, 0.88), 0.75, (0.66, 0.44), 0),
    "steel": ("20261112-203506-96d1d3", 512, 0.20, (0.79, 0.83, 0.88), 1.0, (0.30, 0.20), 255),
    "concrete": ("20261112-203507-922bea", 1024, 0.35, (1.08, 1.08, 1.10), 2.0, (0.40, 0.12), 0),
    "navy": ("20261112-203509-870603", 512, 0.12, (1.0, 1.0, 1.0), 1.0, (0.56, 0.44), 0),
}
# Textures that also get a normal map made from their tones, and how deep it is.
RELIEF = {"walnut": 1.6}


def seam(a):
    """How much worse the wrap-around step is than a step between neighbours inside. 1 is seamless."""
    g = a.mean(2)
    rows = np.abs(g[0] - g[-1]).mean() / np.abs(np.diff(g, axis=0)).mean()
    cols = np.abs(g[:, 0] - g[:, -1]).mean() / np.abs(np.diff(g, axis=1)).mean()
    return round(float(rows), 2), round(float(cols), 2)


def flatten(a, radius):
    """Removes broad light and dark areas, which would show as a repeating pattern."""
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    # Blur a wrapped copy so the low frequencies are estimated the same way at the edges.
    h, w = a.shape[:2]
    pad = np.pad(np.asarray(img), ((h // 2, h // 2), (w // 2, w // 2), (0, 0)), mode="reflect")
    low = np.asarray(Image.fromarray(pad).filter(ImageFilter.GaussianBlur(radius * w))).astype(np.float32)
    low = low[h // 2 : h // 2 + h, w // 2 : w // 2 + w]
    return a - low + a.reshape(-1, 3).mean(0)


def wrap(a, band=0.18):
    """Offset-and-blend: near each edge the picture fades into a copy of itself shifted by half, so
    opposite edges meet in the middle of the copy, where it is continuous."""
    h, w = a.shape[:2]
    out = a
    for axis, n in ((0, h), (1, w)):
        shifted = np.roll(out, n // 2, axis=axis)
        t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (band * n)
        k = np.clip(t, 0, 1)
        k = k * k * (3 - 2 * k)  # 0 at the edges, 1 inside
        shape = [1, 1, 1]
        shape[axis] = n
        k = k.reshape(shape)
        out = out * k + shifted * (1 - k)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (ident, size, radius, gain, contrast, rough, metal) in TEXTURES.items():
        a = np.asarray(Image.open(f"{SRC}/{ident}.jpg").convert("RGB")).astype(np.float32)
        before = seam(a)
        if radius:
            a = flatten(a, radius)
        a = wrap(a)
        mean = a.reshape(-1, 3).mean(0)
        a = np.clip(((a - mean) * contrast + mean) * np.array(gain, np.float32), 0, 255)
        img = Image.fromarray(a.astype(np.uint8)).resize((size, size), Image.LANCZOS)
        img.save(f"{OUT}/{name}.jpg", quality=86, optimize=True)
        small = np.asarray(img.resize((512, 512), Image.LANCZOS)).astype(np.float32)
        # Roughness follows tone: pores and trowel marks are darker and duller.
        g = small.mean(2)
        lo, hi = np.percentile(g, [2, 98])
        t = np.clip((g - lo) / max(hi - lo, 1e-3), 0, 1)
        r = rough[0] + (rough[1] - rough[0]) * t
        orm = np.stack([np.full_like(r, 255), r * 255, np.full_like(r, metal)], axis=2)
        Image.fromarray(orm.astype(np.uint8)).save(f"{OUT}/{name}_orm.jpg", quality=84, optimize=True)
        if name in RELIEF:
            # Light tones stand proud, dark pores sit low. The slope of that height is the normal.
            height = np.asarray(img.convert("L").filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255.0
            dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * RELIEF[name]
            dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * RELIEF[name]
            n = np.stack([-dx, dy, np.ones_like(dx)], axis=2)  # image rows run down, V runs up
            n /= np.linalg.norm(n, axis=2, keepdims=True)
            Image.fromarray((n * 127.5 + 127.5).astype(np.uint8)).save(f"{OUT}/{name}_n.jpg", quality=84, optimize=True)
        print(name, "seam rows,cols before", before, "after", seam(np.asarray(img).astype(np.float32)),
              "mean", np.asarray(img).reshape(-1, 3).mean(0).round(1),
              os.path.getsize(f"{OUT}/{name}.jpg"), os.path.getsize(f"{OUT}/{name}_orm.jpg"))


if __name__ == "__main__":
    main()
