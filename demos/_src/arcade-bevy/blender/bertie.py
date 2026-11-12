"""Builds the arcade's second machine, a homage to Bertie the Brain (1950), as assets/bertie.glb.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/bertie.py                      build and export
    <bpy venv>/bin/python blender/bertie.py --preview out.png    also render a look (add --view hero)
    <bpy venv>/bin/python blender/bertie.py --lines reference    also render line art and depth for Gemini

Everything is written in the game's coordinates (metres, Y up) and converted on the way in. The
machine stands at its own origin facing +Z, so the game can put it anywhere.

The real machine was about four metres tall. The room's ceiling is at 3.2 m, so this one is 2.75 m.
What it keeps (see the sources in src/bertie.rs): a tall upright board of nine squares with an X lamp
and an O lamp in each, a sign either side that says whose turn it is, each with a "Win" lamp, and a
raised panel in front with nine lit keys in a three by three grid.

The game finds these objects by name (src/bertie_machine.rs):

    Lamp_X_0..8, Lamp_O_0..8   the board's lamps; cell 0 is top left as the player sees it, row by row
    Key_0..8                   the keypad's caps, numbered the same way; they sink along their own Y
    Sign_Player, Sign_Machine  whose turn it is; Sign_Win, Sign_Lose, Sign_Draw   how it ended
    Dial_Difficulty            a knob with five notches; it turns about its own Y
    Button_Reset               starts a new game; it sinks along its own Y
    Marquee_Bertie             the name board
    Bertie_Deck                an empty that carries the console's tilt; the controls hang off it

Everything else is scenery, joined into one mesh per material.

Textures: the walnut and steel are the room's shared set (blender/tex/, made by textures.py on the
look branch). Until that lands here, copies sit in blender/tex_bertie/. Bertie's own pictures are
tex_bertie/parts.jpg (an atlas: lamp glass, key cap, label plates) and tex_bertie/marquee.jpg.
assets/ART-bertie.md says which generated image each came from.
"""

import math
import os
import sys

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")
TEX_SHARED = os.path.join(HERE, "tex")
TEX_OWN = os.path.join(HERE, "tex_bertie")

# One texture repeat covers this many metres. The same as the first cabinet's.
TEX_METRES = {"walnut": 0.70, "steel": 0.25}

# ---------------------------------------------------------------- coordinates


def B(x, y, z):
    """Game coordinates to Blender's (Z up, the machine facing -Y)."""
    return Vector((x, -z, y))


def G(v):
    """Blender coordinates back to the game's."""
    return (v.x, v.z, -v.y)


def rot_x(a):
    return Matrix.Rotation(a, 4, "X")


# ---------------------------------------------------------------- the layout

# Fixed points the game also relies on (src/bertie_machine.rs). BERTIE.md lists them.
HEIGHT = 2.75
BODY_HALF = 0.77      # half the width between the side panels
PANEL_T = 0.05
FACE_Z = 0.10         # the front of the tower, which carries the board
BACK_Z = -0.42
LOWER_Z = 0.36        # the front of the lower body
BOARD_C = (0.0, 1.80)
CELL_PITCH, MULLION = 0.25, 0.016
BOARD_BAR = 0.030     # the steel frame round the board
# The console is steep and close under the board, so board and keys share one view from the seat.
DECK_C = (0.0, 1.15, 0.42)
DECK_TILT = 0.65
DECK_D = 0.58
KEY_PITCH, KEY_SIZE, KEY_H = 0.165, 0.142, 0.034
PLATE_T = 0.006
COLLAR_H = 0.012      # the black grid the keys stand in
DIAL_AT, RESET_AT = (0.52, 0.05), (-0.52, 0.03)  # across the deck, and down it
# The dial's five notches, in radians clockwise from straight up the deck. The game uses the same.
DIAL_STEP = 0.6
LEVELS = 5
# Where the player's eye is at the machine and what it looks at. Proposed to the game; see BERTIE.md.
SEAT_EYE, SEAT_AIM, SEAT_FOV = (0.0, 1.52, 1.575), (0.0, 1.49, 0.10), 68.0
HERO_EYE, HERO_AIM = (-1.75, 1.62, 3.1), (0.0, 1.38, 0.10)

DECK = Matrix.Translation(B(*DECK_C)) @ rot_x(DECK_TILT)

# Where each picture sits in tex_bertie/parts.jpg, in pixels from the top left of a 1024 square.
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


def atlas_uv(name):
    x0, y0, x1, y1 = ATLAS[name]
    return x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024


def cell_centre(i):
    """Cell 0 is top left as the player sees it."""
    row, col = divmod(i, 3)
    return (BOARD_C[0] + (col - 1) * CELL_PITCH, BOARD_C[1] + (1 - row) * CELL_PITCH)


def deck_point(x, y, z):
    """A point in the deck's frame (x across, y out of the deck, z down it toward the player), in
    game coordinates."""
    return G(DECK @ Vector((x, -z, y)))


# ---------------------------------------------------------------- materials

MATS = {}
TEXTURED = {"wood", "steel", "glass", "parts"}


def tex_file(name):
    """The shared set if it is here, else Bertie's own folder, else nothing."""
    for folder in (TEX_SHARED, TEX_OWN):
        path = os.path.join(folder, name + ".jpg")
        if os.path.exists(path):
            return path
    return None


def material(name, color=(1, 1, 1), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, tex=None, orm=True, emit_tex=False):
    mat = bpy.data.materials.new("Bertie_" + name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    path = tex_file(tex) if tex else None
    if path:
        base = nt.nodes.new("ShaderNodeTexImage")
        base.image = bpy.data.images.load(path, check_existing=True)
        if color == (1, 1, 1):
            nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            # A tint over the picture. glTF carries it as the base colour factor.
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs["B"].default_value = (*color, 1)
            nt.links.new(base.outputs["Color"], mix.inputs["A"])
            nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        if emit_tex:
            # The same picture shapes the light, so glass keeps its grain when it is lit.
            glow = nt.nodes.new("ShaderNodeMix")
            glow.data_type = "RGBA"
            glow.blend_type = "MULTIPLY"
            glow.inputs["Factor"].default_value = 1.0
            glow.inputs["B"].default_value = (*emit, 1)
            nt.links.new(base.outputs["Color"], glow.inputs["A"])
            nt.links.new(glow.outputs["Result"], bsdf.inputs["Emission Color"])
        orm_path = tex_file(tex + "_orm") if orm else None
        if orm_path:
            # Green is roughness and blue is metal, as glTF packs them.
            node = nt.nodes.new("ShaderNodeTexImage")
            node.image = bpy.data.images.load(orm_path, check_existing=True)
            node.image.colorspace_settings.name = "Non-Color"
            split = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(node.outputs["Color"], split.inputs[0])
            nt.links.new(split.outputs["Green"], bsdf.inputs["Roughness"])
            nt.links.new(split.outputs["Blue"], bsdf.inputs["Metallic"])
        relief = tex_file(tex + "_n") if orm else None
        if relief:
            # The grain's relief, so the wood's sheen breaks up along the grain under a lamp.
            node = nt.nodes.new("ShaderNodeTexImage")
            node.image = bpy.data.images.load(relief, check_existing=True)
            node.image.colorspace_settings.name = "Non-Color"
            bump = nt.nodes.new("ShaderNodeNormalMap")
            bump.uv_map = "UVMap"
            nt.links.new(node.outputs["Color"], bump.inputs["Color"])
            nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    MATS[name] = mat
    return mat


def materials():
    material("wood", rough=0.42, tex="walnut")
    if "--room-steel" in sys.argv:
        # The first cabinet's steel on the look branch: all metal, lit by the room's reflection cube.
        material("steel", rough=0.34, metal=1.0, tex="steel")
    else:
        # Without a reflection cube pure metal goes near black, so this steel keeps a little plain colour.
        material("steel", rough=0.36, metal=0.8, tex="steel", orm=False)
    material("black", color=(0.006, 0.006, 0.007), rough=0.85)
    material("bakelite", color=(0.012, 0.011, 0.010), rough=0.32)
    material("glow", color=(0, 0, 0), emit=(1.0, 0.60, 0.26), emit_strength=3.4)
    material("pip", color=(0.30, 0.18, 0.08), rough=0.4, emit=(1.0, 0.62, 0.28), emit_strength=2.6)
    material("bulb", color=(0.16, 0.11, 0.07), rough=0.20, emit=(1.0, 0.60, 0.30), emit_strength=0.03)
    material("bulb_on", color=(0.80, 0.62, 0.40), rough=0.20, emit=(1.0, 0.58, 0.22), emit_strength=2.4)
    material("bulb_red", color=(0.30, 0.03, 0.02), rough=0.20, emit=(1.0, 0.10, 0.04), emit_strength=0.5)
    # The glass behind each square's lamps, and the engraved plates. Both are cut from the atlas.
    material("glass", color=(0.46, 0.48, 0.52), rough=0.55, tex="parts", orm=False, emit=(0.80, 0.84, 0.90), emit_strength=0.02, emit_tex=True)
    material("parts", rough=0.40, tex="parts", orm=False)
    material("dome", color=(0.74, 0.66, 0.52), rough=0.26, emit=(1.0, 0.82, 0.58), emit_strength=0.35)
    material("dome_reset", color=(0.30, 0.012, 0.012), rough=0.08, emit=(1.0, 0.06, 0.03), emit_strength=0.03)
    # The game lights these. As exported they are the unlit look: frosted glass you can just see.
    material("lamp_x", color=(0.60, 0.56, 0.50), rough=0.45, tex="parts", orm=False, emit=(1.0, 0.50, 0.16), emit_strength=0.03, emit_tex=True)
    material("lamp_o", color=(0.66, 0.66, 0.66), rough=0.45, tex="parts", orm=False, emit=(1.0, 0.80, 0.56), emit_strength=0.03, emit_tex=True)
    material("key", color=(0.74, 0.68, 0.58), rough=0.30, tex="parts", orm=False, emit=(1.0, 0.80, 0.56), emit_strength=0.10, emit_tex=True)
    material("sign", color=(0.0, 0.0, 0.0), rough=0.3)
    material("marquee", rough=0.3, tex="marquee", orm=False, emit=(1, 1, 1), emit_strength=1.3, emit_tex=True)


# ---------------------------------------------------------------- scenery geometry

# Scenery gathers here, one bmesh per material, and becomes one object each at the end.
BUCKETS = {}
SMOOTH = {"bulb", "bulb_on", "bulb_red"}
GRAIN = {"up": Vector((0, 0, 1)), "across": Vector((1, 0, 0))}
PIECE = [0]


def bucket(mat):
    if mat not in BUCKETS:
        bm = bmesh.new()
        if mat in TEXTURED:
            bm.loops.layers.uv.new("UVMap")
        BUCKETS[mat] = bm
    return BUCKETS[mat]


def wood_uv(bm, faces, grain):
    """Lays the grain (the picture's V) along `grain` on every face it can lie in. Each piece starts
    at a different place in the picture, so two panels never show the same figure."""
    uv = bm.loops.layers.uv["UVMap"]
    s = 1.0 / TEX_METRES["walnut"]
    PIECE[0] += 1
    off = ((PIECE[0] * 0.377) % 1.0, (PIECE[0] * 0.613) % 1.0)
    for f in faces:
        n = f.normal
        g = GRAIN[grain]
        v_axis = g - n * g.dot(n)
        if v_axis.length < 0.3:
            alt = GRAIN["across" if grain == "up" else "up"]
            v_axis = alt - n * alt.dot(n)
        v_axis.normalize()
        u_axis = v_axis.cross(n)
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (p.dot(u_axis) * s + off[0], p.dot(v_axis) * s + off[1])


def steel_uv(bm, faces):
    """Lays U along each face's longest edge, so brushed steel is brushed along every strip."""
    uv = bm.loops.layers.uv["UVMap"]
    s = 1.0 / TEX_METRES["steel"]
    for f in faces:
        edge = max(f.edges, key=lambda e: e.calc_length())
        u_axis = (edge.verts[1].co - edge.verts[0].co).normalized()
        v_axis = f.normal.cross(u_axis)
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (p.dot(u_axis) * s, p.dot(v_axis) * s)


def paint(bm, faces, mat, grain):
    bm.normal_update()
    if mat == "wood":
        wood_uv(bm, faces, grain)
    elif mat == "steel":
        steel_uv(bm, faces)


def add_box(mat, size, pos, frame=None, grain="across", tilt=0.0):
    """A box of `size` centred on `pos` in game coordinates, or in `frame` (the deck's) if given.
    `tilt` leans it about the game's X axis round its own centre."""
    bm = bucket(mat)
    sx, sy, sz = size
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    shape = Matrix.Diagonal((sx, sz, sy, 1.0))
    if frame is not None:
        m = frame @ Matrix.Translation(Vector((pos[0], -pos[2], pos[1]))) @ shape
    else:
        m = Matrix.Translation(B(*pos)) @ rot_x(tilt) @ shape
    bmesh.ops.transform(bm, matrix=m, verts=verts)
    paint(bm, list({f for v in verts for f in v.link_faces}), mat, grain)


def add_prism(mat, outline, x0, x1, grain="up"):
    """A solid with the (z, y) `outline` as its section, from x0 to x1."""
    bm = bucket(mat)
    a = [bm.verts.new(B(x0, y, z)) for z, y in outline]
    b = [bm.verts.new(B(x1, y, z)) for z, y in outline]
    faces = [bm.faces.new(a), bm.faces.new(list(reversed(b)))]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new([a[j], a[i], b[i], b[j]]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    paint(bm, faces, mat, grain)


def add_strip(mat, a, b, width, thick, x):
    """A flat bar from `a` to `b`, both (z, y) points on a side panel's edge, `width` across x."""
    (z0, y0), (z1, y1) = a, b
    length = math.hypot(z1 - z0, y1 - y0)
    tilt = math.atan2(z1 - z0, y1 - y0)  # 0 when the bar stands upright
    add_box(mat, (width, length, thick), (x, (y0 + y1) / 2, (z0 + z1) / 2), tilt=tilt)


def add_frame(mat, cx, cy, w, h, z, bar, depth):
    """Four bars round a `w` by `h` opening on the front, centred on (cx, cy), their faces at `z`."""
    zc = z - depth / 2
    add_box(mat, (w + 2 * bar, bar, depth), (cx, cy + h / 2 + bar / 2, zc))
    add_box(mat, (w + 2 * bar, bar, depth), (cx, cy - h / 2 - bar / 2, zc))
    for s in (-1, 1):
        add_box(mat, (bar, h, depth), (cx + s * (w / 2 + bar / 2), cy, zc))


def add_bevel_frame(mat, cx, cy, w, h, z_back, z_front, bar, flat, z_inner):
    """A mitred frame round a `w` by `h` opening: a flat rim `flat` wide at `z_front`, then a slope
    down to the opening at `z_inner`. The slope catches the light the way a deep bezel does."""
    bm = bucket(mat)
    rings = []
    for hw, hh, z in ((w / 2 + bar, h / 2 + bar, z_back), (w / 2 + bar, h / 2 + bar, z_front),
                      (w / 2 + bar - flat, h / 2 + bar - flat, z_front), (w / 2, h / 2, z_inner)):
        rings.append([bm.verts.new(B(cx + sx * hw, cy + sy * hh, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    faces = []
    for lo, hi in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            faces.append(bm.faces.new([lo[i], lo[j], hi[j], hi[i]]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    bm.normal_update()
    # recalc can turn an open shell inside out; the rim must face the player (Blender's -Y).
    rim = faces[4]
    if rim.normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=faces)
    paint(bm, faces, mat, "across")


def add_deck_frame(mat, cx, cz, w, d, y, bar, height):
    """Four bars round a `w` by `d` patch of the deck, their tops at `y` above it."""
    yc = y - height / 2
    for s in (-1, 1):
        add_box(mat, (w + 2 * bar, height, bar), (cx, yc, cz + s * (d / 2 + bar / 2)), frame=DECK)
        add_box(mat, (bar, height, d), (cx + s * (w / 2 + bar / 2), yc, cz), frame=DECK)


def add_quad(mat, corners, picture):
    """A flat picture from the atlas. `corners` run bottom left, bottom right, top right, top left."""
    bm = bucket(mat)
    uv = bm.loops.layers.uv["UVMap"]
    u0, v0, u1, v1 = atlas_uv(picture)
    f = bm.faces.new([bm.verts.new(c) for c in corners])
    for loop, t in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[uv].uv = t


def front_plate(mat, picture, w, h, pos):
    """A picture on the front of the machine, centred on `pos`."""
    x, y, z = pos
    add_quad(mat, [B(x - w / 2, y - h / 2, z), B(x + w / 2, y - h / 2, z), B(x + w / 2, y + h / 2, z), B(x - w / 2, y + h / 2, z)], picture)


def deck_plate(mat, picture, w, d, x, z, y):
    """A picture lying on the deck, centred on (x, z) at `y` above it. Its top is up the deck."""
    pts = [DECK @ Vector((x + px, -(z + pz), y)) for px, pz in ((-w / 2, d / 2), (w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2))]
    add_quad(mat, pts, picture)


def add_ball(mat, r, pos):
    bm = bucket(mat)
    made = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    bmesh.ops.translate(bm, verts=made["verts"], vec=B(*pos))


def lathe(bm, profile, segs=40, mat_index=0, smooth=True, flute=0.0, matrix=None):
    """Turns a profile of (radius, height) points about the up axis, bottom to top. Each band has its
    own vertices, so bands meet at a crisp edge. `flute` cuts grooves of that depth for a grip."""

    def ring(r, z):
        if r <= 1e-9:
            return [bm.verts.new((0, 0, z))]
        out = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = r - (flute if i % 2 else 0.0)
            out.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        return out

    faces = []
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        lo, hi = ring(r0, z0), ring(r1, z1)
        for i in range(segs):
            j = (i + 1) % segs
            if len(lo) == 1:
                vs = [lo[0], hi[j], hi[i]]
            elif len(hi) == 1:
                vs = [lo[i], lo[j], hi[0]]
            else:
                vs = [lo[i], lo[j], hi[j], hi[i]]
            f = bm.faces.new(vs)
            f.smooth = smooth
            f.material_index = mat_index
            faces.append(f)
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=list({v for f in faces for v in f.verts}))
    return faces


def add_lathe(mat, profile, x, z, segs=40):
    """A turned part standing on the deck at (x, z)."""
    bm = bucket(mat)
    faces = lathe(bm, profile, segs=segs, matrix=DECK @ Matrix.Translation(Vector((x, -z, 0))))
    if mat == "steel":
        # U runs round the axis, so the steel reads as turned on a lathe.
        uv = bm.loops.layers.uv["UVMap"]
        axis = DECK.to_3x3() @ Vector((0, 0, 1))
        centre = DECK @ Vector((x, -z, 0))
        side = DECK.to_3x3() @ Vector((1, 0, 0))
        fwd = axis.cross(side)
        for f in faces:
            angles = []
            for loop in f.loops:
                d = loop.vert.co - centre
                angles.append(math.atan2(d.dot(fwd), d.dot(side)) / (2 * math.pi))
            # Keep each face on one side of the seam where the angle wraps.
            if max(angles) - min(angles) > 0.5:
                angles = [a + 1.0 if a < 0 else a for a in angles]
            for loop, ang in zip(f.loops, angles):
                d = loop.vert.co - centre
                loop[uv].uv = (ang * 2.0, (d.dot(axis) + (d - axis * d.dot(axis)).length) * 4.0)


def finish_buckets():
    for mat, bm in BUCKETS.items():
        mesh = bpy.data.meshes.new(f"Bertie_{mat}")
        # The exporter cannot work out tangents for faces with more than four corners.
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        smooth = [f.smooth for f in bm.faces]
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(f"Bertie_{mat}", mesh)
        bpy.context.collection.objects.link(obj)
        for poly, s in zip(mesh.polygons, smooth):
            poly.use_smooth = s or mat in SMOOTH
    BUCKETS.clear()


# ---------------------------------------------------------------- working parts


def mesh_object(name, bm, mats, parent=None, location=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for m in mats:
        mesh.materials.append(MATS[m])
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


def quad_object(name, mat, w, h, pos):
    """A flat panel facing the player. UVs run 0..1, so the game can paint a picture on it."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    pts = [(-w / 2, -h / 2, 0, 0), (w / 2, -h / 2, 1, 0), (w / 2, h / 2, 1, 1), (-w / 2, h / 2, 0, 1)]
    verts = [bm.verts.new(B(x, y, 0)) for x, y, _, _ in pts]
    f = bm.faces.new(verts)
    for loop, p in zip(f.loops, pts):
        loop[uv].uv = (p[2], p[3])
    return mesh_object(name, bm, [mat], location=B(*pos))


def planar_uv(bm, picture, span, up_axis):
    """Maps the atlas picture straight onto the part, `span` metres across, seen from its face."""
    uv = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = atlas_uv(picture)
    for f in bm.faces:
        for loop in f.loops:
            p = loop.vert.co
            s = min(max(p.x / span + 0.5, 0.0), 1.0)
            t = min(max(getattr(p, up_axis) / span + 0.5, 0.0), 1.0)
            loop[uv].uv = (u0 + s * (u1 - u0), v0 + t * (v1 - v0))


def x_lamp(name, at):
    """A flat cross of moulded glass, lying back against the square's glass."""
    arm, half, thick = 0.013, 0.104, 0.012
    plus = [(arm, arm), (half, arm), (half, -arm), (arm, -arm), (arm, -half), (-arm, -half),
            (-arm, -arm), (-half, -arm), (-half, arm), (-arm, arm), (-arm, half), (arm, half)]
    c = math.sqrt(0.5)
    pts = [((x - y) * c, (x + y) * c) for x, y in plus]
    bm = bmesh.new()
    # The face looks at the player (Blender's -Y). Its edge is drawn in a little, like a casting.
    front = [bm.verts.new((x * 0.94, -thick, z * 0.94)) for x, z in pts]
    back = [bm.verts.new((x, 0, z)) for x, z in pts]
    faces = [bm.faces.new(front)]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new([front[i], front[j], back[j], back[i]]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    bm.normal_update()
    if faces[0].normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=faces)
    planar_uv(bm, "glass", CELL_PITCH, "z")
    return mesh_object(name, bm, ["lamp_x"], location=B(*at))


def o_lamp(name, at):
    """A fat ring of glass tube, standing in front of the cross so the two never touch."""
    bm = bmesh.new()
    big, small, nu, nv = 0.082, 0.013, 32, 8
    rings = []
    for i in range(nu):
        u = 2 * math.pi * i / nu
        ring = []
        for j in range(nv):
            v = 2 * math.pi * j / nv
            r = big + small * math.cos(v)
            ring.append(bm.verts.new((r * math.cos(u), small * math.sin(v), r * math.sin(u))))
        rings.append(ring)
    for i in range(nu):
        for j in range(nv):
            a, b = rings[i], rings[(i + 1) % nu]
            bm.faces.new([a[j], a[(j + 1) % nv], b[(j + 1) % nv], b[j]]).smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    planar_uv(bm, "glass", CELL_PITCH, "z")
    return mesh_object(name, bm, ["lamp_o"], location=B(*at))


def key_cap(name, parent, x, z):
    """A heavy square key of milky plastic with cut corners and a chamfered top. Its origin is on
    the plate; pressing sinks it along its own up axis."""
    bm = bmesh.new()

    def ring(half, cut, h):
        a, b = half, half - cut
        pts = [(b, -a), (a, -b), (a, b), (b, a), (-b, a), (-a, b), (-a, -b), (-b, -a)]
        return [bm.verts.new((px, py, h)) for px, py in pts]

    half = KEY_SIZE / 2
    levels = [ring(half, 0.012, 0.0), ring(half, 0.012, KEY_H - 0.009), ring(half - 0.009, 0.010, KEY_H)]
    for lo, hi in zip(levels, levels[1:]):
        for i in range(8):
            j = (i + 1) % 8
            bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    bm.faces.new(levels[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    planar_uv(bm, "key", KEY_SIZE, "y")
    obj = mesh_object(name, bm, ["key"], parent=parent)
    obj.location = (x, -z, PLATE_T)
    return obj


def dial(parent):
    """A chunky fluted knob with a long pointer bar. Its base ring is scenery; this is what turns.
    At rest the pointer lies straight up the deck."""
    bm = bmesh.new()
    lathe(bm, [(0.076, 0.020), (0.072, 0.064)], segs=36, mat_index=0, smooth=False, flute=0.005)
    lathe(bm, [(0.072, 0.064), (0.064, 0.072), (0.0, 0.072)], segs=36, mat_index=0)
    # The pointer: a cream bar across the top that reaches out past the grip to the numbers.
    w, tail, shoulder, tip, lo, hi = 0.017, -0.050, 0.086, 0.122, 0.060, 0.086
    outline = [(-w, tail), (w, tail), (w, shoulder), (0.0, tip), (-w, shoulder)]
    a = [bm.verts.new((x, y, lo)) for x, y in outline]
    b = [bm.verts.new((x * 0.8, y if y != tip else y - 0.004, hi)) for x, y in outline]
    made = [bm.faces.new(a), bm.faces.new(b)]
    for i in range(5):
        j = (i + 1) % 5
        made.append(bm.faces.new([a[i], a[j], b[j], b[i]]))
    bmesh.ops.recalc_face_normals(bm, faces=made)
    for f in made:
        f.material_index = 2
    # A lit line along the pointer's spine.
    made = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=made["verts"], vec=(0.007, 0.120, 0.003))
    bmesh.ops.translate(bm, verts=made["verts"], vec=(0, 0.030, hi + 0.001))
    for f in {f for v in made["verts"] for f in v.link_faces}:
        f.material_index = 3
    obj = mesh_object("Dial_Difficulty", bm, ["bakelite", "bakelite", "dome", "pip"], parent=parent)
    obj.location = (DIAL_AT[0], -DIAL_AT[1], 0)
    return obj


def reset_button(parent):
    """A fat mushroom plunger. Its collar is scenery; this is the part that goes down."""
    bm = bmesh.new()
    lathe(bm, [(0.040, 0.004), (0.040, 0.044)], segs=32, mat_index=0)
    lathe(bm, [(0.044, 0.044), (0.070, 0.047), (0.074, 0.058), (0.068, 0.072), (0.048, 0.083), (0.022, 0.088), (0.0, 0.089)],
          segs=32, mat_index=1)
    # Smooth across the cap's bands, so it is one soft dome.
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.z > 0.0465], dist=1e-5)
    obj = mesh_object("Button_Reset", bm, ["bakelite", "dome_reset"], parent=parent)
    obj.location = (RESET_AT[0], -RESET_AT[1], 0)
    return obj


# ---------------------------------------------------------------- the machine


def side_profile():
    """The outline of a side panel's front edge as (z, y) points, top to bottom. It runs straight
    down the tower, follows the console a little above its top, and returns to the lower body."""
    def cheek(y, z):
        p = deck_point(0, y, z)
        return (p[2], p[1])

    # The cheek's nose is cut back, so it meets the deck's front lip without a point.
    return [(0.19, HEIGHT - 0.012), (0.19, 1.47), cheek(0.050, -DECK_D / 2 - 0.02), cheek(0.050, DECK_D / 2 - 0.030),
            cheek(-0.005, DECK_D / 2 + 0.022), cheek(-0.075, DECK_D / 2 + 0.022), (LOWER_Z + 0.03, 0.74), (LOWER_Z + 0.03, 0.0)]


def side_panels():
    front = side_profile()
    outline = front + [(BACK_Z, 0.0), (BACK_Z, HEIGHT - 0.012)]
    for side in (-1, 1):
        x = side * (BODY_HALF + PANEL_T / 2)
        add_prism("wood", outline, x - PANEL_T / 2, x + PANEL_T / 2, grain="up")
        # Steel edging down the front, with a hairline of warm light set into it.
        for a, b in zip(front, front[1:]):
            add_strip("steel", a, b, PANEL_T + 0.006, 0.012, x)
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if a[1] > 0.95 and b[1] > 0.80 and length > 0.2:
                # The line stands just proud of the steel, on its inner edge, along the strip's own normal.
                nz, ny = -(b[1] - a[1]) / length * 0.0065, (b[0] - a[0]) / length * 0.0065
                add_strip("glow", (a[0] + nz, a[1] + ny), (b[0] + nz, b[1] + ny), 0.006, 0.003, x - side * 0.016)


def body():
    w = 2 * BODY_HALF
    top = HEIGHT - 0.012
    # The lower body and the tower. The grain stands on the lower front and runs across the fascia.
    add_box("wood", (w, 0.76, LOWER_Z - BACK_Z), (0, 0.38, (LOWER_Z + BACK_Z) / 2), grain="up")
    add_box("wood", (w, top - 0.76, FACE_Z - BACK_Z), (0, (top + 0.76) / 2, (FACE_Z + BACK_Z) / 2))
    # The console: a wedge whose top is the deck.
    far, near, nose = deck_point(0, 0, -DECK_D / 2), deck_point(0, 0, DECK_D / 2), deck_point(0, -0.07, DECK_D / 2)
    add_prism("wood", [(far[2], far[1]), (near[2], near[1]), (nose[2], nose[1]), (LOWER_Z, 0.74), (FACE_Z - 0.02, 0.74), (FACE_Z - 0.02, far[1])],
              -BODY_HALF, BODY_HALF, grain="across")
    side_panels()
    # A steel cap over the whole top.
    add_box("steel", (w + 2 * PANEL_T + 0.016, 0.012, 0.19 - BACK_Z + 0.02), (0, HEIGHT - 0.006, (0.19 + BACK_Z) / 2 + 0.01))
    # Shadow gaps where the fascia's panels meet: above the console and under the name board.
    for y in (far[1] + 0.035, 2.372):
        add_box("black", (w, 0.007, 0.004), (0, y, FACE_Z + 0.001))
    # A slatted steel grille and a kick plate on the lower body, and the maker's plate beside them.
    add_box("black", (0.62, 0.30, 0.004), (0, 0.36, LOWER_Z + 0.002))
    for i in range(7):
        # The slats lean down, so they sit in their own shade and the grille stays quiet.
        add_box("steel", (0.62, 0.024, 0.008), (0, 0.24 + i * 0.040, LOWER_Z + 0.009), tilt=-0.7)
    add_bevel_frame("steel", 0, 0.36, 0.62, 0.30, LOWER_Z, LOWER_Z + 0.016, 0.014, 0.006, LOWER_Z + 0.004)
    add_box("steel", (w, 0.085, 0.006), (0, 0.0425, LOWER_Z + 0.003))
    front_plate("parts", "maker", 0.24, 0.060, (0.56, 0.25, LOWER_Z + 0.003))


def board():
    bx, by = BOARD_C
    span = 3 * CELL_PITCH
    opening = CELL_PITCH - MULLION
    # A black field in a deep steel frame, parted into nine squares by steel bars.
    add_box("black", (span + 0.01, span + 0.01, 0.003), (bx, by, FACE_Z + 0.0015))
    add_bevel_frame("steel", bx, by, span, span, FACE_Z, FACE_Z + 0.050, BOARD_BAR, 0.008, FACE_Z + 0.012)
    for s in (-1, 1):
        off = s * CELL_PITCH / 2
        add_box("steel", (MULLION, span, 0.034), (bx + off, by, FACE_Z + 0.017))
        add_box("steel", (span, MULLION, 0.034), (bx, by + off, FACE_Z + 0.017))
    # A hairline of light on the fascia, close round the frame.
    add_frame("glow", bx, by, span + 2 * BOARD_BAR + 0.006, span + 2 * BOARD_BAR + 0.006, FACE_Z + 0.004, 0.005, 0.004)
    for i in range(9):
        cx, cy = cell_centre(i)
        # Frosted glass with a dark bulb behind it. It is seen whether or not the lamps are lit.
        front_plate("glass", "cell", opening, opening, (cx, cy, FACE_Z + 0.004))
        x_lamp(f"Lamp_X_{i}", (cx, cy, FACE_Z + 0.006))
        o_lamp(f"Lamp_O_{i}", (cx, cy, FACE_Z + 0.040))


def signs():
    w = 2 * BODY_HALF
    # The name board across the top.
    add_box("black", (w, 0.30, 0.05), (0, 2.53, FACE_Z + 0.025))
    for s in (-1, 1):
        add_box("steel", (w, 0.014, 0.060), (0, 2.53 + s * 0.143, FACE_Z + 0.030))
    quad_object("Marquee_Bertie", "marquee", 1.50, 0.254, (0, 2.53, FACE_Z + 0.0515))

    # The signs either side of the board. The machine's are on the left, the player's on the right,
    # each with its "Win" lamp beneath. The two are the same size and build, so they look alike unlit.
    sz = FACE_Z + 0.022
    side_x = (BODY_HALF + BOARD_C[0] + 1.5 * CELL_PITCH + BOARD_BAR) / 2
    panels = [("Sign_Machine", -side_x, 1.99, 0.30, 0.45), ("Sign_Lose", -side_x, 1.585, 0.30, 0.21),
              ("Sign_Player", side_x, 1.99, 0.30, 0.45), ("Sign_Win", side_x, 1.585, 0.30, 0.21),
              # The draw lamp sits over the board, between two banks of small bulbs.
              ("Sign_Draw", 0.0, 2.295, 0.40, 0.10)]
    for name, cx, cy, sw, sh in panels:
        add_box("black", (sw + 0.02, sh + 0.02, 0.020), (cx, cy, FACE_Z + 0.010))
        add_bevel_frame("steel", cx, cy, sw, sh, FACE_Z, sz + 0.012, 0.010, 0.004, sz + 0.001)
        quad_object(name, "sign", sw, sh, (cx, cy, sz))

    # The brain: two banks of small bulbs beside the draw lamp. A few are lit.
    lit, red = {2, 12, 19, 27, 30}, {5, 9, 22}
    n = 0
    for side in (-1, 1):
        cx = side * 0.49
        # A dark plate in a thin steel frame, with the bulbs standing through it.
        add_box("bakelite", (0.50, 0.10, 0.006), (cx, 2.295, FACE_Z + 0.003))
        add_bevel_frame("steel", cx, 2.295, 0.50, 0.10, FACE_Z, FACE_Z + 0.012, 0.008, 0.003, FACE_Z + 0.006)
        for row in range(2):
            for col in range(8):
                kind = "bulb_on" if n in lit else "bulb_red" if n in red else "bulb"
                add_ball(kind, 0.010, (cx + (col - 3.5) * 0.058, 2.32 - row * 0.05, FACE_Z + 0.010))
                n += 1


def console():
    w = 2 * BODY_HALF
    # Steel round the deck's edge, as on the first cabinet, with a hairline of light inside it.
    add_box("steel", (w, 0.085, 0.016), (0, -0.0325, DECK_D / 2 + 0.008), frame=DECK)
    add_box("steel", (w, 0.010, 0.018), (0, 0.005, -DECK_D / 2 + 0.009), frame=DECK)
    add_box("glow", (w - 0.04, 0.004, 0.004), (0, 0.002, DECK_D / 2 - 0.006), frame=DECK)
    for s in (-1, 1):
        add_box("glow", (0.004, 0.004, DECK_D - 0.03), (s * (BODY_HALF - 0.006), 0.002, 0), frame=DECK)

    # The keypad: a steel plate carrying a black grid, with a key standing in each opening.
    field = 3 * KEY_PITCH
    rim = 0.030
    plate = field + 2 * rim
    add_box("steel", (plate, PLATE_T, plate), (0, PLATE_T / 2, 0), frame=DECK)
    # Each key stands in a well with a black floor, so a dark gap runs round every cap.
    add_box("bakelite", (field, 0.002, field), (0, PLATE_T + 0.001, 0), frame=DECK)
    web = KEY_PITCH - KEY_SIZE - 0.007
    for off in (-KEY_PITCH / 2, KEY_PITCH / 2):
        add_box("steel", (web, COLLAR_H, field), (off, PLATE_T + COLLAR_H / 2, 0), frame=DECK)
        add_box("steel", (field, COLLAR_H, web), (0, PLATE_T + COLLAR_H / 2, off), frame=DECK)
    add_deck_frame("steel", 0, 0, field + 0.007, field + 0.007, PLATE_T + COLLAR_H, rim - 0.0035, COLLAR_H)
    add_deck_frame("glow", 0, 0, plate + 0.010, plate + 0.010, 0.003, 0.004, 0.003)

    # The dial's base ring, its five ticks and their numbers. The gentlest is on the left.
    dx, dz = DIAL_AT
    add_lathe("steel", [(0.094, 0.0), (0.094, 0.010), (0.084, 0.020), (0.060, 0.020)], dx, dz)
    for level in range(LEVELS):
        a = (level - (LEVELS - 1) / 2) * DIAL_STEP
        sx, cz = math.sin(a), -math.cos(a)
        # Each tick lies along its own spoke.
        add_box("pip", (0.006, 0.003, 0.016), (0, 0.0015, -0.118), frame=DECK @ Matrix.Translation(Vector((dx, -dz, 0))) @ Matrix.Rotation(-a, 4, "Z"))
        deck_plate("parts", f"digit_{level + 1}", 0.036, 0.036, dx + 0.156 * sx, dz + 0.156 * cz, 0.002)
    deck_plate("parts", "difficulty", 0.170, 0.0425, dx, dz + 0.142, 0.002)

    # The reset plunger's collar and its plate.
    rx, rz = RESET_AT
    add_lathe("steel", [(0.090, 0.0), (0.090, 0.012), (0.078, 0.024), (0.046, 0.024)], rx, rz)
    deck_plate("parts", "new_game", 0.170, 0.0425, rx, rz + 0.142, 0.002)

    # Controls hang off an empty that carries the deck's tilt, so they move along the deck's own up.
    deck = bpy.data.objects.new("Bertie_Deck", None)
    deck.location = B(*DECK_C)
    deck.rotation_euler = (DECK_TILT, 0, 0)
    bpy.context.collection.objects.link(deck)
    for i in range(9):
        row, col = divmod(i, 3)
        # Row 0 is the far row, which the player sees as the top.
        key_cap(f"Key_{i}", deck, (col - 1) * KEY_PITCH, (row - 1) * KEY_PITCH)
    dial(deck)
    reset_button(deck)


def machine():
    body()
    board()
    signs()
    console()


# ---------------------------------------------------------------- checks


def bounds(obj):
    """An object's bounding box in game coordinates, as (min, max)."""
    pts = [G(obj.matrix_world @ Vector(c)) for c in obj.bound_box]
    return tuple(min(p[i] for p in pts) for i in range(3)), tuple(max(p[i] for p in pts) for i in range(3))


def seat_pixels(points, size=(1280, 720)):
    """Where game-space points land in the seat view, in pixels."""
    eye, aim = Vector(SEAT_EYE), Vector(SEAT_AIM)
    f = (aim - eye).normalized()
    r = f.cross(Vector((0, 1, 0))).normalized()
    u = r.cross(f)
    t = math.tan(math.radians(SEAT_FOV / 2))
    out = []
    for p in points:
        d = Vector(p) - eye
        out.append((size[0] / 2 + d.dot(r) / d.dot(f) / t * size[1] / 2, size[1] / 2 - d.dot(u) / d.dot(f) / t * size[1] / 2))
    return out


def report():
    bpy.context.view_layer.update()
    fmt = lambda p: "(" + ", ".join(f"{v:+.3f}" for v in p) + ")"
    lo_all, hi_all, tris = [1e9] * 3, [-1e9] * 3, 0
    print(f"{'node':<18} {'min (x, y, z)':<28} {'max (x, y, z)':<28} {'tris':>5}  seat view px (x0 y0 x1 y1), width %")
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type != "MESH":
            continue
        lo, hi = bounds(obj)
        n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        tris += n
        lo_all = [min(a, b) for a, b in zip(lo_all, lo)]
        hi_all = [max(a, b) for a, b in zip(hi_all, hi)]
        px = seat_pixels([G(obj.matrix_world @ v.co) for v in obj.data.vertices])
        xs, ys = [p[0] for p in px], [p[1] for p in px]
        seen = f"{min(xs):5.0f} {min(ys):5.0f} {max(xs):5.0f} {max(ys):5.0f}  {(max(xs) - min(xs)) / 12.8:4.1f}%"
        print(f"{obj.name:<18} {fmt(lo):<28} {fmt(hi):<28} {n:>5}  {seen}")
    print(f"{'ALL':<18} {fmt(lo_all):<28} {fmt(hi_all):<28} {tris:>5}")


# ---------------------------------------------------------------- pictures of it


def camera(eye, aim, fov=SEAT_FOV):
    cam = bpy.data.cameras.new("cam")
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(fov)
    cam.clip_start, cam.clip_end = 0.05, 50
    obj = bpy.data.objects.new("cam", cam)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = B(*eye)
    obj.rotation_euler = (B(*aim) - B(*eye)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = obj
    return obj


def room_shell():
    """The floor and the wall behind, so pictures show the machine standing somewhere. The wall is
    the room's: 0.6 m behind the origin, 3.2 m high."""
    for name, color, rough in (("pv_floor", (0.16, 0.16, 0.155), 0.25), ("pv_wall", (0.012, 0.022, 0.050), 0.5)):
        material(name, color=color, rough=rough)
    for mat, size, pos in (("pv_floor", (9, 0.1, 9), (0, -0.05, 2.0)), ("pv_wall", (9, 3.2, 0.1), (0, 1.6, -0.65)),
                           ("pv_wall", (9, 0.1, 9), (0, 3.25, 2.0))):
        bm = bmesh.new()
        verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.transform(bm, matrix=Matrix.Translation(B(*pos)) @ Matrix.Diagonal((size[0], size[2], size[1], 1.0)), verts=verts)
        mesh_object(mat, bm, [mat])


VIEWS = {"seat": (SEAT_EYE, SEAT_AIM, (1024, 576)), "hero": (HERO_EYE, HERO_AIM, (768, 1024))}


def flat(depth):
    """A flat emission material: distance from the camera as grey, or the surface normal as colour."""
    mat = bpy.data.materials.new("flat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs[0], out.inputs[0])
    if depth:
        cam = nt.nodes.new("ShaderNodeCameraData")
        rng = nt.nodes.new("ShaderNodeMapRange")
        rng.inputs["From Min"].default_value = depth[0]
        rng.inputs["From Max"].default_value = depth[1]
        rng.inputs["To Min"].default_value = 1.0
        rng.inputs["To Max"].default_value = 0.0
        nt.links.new(cam.outputs["View Z Depth"], rng.inputs["Value"])
        nt.links.new(rng.outputs[0], emit.inputs["Color"])
    else:
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        half = nt.nodes.new("ShaderNodeVectorMath")
        half.operation = "MULTIPLY_ADD"
        half.inputs[1].default_value = (0.5, 0.5, 0.5)
        half.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(geo.outputs["Normal"], half.inputs[0])
        nt.links.new(half.outputs[0], emit.inputs["Color"])
    return mat


def lines(out):
    """Line art and depth (near is white) from the seat and from a three-quarter view. Freestyle
    finds no strokes in this headless build, so the lines are drawn where the depth jumps or the
    surface turns, as blender/lines.py on the look branch does."""
    import numpy as np
    from PIL import Image

    os.makedirs(out, exist_ok=True)
    room_shell()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.filter_width = 0.01  # no blur across edges: the edge finder wants hard steps
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Raw"
    scene.world = bpy.data.worlds.new("w")
    layer = scene.view_layers[0]
    for name, (eye, aim, size) in VIEWS.items():
        camera(eye, aim)
        # Rendered at twice the size and halved, so thin parts keep a clean line.
        scene.render.resolution_x, scene.render.resolution_y = size[0] * 2, size[1] * 2
        far = 3.2 if name == "seat" else 6.5
        paths = {}
        for kind in ("depth", "normal"):
            layer.material_override = flat((0.5, far) if kind == "depth" else None)
            paths[kind] = scene.render.filepath = os.path.join(out, f"_bertie_{name}_{kind}.png")
            bpy.ops.render.render(write_still=True)
        d = np.asarray(Image.open(paths["depth"]).convert("RGB")).astype(np.float32)[:, :, 0] / 255.0
        n = np.asarray(Image.open(paths["normal"]).convert("RGB")).astype(np.float32) / 255.0
        line = np.zeros(d.shape, bool)
        for axis in (0, 1):
            dd = np.abs(np.diff(d, axis=axis, append=d.take([-1], axis=axis)))
            dn = np.abs(np.diff(n, axis=axis, append=n.take([-1], axis=axis))).sum(axis=2)
            line |= (dd > 0.012) | (dn > 0.30)
        ink = Image.fromarray(np.where(line, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)
        ink.save(os.path.join(out, f"bertie_{name}_lines.png"), optimize=True)
        Image.fromarray((d * 255).astype(np.uint8)).resize(size, Image.LANCZOS).save(os.path.join(out, f"bertie_{name}_depth.png"), optimize=True)
        for p in paths.values():
            os.remove(p)
        print("wrote", name, "lines and depth")
    layer.material_override = None


def preview(path, view):
    """A look at the machine, lit roughly as the room is. Only for checking the model by eye."""
    scene = bpy.context.scene
    room_shell()
    # A game in progress, so lit and unlit lamps can both be judged.
    material("x_lit", color=(0, 0, 0), emit=(1.0, 0.42, 0.10), emit_strength=3.5, tex="parts", orm=False, emit_tex=True)
    material("o_lit", color=(0, 0, 0), emit=(1.0, 0.80, 0.56), emit_strength=3.5, tex="parts", orm=False, emit_tex=True)
    material("key_lit", color=(0.7, 0.62, 0.48), emit=(1.0, 0.78, 0.52), emit_strength=1.6, tex="parts", orm=False, emit_tex=True)
    material("sign_lit", color=(0, 0, 0), emit=(1.0, 0.60, 0.26), emit_strength=1.5)
    taken = {0: "X", 4: "X", 2: "O", 7: "O"}
    for cell, mark in taken.items():
        keep, hide = ("Lamp_X_", "Lamp_O_") if mark == "X" else ("Lamp_O_", "Lamp_X_")
        bpy.data.objects[f"{keep}{cell}"].data.materials[0] = MATS["x_lit" if mark == "X" else "o_lit"]
        bpy.data.objects[f"{hide}{cell}"].hide_render = True
    for cell in range(9):
        if cell not in taken:
            bpy.data.objects[f"Key_{cell}"].data.materials[0] = MATS["key_lit"]
    bpy.data.objects["Sign_Player"].data.materials[0] = MATS["sign_lit"]
    eye, aim, size = VIEWS[view]
    camera(eye, aim)
    # The room's light: warm lamps overhead and in front, and a wash from the floor coves.
    for at, energy, color, soft in (((0.8, 3.0, 2.4), 420, (1.0, 0.86, 0.70), 0.6), ((-2.6, 2.0, 2.2), 260, (1.0, 0.80, 0.62), 0.8),
                                    ((0.0, 0.3, 3.0), 30, (1.0, 0.62, 0.30), 1.0)):
        lamp = bpy.data.objects.new("L", bpy.data.lights.new("L", "POINT"))
        lamp.data.energy = energy
        lamp.data.color = color
        lamp.data.shadow_soft_size = soft
        lamp.location = B(*at)
        scene.collection.objects.link(lamp)
    scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.045, 0.047, 0.055, 1)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path)


# ---------------------------------------------------------------- build and export


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()
    machine()
    finish_buckets()
    report()

    path = os.path.join(OUT, "bertie.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_image_format="AUTO",
        export_tangents=True,
        export_cameras=False,
        export_lights=False,
    )
    print("wrote", path, os.path.getsize(path), "bytes")

    # After the export, so the cameras, lamps and lit materials below never reach the file.
    if "--lines" in sys.argv:
        lines(sys.argv[sys.argv.index("--lines") + 1])
    elif "--preview" in sys.argv:
        view = sys.argv[sys.argv.index("--view") + 1] if "--view" in sys.argv else "seat"
        preview(sys.argv[sys.argv.index("--preview") + 1], view)


if __name__ == "__main__":
    main()
