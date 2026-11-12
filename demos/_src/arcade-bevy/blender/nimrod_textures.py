"""Makes Nimrod's own textures from the generated pictures: blender/tex_nimrod/parts.jpg, enamel.jpg,
enamel_orm.jpg and marquee.jpg.

    <bpy venv>/bin/python blender/nimrod_textures.py

Reads the originals from the image wall's store (never in git). assets/ART-nimrod.md lists them.
parts.jpg is one 1024 px atlas laid out by blender/nimrod_atlas.py. The words on the legends and
plates are drawn here, not generated, so they are exact.
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nimrod_atlas import ATLAS, INSTRUCTION_WORDS  # noqa: E402
from textures import flatten, seam, wrap  # noqa: E402

SRC = os.path.expanduser(os.environ.get("HARNESS_IMAGES", "~/_agent_scratch/studio/images")) + "/files"
OUT = os.path.join(HERE, "tex_nimrod")
STEEL = os.path.join(HERE, "tex", "steel.jpg")
FONT = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"

ENAMEL = "20261112-225003-1271d7"   # grey hammertone enamel
LENS = "20261112-225022-1ebf87"     # one domed lamp lens, a dark bulb behind it
CAP = "20261112-225025-bbc46c"      # one round button cap from above
MARQUEE = "20261112-225026-76919a"  # the amber name board

INK = (22, 20, 18)
# The legends' light: warm cream words on black glass. The game tints and brightens them.
GLOW_INK = (255, 236, 205)


def original(ident):
    return Image.open(f"{SRC}/{ident}.jpg").convert("RGB")


def box_size(name):
    x0, y0, x1, y1 = ATLAS[name]
    return x1 - x0, y1 - y0


def steel_sheet(w, h, tone=0.72):
    """Brushed steel to engrave on, cut from the room's steel and dimmed to sit on the walnut."""
    steel = Image.open(STEEL).convert("RGB").resize((512, 512))
    img = Image.new("RGB", (w, h))
    for x in range(0, w, 512):
        for y in range(0, h, 512):
            img.paste(steel, (x, y))
    return Image.eval(img, lambda v: int(v * tone))


def centred(d, w, h, text, font, fill, dy=0):
    box = d.textbbox((0, 0), text, font=font)
    d.text(((w - box[2] - box[0]) / 2, (h - box[3] - box[1]) / 2 + dy), text, font=font, fill=fill)


def plate(size, text, tall=0.58, scale=4, screws=True):
    """A small steel plate with engraved words and a cut line round its edge. Drawn large and
    reduced, so the letters are smooth."""
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    m = h // 12
    d.rounded_rectangle((m, m, w - m, h - m), radius=h // 8, outline=INK, width=max(2, h // 40))
    font = ImageFont.truetype(FONT, int(h * tall))
    lip = max(2, h // 80)
    centred(d, w, h, text, font, (205, 200, 190), lip)
    centred(d, w, h, text, font, INK)
    if screws and w > 2.5 * h:
        for cx in (h * 0.42, w - h * 0.42):
            r = h * 0.10
            d.ellipse((cx - r, h / 2 - r, cx + r, h / 2 + r), fill=(70, 68, 64), outline=INK)
            d.line((cx - r * 0.7, h / 2 - r * 0.5, cx + r * 0.7, h / 2 + r * 0.5), fill=INK, width=max(2, h // 50))
    return img.resize(size, Image.LANCZOS)


def legend(size, text, scale=4):
    """A legend pane: words that glow when lit, on black glass. A faint inner line frames them."""
    w, h = size[0] * scale, size[1] * scale
    img = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(h * 0.50))
    centred(d, w, h, text, font, GLOW_INK)
    # A little bloom in the glass round the letters, as light in a real pane spreads.
    soft = img.filter(ImageFilter.GaussianBlur(h * 0.06))
    img = Image.fromarray(np.clip(np.asarray(img).astype(np.float32) + 0.45 * np.asarray(soft), 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    m = h // 10
    d.rectangle((m, m, w - m, h - m), outline=(40, 34, 26), width=max(2, h // 60))
    return img.resize(size, Image.LANCZOS)


def maker(size, scale=3):
    """The plate on the lower body. The facts are the real machine's."""
    w, h = size[0] * scale, size[1] * scale
    img = steel_sheet(w, h)
    d = ImageDraw.Draw(img)
    m = h // 14
    d.rectangle((m, m, w - m, h - m), outline=INK, width=max(2, h // 60))
    for text, tall, top in (("NIMROD DIGITAL COMPUTER", 0.30, 0.12), ("DESIGNED TO PLAY THE GAME OF NIM", 0.16, 0.50),
                            ("EXHIBITION OF SCIENCE   SOUTH KENSINGTON   1951", 0.15, 0.72)):
        font = ImageFont.truetype(FONT, int(h * tall))
        box = d.textbbox((0, 0), text, font=font)
        d.text(((w - box[2] - box[0]) / 2, h * top), text, font=font, fill=INK)
    return img.resize(size, Image.LANCZOS)


def disc(img, dark=0):
    """Crops a round thing on a plain background to its circle's square."""
    a = np.asarray(img.convert("L")).astype(np.float32)
    mask = a > a[:20, :20].mean() + 30 if dark == 0 else a < a[:20, :20].mean() - 30
    ys, xs = np.nonzero(mask)
    return img.crop((xs.min(), ys.min(), xs.max(), ys.max()))


def main():
    os.makedirs(OUT, exist_ok=True)
    atlas = Image.new("RGB", (1024, 1024), (0, 0, 0))

    def put(name, img):
        x0, y0, x1, y1 = ATLAS[name]
        # Each picture runs a few pixels past its box, so smaller copies of the atlas do not bleed.
        atlas.paste(img.resize((x1 - x0 + 8, y1 - y0 + 8), Image.LANCZOS), (x0 - 4, y0 - 4))

    # The lens fills its picture; its outer rim is trimmed so the bezel meets clear glass.
    lens = original(LENS)
    s = lens.width
    put("lens", lens.crop((int(s * 0.06), int(s * 0.06), int(s * 0.94), int(s * 0.94))))
    # The cap's own soft light is taken half out, so the game's light decides how warm a lit one is.
    cap = disc(original(CAP))
    cap = Image.blend(cap, cap.convert("L").convert("RGB"), 0.5)
    put("cap", Image.blend(cap, cap.filter(ImageFilter.GaussianBlur(10)), 0.6))
    put("maker", maker(box_size("maker")))
    for name, text in (("opponents_move", "OPPONENT'S MOVE"), ("computers_move", "COMPUTER'S MOVE"),
                       ("opponent_wins", "OPPONENT WINS"), ("computer_wins", "COMPUTER WINS")):
        put(name, legend(box_size(name), text))
    for i, text in enumerate(INSTRUCTION_WORDS):
        put(f"instr_{i}", plate(box_size(f"instr_{i}"), text, tall=0.52, screws=False))
    for name, text in (("simple", "SIMPLE"), ("reverse", "REVERSE"), ("new_game", "NEW GAME"), ("comp_move", "COMP. MOVE"),
                       ("odd", "ODD"), ("instructions", "INSTRUCTIONS"), ("registers", "REGISTERS")):
        put(name, plate(box_size(name), text))
    for b in (4, 2, 1):
        put(f"head_{b}", plate(box_size(f"head_{b}"), str(b), tall=0.70, screws=False))
    for h in range(1, 5):
        put(f"heap_{h}", plate(box_size(f"heap_{h}"), str(h), tall=0.70, screws=False))
    atlas.save(os.path.join(OUT, "parts.jpg"), quality=86, optimize=True)

    # The enamel: flattened, wrapped and reduced, with a roughness map from its tones.
    a = np.asarray(original(ENAMEL)).astype(np.float32)
    before = seam(a)
    a = wrap(flatten(a, 0.15))
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((320, 320), Image.LANCZOS)
    img.save(os.path.join(OUT, "enamel.jpg"), quality=86, optimize=True)
    g = np.asarray(img.convert("L")).astype(np.float32)
    lo, hi = np.percentile(g, [2, 98])
    t = np.clip((g - lo) / max(hi - lo, 1e-3), 0, 1)
    # The dimples' light rims are a little glossier than their hollows. Blue is metal: a faint flake.
    r = 0.62 - 0.18 * t
    orm = np.stack([np.full_like(r, 255), r * 255, np.full_like(r, 40)], axis=2)
    Image.fromarray(orm.astype(np.uint8)).save(os.path.join(OUT, "enamel_orm.jpg"), quality=84, optimize=True)
    print("enamel seam before", before, "after", seam(np.asarray(img).astype(np.float32)))

    # The name board is 1.40 m by 0.19 m. The band with the lettering is cut to that shape.
    m = original(MARQUEE)
    # The letters are the darkest rows in the middle of the picture; its scorched edges are not.
    top = int(m.height * 0.2)
    dark = (np.asarray(m.convert("L")).astype(np.float32) < 70)[top:int(m.height * 0.8), int(m.width * 0.2):int(m.width * 0.8)]
    rows = np.nonzero(dark.mean(1) > 0.05)[0] + top
    mid = (rows.min() + rows.max()) // 2
    band = round(m.width * 0.19 / 1.40)
    print("marquee letters rows", rows.min(), rows.max(), "band", band)
    m = m.crop((0, mid - band // 2, m.width, mid - band // 2 + band)).resize((1024, 140), Image.LANCZOS)
    m = ImageEnhance.Color(ImageEnhance.Contrast(m).enhance(1.25)).enhance(1.1)
    m.save(os.path.join(OUT, "marquee.jpg"), quality=88, optimize=True)
    for name in ("parts", "enamel", "enamel_orm", "marquee"):
        p = os.path.join(OUT, name + ".jpg")
        print(name, Image.open(p).size, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
