"""Makes Bertie's own textures from the generated pictures: blender/tex_bertie/parts.jpg and marquee.jpg.

    <bpy venv>/bin/python blender/bertie_textures.py

Reads the originals from the image wall's store (never in git). assets/ART-bertie.md lists them.
parts.jpg is one 1024 px atlas; blender/bertie.py holds the same table of where each picture sits.
The label plates are drawn here, not generated, so their words are exact.
"""

import os

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser(os.environ.get("HARNESS_IMAGES", "~/_agent_scratch/studio/images")) + "/files"
OUT = os.path.join(HERE, "tex_bertie")
FONT = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"

GLASS = "20261112-210109-394992"    # frosted glass with a dark bulb behind it
KEY = "20261112-210020-825a61"      # one milky key cap from above
MARQUEE = "20261112-210031-ae204a"  # the amber name board

# The same table as ATLAS in bertie.py: left, top, right, bottom in pixels.
ATLAS = {
    "glass": (4, 4, 380, 380),
    "cell": (388, 4, 764, 380),
    "key": (772, 4, 1020, 252),
    "new_game": (4, 392, 508, 518),
    "difficulty": (516, 392, 1020, 518),
    "digit_1": (4, 528, 124, 648),
    "digit_2": (132, 528, 252, 648),
    "digit_3": (260, 528, 380, 648),
    "digit_4": (388, 528, 508, 648),
    "digit_5": (516, 528, 636, 648),
    "maker": (4, 660, 636, 818),
}


def original(ident):
    return Image.open(f"{SRC}/{ident}.jpg").convert("RGB")


def edge_shade(img, depth=0.18, band=0.16):
    """Darkens toward the edges, as a pane does at the bottom of a deep frame."""
    w, h = img.size
    x = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (band * w)
    y = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (band * h)
    k = np.clip(np.minimum.outer(y, x), 0, 1)
    k = 1 - depth * (1 - k * k * (3 - 2 * k))
    return Image.fromarray((np.asarray(img).astype(np.float32) * k[:, :, None]).astype(np.uint8))


INK = (22, 20, 18)


def steel_sheet(w, h, tone=0.72):
    """Brushed steel to engrave on, cut from the room's steel and dimmed to sit on the walnut."""
    steel = Image.open(os.path.join(OUT, "steel.jpg")).convert("RGB").resize((512, 512))
    img = Image.new("RGB", (w, h))
    for x in range(0, w, 512):
        for y in range(0, h, 512):
            img.paste(steel, (x, y))
    return Image.eval(img, lambda v: int(v * tone))


def engrave(img, text, tall, top=None):
    """Dark filled letters with a light lower lip, as a cutter leaves them."""
    d = ImageDraw.Draw(img)
    w, h = img.size
    font = ImageFont.truetype(FONT, int(h * tall))
    box = d.textbbox((0, 0), text, font=font)
    x = (w - box[2] - box[0]) / 2
    y = (h - box[3] - box[1]) / 2 if top is None else h * top
    lip = max(2, h // 90)
    d.text((x, y + lip), text, font=font, fill=(205, 200, 190))
    d.text((x, y), text, font=font, fill=INK)


def plate(size, text, scale=4):
    """A small steel plate with engraved words, a cut line round its edge and a screw at each end.
    Drawn large and reduced, so the letters are smooth."""
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    m = h // 12
    d.rounded_rectangle((m, m, w - m, h - m), radius=h // 8, outline=INK, width=max(2, h // 50))
    engrave(img, text, 0.58)
    for cx in (h * 0.42, w - h * 0.42):
        r = h * 0.10
        d.ellipse((cx - r, h / 2 - r, cx + r, h / 2 + r), fill=(70, 68, 64), outline=INK)
        d.line((cx - r * 0.7, h / 2 - r * 0.5, cx + r * 0.7, h / 2 + r * 0.5), fill=INK, width=max(2, h // 50))
    return img.resize(size, Image.LANCZOS)


def digit(size, text, scale=4):
    """A small steel tag with one engraved numeral, for the dial's five notches."""
    n = size[0] * scale
    img = steel_sheet(n, n)
    d = ImageDraw.Draw(img)
    d.rectangle((n * 0.04, n * 0.04, n * 0.96, n * 0.96), outline=INK, width=n // 36)
    engrave(img, text, 0.74)
    return img.resize(size, Image.LANCZOS)


def maker(size, scale=3):
    """The maker's plate: brushed steel with dark engraved lines. The facts are the real machine's."""
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    ink = INK
    m = h // 14
    d.rectangle((m, m, w - m, h - m), outline=ink, width=max(2, h // 60))
    lines = [("BERTIE THE BRAIN", 0.34, 0.10), ("ROGERS MAJESTIC LTD.   TORONTO", 0.17, 0.50), ("CANADIAN NATIONAL EXHIBITION   1950", 0.17, 0.72)]
    for text, tall, top in lines:
        font = ImageFont.truetype(FONT, int(h * tall))
        box = d.textbbox((0, 0), text, font=font)
        d.text(((w - box[2] - box[0]) / 2, h * top), text, font=font, fill=ink)
    return img.resize(size, Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    atlas = Image.new("RGB", (1024, 1024), (0, 0, 0))

    def put(name, img):
        x0, y0, x1, y1 = ATLAS[name]
        # Each picture runs a few pixels past its box, so smaller copies of the atlas do not bleed black.
        atlas.paste(img.resize((x1 - x0 + 8, y1 - y0 + 8), Image.LANCZOS), (x0 - 4, y0 - 4))

    glass = original(GLASS)
    # The pane with the bulb behind it sits at the back of every square. Its dusty border is cut off.
    put("cell", edge_shade(glass.crop((36, 36, 988, 988))))
    # The lamps' own glass is a plain part of the same pane, away from the bulb.
    put("glass", glass.crop((620, 40, 990, 410)).filter(ImageFilter.GaussianBlur(0.6)))
    # The cap's picture is lit orange from inside. Half of that colour is taken out, so an unlit key
    # is plain milky plastic and the game's light decides how warm a lit one is.
    cap = original(KEY).crop((33, 31, 987, 990))
    cap = Image.blend(cap, cap.convert("L").convert("RGB"), 0.5)
    # Its scratches read as stains at the size a key is seen, so most of the fine detail is smoothed away.
    put("key", Image.blend(cap, cap.filter(ImageFilter.GaussianBlur(14)), 0.75))
    for name, text in (("new_game", "NEW GAME"), ("difficulty", "DIFFICULTY")):
        x0, y0, x1, y1 = ATLAS[name]
        put(name, plate((x1 - x0, y1 - y0), text))
    for i in range(1, 6):
        x0, y0, x1, y1 = ATLAS[f"digit_{i}"]
        put(f"digit_{i}", digit((x1 - x0, y1 - y0), str(i)))
    x0, y0, x1, y1 = ATLAS["maker"]
    put("maker", maker((x1 - x0, y1 - y0)))
    atlas.save(os.path.join(OUT, "parts.jpg"), quality=86, optimize=True)

    # The name board is 1.50 m by 0.254 m. The band with the lettering is cut to that shape.
    m = original(MARQUEE)
    band = round(m.width * 0.254 / 1.50)
    mid = (504 + 817) // 2  # the lettering's rows in the original
    m = m.crop((0, mid - band // 2, m.width, mid - band // 2 + band)).resize((1024, 176), Image.LANCZOS)
    # Deeper letters and richer amber, so the board still reads as lit glass once the game adds its glare.
    m = ImageEnhance.Color(ImageEnhance.Contrast(m).enhance(1.3)).enhance(1.15)
    m.save(os.path.join(OUT, "marquee.jpg"), quality=88, optimize=True)
    for name in ("parts", "marquee"):
        p = os.path.join(OUT, name + ".jpg")
        print(name, Image.open(p).size, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
