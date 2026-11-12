"""Makes the Whirlwind console's own textures: blender/tex_whirlwind/parts.jpg.

    <bpy venv>/bin/python blender/whirlwind_textures.py

parts.jpg is one 1024 px atlas; blender/whirlwind.py holds the same table of where each picture sits.
The plates are drawn here, not generated, so their words are exact. The lamp lens comes from a
generated picture when its id is set below (the originals stay in the image wall's store, never in
git); without it a plain drawn lens stands in. assets/ART-whirlwind.md lists the ids.
"""

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser(os.environ.get("HARNESS_IMAGES", "~/_agent_scratch/studio/images")) + "/files"
OUT = os.path.join(HERE, "tex_whirlwind")
STEEL = os.path.join(HERE, "tex", "steel.jpg")
FONT = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"

# Generated pictures used, by id. None until the art pass has made them.
LENS = "20261112-224434-6dd00d"   # a faceted glass pilot-lamp jewel, seen straight on

# The same table as ATLAS in whirlwind.py: left, top, right, bottom in pixels.
ATLAS = {
    "lens": (4, 4, 252, 252),
    "dial": (260, 4, 764, 508),
    "bounce": (4, 520, 508, 646),
    "speed": (516, 520, 1020, 646),
    "release": (4, 654, 508, 780),
    "name": (516, 654, 1020, 780),
    "maker": (4, 790, 1020, 950),
    "tick": (772, 4, 1020, 252),
}

INK = (22, 20, 18)


def steel_sheet(w, h, tone=0.72):
    """Brushed steel to engrave on, cut from the room's steel and dimmed to sit on the walnut."""
    steel = Image.open(STEEL).convert("RGB").resize((512, 512))
    img = Image.new("RGB", (w, h))
    for x in range(0, w, 512):
        for y in range(0, h, 512):
            img.paste(steel, (x, y))
    return Image.eval(img, lambda v: int(v * tone))


def engrave(img, text, tall, top=None, spacing=0):
    """Dark filled letters with a light lower lip, as a cutter leaves them."""
    d = ImageDraw.Draw(img)
    w, h = img.size
    font = ImageFont.truetype(FONT, int(h * tall))
    text = (" " * spacing).join(text) if spacing else text
    box = d.textbbox((0, 0), text, font=font)
    x = (w - box[2] - box[0]) / 2
    y = (h - box[3] - box[1]) / 2 if top is None else h * top
    lip = max(2, h // 90)
    d.text((x, y + lip), text, font=font, fill=(205, 200, 190))
    d.text((x, y), text, font=font, fill=INK)


def plate(size, text, scale=4):
    """A small steel plate with engraved words, a cut line round its edge and a screw at each end."""
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


def maker(size, scale=3):
    """The maker's plate: brushed steel with dark engraved lines. The facts are the real machine's."""
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    m = h // 14
    d.rectangle((m, m, w - m, h - m), outline=INK, width=max(2, h // 60))
    lines = [("WHIRLWIND I   BOUNCING BALL", 0.30, 0.12), ("DIGITAL COMPUTER LABORATORY", 0.17, 0.50),
             ("MASSACHUSETTS INSTITUTE OF TECHNOLOGY   1951", 0.17, 0.72)]
    for text, tall, top in lines:
        font = ImageFont.truetype(FONT, int(h * tall))
        box = d.textbbox((0, 0), text, font=font)
        d.text(((w - box[2] - box[0]) / 2, h * top), text, font=font, fill=INK)
    return img.resize(size, Image.LANCZOS)


def dial(size, scale=2):
    """The knob's dial plate: a black ring with nine white ticks, the middle one long. Ticks run
    clockwise from the left, 0.30 rad apart, as NOTCH_STEP in whirlwind.py and src/whirlwind_machine.rs."""
    n = size[0] * scale
    img = Image.new("RGB", (n, n), (14, 13, 12))
    d = ImageDraw.Draw(img)
    c = n / 2
    for k in range(9):
        a = (k - 4) * 0.30
        r0 = n * (0.36 if k in (0, 4, 8) else 0.40)
        r1 = n * 0.47
        sx, sy = np.sin(a), -np.cos(a)
        d.line((c + sx * r0, c + sy * r0, c + sx * r1, c + sy * r1), fill=(222, 214, 196), width=max(3, n // 70))
    # A thin ring inside the ticks, like a printed scale.
    r = n * 0.335
    d.arc((c - r, c - r, c + r, c + r), start=-90 - 4 * 17.19 - 4, end=-90 + 4 * 17.19 + 4, fill=(150, 144, 132), width=max(2, n // 160))
    return img.resize(size, Image.LANCZOS)


def lens(size):
    """The lamp's jewel. From the generated picture if there is one, else a drawn dome of facets."""
    if LENS:
        img = Image.open(f"{SRC}/{LENS}.jpg").convert("RGB")
        s = min(img.size)
        img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width + s) // 2, (img.height + s) // 2))
        # Grey it, so one picture serves every colour: the material's tint decides the hue.
        return img.convert("L").convert("RGB").resize(size, Image.LANCZOS)
    n = size[0]
    y, x = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1
    r = np.sqrt(x * x + y * y)
    facet = 0.75 + 0.25 * np.cos(np.arctan2(y, x) * 8) * (r > 0.35)
    v = np.clip((1.0 - 0.5 * r) * facet, 0, 1) * 235
    return Image.fromarray(v.astype(np.uint8)).convert("RGB").filter(ImageFilter.GaussianBlur(1.2))


def main():
    os.makedirs(OUT, exist_ok=True)
    atlas = Image.new("RGB", (1024, 1024), (0, 0, 0))

    def put(name, img):
        x0, y0, x1, y1 = ATLAS[name]
        atlas.paste(img.resize((x1 - x0 + 8, y1 - y0 + 8), Image.LANCZOS), (x0 - 4, y0 - 4))

    box = lambda name: (ATLAS[name][2] - ATLAS[name][0], ATLAS[name][3] - ATLAS[name][1])
    put("lens", lens(box("lens")))
    put("dial", dial(box("dial")))
    for name, text in (("bounce", "BOUNCE"), ("speed", "SPEED"), ("release", "RELEASE"), ("name", "WHIRLWIND  I")):
        put(name, plate(box(name), text))
    put("maker", maker(box("maker")))
    # A plain white patch for the dial's ticks and lit lines, which take their colour from the material.
    put("tick", Image.new("RGB", box("tick"), (230, 224, 210)))
    path = os.path.join(OUT, "parts.jpg")
    atlas.save(path, quality=86, optimize=True)
    print("parts", atlas.size, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
