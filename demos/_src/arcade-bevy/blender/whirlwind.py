"""Builds the arcade's third machine, a homage to the Bouncing Ball on MIT's Whirlwind I (1951), as
assets/whirlwind.glb: a display console with a round tube in a steel hood.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/whirlwind.py                      build and export
    <bpy venv>/bin/python blender/whirlwind.py --preview out.png    also render a look (add --view hero)
    <bpy venv>/bin/python blender/whirlwind.py --lines reference    also render line art and depth for Gemini

Everything is written in the game's coordinates (metres, Y up) and converted on the way in. The
machine stands at its own origin facing +Z, so the game can put it anywhere. It fits in 1.5 m wide,
0.9 m deep and 2.4 m tall.

The game finds these objects by name (src/whirlwind_machine.rs):

    Tube_Screen                  the round tube face; UVs 0..1 across its square, the game paints it
    Knob_Bounce, Knob_Speed      notched knobs; they turn about their own Y, clockwise is more
    Plunger_Release              releases the ball; it sinks along its own Y
    Lamp_Score_0..15             the score register, bit 0 on the right, as Whirlwind's lamps read
    Lamp_Ball_0..4               balls left in the run (misses still allowed), left to right
    Lamp_Bounce_0..3             step along one at each bounce
    Whirlwind_Deck               an empty that carries the desk's slope; the controls hang off it

Everything else is scenery, joined into one mesh per material.

Textures: the walnut and steel are the room's shared set (blender/tex/). The console's own pictures
are in tex_whirlwind/parts.jpg (an atlas: the lamp lens, the knobs' dial, the plates), made by
whirlwind_textures.py. assets/ART-whirlwind.md says which generated image each came from.
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
TEX_OWN = os.path.join(HERE, "tex_whirlwind")

# One texture repeat covers this many metres. The same as the first cabinet's.
TEX_METRES = {"walnut": 0.70, "steel": 0.25}
PREFIX = "Whirlwind_"

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

HEIGHT = 2.26
HALF_W = 0.66         # half the width between the side panels
PANEL_T = 0.04
BACK_Z = -0.40
FACE_Z = 0.10         # the tower's front, which carries the tube, the lamps and the switches
LOWER_Z = 0.30        # the front of the pedestal under the desk
LOWER_TOP = 0.80
# The tube: a 16-inch round face, as on Whirlwind's display consoles.
TUBE_C = (0.0, 1.43)
SCREEN_R = 0.23
HOOD_R = 0.268        # half the hood's inside at its root
HOOD_FRONT = 0.292    # and at its mouth: it flares
HOOD_MIN, HOOD_MAX = 0.12, 0.18   # how far the hood stands out at the bottom and at the top
SCREEN_Z = FACE_Z + 0.030
# The desk slopes down toward the player.
DECK_C = (0.0, 0.965, 0.29)
DECK_TILT = 0.32
DECK_D = 0.34
KNOB_X = 0.24
KNOB_Z = -0.035       # down the deck from its middle; plates sit nearer the player
PLUNGER_AT = (0.0, -0.035)
NOTCH_STEP = 0.30     # radians between the knobs' nine notches; the game uses the same
# The lamp register above the tube, and the switches under it.
LAMP_PITCH = 0.062
SCORE_Y, ROW2_Y = 2.015, 1.925
SWITCH_Y = 1.80
NAME_Y = 2.15
# Where the player's eye is at the machine and what it looks at (src/whirlwind_machine.rs).
SEAT_EYE, SEAT_AIM, SEAT_FOV = (0.0, 1.55, 1.15), (0.0, 1.42, 0.15), 68.0
HERO_EYE, HERO_AIM = (-1.55, 1.70, 2.70), (0.0, 1.32, 0.10)

DECK = Matrix.Translation(B(*DECK_C)) @ rot_x(DECK_TILT)

# Where each picture sits in tex_whirlwind/parts.jpg, in pixels from the top left of a 1024 square.
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


def atlas_uv(name):
    x0, y0, x1, y1 = ATLAS[name]
    return x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024


def deck_point(x, y, z):
    """A point in the deck's frame (x across, y out of the deck, z down it toward the player), in
    game coordinates."""
    return G(DECK @ Vector((x, -z, y)))


def score_x(bit):
    """Bit 15 on the left, bit 0 on the right, as a register is read."""
    return (7.5 - bit) * LAMP_PITCH


# ---------------------------------------------------------------- materials

MATS = {}
TEXTURED = {"wood", "steel", "parts", "dialplate"}


def tex_file(name):
    for folder in (TEX_SHARED, TEX_OWN):
        path = os.path.join(folder, name + ".jpg")
        if os.path.exists(path):
            return path
    return None


def material(name, color=(1, 1, 1), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, tex=None, orm=True, emit_tex=False):
    mat = bpy.data.materials.new(PREFIX + name)
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
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs["B"].default_value = (*color, 1)
            nt.links.new(base.outputs["Color"], mix.inputs["A"])
            nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        if emit_tex:
            glow = nt.nodes.new("ShaderNodeMix")
            glow.data_type = "RGBA"
            glow.blend_type = "MULTIPLY"
            glow.inputs["Factor"].default_value = 1.0
            glow.inputs["B"].default_value = (*emit, 1)
            nt.links.new(base.outputs["Color"], glow.inputs["A"])
            nt.links.new(glow.outputs["Result"], bsdf.inputs["Emission Color"])
        orm_path = tex_file(tex + "_orm") if orm else None
        if orm_path:
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


def materials():
    material("wood", rough=0.42, tex="walnut")
    # Without the room's reflection cube on this machine, pure metal goes near black, so this steel
    # keeps a little plain colour, as Bertie's does.
    material("steel", rough=0.36, metal=0.8, tex="steel", orm=False)
    material("black", color=(0.006, 0.006, 0.007), rough=0.85)
    material("bakelite", color=(0.012, 0.011, 0.010), rough=0.32)
    material("glow", color=(0, 0, 0), emit=(1.0, 0.60, 0.26), emit_strength=3.4)
    material("pip", color=(0.30, 0.18, 0.08), rough=0.4, emit=(1.0, 0.62, 0.28), emit_strength=2.6)
    material("parts", rough=0.40, tex="parts", orm=False)
    material("dialplate", rough=0.30, tex="parts", orm=False)
    material("dome", color=(0.74, 0.66, 0.52), rough=0.26, emit=(1.0, 0.82, 0.58), emit_strength=0.30)
    material("cream", color=(0.80, 0.74, 0.62), rough=0.35)
    material("plunger", color=(0.55, 0.22, 0.03), rough=0.10, emit=(1.0, 0.45, 0.08), emit_strength=0.35)
    # The tube's face as exported: dark green-grey glass. The game paints its own picture on it.
    material("screen", color=(0.010, 0.016, 0.012), rough=0.06)
    # Lamps as exported are their unlit look: coloured glass you can just see. The game lights them.
    material("lamp_score", color=(0.40, 0.26, 0.10), rough=0.20, tex="parts", orm=False, emit=(1.0, 0.62, 0.22), emit_strength=0.04, emit_tex=True)
    material("lamp_ball", color=(0.36, 0.05, 0.03), rough=0.20, tex="parts", orm=False, emit=(1.0, 0.12, 0.05), emit_strength=0.04, emit_tex=True)
    material("lamp_bounce", color=(0.16, 0.30, 0.10), rough=0.20, tex="parts", orm=False, emit=(0.55, 1.0, 0.30), emit_strength=0.04, emit_tex=True)
    # Dressing lamps that never change: a few are lit for good.
    material("bulb", color=(0.16, 0.11, 0.07), rough=0.20, emit=(1.0, 0.60, 0.30), emit_strength=0.03)
    material("bulb_on", color=(0.80, 0.62, 0.40), rough=0.20, emit=(1.0, 0.58, 0.22), emit_strength=2.0)


# ---------------------------------------------------------------- scenery geometry

BUCKETS = {}
SMOOTH = {"bulb", "bulb_on"}
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


def add_box(mat, size, pos, frame=None, grain="across", tilt=0.0, bevel=0.0):
    """A box of `size` centred on `pos` in game coordinates, or in `frame` (the deck's) if given.
    `tilt` leans it about the game's X axis round its own centre. `bevel` cuts its edges."""
    sx, sy, sz = size
    tmp = bmesh.new()
    verts = bmesh.ops.create_cube(tmp, size=1.0)["verts"]
    bmesh.ops.scale(tmp, verts=verts, vec=(sx, sz, sy))
    if bevel > 0:
        bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=min(bevel, min(size) * 0.45), segments=1, affect="EDGES", profile=0.5)
    if frame is not None:
        m = frame @ Matrix.Translation(Vector((pos[0], -pos[2], pos[1])))
    else:
        m = Matrix.Translation(B(*pos)) @ rot_x(tilt)
    bmesh.ops.transform(tmp, matrix=m, verts=list(tmp.verts))
    merge(tmp, mat, grain)


def merge(tmp, mat, grain="across"):
    """Moves a finished piece into its material's bucket and lays its texture."""
    bm = bucket(mat)
    mesh = bpy.data.meshes.new("tmp")
    tmp.to_mesh(mesh)
    tmp.free()
    before = set(bm.faces)
    bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)
    faces = [f for f in bm.faces if f not in before]
    paint(bm, faces, mat, grain)
    return faces


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
    tilt = math.atan2(z1 - z0, y1 - y0)
    add_box(mat, (width, length, thick), (x, (y0 + y1) / 2, (z0 + z1) / 2), tilt=tilt, bevel=0.003)


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
    if faces[4].normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=faces)
    paint(bm, faces, mat, "across")


def add_quad(mat, corners, picture):
    """A flat picture from the atlas. `corners` run bottom left, bottom right, top right, top left."""
    bm = bucket(mat)
    uv = bm.loops.layers.uv["UVMap"]
    u0, v0, u1, v1 = atlas_uv(picture)
    f = bm.faces.new([bm.verts.new(c) for c in corners])
    for loop, t in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[uv].uv = t


def front_plate(mat, picture, w, h, pos):
    x, y, z = pos
    add_quad(mat, [B(x - w / 2, y - h / 2, z), B(x + w / 2, y - h / 2, z), B(x + w / 2, y + h / 2, z), B(x - w / 2, y + h / 2, z)], picture)


def deck_plate(mat, picture, w, d, x, z, y):
    """A picture lying on the deck, centred on (x, z) at `y` above it. Its top is up the deck."""
    pts = [DECK @ Vector((x + px, -(z + pz), y)) for px, pz in ((-w / 2, d / 2), (w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2))]
    add_quad(mat, pts, picture)


def add_ball(mat, r, pos):
    bm = bucket(mat)
    made = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
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


def turned_uv(bm, faces, centre, axis, side):
    """U runs round the axis, so turned steel reads as turned on a lathe."""
    uv = bm.loops.layers.uv["UVMap"]
    fwd = axis.cross(side)
    for f in faces:
        angles = []
        for loop in f.loops:
            d = loop.vert.co - centre
            angles.append(math.atan2(d.dot(fwd), d.dot(side)) / (2 * math.pi))
        if max(angles) - min(angles) > 0.5:
            angles = [a + 1.0 if a < 0 else a for a in angles]
        for loop, ang in zip(f.loops, angles):
            d = loop.vert.co - centre
            loop[uv].uv = (ang * 2.0, (d.dot(axis) + (d - axis * d.dot(axis)).length) * 4.0)


def add_lathe(mat, profile, x, z, segs=40):
    """A turned part standing on the deck at (x, z)."""
    bm = bucket(mat)
    m = DECK @ Matrix.Translation(Vector((x, -z, 0)))
    faces = lathe(bm, profile, segs=segs, matrix=m)
    if mat == "steel":
        turned_uv(bm, faces, m @ Vector((0, 0, 0)), DECK.to_3x3() @ Vector((0, 0, 1)), DECK.to_3x3() @ Vector((1, 0, 0)))
    return faces


FACING = rot_x(math.pi / 2)   # turns a lathe's up axis to face the player (game +Z)


def add_front_lathe(mat, profile, x, y, z, segs=40):
    """A turned part standing out of the front at (x, y), its foot at `z`."""
    bm = bucket(mat)
    m = Matrix.Translation(B(x, y, z)) @ FACING
    faces = lathe(bm, profile, segs=segs, matrix=m)
    if mat == "steel":
        turned_uv(bm, faces, m @ Vector((0, 0, 0)), Vector((0, -1, 0)), Vector((1, 0, 0)))
    return faces


def finish_buckets():
    for mat, bm in BUCKETS.items():
        mesh = bpy.data.meshes.new(PREFIX + mat)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        smooth = [f.smooth for f in bm.faces]
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(PREFIX + mat, mesh)
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


def screen():
    """The tube's face: a shallow dome. Its UVs run 0..1 across the square the game paints, whose
    tube circle has a radius of 0.48 of it (src/whirlwind.rs, TUBE_R)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    rings, segs, sag = 10, 64, 0.016
    centre = bm.verts.new((0, -sag, 0))
    prev = None
    verts_uv = {centre: (0.5, 0.5)}
    for i in range(1, rings + 1):
        r = SCREEN_R * i / rings
        ring = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            x, y = r * math.cos(a), r * math.sin(a)
            v = bm.verts.new((x, -sag * (1 - (r / SCREEN_R) ** 2), y))
            verts_uv[v] = (0.5 + 0.48 * x / SCREEN_R, 0.5 + 0.48 * y / SCREEN_R)
            ring.append(v)
        for j in range(segs):
            k = (j + 1) % segs
            f = bm.faces.new([centre, ring[j], ring[k]] if prev is None else [prev[j], ring[j], ring[k], prev[k]])
            f.smooth = True
        prev = ring
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    if bm.faces[0].normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = verts_uv[loop.vert]
    return mesh_object("Tube_Screen", bm, ["screen"], location=B(TUBE_C[0], TUBE_C[1], SCREEN_Z))


def lamp(name, mat, x, y):
    """A domed glass jewel in a steel bezel. The bezel is scenery; the jewel is what lights."""
    add_front_lathe("steel", [(0.029, 0.0), (0.029, 0.005), (0.022, 0.010)], x, y, FACE_Z, segs=16)
    bm = bmesh.new()
    lathe(bm, [(0.022, 0.0), (0.022, 0.004), (0.018, 0.012), (0.011, 0.018), (0.0, 0.020)], segs=16)
    bmesh.ops.transform(bm, matrix=FACING, verts=bm.verts[:])
    uv = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = atlas_uv("lens")
    for f in bm.faces:
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (u0 + (p.x / 0.046 + 0.5) * (u1 - u0), v0 + (p.z / 0.046 + 0.5) * (v1 - v0))
    return mesh_object(name, bm, [mat], location=B(x, y, FACE_Z + 0.006))


def knob(name, parent, x, z):
    """A heavy knob: a fluted black drum on a steel skirt, an opal cap, and a black pointer bar that
    reaches out over the dial's ticks with a lit line along it. The bar lies low across the cap, so
    it reads as a pointer, not a lever. At rest it points up the deck."""
    bm = bmesh.new()
    lathe(bm, [(0.080, 0.004), (0.080, 0.014), (0.074, 0.018)], segs=48, mat_index=0)
    lathe(bm, [(0.072, 0.018), (0.072, 0.056)], segs=48, mat_index=1, smooth=False, flute=0.004)
    lathe(bm, [(0.072, 0.056), (0.066, 0.062), (0.050, 0.064)], segs=48, mat_index=1)
    lathe(bm, [(0.050, 0.064), (0.044, 0.068), (0.026, 0.071), (0.0, 0.072)], segs=48, mat_index=2)
    w, tail, shoulder, tip, lo, hi = 0.014, -0.060, 0.088, 0.110, 0.058, 0.076
    outline = [(-w, tail), (w, tail), (w, shoulder), (0.0, tip), (-w, shoulder)]
    a = [bm.verts.new((px, py, lo)) for px, py in outline]
    b = [bm.verts.new((px * 0.8, py if py != tip else py - 0.004, hi)) for px, py in outline]
    made = [bm.faces.new(a), bm.faces.new(b)]
    for i in range(5):
        j = (i + 1) % 5
        made.append(bm.faces.new([a[i], a[j], b[j], b[i]]))
    bmesh.ops.recalc_face_normals(bm, faces=made)
    for f in made:
        f.material_index = 3
    line = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=line["verts"], vec=(0.006, 0.100, 0.003))
    bmesh.ops.translate(bm, verts=line["verts"], vec=(0, 0.040, hi + 0.001))
    for f in {f for v in line["verts"] for f in v.link_faces}:
        f.material_index = 4
    obj = mesh_object(name, bm, ["steel", "bakelite", "dome", "bakelite", "pip"], parent=parent)
    obj.location = (x, -z, 0.004)
    return obj


def plunger(parent):
    """A fat amber mushroom plunger. Its collar is scenery; this is the part that goes down."""
    bm = bmesh.new()
    lathe(bm, [(0.032, 0.004), (0.032, 0.040)], segs=40, mat_index=0)
    lathe(bm, [(0.036, 0.040), (0.056, 0.043), (0.060, 0.054), (0.055, 0.067), (0.038, 0.078), (0.018, 0.083), (0.0, 0.084)],
          segs=40, mat_index=1)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.z > 0.0415], dist=1e-5)
    obj = mesh_object("Plunger_Release", bm, ["steel", "plunger"], parent=parent)
    obj.location = (PLUNGER_AT[0], -PLUNGER_AT[1], 0)
    return obj


# ---------------------------------------------------------------- the machine


def side_profile():
    """A side panel's front edge as (z, y) points, top to bottom: straight down the tower, over the
    desk a little above it, and back to the pedestal."""
    def cheek(y, z):
        p = deck_point(0, y, z)
        return (p[2], p[1])

    return [(0.17, HEIGHT - 0.012), (0.17, 1.16), cheek(0.045, -DECK_D / 2 - 0.01), cheek(0.045, DECK_D / 2 - 0.03),
            cheek(-0.005, DECK_D / 2 + 0.018), cheek(-0.07, DECK_D / 2 + 0.018), (LOWER_Z + 0.03, LOWER_TOP - 0.06), (LOWER_Z + 0.03, 0.0)]


def side_panels():
    front = side_profile()
    outline = front + [(BACK_Z, 0.0), (BACK_Z, HEIGHT - 0.012)]
    for side in (-1, 1):
        x = side * (HALF_W + PANEL_T / 2)
        add_prism("wood", outline, x - PANEL_T / 2, x + PANEL_T / 2, grain="up")
        for a, b in zip(front, front[1:]):
            add_strip("steel", a, b, PANEL_T + 0.006, 0.012, x)
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if a[1] > 0.95 and b[1] > 0.85 and length > 0.2:
                nz, ny = -(b[1] - a[1]) / length * 0.0065, (b[0] - a[0]) / length * 0.0065
                add_strip("glow", (a[0] + nz, a[1] + ny), (b[0] + nz, b[1] + ny), 0.006, 0.003, x - side * 0.014)


def body():
    w = 2 * HALF_W
    top = HEIGHT - 0.012
    # The plinth is set back and dark, so the console seems to stand off the floor.
    add_box("black", (w - 0.04, 0.07, LOWER_Z - BACK_Z - 0.06), (0, 0.035, (LOWER_Z + BACK_Z) / 2 - 0.03))
    add_box("wood", (w, LOWER_TOP - 0.07, LOWER_Z - BACK_Z), (0, (LOWER_TOP + 0.07) / 2, (LOWER_Z + BACK_Z) / 2), grain="up", bevel=0.004)
    add_box("wood", (w, top - LOWER_TOP, FACE_Z - BACK_Z), (0, (top + LOWER_TOP) / 2, (FACE_Z + BACK_Z) / 2), grain="up")
    # The desk: a wedge whose top is the deck.
    far, near, nose = deck_point(0, 0, -DECK_D / 2), deck_point(0, 0, DECK_D / 2), deck_point(0, -0.07, DECK_D / 2)
    add_prism("wood", [(far[2], far[1]), (near[2], near[1]), (nose[2], nose[1]), (LOWER_Z, LOWER_TOP), (FACE_Z - 0.02, LOWER_TOP), (FACE_Z - 0.02, far[1])],
              -HALF_W, HALF_W, grain="across")
    side_panels()
    add_box("steel", (w + 2 * PANEL_T + 0.016, 0.014, 0.17 - BACK_Z + 0.02), (0, HEIGHT - 0.007, (0.17 + BACK_Z) / 2 + 0.01), bevel=0.004)
    # A shadow gap above the desk and a steel kick plate along the foot of the pedestal.
    add_box("black", (w, 0.007, 0.004), (0, far[1] + 0.03, FACE_Z + 0.001))
    add_box("steel", (w, 0.075, 0.006), (0, 0.105, LOWER_Z + 0.003), bevel=0.002)
    front_plate("parts", "maker", 0.36, 0.056, (0.0, 0.69, LOWER_Z + 0.003))


def tube():
    """The round tube in a deep steel box hood that flares toward the player and stands out further
    at the top, as both target pictures drew it."""
    cx, cy = TUBE_C
    steel = bucket("steel")
    wall, chamfer = 0.012, 0.022

    def rect(half, z_of, grow=0.0):
        h = half + grow
        c = chamfer + grow * 0.4
        pts = [(h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c), (-h + c, -h)]
        return [(cx + x, cy + y, z_of(y)) for x, y in pts]

    def front(y):
        t = (y + HOOD_FRONT + wall) / (2 * (HOOD_FRONT + wall))
        return FACE_Z + HOOD_MIN + (HOOD_MAX - HOOD_MIN) * t

    back = lambda y: FACE_Z
    rings = [rect(HOOD_R, back, wall), rect(HOOD_FRONT, front, wall), rect(HOOD_FRONT, front), rect(HOOD_R, lambda y: FACE_Z + 0.004)]
    pieces = []
    for k, (lo, hi) in enumerate(zip(rings, rings[1:])):
        tmp = bmesh.new()
        a = [tmp.verts.new(B(*p)) for p in lo]
        b = [tmp.verts.new(B(*p)) for p in hi]
        for i in range(8):
            j = (i + 1) % 8
            tmp.faces.new([a[i], a[j], b[j], b[i]])
        tmp.normal_update()
        for f in tmp.faces:
            c = f.calc_center_median()
            radial = Vector((c.x - cx, 0, c.z - cy))
            # Outside and lip face away from the tube and toward the player; the lining faces in.
            want = radial if k == 0 else Vector((0, -1, 0)) if k == 1 else -radial
            if f.normal.dot(want) < 0:
                f.normal_flip()
        pieces.append((tmp, "black" if k == 2 else "steel"))
    for tmp, mat in pieces:
        merge(tmp, mat)
    # A black mask behind the glass, and a thick turned steel ring round the face.
    add_box("black", (2 * HOOD_R, 2 * HOOD_R, 0.004), (cx, cy, FACE_Z + 0.002))
    add_front_lathe("steel", [(SCREEN_R + 0.032, 0.0), (SCREEN_R + 0.032, 0.010), (SCREEN_R + 0.020, 0.022), (SCREEN_R + 0.004, SCREEN_Z - FACE_Z),
                              (SCREEN_R - 0.002, SCREEN_Z - FACE_Z - 0.001)], cx, cy, FACE_Z + 0.004, segs=72)
    screen()


def register():
    """The lamp register above the tube, the switch row under it, and the name plate."""
    span = 16 * LAMP_PITCH
    panel_h = SCORE_Y - ROW2_Y + 0.10
    py = (SCORE_Y + ROW2_Y) / 2
    add_box("bakelite", (span + 0.04, panel_h, 0.006), (0, py, FACE_Z + 0.003))
    add_bevel_frame("steel", 0, py, span + 0.04, panel_h, FACE_Z, FACE_Z + 0.016, 0.014, 0.005, FACE_Z + 0.006)
    add_box("glow", (span + 0.10, 0.004, 0.004), (0, py + panel_h / 2 + 0.024, FACE_Z + 0.002))
    for bit in range(16):
        lamp(f"Lamp_Score_{bit}", "lamp_score", score_x(bit), SCORE_Y)
    # Short white marks part the register into groups of four bits, as on a console, so they can be counted.
    for bit in (4, 8, 12):
        add_box("cream", (0.003, 0.012, 0.002), (score_x(bit) + LAMP_PITCH / 2, SCORE_Y - 0.030, FACE_Z + 0.007))
    # The lower row: balls left on the left, the bounce lamps on the right, steady lamps between.
    for i in range(5):
        lamp(f"Lamp_Ball_{i}", "lamp_ball", (i - 7.5) * LAMP_PITCH, ROW2_Y)
    for i in range(4):
        lamp(f"Lamp_Bounce_{i}", "lamp_bounce", (i + 4.5) * LAMP_PITCH, ROW2_Y)
    for i, kind in zip(range(-2, 4), ("bulb", "bulb_on", "bulb", "bulb", "bulb_on", "bulb")):
        x = (i - 0.5) * LAMP_PITCH
        add_front_lathe("steel", [(0.016, 0.0), (0.016, 0.006), (0.012, 0.008)], x, ROW2_Y, FACE_Z, segs=20)
        add_ball(kind, 0.010, (x, ROW2_Y, FACE_Z + 0.010))

    # Sixteen toggle switches, as Whirlwind's consoles had for setting words by hand. Dressing only.
    add_box("steel", (span + 0.04, 0.07, 0.008), (0, SWITCH_Y, FACE_Z + 0.004), bevel=0.003)
    for bit in range(16):
        x = score_x(bit)
        add_front_lathe("steel", [(0.011, 0.0), (0.011, 0.010), (0.005, 0.012)], x, SWITCH_Y, FACE_Z + 0.008, segs=10)
        up = 1 if (bit * 7) % 5 < 2 else -1
        add_box("steel", (0.006, 0.036, 0.006), (x, SWITCH_Y + up * 0.012, FACE_Z + 0.030), tilt=-up * 0.45, bevel=0.002)
    add_box("glow", (span + 0.10, 0.004, 0.004), (0, SWITCH_Y - 0.052, FACE_Z + 0.002))
    front_plate("parts", "name", 0.40, 0.10, (0, NAME_Y, FACE_Z + 0.004))
    add_bevel_frame("steel", 0, NAME_Y, 0.40, 0.10, FACE_Z, FACE_Z + 0.010, 0.008, 0.003, FACE_Z + 0.005)


def desk():
    w = 2 * HALF_W
    add_box("steel", (w, 0.08, 0.016), (0, -0.030, DECK_D / 2 + 0.008), frame=DECK, bevel=0.003)
    add_box("steel", (w, 0.010, 0.018), (0, 0.005, -DECK_D / 2 + 0.009), frame=DECK, bevel=0.002)
    add_box("glow", (w - 0.04, 0.004, 0.004), (0, 0.002, DECK_D / 2 - 0.006), frame=DECK)
    for s in (-1, 1):
        add_box("glow", (0.004, 0.004, DECK_D - 0.03), (s * (HALF_W - 0.006), 0.002, 0), frame=DECK)
    # Each knob: a steel base ring and a black dial plate with nine ticks, then its label plate.
    for x, label in ((-KNOB_X, "bounce"), (KNOB_X, "speed")):
        add_lathe("steel", [(0.124, 0.0), (0.124, 0.006), (0.118, 0.010), (0.112, 0.010)], x, KNOB_Z)
        bm = bucket("dialplate")
        uvl = bm.loops.layers.uv["UVMap"]
        u0, v0, u1, v1 = atlas_uv("dial")
        m = DECK @ Matrix.Translation(Vector((x, -KNOB_Z, 0.0105)))
        segs = 48
        c = bm.verts.new(m @ Vector((0, 0, 0)))
        ring = [bm.verts.new(m @ Vector((0.112 * math.cos(2 * math.pi * i / segs), 0.112 * math.sin(2 * math.pi * i / segs), 0))) for i in range(segs)]
        for i in range(segs):
            j = (i + 1) % segs
            f = bm.faces.new([c, ring[i], ring[j]])
            for loop in f.loops:
                p = m.inverted() @ loop.vert.co
                # The picture's up is up the deck (Blender +Y in the deck's frame).
                loop[uvl].uv = (u0 + (p.x / 0.224 + 0.5) * (u1 - u0), v0 + (p.y / 0.224 + 0.5) * (v1 - v0))
        deck_plate("parts", label, 0.15, 0.0375, x, KNOB_Z + 0.135, 0.002)
    px, pz = PLUNGER_AT
    add_lathe("steel", [(0.074, 0.0), (0.074, 0.012), (0.064, 0.022), (0.038, 0.022)], px, pz)
    deck_plate("parts", "release", 0.15, 0.0375, px, pz + 0.135, 0.002)

    deck = bpy.data.objects.new("Whirlwind_Deck", None)
    deck.location = B(*DECK_C)
    deck.rotation_euler = (DECK_TILT, 0, 0)
    bpy.context.collection.objects.link(deck)
    knob("Knob_Bounce", deck, -KNOB_X, KNOB_Z)
    knob("Knob_Speed", deck, KNOB_X, KNOB_Z)
    plunger(deck)


def machine():
    body()
    tube()
    register()
    desk()


# ---------------------------------------------------------------- checks


def bounds(obj):
    pts = [G(obj.matrix_world @ Vector(c)) for c in obj.bound_box]
    return tuple(min(p[i] for p in pts) for i in range(3)), tuple(max(p[i] for p in pts) for i in range(3))


def view_pixels(points, eye, aim, size, fov=SEAT_FOV):
    """Where game-space points land in a view, in pixels."""
    eye, aim = Vector(eye), Vector(aim)
    f = (aim - eye).normalized()
    r = f.cross(Vector((0, 1, 0))).normalized()
    u = r.cross(f)
    t = math.tan(math.radians(fov / 2))
    out = []
    for p in points:
        d = Vector(p) - eye
        out.append((size[0] / 2 + d.dot(r) / d.dot(f) / t * size[1] / 2, size[1] / 2 - d.dot(u) / d.dot(f) / t * size[1] / 2))
    return out


def phone_eye(aspect=390 / 844, half_width=0.40, front=0.47):
    """The seat on an upright phone: src/player.rs steps back until `half_width` fits."""
    per_metre = math.tan(math.radians(SEAT_FOV / 2)) * aspect
    return (SEAT_EYE[0], SEAT_EYE[1], max(SEAT_EYE[2], front + half_width / per_metre))


def report():
    bpy.context.view_layer.update()
    fmt = lambda p: "(" + ", ".join(f"{v:+.3f}" for v in p) + ")"
    lo_all, hi_all, tris = [1e9] * 3, [-1e9] * 3, 0
    phone = (390, 844)
    peye = phone_eye()
    print(f"phone seat eye {fmt(peye)}")
    print(f"{'node':<22} {'min (x, y, z)':<28} {'max (x, y, z)':<28} {'tris':>5}  seat px (x0 y0 x1 y1) w%   phone w% y0-y1")
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type != "MESH":
            continue
        lo, hi = bounds(obj)
        n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        tris += n
        lo_all = [min(a, b) for a, b in zip(lo_all, lo)]
        hi_all = [max(a, b) for a, b in zip(hi_all, hi)]
        pts = [G(obj.matrix_world @ v.co) for v in obj.data.vertices]
        px = view_pixels(pts, SEAT_EYE, SEAT_AIM, (1280, 720))
        xs, ys = [p[0] for p in px], [p[1] for p in px]
        ph = view_pixels(pts, peye, SEAT_AIM, phone)
        pxs, pys = [p[0] for p in ph], [p[1] for p in ph]
        seen = f"{min(xs):5.0f} {min(ys):5.0f} {max(xs):5.0f} {max(ys):5.0f} {(max(xs) - min(xs)) / 12.8:4.1f}%"
        pseen = f"{(max(pxs) - min(pxs)) / phone[0] * 100:5.1f}% {min(pys):4.0f}-{max(pys):4.0f}"
        print(f"{obj.name:<22} {fmt(lo):<28} {fmt(hi):<28} {n:>5}  {seen}  {pseen}")
    print(f"{'ALL':<22} {fmt(lo_all):<28} {fmt(hi_all):<28} {tris:>5}")
    size = [hi_all[i] - lo_all[i] for i in range(3)]
    print(f"size: {size[0]:.3f} wide, {size[1]:.3f} tall, {size[2]:.3f} deep (limit 1.5, 2.4, 0.9)")
    assert size[0] <= 1.5 and size[1] <= 2.4 and size[2] <= 0.9, "over the size limit"


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
    """The floor and the wall behind, so pictures show the machine standing somewhere. The left wall
    of the room is 0.6 m behind the origin; the ceiling is at 3.2 m."""
    for name, color, rough in (("pv_floor", (0.16, 0.16, 0.155), 0.25), ("pv_wall", (0.012, 0.022, 0.050), 0.5)):
        material(name, color=color, rough=rough)
    for mat, size, pos in (("pv_floor", (9, 0.1, 9), (0, -0.05, 2.0)), ("pv_wall", (9, 3.2, 0.1), (0, 1.6, -0.65)),
                           ("pv_wall", (9, 0.1, 9), (0, 3.25, 2.0))):
        bm = bmesh.new()
        verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.transform(bm, matrix=Matrix.Translation(B(*pos)) @ Matrix.Diagonal((size[0], size[2], size[1], 1.0)), verts=verts)
        mesh_object(mat, bm, [mat])


VIEWS = {"seat": (SEAT_EYE, SEAT_AIM, (1024, 576)), "hero": (HERO_EYE, HERO_AIM, (768, 1024)),
         "phone": (phone_eye(), SEAT_AIM, (390, 844))}


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
    finds no strokes in this headless build, so lines are drawn where the depth jumps or the surface
    turns, as blender/lines.py does."""
    import numpy as np
    from PIL import Image

    os.makedirs(out, exist_ok=True)
    room_shell()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.filter_width = 0.01
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Raw"
    scene.world = bpy.data.worlds.new("w")
    layer = scene.view_layers[0]
    for name in ("seat", "hero"):
        eye, aim, size = VIEWS[name]
        camera(eye, aim)
        scene.render.resolution_x, scene.render.resolution_y = size[0] * 2, size[1] * 2
        far = 3.2 if name == "seat" else 6.5
        paths = {}
        for kind in ("depth", "normal"):
            layer.material_override = flat((0.5, far) if kind == "depth" else None)
            paths[kind] = scene.render.filepath = os.path.join(out, f"_whirlwind_{name}_{kind}.png")
            bpy.ops.render.render(write_still=True)
        d = np.asarray(Image.open(paths["depth"]).convert("RGB")).astype(np.float32)[:, :, 0] / 255.0
        n = np.asarray(Image.open(paths["normal"]).convert("RGB")).astype(np.float32) / 255.0
        line = np.zeros(d.shape, bool)
        for axis in (0, 1):
            dd = np.abs(np.diff(d, axis=axis, append=d.take([-1], axis=axis)))
            dn = np.abs(np.diff(n, axis=axis, append=n.take([-1], axis=axis))).sum(axis=2)
            line |= (dd > 0.012) | (dn > 0.30)
        ink = Image.fromarray(np.where(line, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)
        ink.save(os.path.join(out, f"whirlwind_{name}_lines.png"), optimize=True)
        Image.fromarray((d * 255).astype(np.uint8)).resize(size, Image.LANCZOS).save(os.path.join(out, f"whirlwind_{name}_depth.png"), optimize=True)
        for p in paths.values():
            os.remove(p)
        print("wrote", name, "lines and depth")
    layer.material_override = None


def preview(path, view):
    """A look at the machine, lit roughly as the room is. Only for checking the model by eye."""
    scene = bpy.context.scene
    room_shell()
    # A run in progress, so lit and unlit lamps can both be judged: score 230, three balls left,
    # the second bounce lamp lit.
    for name, color in (("score_lit", (1.0, 0.62, 0.22)), ("ball_lit", (1.0, 0.12, 0.05)), ("bounce_lit", (0.55, 1.0, 0.30))):
        material(name, color=(0, 0, 0), emit=color, emit_strength=6.0, tex="parts", orm=False, emit_tex=True)
    for bit in range(16):
        if 230 >> bit & 1:
            bpy.data.objects[f"Lamp_Score_{bit}"].data.materials[0] = MATS["score_lit"]
    for i in range(3):
        bpy.data.objects[f"Lamp_Ball_{i}"].data.materials[0] = MATS["ball_lit"]
    bpy.data.objects["Lamp_Bounce_1"].data.materials[0] = MATS["bounce_lit"]
    # A green glow on the tube, as if a trace were on it.
    material("tube_on", color=(0.01, 0.02, 0.01), rough=0.06, emit=(0.30, 0.9, 0.25), emit_strength=0.25)
    bpy.data.objects["Tube_Screen"].data.materials[0] = MATS["tube_on"]
    eye, aim, size = VIEWS[view]
    camera(eye, aim)
    for at, energy, color, soft in (((0.8, 3.0, 2.4), 420, (1.0, 0.86, 0.70), 0.6), ((-2.6, 2.0, 2.2), 260, (1.0, 0.80, 0.62), 0.8),
                                    ((0.0, 0.3, 3.0), 30, (1.0, 0.62, 0.30), 1.0)):
        light = bpy.data.objects.new("L", bpy.data.lights.new("L", "POINT"))
        light.data.energy = energy
        light.data.color = color
        light.data.shadow_soft_size = soft
        light.location = B(*at)
        scene.collection.objects.link(light)
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

    path = os.path.join(OUT, "whirlwind.glb")
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

    if "--lines" in sys.argv:
        lines(sys.argv[sys.argv.index("--lines") + 1])
    elif "--preview" in sys.argv:
        view = sys.argv[sys.argv.index("--view") + 1] if "--view" in sys.argv else "seat"
        preview(sys.argv[sys.argv.index("--preview") + 1], view)


if __name__ == "__main__":
    main()
