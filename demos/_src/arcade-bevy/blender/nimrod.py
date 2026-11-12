"""Builds the arcade's third machine, a homage to Ferranti's Nimrod (1951), as assets/nimrod.glb.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/nimrod.py                      build and export
    <bpy venv>/bin/python blender/nimrod.py --preview out.png    also render a look (add --view hero)
    <bpy venv>/bin/python blender/nimrod.py --lines reference    also render line art and depth for Gemini

Everything is written in the game's coordinates (metres, Y up) and converted on the way in. The
machine stands at its own origin facing +Z, so the game can put it anywhere.

The real machine was 12 feet wide and 9 feet tall, a "tremendous gray refrigerator" with a separate
desk for the visitor. This one is 1.7 m wide, 2.58 m tall and 0.9 m deep with the desk built on. What
it keeps (see the sources in src/nimrod.rs): three panels across its face, the instructions lit one at
a time on the left, the game's four rows of seven lamps in the middle with a white lamp for the heap
changed last and the stage legends under them, and the registers on the right; on the desk, a button
under every lamp of every row, a zero button at the left of each row, the game switch, and COMP. MOVE.

The game finds these objects by name (src/nimrod_machine.rs):

    Lamp_Match_<h>_<n>     the face's lamps, heap h 0..3 (top row first), match n 1..7 from the left
    Lamp_Changed_<h>       the white lamp at the left of each row: the heap changed last
    Lamp_Instr_<i>         the instruction panel's eight lamps, top down, as the game's I_ constants
    Lamp_Reg_<h>_<b>       the registers: heap h's count in binary, b is 4, 2 or 1
    Lamp_Select_<h>        the register's choice of heap
    Lamp_Odd_<b>           the parity lamps under the registers' columns, b is 4, 2 or 1
    Legend_<name>          OpponentsMove, ComputersMove, OpponentWins, ComputerWins
    Key_<h>_<n>            the desk's buttons, laid out as the lamps; n 0 is the zero button. They
                           sink along their own Y. Keys 1..7 are lamps too: lit while their match is in.
    Lever_Game             the game switch; it swings about its own Z, left for simple, right for reverse
    Button_CompMove        COMP. MOVE; Button_NewGame deals a new position. Both sink along their own Y.
    Nimrod_Deck            an empty that carries the desk's tilt; the controls hang off it

Every lamp and legend is exported in its unlit look. The game lights it by raising its glow.
Everything else is scenery, joined into one mesh per material.
"""

import math
import os
import sys

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nimrod_atlas import ATLAS  # noqa: E402

OUT = os.path.join(HERE, "..", "assets")
TEX_SHARED = os.path.join(HERE, "tex")
TEX_OWN = os.path.join(HERE, "tex_nimrod")

# One texture repeat covers this many metres. Walnut and steel as on the other machines.
TEX_METRES = {"walnut": 0.70, "steel": 0.25, "enamel": 0.40}

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

HEIGHT = 2.58
BODY_HALF = 0.79      # half the width between the side panels
PANEL_T = 0.05
FACE_Z = -0.05        # the tower's face, which carries the three panels
BACK_Z = -0.45
LOWER_Z = 0.30        # the front of the lower body, under the desk
CHEEK_Z = 0.04        # how far the side panels stand proud of the face
# The face's lamp grid. Columns are shared with the desk, so a button sits under its lamp's column.
COL_PITCH = 0.088
ROWS_Y = (2.06, 1.94, 1.82, 1.70)
LAMP_R = 0.024        # a lamp's glass; its steel bezel is a little wider
PANEL_Y = (1.40, 2.22)
CENTRE_HALF = 0.40
SIDE_C, SIDE_HALF = 0.625, 0.15
LEGEND_W, LEGEND_H = 0.32, 0.08
LEGENDS = {"OpponentsMove": (-0.175, 1.555), "ComputersMove": (0.175, 1.555),
           "OpponentWins": (-0.175, 1.455), "ComputerWins": (0.175, 1.455)}
LEGEND_PICTURES = {"OpponentsMove": "opponents_move", "ComputersMove": "computers_move",
                   "OpponentWins": "opponent_wins", "ComputerWins": "computer_wins"}
INSTR_Y0, INSTR_PITCH = 2.08, 0.08
REG_X = {4: 0.535, 2: 0.605, 1: 0.675}
SELECT_X = 0.75
ODD_Y = 1.565
# The desk: a sloping top in front of the face. Its controls hang off an empty with this tilt.
DECK_C = (0.0, 1.05, 0.20)
DECK_TILT = 0.5
DECK_D = 0.52
KEY_ROWS_Z = (-0.085, 0.0, 0.085, 0.17)   # down the deck, toward the player
KEY_R, KEY_H = 0.033, 0.026
PLATE_T = 0.006
CONTROLS_Z = -0.18
LEVER_X, NEW_X, COMP_X = -0.24, 0.02, 0.24
# The game switch's two throws, in radians about its own Z. Positive leans it left, to SIMPLE.
LEVER_THROW = 0.38
# Where the player's eye is at the machine and what it looks at. The game uses the same.
SEAT_EYE, SEAT_AIM, SEAT_FOV = (0.0, 1.55, 1.55), (0.0, 1.56, -0.05), 68.0
SEAT_FRONT, SEAT_HALF_WIDTH = 0.43, 0.44
HERO_EYE, HERO_AIM = (-1.75, 1.62, 3.0), (0.0, 1.38, 0.0)

DECK = Matrix.Translation(B(*DECK_C)) @ rot_x(DECK_TILT)


def col_x(n):
    """Column n (0 for the white lamp or the zero button, 1..7 for matches), left to right."""
    return (n - 3.5) * COL_PITCH


def atlas_uv(name):
    x0, y0, x1, y1 = ATLAS[name]
    return x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024


def deck_point(x, y, z):
    """A point in the deck's frame (x across, y out of the deck, z down it toward the player), in
    game coordinates."""
    return G(DECK @ Vector((x, -z, y)))


# ---------------------------------------------------------------- materials

MATS = {}
TEXTURED = {"wood", "steel", "enamel", "parts", "legend"}


def tex_file(name):
    """The shared set if it is here, else Nimrod's own folder, else nothing (the greybox)."""
    for folder in (TEX_SHARED, TEX_OWN):
        path = os.path.join(folder, name + ".jpg")
        if os.path.exists(path):
            return path
    return None


def material(name, color=(1, 1, 1), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, tex=None, orm=True, emit_tex=False):
    mat = bpy.data.materials.new("Nimrod_" + name)
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
            # The same picture shapes the light, so lit glass keeps its grain and legends their words.
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
            node = nt.nodes.new("ShaderNodeTexImage")
            node.image = bpy.data.images.load(relief, check_existing=True)
            node.image.colorspace_settings.name = "Non-Color"
            bump = nt.nodes.new("ShaderNodeNormalMap")
            bump.uv_map = "UVMap"
            nt.links.new(node.outputs["Color"], bump.inputs["Color"])
            nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    MATS[name] = mat
    return mat


# Lamp colours, lit. The game uses the same, by the node's name (src/nimrod_machine.rs).
WARM = (1.0, 0.45, 0.12)      # the matches, the instruction lamps and the registers
WHITE = (0.80, 0.86, 1.0)     # the "last changed" lamps, cool as on the real desk
RED = (1.0, 0.16, 0.06)       # the register's choice and the odd columns


def materials():
    material("wood", rough=0.42, tex="walnut")
    material("steel", rough=0.36, metal=0.8, tex="steel", orm=False)
    # The panels' grey hammered enamel: Nimrod was a grey machine.
    material("enamel", color=(0.52, 0.53, 0.52), rough=0.55, metal=0.15, tex="enamel")
    material("black", color=(0.006, 0.006, 0.007), rough=0.85)
    material("bakelite", color=(0.012, 0.011, 0.010), rough=0.32)
    material("glow", color=(0, 0, 0), emit=(1.0, 0.60, 0.26), emit_strength=3.4)
    material("parts", rough=0.40, tex="parts", orm=False)
    material("marquee", rough=0.3, tex="marquee", orm=False, emit=(1, 1, 1), emit_strength=1.3, emit_tex=True)
    # The valves behind the window in the lower body: glass with a dull orange heater glow.
    material("valve", color=(0.30, 0.30, 0.32), rough=0.12, metal=0.3, emit=(1.0, 0.36, 0.08), emit_strength=2.2)
    # Lamps as exported are unlit: tinted glass over a dark bulb, faintly showing its colour.
    for name, tint in (("lamp_warm", WARM), ("lamp_white", WHITE), ("lamp_red", RED)):
        material(name, color=tuple(0.04 + 0.10 * c for c in tint), rough=0.22, tex="parts", orm=False,
                 emit=tint, emit_strength=0.04, emit_tex=True)
    # The legends: words on dark glass. Unlit, the words can just be read.
    material("legend", color=(0.02, 0.02, 0.02), rough=0.25, tex="parts", orm=False, emit=WARM, emit_strength=0.05, emit_tex=True)
    material("key", color=(0.45, 0.42, 0.37), rough=0.34, tex="parts", orm=False, emit=WARM, emit_strength=0.06, emit_tex=True)
    material("key_zero", color=(0.10, 0.10, 0.11), rough=0.30, tex="parts", orm=False)
    material("dome_comp", color=(0.55, 0.30, 0.08), rough=0.10, emit=(1.0, 0.50, 0.12), emit_strength=0.35)
    material("dome_new", color=(0.02, 0.02, 0.022), rough=0.20)


# ---------------------------------------------------------------- scenery geometry

BUCKETS = {}
SMOOTH = {"valve"}
GRAIN = {"up": Vector((0, 0, 1)), "across": Vector((1, 0, 0))}
PIECE = [0]


def bucket(mat):
    if mat not in BUCKETS:
        bm = bmesh.new()
        if mat in TEXTURED:
            bm.loops.layers.uv.new("UVMap")
        BUCKETS[mat] = bm
    return BUCKETS[mat]


def enamel_uv(bm, faces):
    """A flat projection along each face's own plane, so the hammer marks keep their size."""
    uv = bm.loops.layers.uv["UVMap"]
    s = 1.0 / TEX_METRES["enamel"]
    for f in faces:
        n = f.normal
        up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((0, 1, 0))
        u_axis = up.cross(n).normalized()
        v_axis = n.cross(u_axis)
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (p.dot(u_axis) * s, p.dot(v_axis) * s)


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
    elif mat == "enamel":
        enamel_uv(bm, faces)


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
        turned_uv(bm, faces, DECK @ Vector((x, -z, 0)), DECK.to_3x3() @ Vector((0, 0, 1)), DECK.to_3x3() @ Vector((1, 0, 0)))


def turned_uv(bm, faces, centre, axis, side):
    """U runs round the axis, so the steel reads as turned on a lathe. Neighbouring faces share their
    corners' UVs, so the exporter keeps one vertex where they meet (except along the seam)."""
    uv = bm.loops.layers.uv["UVMap"]
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
        mesh = bpy.data.meshes.new(f"Nimrod_{mat}")
        # The exporter cannot work out tangents for faces with more than four corners.
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        smooth = [f.smooth for f in bm.faces]
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(f"Nimrod_{mat}", mesh)
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


def picture_object(name, mat, w, h, pos, picture):
    """A flat panel facing the player, with an atlas picture on it."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    u0, v0, u1, v1 = atlas_uv(picture)
    pts = [(-w / 2, -h / 2, u0, v0), (w / 2, -h / 2, u1, v0), (w / 2, h / 2, u1, v1), (-w / 2, h / 2, u0, v1)]
    f = bm.faces.new([bm.verts.new(B(x, y, 0)) for x, y, _, _ in pts])
    for loop, p in zip(f.loops, pts):
        loop[uv].uv = (p[2], p[3])
    return mesh_object(name, bm, [mat], location=B(*pos))


def lamp(name, mat, at, r=LAMP_R):
    """A domed glass lamp lens on the face, its origin at the dome's foot. A steel bezel round it is
    scenery."""
    bm = bmesh.new()
    # Built about Blender's Z, then turned to face the player (Blender's -Y).
    lathe(bm, [(r, 0.0), (r * 0.80, 0.011), (0.0, 0.0165)], segs=12)
    bmesh.ops.transform(bm, matrix=rot_x(math.pi / 2), verts=bm.verts[:])
    lens_uv_front(bm, 2 * r)
    bezel(at, r)
    return mesh_object(name, bm, [mat], location=B(*at))


def lens_uv_front(bm, span):
    """As lens_uv, for a part facing the player: Blender's X across and Z up."""
    uv = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = atlas_uv("lens")
    for f in bm.faces:
        for loop in f.loops:
            p = loop.vert.co
            s = min(max(p.x / span + 0.5, 0.0), 1.0)
            t = min(max(p.z / span + 0.5, 0.0), 1.0)
            loop[uv].uv = (u0 + s * (u1 - u0), v0 + t * (v1 - v0))


def bezel(at, r):
    """A turned steel ring round a lamp on the face. It slopes in to the glass, like a deep bezel."""
    bm = bucket("steel")
    faces = lathe(bm, [(r + 0.0075, 0.0), (r + 0.0015, 0.007)],
                  segs=12, matrix=Matrix.Translation(B(*at)) @ rot_x(math.pi / 2))
    turned_uv(bm, faces, B(*at), Vector((0, -1, 0)), Vector((1, 0, 0)))


def key(name, parent, x, z, zero):
    """A round push button standing in a steel collar. Its origin is on the deck; pressing sinks it
    along its own up axis. The collar is scenery."""
    bm = bmesh.new()
    lathe(bm, [(KEY_R, 0.0), (KEY_R, KEY_H - 0.007), (KEY_R * 0.78, KEY_H), (0.0, KEY_H + 0.0005)], segs=16)
    uv = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = atlas_uv("cap")
    for f in bm.faces:
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (u0 + (p.x / (2 * KEY_R) + 0.5) * (u1 - u0), v0 + (p.y / (2 * KEY_R) + 0.5) * (v1 - v0))
    obj = mesh_object(name, bm, ["key_zero" if zero else "key"], parent=parent)
    obj.location = (x, -z, PLATE_T)
    add_lathe("steel", [(KEY_R + 0.009, 0.0), (KEY_R + 0.002, PLATE_T + 0.010)], x, z, segs=16)
    return obj


def plunger(name, parent, x, z, r, height, dome):
    """A mushroom push button. Its stepped collar is scenery; this is the part that goes down."""
    bm = bmesh.new()
    lathe(bm, [(r * 0.55, 0.004), (r * 0.55, height * 0.5)], segs=32, mat_index=0)
    lathe(bm, [(r * 0.6, height * 0.5), (r, height * 0.55), (r * 1.04, height * 0.7), (r * 0.95, height * 0.85),
               (r * 0.65, height * 0.97), (r * 0.3, height), (0.0, height + 0.001)], segs=32, mat_index=1)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.z > height * 0.52], dist=1e-5)
    obj = mesh_object(name, bm, ["bakelite", dome], parent=parent)
    obj.location = (x, -z, 0)
    add_lathe("steel", [(r + 0.022, 0.0), (r + 0.022, 0.010), (r + 0.010, 0.022), (r * 0.6, 0.022)], x, z, segs=32)
    return obj


def lever(parent):
    """The game switch: a bakelite bat on a steel pivot. It leans left for the simple game and right
    for the reverse game, swinging about its own Z (down the deck). Exported upright."""
    bm = bmesh.new()
    lathe(bm, [(0.010, 0.0), (0.010, 0.016)], segs=16, mat_index=0)
    lathe(bm, [(0.008, 0.016), (0.009, 0.060)], segs=16, mat_index=0)
    # The paddle: wide across the throw, so a thumb finds it, with its edges cut back.
    made = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=made["verts"], vec=(0.080, 0.030, 0.052))
    bmesh.ops.translate(bm, verts=made["verts"], vec=(0, 0, 0.084))
    bmesh.ops.bevel(bm, geom=list({e for v in made["verts"] for e in v.link_edges}), offset=0.006, segments=1, affect="EDGES")
    for f in bm.faces:
        if f.calc_center_median().z > 0.057:
            f.material_index = 1
    obj = mesh_object("Lever_Game", bm, ["steel", "bakelite"], parent=parent)
    obj.location = (LEVER_X, -CONTROLS_Z, 0.010)
    # Its base: a steel boss with a slot the bat swings in, on a round plate.
    add_lathe("steel", [(0.042, 0.0), (0.042, 0.006), (0.030, 0.010), (0.020, 0.010)], LEVER_X, CONTROLS_Z, segs=32)
    add_box("steel", (0.12, 0.012, 0.022), (LEVER_X, 0.006, CONTROLS_Z), frame=DECK)
    return obj


# ---------------------------------------------------------------- the machine


def side_profile():
    """The outline of a side panel's front edge as (z, y) points, top to bottom: straight down past
    the face, along the desk a little above its top, and back to the lower body."""
    def cheek(y, z):
        p = deck_point(0, y, z)
        return (p[2], p[1])

    return [(CHEEK_Z, HEIGHT - 0.012), (CHEEK_Z, 1.32), cheek(0.045, -DECK_D / 2 - 0.02), cheek(0.045, DECK_D / 2 - 0.03),
            cheek(-0.005, DECK_D / 2 + 0.020), cheek(-0.07, DECK_D / 2 + 0.020), (LOWER_Z + 0.03, 0.78), (LOWER_Z + 0.03, 0.0)]


def side_panels():
    front = side_profile()
    outline = front + [(BACK_Z, 0.0), (BACK_Z, HEIGHT - 0.012)]
    for side in (-1, 1):
        x = side * (BODY_HALF + PANEL_T / 2)
        add_prism("wood", outline, x - PANEL_T / 2, x + PANEL_T / 2, grain="up")
        for a, b in zip(front, front[1:]):
            add_strip("steel", a, b, PANEL_T + 0.006, 0.012, x)
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if a[1] > 0.95 and b[1] > 0.80 and length > 0.2:
                nz, ny = -(b[1] - a[1]) / length * 0.0065, (b[0] - a[0]) / length * 0.0065
                add_strip("glow", (a[0] + nz, a[1] + ny), (b[0] + nz, b[1] + ny), 0.006, 0.003, x - side * 0.016)


def body():
    w = 2 * BODY_HALF
    top = HEIGHT - 0.012
    # The lower body, with a window cut in its front onto the valve bay. Its front is a frame of four
    # pieces round the window, on a body set back by the bay's depth.
    wx, wy, ww, wh, bay = 0.0, 0.47, 0.96, 0.34, 0.07
    add_box("wood", (w, 0.80, LOWER_Z - bay - BACK_Z), (0, 0.40, (LOWER_Z - bay + BACK_Z) / 2), grain="up")
    zc = LOWER_Z - bay / 2
    add_box("wood", (w, wy - wh / 2, bay), (0, (wy - wh / 2) / 2, zc), grain="up")
    add_box("wood", (w, 0.80 - wy - wh / 2, bay), (0, (0.80 + wy + wh / 2) / 2, zc), grain="up")
    for s in (-1, 1):
        add_box("wood", ((w - ww) / 2, wh, bay), (s * (ww + w) / 4, wy, zc), grain="up")
    add_box("wood", (w, top - 0.80, FACE_Z - BACK_Z), (0, (top + 0.80) / 2, (FACE_Z + BACK_Z) / 2))
    far, near, nose = deck_point(0, 0, -DECK_D / 2), deck_point(0, 0, DECK_D / 2), deck_point(0, -0.07, DECK_D / 2)
    add_prism("wood", [(far[2], far[1]), (near[2], near[1]), (nose[2], nose[1]), (LOWER_Z, 0.78), (FACE_Z - 0.02, 0.78), (FACE_Z - 0.02, far[1])],
              -BODY_HALF, BODY_HALF, grain="across")
    side_panels()
    add_box("steel", (w + 2 * PANEL_T + 0.016, 0.012, CHEEK_Z - BACK_Z + 0.02), (0, HEIGHT - 0.006, (CHEEK_Z + BACK_Z) / 2 + 0.01))
    add_box("black", (w, 0.007, 0.004), (0, far[1] + 0.03, FACE_Z + 0.001))
    # The valve bay: a window in the lower body onto two rows of glowing valves, the machine's works.
    add_box("black", (ww, wh, 0.004), (wx, wy, LOWER_Z - bay + 0.002))
    for row, vy in enumerate((wy - 0.075, wy + 0.075)):
        add_box("steel", (ww - 0.04, 0.012, 0.04), (wx, vy - 0.058, LOWER_Z - bay + 0.024))
        for i in range(11):
            vx = wx + (i - 5) * 0.082 + (0.020 if row else 0.0)
            bm = bucket("valve")
            faces = lathe(bm, [(0.013, 0.0), (0.014, 0.05), (0.010, 0.078), (0.0, 0.085)], segs=8,
                          matrix=Matrix.Translation(B(vx, vy - 0.052, LOWER_Z - bay + 0.026)))
            for f in faces:
                f.smooth = True
    add_bevel_frame("steel", wx, wy, ww, wh, LOWER_Z, LOWER_Z + 0.016, 0.016, 0.006, LOWER_Z + 0.004)
    add_box("steel", (w, 0.085, 0.006), (0, 0.0425, LOWER_Z + 0.003))
    front_plate("parts", "maker", 0.30, 0.075, (0.0, 0.18, LOWER_Z + 0.003))


def panel(cx, half):
    """A grey enamel board in a bevelled steel frame on the face, with a hairline of light round it."""
    y0, y1 = PANEL_Y
    cy, h = (y0 + y1) / 2, y1 - y0
    add_box("enamel", (2 * half, h, 0.006), (cx, cy, FACE_Z + 0.003))
    add_bevel_frame("steel", cx, cy, 2 * half, h, FACE_Z, FACE_Z + 0.022, 0.016, 0.005, FACE_Z + 0.007)
    add_frame("glow", cx, cy, 2 * half + 0.036, h + 0.036, FACE_Z + 0.004, 0.004, 0.004)


def face():
    z = FACE_Z + 0.006
    panel(0.0, CENTRE_HALF)
    panel(-SIDE_C, SIDE_HALF)
    panel(SIDE_C, SIDE_HALF)
    # The game display: a white lamp and seven match lamps in each of four rows.
    for h, y in enumerate(ROWS_Y):
        lamp(f"Lamp_Changed_{h}", "lamp_white", (col_x(0), y, z))
        for n in range(1, 8):
            lamp(f"Lamp_Match_{h}_{n}", "lamp_warm", (col_x(n), y, z))
        front_plate("parts", f"heap_{h + 1}", 0.036, 0.036, (-0.374, y, z + 0.0005))
        # A thin steel rule between the white lamp and the matches.
    for y in (ROWS_Y[0] + 0.05, ROWS_Y[-1] - 0.05):
        add_box("steel", (0.66, 0.004, 0.003), (0.0, y, z + 0.0015))
    add_box("steel", (0.004, ROWS_Y[0] - ROWS_Y[-1] + 0.1, 0.003), ((col_x(0) + col_x(1)) / 2, (ROWS_Y[0] + ROWS_Y[-1]) / 2, z + 0.0015))
    # The legends, each a dark glass pane in a thin steel frame.
    for name, (lx, ly) in LEGENDS.items():
        add_bevel_frame("steel", lx, ly, LEGEND_W, LEGEND_H, z, z + 0.010, 0.008, 0.003, z + 0.002)
        picture_object(f"Legend_{name}", "legend", LEGEND_W, LEGEND_H, (lx, ly, z + 0.002), LEGEND_PICTURES[name])

    # The instruction panel: a lamp and an engraved line for each step of the machine's work.
    front_plate("parts", "instructions", 0.26, 0.032, (-SIDE_C, PANEL_Y[1] - 0.045, z + 0.0005))
    for i in range(8):
        y = INSTR_Y0 - i * INSTR_PITCH
        lamp(f"Lamp_Instr_{i}", "lamp_warm", (-SIDE_C - 0.105, y, z), r=0.018)
        front_plate("parts", f"instr_{i}", 0.19, 0.0475, (-SIDE_C + 0.035, y, z + 0.0005))

    # The registers: each heap's count in binary, beside its row, the choice of heap, and the odd columns.
    for b, x in REG_X.items():
        front_plate("parts", f"head_{b}", 0.036, 0.036, (x, PANEL_Y[1] - 0.045, z + 0.0005))
        for h, y in enumerate(ROWS_Y):
            lamp(f"Lamp_Reg_{h}_{b}", "lamp_warm", (x, y, z), r=0.020)
        lamp(f"Lamp_Odd_{b}", "lamp_red", (x, ODD_Y, z), r=0.020)
    for h, y in enumerate(ROWS_Y):
        lamp(f"Lamp_Select_{h}", "lamp_red", (SELECT_X, y, z), r=0.014)
    front_plate("parts", "odd", 0.072, 0.036, (SELECT_X - 0.005, ODD_Y, z + 0.0005))
    front_plate("parts", "registers", 0.26, 0.032, (SIDE_C, 1.455, z + 0.0005))
    add_box("steel", (0.25, 0.004, 0.003), (SIDE_C + 0.01, ODD_Y + 0.05, z + 0.0015))


def marquee():
    w = 2 * BODY_HALF
    cy = 2.385
    add_box("black", (w, 0.24, 0.05), (0, cy, FACE_Z + 0.025))
    for s in (-1, 1):
        add_box("steel", (w, 0.014, 0.060), (0, cy + s * 0.113, FACE_Z + 0.030))
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    mw, mh = 1.40, 0.19
    pts = [(-mw / 2, -mh / 2, 0, 0), (mw / 2, -mh / 2, 1, 0), (mw / 2, mh / 2, 1, 1), (-mw / 2, mh / 2, 0, 1)]
    f = bm.faces.new([bm.verts.new(B(x, y, 0)) for x, y, _, _ in pts])
    for loop, p in zip(f.loops, pts):
        loop[uv].uv = (p[2], p[3])
    mesh_object("Marquee_Nimrod", bm, ["marquee"], location=B(0, cy, FACE_Z + 0.0515))


def desk():
    w = 2 * BODY_HALF
    add_box("steel", (w, 0.085, 0.016), (0, -0.0325, DECK_D / 2 + 0.008), frame=DECK)
    add_box("steel", (w, 0.010, 0.018), (0, 0.005, -DECK_D / 2 + 0.009), frame=DECK)
    add_box("glow", (w - 0.04, 0.004, 0.004), (0, 0.002, DECK_D / 2 - 0.006), frame=DECK)
    for s in (-1, 1):
        add_box("glow", (0.004, 0.004, DECK_D - 0.03), (s * (BODY_HALF - 0.006), 0.002, 0), frame=DECK)
    # A brushed steel plate under the buttons, as in the target picture.
    field_w = 8 * COL_PITCH + 0.03
    field_z0, field_z1 = KEY_ROWS_Z[0] - 0.05, KEY_ROWS_Z[-1] + 0.05
    fz, fd = (field_z0 + field_z1) / 2, field_z1 - field_z0
    add_box("steel", (field_w + 0.04, PLATE_T, fd + 0.04), (0, PLATE_T / 2, fz), frame=DECK)
    add_deck_frame("glow", 0, fz, field_w + 0.05, fd + 0.05, 0.003, 0.004, 0.003)
    # A thin rule between the zero buttons and the rest, as on the face.
    add_box("steel", (0.004, 0.002, fd - 0.02), ((col_x(0) + col_x(1)) / 2, PLATE_T + 0.002, fz), frame=DECK)
    # The plates over the switch and the two plungers.
    plate_z = CONTROLS_Z - 0.062
    deck_plate("parts", "simple", 0.10, 0.025, LEVER_X - 0.075, plate_z, 0.002)
    deck_plate("parts", "reverse", 0.10, 0.025, LEVER_X + 0.075, plate_z, 0.002)
    deck_plate("parts", "new_game", 0.12, 0.030, NEW_X, plate_z, 0.002)
    deck_plate("parts", "comp_move", 0.12, 0.030, COMP_X, plate_z, 0.002)

    deck = bpy.data.objects.new("Nimrod_Deck", None)
    deck.location = B(*DECK_C)
    deck.rotation_euler = (DECK_TILT, 0, 0)
    bpy.context.collection.objects.link(deck)
    for h, z in enumerate(KEY_ROWS_Z):
        for n in range(8):
            key(f"Key_{h}_{n}", deck, col_x(n), z, n == 0)
    lever(deck)
    plunger("Button_NewGame", deck, NEW_X, CONTROLS_Z, 0.036, 0.050, "dome_new")
    plunger("Button_CompMove", deck, COMP_X, CONTROLS_Z, 0.042, 0.060, "dome_comp")


def machine():
    body()
    face()
    marquee()
    desk()


# ---------------------------------------------------------------- checks


def bounds(obj):
    pts = [G(obj.matrix_world @ Vector(c)) for c in obj.bound_box]
    return tuple(min(p[i] for p in pts) for i in range(3)), tuple(max(p[i] for p in pts) for i in range(3))


def eye_for(aspect):
    """The seat for a view of this aspect, as src/player.rs places it."""
    per_metre = math.tan(math.radians(SEAT_FOV / 2)) * aspect
    x, y, z = SEAT_EYE
    return (x, y, max(z, SEAT_FRONT + SEAT_HALF_WIDTH / per_metre))


def seat_pixels(points, size=(1280, 720)):
    """Where game-space points land in the seat view for a screen of `size`, in pixels."""
    eye, aim = Vector(eye_for(size[0] / size[1])), Vector(SEAT_AIM)
    f = (aim - eye).normalized()
    r = f.cross(Vector((0, 1, 0))).normalized()
    u = r.cross(f)
    t = math.tan(math.radians(SEAT_FOV / 2))
    out = []
    for p in points:
        d = Vector(p) - eye
        out.append((size[0] / 2 + d.dot(r) / d.dot(f) / t * size[1] / 2, size[1] / 2 - d.dot(u) / d.dot(f) / t * size[1] / 2))
    return out


PHONE = (390, 844)


def report():
    bpy.context.view_layer.update()
    fmt = lambda p: "(" + ", ".join(f"{v:+.3f}" for v in p) + ")"
    lo_all, hi_all, tris = [1e9] * 3, [-1e9] * 3, 0
    print(f"{'node':<18} {'min (x, y, z)':<28} {'max (x, y, z)':<28} {'tris':>5}  landscape px x0 y0 x1 y1 w%   upright phone x0 y0 x1 y1 w%")
    worst = (100.0, "")
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type != "MESH":
            continue
        lo, hi = bounds(obj)
        n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        tris += n
        lo_all = [min(a, b) for a, b in zip(lo_all, lo)]
        hi_all = [max(a, b) for a, b in zip(hi_all, hi)]
        pts = [G(obj.matrix_world @ v.co) for v in obj.data.vertices]
        cols = []
        for size in ((1280, 720), PHONE):
            px = seat_pixels(pts, size)
            xs, ys = [p[0] for p in px], [p[1] for p in px]
            pct = (max(xs) - min(xs)) / size[0] * 100
            cols.append(f"{min(xs):5.0f} {min(ys):5.0f} {max(xs):5.0f} {max(ys):5.0f} {pct:4.1f}%")
            off = min(xs) < 0 or max(xs) > size[0] or min(ys) < 0 or max(ys) > size[1]
            if off:
                cols[-1] += " OFF"
            if size == PHONE and (obj.name.startswith(("Key_", "Lever_", "Button_"))):
                worst = min(worst, (pct, obj.name))
        print(f"{obj.name:<18} {fmt(lo):<28} {fmt(hi):<28} {n:>5}  {cols[0]}   {cols[1]}")
    print(f"{'ALL':<18} {fmt(lo_all):<28} {fmt(hi_all):<28} {tris:>5}")
    print(f"smallest control on an upright phone: {worst[1]} at {worst[0]:.1f}% of the width; phone eye {eye_for(PHONE[0] / PHONE[1])}")


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
            paths[kind] = scene.render.filepath = os.path.join(out, f"_nimrod_{name}_{kind}.png")
            bpy.ops.render.render(write_still=True)
        d = np.asarray(Image.open(paths["depth"]).convert("RGB")).astype(np.float32)[:, :, 0] / 255.0
        n = np.asarray(Image.open(paths["normal"]).convert("RGB")).astype(np.float32) / 255.0
        line = np.zeros(d.shape, bool)
        for axis in (0, 1):
            dd = np.abs(np.diff(d, axis=axis, append=d.take([-1], axis=axis)))
            dn = np.abs(np.diff(n, axis=axis, append=n.take([-1], axis=axis))).sum(axis=2)
            line |= (dd > 0.012) | (dn > 0.30)
        ink = Image.fromarray(np.where(line, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)
        ink.save(os.path.join(out, f"nimrod_{name}_lines.png"), optimize=True)
        Image.fromarray((d * 255).astype(np.uint8)).resize(size, Image.LANCZOS).save(os.path.join(out, f"nimrod_{name}_depth.png"), optimize=True)
        for p in paths.values():
            os.remove(p)
        print("wrote", name, "lines and depth")
    layer.material_override = None



def preview(path, view):
    """A look at the machine, lit roughly as the room is. Only for checking the model by eye."""
    scene = bpy.context.scene
    room_shell()
    # A game in progress, so lit and unlit lamps can both be judged.
    lit = {}
    for name, tint, k in (("lamp_warm", WARM, 10.0), ("lamp_white", WHITE, 10.0), ("lamp_red", RED, 10.0), ("legend", WARM, 5.0), ("key", WARM, 3.0)):
        src = MATS[name]
        mat = src.copy()
        mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k
        lit[name] = mat
    heaps, changed, instr, odd, select = (3, 5, 2, 6), 1, 3, (4, 2), 1
    for obj in bpy.data.objects:
        n = obj.name
        on = False
        if n.startswith("Lamp_Match_"):
            h, m = map(int, n.split("_")[2:])
            on = m <= heaps[h]
        elif n.startswith("Key_"):
            h, m = map(int, n.split("_")[1:])
            on = 1 <= m <= heaps[h]
        elif n.startswith("Lamp_Reg_"):
            h, b = map(int, n.split("_")[2:])
            on = heaps[h] & b != 0
        elif n.startswith("Lamp_Odd_"):
            on = int(n.split("_")[2]) in odd
        on = on or n in (f"Lamp_Changed_{changed}", f"Lamp_Instr_{instr}", f"Lamp_Select_{select}", "Legend_ComputersMove")
        if on and obj.type == "MESH":
            obj.data.materials[0] = lit[obj.data.materials[0].name.removeprefix("Nimrod_")]
    bpy.data.objects["Lever_Game"].rotation_euler = (0, LEVER_THROW, 0)
    eye, aim, size = VIEWS[view]
    camera(eye, aim)
    for at, energy, color, soft in (((0.8, 3.0, 2.4), 420, (1.0, 0.86, 0.70), 0.6), ((-2.6, 2.0, 2.2), 260, (1.0, 0.80, 0.62), 0.8),
                                    ((0.0, 0.3, 3.0), 30, (1.0, 0.62, 0.30), 1.0)):
        lamp_obj = bpy.data.objects.new("L", bpy.data.lights.new("L", "POINT"))
        lamp_obj.data.energy = energy
        lamp_obj.data.color = color
        lamp_obj.data.shadow_soft_size = soft
        lamp_obj.location = B(*at)
        scene.collection.objects.link(lamp_obj)
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

    path = os.path.join(OUT, "nimrod.glb")
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
