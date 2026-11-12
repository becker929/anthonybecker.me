"""Makes the Prinz desk's own textures: blender/tex_prinz/{maple,enamel,felt,parts}.jpg.

    <bpy venv>/bin/python blender/prinz_textures.py

Reads the generated originals from the image wall's store (never in git). assets/ART-prinz.md lists
them. The three materials are made tileable the way blender/textures.py makes the room's. parts.jpg
is an atlas of engraved plates, drawn here so the words are exact; blender/prinz.py holds the same
table of where each sits.
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from textures import flatten, seam, wrap  # noqa: E402

SRC = os.path.expanduser(os.environ.get("HARNESS_IMAGES", "~/_agent_scratch/studio/images")) + "/files"
OUT = os.path.join(HERE, "tex_prinz")
FONT = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"

# name: (image id, output size, flatten radius as a fraction of the width, gain, contrast, roughness
# from darkest to lightest tones).
TEXTURES = {
    "maple": ("20261112-224937-183a62", 512, 0.25, (1.0, 1.0, 1.0), 1.1, (0.40, 0.30)),
    "enamel": ("20261112-224938-ff95c5", 512, 0.20, (1.0, 1.0, 1.0), 1.25, (0.62, 0.48)),
    "felt": ("20261112-225012-e354df", 256, 0.30, (1.0, 1.0, 1.0), 1.0, (0.95, 0.90)),
}

# The same table as ATLAS in prinz.py: left, top, right, bottom in pixels of a 1024 square.
ATLAS = {
    "white": (4, 4, 252, 68),
    "think": (260, 4, 508, 68),
    "mate": (516, 4, 764, 68),
    "refuted": (772, 4, 1020, 68),
    "next": (4, 76, 252, 140),
    "problem": (260, 76, 508, 140),
    "name": (4, 148, 1020, 268),
    "files": (4, 276, 1020, 340),
}
PLATES = {"white": "WHITE TO PLAY", "think": "THINKING", "mate": "MATE", "refuted": "REFUTED", "next": "NEXT PROBLEM",
          "problem": "PROBLEMS SOLVED"}
INK = (22, 20, 18)


def tile(name, ident, size, radius, gain, contrast, rough):
    a = np.asarray(Image.open(f"{SRC}/{ident}.jpg").convert("RGB")).astype(np.float32)
    before = seam(a)
    a = wrap(flatten(a, radius))
    mean = a.reshape(-1, 3).mean(0)
    a = np.clip(((a - mean) * contrast + mean) * np.array(gain, np.float32), 0, 255)
    img = Image.fromarray(a.astype(np.uint8)).resize((size, size), Image.LANCZOS)
    img.save(f"{OUT}/{name}.jpg", quality=86, optimize=True)
    g = np.asarray(img).astype(np.float32).mean(2)
    lo, hi = np.percentile(g, [2, 98])
    t = np.clip((g - lo) / max(hi - lo, 1e-3), 0, 1)
    r = rough[0] + (rough[1] - rough[0]) * t
    orm = np.stack([np.full_like(r, 255), r * 255, np.zeros_like(r)], axis=2)
    Image.fromarray(orm.astype(np.uint8)).save(f"{OUT}/{name}_orm.jpg", quality=84, optimize=True)
    print(name, "seam before", before, "after", seam(np.asarray(img).astype(np.float32)), "mean",
          np.asarray(img).reshape(-1, 3).mean(0).round(1), os.path.getsize(f"{OUT}/{name}.jpg"), "bytes")


def steel_sheet(w, h, tone=0.80):
    steel = Image.open(os.path.join(HERE, "tex", "steel.jpg")).convert("RGB").resize((512, 512))
    img = Image.new("RGB", (w, h))
    for x in range(0, w, 512):
        for y in range(0, h, 512):
            img.paste(steel, (x, y))
    return Image.eval(img, lambda v: int(v * tone))


def engrave(d, text, font, x, y, h):
    """Dark letters with a light lower lip, as a cutter leaves them."""
    lip = max(2, h // 60)
    d.text((x, y + lip), text, font=font, fill=(210, 205, 195))
    d.text((x, y), text, font=font, fill=INK)


def plate(size, text, tall=0.56, scale=4, screws=True, spaced=False):
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    m = h // 12
    d.rounded_rectangle((m, m, w - m, h - m), radius=h // 8, outline=INK, width=max(2, h // 45))
    font = ImageFont.truetype(FONT, int(h * tall))
    box = d.textbbox((0, 0), text, font=font)
    engrave(d, text, font, (w - box[2] - box[0]) / 2, (h - box[3] - box[1]) / 2, h)
    if screws:
        for cx in (h * 0.45, w - h * 0.45):
            r = h * 0.11
            d.ellipse((cx - r, h / 2 - r, cx + r, h / 2 + r), fill=(70, 68, 64), outline=INK)
            d.line((cx - r * 0.7, h / 2 - r * 0.5, cx + r * 0.7, h / 2 + r * 0.5), fill=INK, width=max(2, h // 45))
    return img.resize(size, Image.LANCZOS)


def files_strip(size, scale=4):
    """a to h, one under each file. The strip is exactly eight squares wide."""
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(h * 0.70))
    for i, c in enumerate("abcdefgh"):
        box = d.textbbox((0, 0), c, font=font)
        cx = (i + 0.5) * w / 8
        engrave(d, c, font, cx - (box[2] + box[0]) / 2, (h - box[3] - box[1]) / 2, h)
    return img.resize(size, Image.LANCZOS)


def name_plate(size, scale=3):
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    m = h // 14
    d.rectangle((m, m, w - m, h - m), outline=INK, width=max(2, h // 50))
    for text, tall, top in (("ROBOT CHESS", 0.40, 0.10), ("MATE IN TWO   ·   D. G. PRINZ   ·   MANCHESTER 1951", 0.20, 0.62)):
        font = ImageFont.truetype(FONT, int(h * tall))
        box = d.textbbox((0, 0), text, font=font)
        engrave(d, text, font, (w - box[2] - box[0]) / 2, h * top, h)
    return img.resize(size, Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, args in TEXTURES.items():
        tile(name, *args)
    atlas = Image.new("RGB", (1024, 1024), (0, 0, 0))

    def put(name, img):
        x0, y0, x1, y1 = ATLAS[name]
        atlas.paste(img.resize((x1 - x0 + 8, y1 - y0 + 8), Image.LANCZOS), (x0 - 4, y0 - 4))

    for name, text in PLATES.items():
        x0, y0, x1, y1 = ATLAS[name]
        put(name, plate((x1 - x0, y1 - y0), text))
    x0, y0, x1, y1 = ATLAS["files"]
    put("files", files_strip((x1 - x0, y1 - y0)))
    x0, y0, x1, y1 = ATLAS["name"]
    put("name", name_plate((x1 - x0, y1 - y0)))
    # Only the top third is used; the rest stays black and costs little.
    atlas.save(os.path.join(OUT, "parts.jpg"), quality=86, optimize=True)
    print("parts", os.path.getsize(os.path.join(OUT, "parts.jpg")), "bytes")


if __name__ == "__main__":
    main()
