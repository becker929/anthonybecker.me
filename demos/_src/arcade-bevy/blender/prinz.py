"""Builds the arcade's fifth machine, a homage to Dietrich Prinz's chess program (1951), as assets/prinz.glb.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/prinz.py                      build and export
    <bpy venv>/bin/python blender/prinz.py --preview out.png    also render a look (add --view hero|phone)
    <bpy venv>/bin/python blender/prinz.py --lines reference    also render line art and depth for Gemini

Everything is written in the game's coordinates (metres, Y up) and converted on the way in. The
machine stands at its own origin facing +Z, so the game can put it anywhere.

Prinz's program ran on the Ferranti Mark 1 at Manchester. Its operators sat at a long console with
switches, neon lamps and small monitor tubes that showed the store's bits as dots. This machine is an
operator's desk in that manner, in the room's walnut and steel, with a real chessboard set into its
sloped top. The visitor solves the machine's mate-in-two problems on it (src/prinz.rs).

The game finds these objects by name (src/prinz_machine.rs):

    Prinz_Board          an empty at the centre of the board's top face, carrying the desk's tilt. Squares
                         are 0.064 m apart in its X (files, a to h) and -Z (ranks, 1 to 8: rank 1 is nearest)
    Prinz_Tray           an empty at the centre of the tray's floor, in the same tilt; taken pieces go here
    Lamp_Sq_0..63        a ring of lamp glass round each square's edge; a1 = 0, h8 = 63
    Piece_W_K .. Piece_B_P   one template of each piece, origin at the centre of its base; the game hides
                         these and lays out copies. K Q R B N P, W and B
    Lamp_White, Lamp_Think, Lamp_Mate, Lamp_Refuted   the result lamps behind the board
    Lamp_Problem_0..14   the problem row on the panel: lit when solved in this run
    Lamp_Run_0..7        neon lamps that run while the machine thinks
    Button_Next          the heavy next-problem button; it sinks along its own Y
    Monitor_Tube         the monitor's face, UVs 0 to 1, for a picture painted by the game

Everything else is scenery, joined into one mesh per material.
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
TEX_OWN = os.path.join(HERE, "tex_prinz")

# One texture repeat covers this many metres. Walnut and steel as on the other machines.
TEX_METRES = {"walnut": 0.70, "steel": 0.25, "maple": 0.30, "enamel": 0.40}

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

HALF = 0.72           # half the width between the side panels
PANEL_T = 0.04
BACK_Z = -0.40
LOWER_Z = 0.28        # the front of the lower body, under the desk
# The desk: a sloped top whose frame has x across, y out of the top and z down the slope toward the
# player. DESK_C is the centre of its top face.
DESK_C = (0.0, 1.03, 0.13)
DESK_TILT = 0.44      # radians, about 25 degrees
DESK_FAR, DESK_NEAR = -0.40, 0.36   # the top's extent along the slope, in its frame
# The board, in the desk's frame. Squares are 64 mm, so a square is a thumb's width on an upright phone.
PITCH = 0.064
BOARD_Z = 0.05        # the board's centre, down the slope from the desk's centre
BOARD_RISE = 0.006    # its top above the desk
FRAME = 0.026
# The rail behind the board: result lamps and the next button.
RAIL_Z = -0.315
RAIL_X = (-0.25, -0.125, 0.0, 0.125)  # White, Think, Mate, Refuted
NEXT_X = 0.255
LAMP_R = 0.024
# The tray for taken pieces, right of the board.
TRAY_C = (0.47, 0.08)
TRAY_HALF = (0.115, 0.22)
# The panel at the back.
PANEL_Z = -0.235      # its face at its foot
PANEL_LEAN = 0.10     # it leans back this many radians
PANEL_TOP = 1.80
MONITOR_C = (0.0, 1.50)
PROBLEMS = 15

# Where the player's eye is at the machine and what it looks at; the game uses the same numbers.
SEAT_EYE, SEAT_AIM, SEAT_FOV = (0.0, 1.58, 0.86), (0.0, 1.13, 0.02), 68.0
# On a narrow screen the eye steps back until this half width fits at SEAT_FRONT (src/player.rs).
SEAT_HALF_WIDTH, SEAT_FRONT = 0.25, 0.43
PHONE = (390, 844)
HERO_EYE, HERO_AIM = (-1.45, 1.70, 2.0), (0.0, 1.10, 0.05)

DESK = Matrix.Translation(B(*DESK_C)) @ rot_x(DESK_TILT)


def phone_eye():
    """The seat on an upright phone, as Machine::eye_for in src/player.rs works it out."""
    aspect = PHONE[0] / PHONE[1]
    per_metre = math.tan(math.radians(SEAT_FOV / 2)) * aspect
    x, y, z = SEAT_EYE
    return (x, y, max(z, SEAT_FRONT + SEAT_HALF_WIDTH / per_metre))


def desk_point(x, y, z):
    """A point in the desk's frame (x across, y out of the top, z down the slope), in game coordinates."""
    return G(DESK @ Vector((x, -z, y)))


def square_local(i):
    """A square's centre in the board's frame: x across, z down the slope. a1 = 0 is near left."""
    f, r = i % 8, i // 8
    return ((f - 3.5) * PITCH, (3.5 - r) * PITCH)


# Where each picture sits in tex_prinz/parts.jpg, in pixels from the top left of a 1024 square.
ATLAS = {
    "white": (4, 4, 252, 68),
    "think": (260, 4, 508, 68),
    "mate": (516, 4, 764, 68),
    "refuted": (772, 4, 1020, 68),
    "next": (4, 76, 252, 140),
    "problem": (260, 76, 508, 140),
    "name": (4, 148, 1020, 268),
    "files": (4, 276, 1020, 340),
    "ranks": (4, 348, 1020, 412),
    "tube": (4, 420, 260, 676),
}


def atlas_uv(name):
    x0, y0, x1, y1 = ATLAS[name]
    return x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024


# ---------------------------------------------------------------- materials

MATS = {}
TEXTURED = {"wood", "steel", "parts", "maple", "darksq", "enamel", "felt"}


def tex_file(name):
    for folder in (TEX_OWN, TEX_SHARED):
        path = os.path.join(folder, name + ".jpg")
        if os.path.exists(path):
            return path
    return None


def material(name, color=(1, 1, 1), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, tex=None, orm=True, emit_tex=False, coat=0.0):
    mat = bpy.data.materials.new("Prinz_" + name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
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
    material("steel", rough=0.36, metal=0.8, tex="steel", orm=False)
    material("black", color=(0.006, 0.006, 0.007), rough=0.85)
    material("bakelite", color=(0.012, 0.011, 0.010), rough=0.32)
    material("enamel", color=(0.86, 0.86, 0.85), rough=0.55, tex="enamel")
    material("glow", color=(0, 0, 0), emit=(1.0, 0.60, 0.26), emit_strength=3.4)
    # The board: pale maple and dark walnut squares, both satin varnished.
    material("maple", color=(0.95, 0.93, 0.90), rough=0.34, tex="maple", coat=0.3)
    material("darksq", color=(0.62, 0.50, 0.42), rough=0.34, tex="walnut", orm=False, coat=0.3)
    material("felt", rough=0.95, tex="felt")
    # The pieces: boxwood and ebony. Two materials only, so every copy batches with its kind.
    material("ivory", color=(0.78, 0.54, 0.26), rough=0.30, coat=0.4)
    material("ebony", color=(0.020, 0.017, 0.015), rough=0.22, coat=0.6)
    # Lamp glass, unlit. The game lights copies of these.
    material("ring", color=(0.075, 0.055, 0.035), rough=0.30, emit=(1.0, 0.70, 0.35), emit_strength=0.01)
    material("jewel_white", color=(0.62, 0.58, 0.50), rough=0.15, emit=(1.0, 0.86, 0.62), emit_strength=0.04)
    material("jewel_amber", color=(0.50, 0.26, 0.06), rough=0.15, emit=(1.0, 0.50, 0.12), emit_strength=0.04)
    material("jewel_green", color=(0.10, 0.32, 0.14), rough=0.15, emit=(0.30, 1.0, 0.40), emit_strength=0.04)
    material("jewel_red", color=(0.40, 0.04, 0.03), rough=0.15, emit=(1.0, 0.08, 0.04), emit_strength=0.04)
    material("neon", color=(0.32, 0.16, 0.08), rough=0.25, emit=(1.0, 0.36, 0.08), emit_strength=0.03)
    material("neon_on", color=(0.80, 0.40, 0.14), rough=0.25, emit=(1.0, 0.36, 0.08), emit_strength=3.0)
    material("tube", color=(0.0, 0.0, 0.0), rough=0.08, emit=(0.30, 0.95, 0.55), emit_strength=0.05)
    material("dome_next", color=(0.40, 0.03, 0.02), rough=0.10, emit=(1.0, 0.10, 0.04), emit_strength=0.08)
    material("parts", rough=0.40, tex="parts", orm=False)


# ---------------------------------------------------------------- scenery geometry

BUCKETS = {}
SMOOTH = {"neon", "neon_on", "jewel_white", "jewel_amber", "jewel_green", "jewel_red"}
GRAIN = {"up": Vector((0, 0, 1)), "across": Vector((1, 0, 0))}
PIECE = [0]


def bucket(mat):
    if mat not in BUCKETS:
        bm = bmesh.new()
        if mat in TEXTURED:
            bm.loops.layers.uv.new("UVMap")
        BUCKETS[mat] = bm
    return BUCKETS[mat]


def wood_uv(bm, faces, grain, metres):
    """Lays the grain (the picture's V) along `grain` on every face it can lie in. Each piece starts
    at a different place in the picture."""
    uv = bm.loops.layers.uv["UVMap"]
    s = 1.0 / metres
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
    if mat == "wood" or mat == "darksq":
        wood_uv(bm, faces, grain, TEX_METRES["walnut"] * (0.5 if mat == "darksq" else 1.0))
    elif mat == "maple":
        wood_uv(bm, faces, grain, TEX_METRES["maple"])
    elif mat in ("enamel", "felt"):
        wood_uv(bm, faces, grain, TEX_METRES["enamel"])
    elif mat == "steel":
        steel_uv(bm, faces)


def add_box(mat, size, pos, frame=None, grain="across", tilt=0.0, bevel=0.0):
    """A box of `size` centred on `pos` in game coordinates, or in `frame` (the desk's) if given.
    `bevel` rounds its edges by that many metres, so they catch the light."""
    bm = bucket(mat)
    sx, sy, sz = size
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    bmesh.ops.scale(tmp, verts=tmp.verts[:], vec=(sx, sz, sy))
    if bevel > 0:
        bmesh.ops.bevel(tmp, geom=tmp.edges[:], offset=min(bevel, min(size) * 0.45), segments=1, profile=0.5, affect="EDGES")
    if frame is not None:
        m = frame @ Matrix.Translation(Vector((pos[0], -pos[2], pos[1])))
    else:
        m = Matrix.Translation(B(*pos)) @ rot_x(tilt)
    bmesh.ops.transform(tmp, matrix=m, verts=tmp.verts[:])
    merge(bm, tmp, mat, grain)


def merge(bm, tmp, mat, grain):
    """Copies a finished bmesh into a material's bucket and paints it."""
    uv_layer = bm.loops.layers.uv.get("UVMap")
    vmap = {v: bm.verts.new(v.co) for v in tmp.verts}
    faces = []
    for f in tmp.faces:
        try:
            nf = bm.faces.new([vmap[v] for v in f.verts])
        except ValueError:
            continue
        nf.smooth = f.smooth
        faces.append(nf)
    tmp.free()
    # Small turned dressing passes no grain: its faces keep one UV, so its vertices stay shared.
    if grain:
        paint(bm, faces, mat, grain)
    else:
        bm.normal_update()
    return faces, uv_layer


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
    add_box(mat, (width, length, thick), (x, (y0 + y1) / 2, (z0 + z1) / 2), tilt=tilt, bevel=0.002)


def add_bevel_frame(mat, w, h, z_back, z_front, bar, flat, z_inner, frame, cx=0.0, cy=0.0, grain="across"):
    """A mitred frame round a `w` by `h` opening in `frame`'s x-y plane (its z out toward the viewer):
    a flat rim `flat` wide at `z_front`, then a slope down to the opening at `z_inner`."""
    bm = bucket(mat)
    rings = []
    for hw, hh, z in ((w / 2 + bar, h / 2 + bar, z_back), (w / 2 + bar, h / 2 + bar, z_front),
                      (w / 2 + bar - flat, h / 2 + bar - flat, z_front), (w / 2, h / 2, z_inner)):
        rings.append([bm.verts.new(frame @ Vector((cx + sx * hw, cy + sy * hh, z))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    faces = []
    for lo, hi in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            faces.append(bm.faces.new([lo[i], lo[j], hi[j], hi[i]]))
    bm.normal_update()
    out = (frame.to_3x3() @ Vector((0, 0, 1))).normalized()
    if faces[4].normal.dot(out) < 0:
        bmesh.ops.reverse_faces(bm, faces=faces)
    paint(bm, faces, mat, grain)


def add_quad(mat, corners, picture):
    """A flat picture from the atlas. `corners` run bottom left, bottom right, top right, top left."""
    bm = bucket(mat)
    uv = bm.loops.layers.uv["UVMap"]
    u0, v0, u1, v1 = atlas_uv(picture)
    f = bm.faces.new([bm.verts.new(c) for c in corners])
    for loop, t in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[uv].uv = t


def desk_plate(picture, w, d, x, z, y=0.0015):
    """A picture lying on the desk, centred on (x, z) at `y` above it. Its top is up the slope."""
    pts = [DESK @ Vector((x + px, -(z + pz), y)) for px, pz in ((-w / 2, d / 2), (w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2))]
    add_quad("parts", pts, picture)


def lathe(bm, profile, segs=32, mat_index=0, smooth=True, flute=0.0, matrix=None):
    """Turns a profile of (radius, height) points about the up axis, bottom to top. Each band has its
    own vertices, so bands meet at a crisp edge."""

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
            if len(lo) == 1 and len(hi) == 1:
                continue
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


def add_lathe(mat, profile, frame, segs=32, smooth=True):
    """A turned part standing on `frame`'s x-y plane at its origin, its axis along the frame's z."""
    bm = bucket(mat)
    faces = lathe(bm, profile, segs=segs, matrix=frame, smooth=smooth)
    if mat == "steel":
        uv = bm.loops.layers.uv["UVMap"]
        centre = frame @ Vector((0, 0, 0))
        axis = (frame.to_3x3() @ Vector((0, 0, 1))).normalized()
        side = (frame.to_3x3() @ Vector((1, 0, 0))).normalized()
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


def finish_buckets():
    for mat, bm in BUCKETS.items():
        mesh = bpy.data.meshes.new(f"Prinz_{mat}")
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        smooth = [f.smooth for f in bm.faces]
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(f"Prinz_{mat}", mesh)
        bpy.context.collection.objects.link(obj)
        for poly, s in zip(mesh.polygons, smooth):
            poly.use_smooth = s or mat in SMOOTH
    BUCKETS.clear()


# ---------------------------------------------------------------- working parts


def mesh_object(name, bm, mats, parent=None, matrix=None):
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for m in mats:
        mesh.materials.append(MATS[m])
    obj = bpy.data.objects.new(name, mesh)
    obj.parent = parent
    if matrix is not None:
        obj.matrix_basis = matrix
    bpy.context.collection.objects.link(obj)
    return obj


def empty(name, matrix, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.parent = parent
    obj.matrix_basis = matrix
    bpy.context.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------- the pieces

LATHE = lathe

# Heights are low and heads are broad: from the seat a piece is seen from above at about 50 degrees,
# so it is told by its top and its outline, and a tall one would hide the square behind it.
BASE_R = 0.0215
PIECE_SCALE = 1.35


def foot(top_r, h):
    """The turned foot every piece shares: a wide base with a bead, rising to `top_r` at height `h`."""
    return [(0.0, 0.0), (BASE_R, 0.0), (BASE_R, 0.0035), (BASE_R - 0.0015, 0.0050), (BASE_R - 0.0040, 0.0060),
            (BASE_R - 0.0040, 0.0075), (top_r + 0.004, 0.0105), (top_r, h)]


def ball(bm, r, z, mat_index=0, segs=14):
    rows = 6
    prof = [(r * math.sin(math.pi * i / rows), z - r * math.cos(math.pi * i / rows)) for i in range(rows + 1)]
    prof[0] = (0.0, prof[0][1])
    prof[-1] = (0.0, prof[-1][1])
    LATHE(bm, prof, segs=segs, mat_index=mat_index)


def box_into(bm, size, at, rot_z=0.0):
    made = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=made["verts"], vec=size)
    if rot_z:
        bmesh.ops.rotate(bm, verts=made["verts"], cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, "Z"))
    bmesh.ops.translate(bm, verts=made["verts"], vec=at)


def piece_mesh(kind):
    """One piece as a bmesh in Blender's own axes, standing on its origin, up along Z."""
    bm = bmesh.new()
    lathe = lambda b, prof, **k: LATHE(b, prof, **{"segs": 20, **k})
    if kind == "P":
        lathe(bm, foot(0.0060, 0.0170) + [(0.0095, 0.0185), (0.0095, 0.0200), (0.0050, 0.0210), (0.0, 0.0210)])
        ball(bm, 0.0085, 0.0270)
    elif kind == "R":
        # A broad tower with a deep crenellated top: four merlons round a hollow.
        lathe(bm, foot(0.0120, 0.0230) + [(0.0150, 0.0250), (0.0150, 0.0300), (0.0, 0.0300)])
        for i in range(4):
            a = math.pi / 4 + i * math.pi / 2
            box_into(bm, (0.0105, 0.0070, 0.0075), (0.0110 * math.cos(a), 0.0110 * math.sin(a), 0.0335), rot_z=a + math.pi / 2)
    elif kind == "B":
        # A tall mitre with a cut and a small ball on top.
        lathe(bm, foot(0.0055, 0.0230) + [(0.0110, 0.0245), (0.0110, 0.0260), (0.0060, 0.0270)])
        prof = [(0.0060, 0.0270), (0.0105, 0.0300), (0.0112, 0.0335), (0.0095, 0.0370), (0.0055, 0.0405), (0.0, 0.0420)]
        lathe(bm, prof)
        ball(bm, 0.0040, 0.0450)
        # The mitre's cut, as a dark slot is not possible in one material: a thin raised fin reads as one.
        box_into(bm, (0.0230, 0.0020, 0.0060), (0.0, 0.0, 0.0365), rot_z=0.6)
    elif kind == "Q":
        # A crown: a flared cup ringed by eight balls, with a ball in the middle.
        lathe(bm, foot(0.0060, 0.0280) + [(0.0115, 0.0295), (0.0115, 0.0310), (0.0065, 0.0320), (0.0080, 0.0360),
                                           (0.0140, 0.0420), (0.0120, 0.0420), (0.0, 0.0400)])
        for i in range(8):
            a = i * math.pi / 4
            made = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.0032)
            bmesh.ops.translate(bm, verts=made["verts"], vec=(0.0130 * math.cos(a), 0.0130 * math.sin(a), 0.0440))
        ball(bm, 0.0050, 0.0465)
    elif kind == "K":
        # A taller crown with a cross on top.
        lathe(bm, foot(0.0065, 0.0300) + [(0.0120, 0.0315), (0.0120, 0.0330), (0.0070, 0.0340), (0.0085, 0.0380),
                                           (0.0130, 0.0430), (0.0125, 0.0440), (0.0060, 0.0460), (0.0, 0.0460)])
        box_into(bm, (0.0060, 0.0060, 0.0200), (0, 0, 0.0550))
        box_into(bm, (0.0160, 0.0060, 0.0055), (0, 0, 0.0570))
    elif kind == "N":
        lathe(bm, foot(0.0100, 0.0120) + [(0.0140, 0.0130), (0.0140, 0.0150), (0.0, 0.0150)])
        # The horse's head, cut from a thick board and chamfered. It looks toward -X (the a-file side).
        head = [(0.010, 0.014), (0.013, 0.030), (0.010, 0.040), (0.004, 0.048), (0.000, 0.052), (-0.004, 0.049),
                (-0.012, 0.044), (-0.019, 0.037), (-0.020, 0.032), (-0.016, 0.029), (-0.008, 0.031), (-0.004, 0.026),
                (-0.009, 0.018), (-0.010, 0.014)]
        t = 0.0075
        front = [bm.verts.new((x, -t, z)) for x, z in head]
        back = [bm.verts.new((x, t, z)) for x, z in head]
        bm.faces.new(front)
        bm.faces.new(list(reversed(back)))
        n = len(head)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([front[j], front[i], back[i], back[j]])
        # A mane ridge down the back of the neck.
        box_into(bm, (0.0040, 0.0170, 0.0180), (0.0115, 0.0, 0.0300), rot_z=0.0)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    return bm


def pieces(parent):
    """One template of each piece and colour, out of sight under the desk. The game copies them onto
    the board and hides these."""
    for c, mat in (("W", "ivory"), ("B", "ebony")):
        for i, kind in enumerate("KQRBNP"):
            bm = piece_mesh(kind)
            # Drawn at a 43 mm base; set at 58 mm, so a piece fills most of its 64 mm square.
            bmesh.ops.scale(bm, verts=bm.verts[:], vec=(PIECE_SCALE,) * 3)
            # Black's knights look the other way, as across a real board.
            if c == "B" and kind == "N":
                bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi, 3, "Z"))
            at = Matrix.Translation(B(-0.30 + i * 0.07, 0.30 if c == "W" else 0.40, 0.0))
            mesh_object(f"Piece_{c}_{kind}", bm, [mat], parent=None, matrix=at)


# ---------------------------------------------------------------- lamps, button, tube


def square_ring(name, board, i):
    """A ring of lamp glass laid round a square's edge, just proud of the board."""
    x, z = square_local(i)
    bm = bmesh.new()
    outer, inner, h = PITCH / 2 - 0.0016, PITCH / 2 - 0.0062, 0.0016
    rings = []
    for half, y in ((outer, 0.0), (outer, h), (inner, h), (inner, 0.0)):
        rings.append([bm.verts.new((sx * half, -sz * half, y)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for lo, hi in zip(rings, rings[1:]):
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new([lo[k], lo[j], hi[j], hi[k]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return mesh_object(name, bm, ["ring"], parent=board, matrix=Matrix.Translation(Vector((x, -z, 0.0))))


def jewel(name, mat, frame, r, parent=None, local=None):
    """A domed glass lamp in a steel bezel. The bezel is scenery; the dome is the named part."""
    add_lathe("steel", [(r + 0.010, 0.0), (r + 0.010, 0.004), (r + 0.006, 0.010), (r + 0.001, 0.010), (r + 0.001, 0.006)], frame, segs=24)
    bm = bmesh.new()
    prof = [(r, 0.004)] + [(r * math.cos(a), 0.004 + r * 0.55 * math.sin(a)) for a in (0.35, 0.7, 1.05, 1.35)] + [(0.0, 0.004 + r * 0.55)]
    lathe(bm, prof, segs=24)
    return mesh_object(name, bm, [mat], parent=parent, matrix=local if local is not None else frame)


def next_button(frame, parent, local):
    """A heavy mushroom button on a stepped collar. The collar is scenery; the cap is what sinks."""
    add_lathe("steel", [(0.052, 0.0), (0.052, 0.008), (0.046, 0.016), (0.040, 0.016), (0.040, 0.010)], frame, segs=40)
    bm = bmesh.new()
    lathe(bm, [(0.030, 0.006), (0.030, 0.034)], segs=32, mat_index=0)
    lathe(bm, [(0.034, 0.034), (0.046, 0.037), (0.048, 0.046), (0.043, 0.056), (0.030, 0.063), (0.014, 0.066), (0.0, 0.0665)], segs=32, mat_index=1)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.z > 0.0345], dist=1e-5)
    return mesh_object("Button_Next", bm, ["bakelite", "dome_next"], parent=parent, matrix=local)


def neon(name, frame, on=False, parent=None):
    """A small neon lamp: a pea of glass in a black grommet."""
    add_lathe("black", [(0.0085, 0.0), (0.0085, 0.003), (0.0065, 0.004)], frame, segs=8)
    bm = bmesh.new()
    lathe(bm, [(0.0, 0.002), (0.0055, 0.003), (0.0060, 0.0065), (0.0045, 0.0095), (0.0, 0.0105)], segs=8)
    if name:
        return mesh_object(name, bm, ["neon"], parent=parent, matrix=frame)
    # Dressing: joined into the scenery.
    tgt = bucket("neon_on" if on else "neon")
    bmesh.ops.transform(bm, matrix=frame, verts=bm.verts[:])
    merge(tgt, bm, "neon", "across")


def toggle(frame):
    """A bat-handled toggle switch on a hex nut, as dressing."""
    add_lathe("steel", [(0.0075, 0.0), (0.0075, 0.004), (0.0045, 0.004), (0.0045, 0.008), (0.0025, 0.009)], frame, segs=8)
    bm = bucket("steel")
    tmp = bmesh.new()
    lathe(tmp, [(0.0018, 0.0), (0.0024, 0.020), (0.0, 0.0215)], segs=6)
    bmesh.ops.transform(tmp, matrix=frame @ Matrix.Translation(Vector((0, 0, 0.008))) @ Matrix.Rotation(0.45, 4, "X"), verts=tmp.verts[:])
    merge(bm, tmp, "steel", None)


# ---------------------------------------------------------------- the machine


def panel_frame():
    """The back panel's frame: x across, y up its face, z out of it toward the player. Its origin is the
    panel face's foot at the middle."""
    foot_pt = desk_point(0, 0, DESK_FAR)
    return Matrix.Translation(B(0.0, foot_pt[1], PANEL_Z)) @ rot_x(math.pi / 2 - PANEL_LEAN)


def panel_point(x, y, out=0.0):
    """A point on the back panel: `y` metres up its face from its foot, `out` toward the player."""
    return panel_frame() @ Vector((x, y, out))


def panel_at(x, gy, out=0.0):
    """The panel frame moved to the point at game height `gy`, for parts set into the face."""
    pf = panel_frame()
    foot_y = G(pf @ Vector((0, 0, 0)))[1]
    up = (gy - foot_y) / math.cos(PANEL_LEAN)
    return pf @ Matrix.Translation(Vector((x, up, out)))


def side_profile():
    """The side panels' outline as (z, y) points, clockwise from the back of the top."""
    lip = desk_point(0, 0.0, DESK_NEAR + 0.012)
    lip_lo = desk_point(0, -0.050, DESK_NEAR + 0.012)
    far = desk_point(0, 0.0, DESK_FAR)
    top_front = G(panel_point(0, (PANEL_TOP - far[1]) / math.cos(PANEL_LEAN)))
    return [(BACK_Z, PANEL_TOP), (top_front[2] + 0.02, PANEL_TOP), (far[2] + 0.02, far[1] + 0.010),
            (lip[2] + 0.012, lip[1] + 0.010), (lip_lo[2] + 0.012, lip_lo[1] - 0.012), (LOWER_Z + 0.02, 0.70),
            (LOWER_Z + 0.02, 0.0), (BACK_Z, 0.0)]


def body():
    w = 2 * HALF
    far = desk_point(0, 0.0, DESK_FAR)
    lip = desk_point(0, 0.0, DESK_NEAR)
    # The lower body, and the desk's wedge under its sloped top.
    add_box("wood", (w, 0.72, LOWER_Z - BACK_Z), (0, 0.36, (LOWER_Z + BACK_Z) / 2), grain="up", bevel=0.004)
    nose = desk_point(0, -0.045, DESK_NEAR)
    add_prism("wood", [(far[2], far[1]), (lip[2], lip[1]), (nose[2], nose[1]), (LOWER_Z, 0.70), (BACK_Z, 0.70), (BACK_Z, far[1])],
              -HALF, HALF, grain="across")
    # The back panel: a slab leaning back, grey enamel on its face.
    pf = panel_frame()
    length = (PANEL_TOP - far[1]) / math.cos(PANEL_LEAN)
    add_box("enamel", (w, 0.02, length), (0, -0.010, -length / 2), frame=pf, grain="across")
    add_prism("wood", [(BACK_Z + 0.001, PANEL_TOP - 0.001), (G(pf @ Vector((0, length, -0.02)))[2], PANEL_TOP - 0.001),
                       (G(pf @ Vector((0, 0, -0.02)))[2], far[1]), (BACK_Z + 0.001, far[1])], -HALF, HALF, grain="up")
    # Side panels with steel edging and a hairline of warm light.
    front = side_profile()
    for side in (-1, 1):
        x = side * (HALF + PANEL_T / 2)
        add_prism("wood", front, x - PANEL_T / 2, x + PANEL_T / 2, grain="up")
        edge = front[1:7]
        for a, b in zip(edge, edge[1:]):
            add_strip("steel", a, b, PANEL_T + 0.006, 0.010, x)
            length_ab = math.hypot(b[0] - a[0], b[1] - a[1])
            if b[1] > 0.6 and length_ab > 0.15:
                nz, ny = -(b[1] - a[1]) / length_ab * 0.0055, (b[0] - a[0]) / length_ab * 0.0055
                add_strip("glow", (a[0] + nz, a[1] + ny), (b[0] + nz, b[1] + ny), 0.005, 0.003, x - side * 0.014)
    # A steel cap over the top and a kick plate.
    add_box("steel", (w + 2 * PANEL_T + 0.012, 0.012, front[1][0] - BACK_Z + 0.012), (0, PANEL_TOP + 0.006, (front[1][0] + BACK_Z) / 2), bevel=0.003)
    add_box("steel", (w, 0.080, 0.006), (0, 0.040, LOWER_Z + 0.003), bevel=0.002)
    # The desk's top: walnut, with a steel lip along its near edge and a hairline inside it.
    add_box("wood", (w, 0.008, DESK_NEAR - DESK_FAR), (0, -0.004, (DESK_NEAR + DESK_FAR) / 2), frame=DESK, grain="across")
    add_box("steel", (w, 0.060, 0.016), (0, -0.026, DESK_NEAR + 0.008), frame=DESK, bevel=0.003)
    add_box("glow", (w - 0.05, 0.003, 0.004), (0, 0.0015, DESK_NEAR - 0.006), frame=DESK)
    add_box("steel", (w, 0.014, 0.012), (0, 0.004, DESK_FAR + 0.006), frame=DESK, bevel=0.003)


def board(root_board):
    span = 8 * PITCH
    bf = DESK @ Matrix.Translation(Vector((0, -BOARD_Z, 0)))
    # A walnut surround in a steel bevel, raised off the desk.
    add_box("wood", (span + 2 * FRAME, BOARD_RISE, span + 2 * FRAME), (0, BOARD_RISE / 2, BOARD_Z), frame=DESK, grain="across", bevel=0.003)
    add_bevel_frame("steel", span + 2 * FRAME - 0.012, span + 2 * FRAME - 0.012, -0.002, BOARD_RISE + 0.004, 0.006, 0.003, BOARD_RISE,
                    bf @ rot_x(math.pi / 2).inverted() @ Matrix.Rotation(math.pi / 2, 4, "X"))
    for i in range(64):
        x, z = square_local(i)
        dark = (i % 8 + i // 8) % 2 == 0
        add_box("darksq" if dark else "maple", (PITCH, 0.002, PITCH), (x, BOARD_RISE + 0.001, BOARD_Z + z), frame=DESK,
                grain="up" if dark else "across")
    # The file letters along the near edge and rank numbers down the left, engraved on steel strips.
    near = BOARD_Z + span / 2 + FRAME / 2
    desk_plate("files", span, FRAME * 0.62, 0.0, near, BOARD_RISE + 0.0012)
    add_box("glow", (span + 2 * FRAME + 0.010, 0.002, 0.004), (0, 0.001, BOARD_Z + span / 2 + FRAME + 0.010), frame=DESK)
    for i in range(64):
        square_ring(f"Lamp_Sq_{i}", root_board, i)


def rail(root_desk):
    """The result lamps and the next button, on the desk behind the board."""
    names = [("Lamp_White", "jewel_white", "white"), ("Lamp_Think", "jewel_amber", "think"), ("Lamp_Mate", "jewel_green", "mate"),
             ("Lamp_Refuted", "jewel_red", "refuted")]
    for (name, mat, label), x in zip(names, RAIL_X):
        local = Matrix.Translation(Vector((x, -RAIL_Z, 0.003)))
        jewel(name, mat, DESK @ local, LAMP_R, parent=root_desk, local=local)
        desk_plate(label, 0.110, 0.0285, x, RAIL_Z - 0.050, 0.0035)
    local = Matrix.Translation(Vector((NEXT_X, -RAIL_Z, 0.003)))
    next_button(DESK @ local, root_desk, local)
    desk_plate("next", 0.110, 0.0285, NEXT_X, RAIL_Z - 0.062, 0.0035)
    # The lamps stand on a brushed steel band across the desk, with a hairline of light along its front.
    add_box("steel", (2 * HALF - 0.12, 0.003, 0.125), (0, 0.0015, RAIL_Z - 0.008), frame=DESK, bevel=0.0015)
    add_box("glow", (2 * HALF - 0.14, 0.002, 0.003), (0, 0.001, RAIL_Z + 0.058), frame=DESK)


def tray(root_desk):
    """A recessed baize tray for taken pieces, right of the board."""
    cx, cz = TRAY_C
    hx, hz = TRAY_HALF
    add_box("felt", (2 * hx, 0.002, 2 * hz), (cx, 0.001, cz), frame=DESK, grain="across")
    for s in (-1, 1):
        add_box("steel", (2 * hx + 0.024, 0.014, 0.012), (cx, 0.007, cz + s * (hz + 0.006)), frame=DESK, bevel=0.003)
        add_box("steel", (0.012, 0.014, 2 * hz), (cx + s * (hx + 0.006), 0.007, cz), frame=DESK, bevel=0.003)
    return empty("Prinz_Tray", Matrix.Translation(Vector((cx, -cz, 0.002))), parent=root_desk)


def switch_bank():
    """Dressing on the desk left of the board: rows of toggles, as on the Mark 1's console."""
    for row in range(3):
        for col in range(4):
            x = -0.62 + col * 0.075
            z = -0.06 + row * 0.10
            toggle(DESK @ Matrix.Translation(Vector((x, -z, 0.0))))
    add_box("bakelite", (0.30, 0.003, 0.36), (-0.507, 0.0015, 0.03), frame=DESK)


def back_panel():
    w = 2 * HALF
    mx, my = MONITOR_C
    # The monitor: a round tube face in a square steel bezel, set into a black surround.
    mf = panel_at(mx, my, 0.0)
    tw, th = 0.22, 0.17
    add_bevel_frame("steel", tw, th, -0.004, 0.022, 0.026, 0.008, 0.004, mf)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    # A gently domed face, a grid of quads, UVs 0 to 1.
    n = 12
    grid = [[bm.verts.new((tw * (i / n - 0.5), th * (j / n - 0.5), 0.004 + 0.010 * (1 - (2 * i / n - 1) ** 2) * (1 - (2 * j / n - 1) ** 2)))
             for j in range(n + 1)] for i in range(n + 1)]
    for i in range(n):
        for j in range(n):
            f = bm.faces.new([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]])
            f.smooth = True
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv].uv = (a / n, b / n)
    mesh_object("Monitor_Tube", bm, ["tube"], matrix=mf)
    # The problem row: fourteen neons under the monitor, with a plate to their left.
    py = 1.315
    for i in range(PROBLEMS):
        x = (i - (PROBLEMS - 1) / 2) * 0.036
        neon(f"Lamp_Problem_{i}", panel_at(x, py, 0.0))
    pp = panel_at(0, py - 0.040, 0.0005)
    add_quad("parts", [pp @ Vector((-0.07, -0.0125, 0)), pp @ Vector((0.07, -0.0125, 0)), pp @ Vector((0.07, 0.0125, 0)), pp @ Vector((-0.07, 0.0125, 0))], "problem")
    add_bevel_frame("steel", 14 * 0.036 + 0.01, 0.030, -0.002, 0.006, 0.006, 0.002, 0.001, panel_at(0, py, 0.0))
    # The running lamps over the monitor.
    for i in range(8):
        neon(f"Lamp_Run_{i}", panel_at((i - 3.5) * 0.034, my + th / 2 + 0.055, 0.0))
    # Banks either side: neons on the left, toggles on the right, each in a framed plate.
    lit = {1, 4, 9, 14, 18, 22, 27}
    for side in (-1, 1):
        cx = side * 0.43
        add_bevel_frame("steel", 0.40, 0.30, -0.002, 0.008, 0.008, 0.003, 0.001, panel_at(cx, my, 0.0))
        add_box("bakelite", (0.40, 0.003, 0.30), (cx, 0.0015, 0.0), frame=panel_at(0, my, 0.0))
        for row in range(4):
            for col in range(8):
                x = cx + (col - 3.5) * 0.045
                y = my + (1.5 - row) * 0.065
                if side < 0:
                    neon(None, panel_at(x, y, 0.003), on=(row * 8 + col) in lit)
                elif row < 3 and col % 4 != 3:
                    toggle(panel_at(cx + (col - 3.5) * 0.045, my + (1.0 - row) * 0.085, 0.003))
    # The name plate along the top.
    np_ = panel_at(0, PANEL_TOP - 0.065, 0.001)
    add_quad("parts", [np_ @ Vector((-0.40, -0.047, 0)), np_ @ Vector((0.40, -0.047, 0)), np_ @ Vector((0.40, 0.047, 0)), np_ @ Vector((-0.40, 0.047, 0))], "name")
    add_bevel_frame("steel", 0.80, 0.094, -0.002, 0.008, 0.008, 0.003, 0.001, panel_at(0, PANEL_TOP - 0.065, 0.0))
    # A hairline of light along the panel's foot, where it meets the desk.
    add_box("glow", (w - 0.04, 0.004, 0.004), (0, 0.002, -0.010), frame=panel_frame())


def machine():
    body()
    root_desk = empty("Prinz_Desk", DESK)
    root_board = empty("Prinz_Board", Matrix.Translation(Vector((0, -BOARD_Z, BOARD_RISE + 0.002))), parent=root_desk)
    board(root_board)
    rail(root_desk)
    tray(root_desk)
    switch_bank()
    back_panel()
    pieces(None)


# ---------------------------------------------------------------- checks


def bounds(obj):
    pts = [G(obj.matrix_world @ Vector(c)) for c in obj.bound_box]
    return tuple(min(p[i] for p in pts) for i in range(3)), tuple(max(p[i] for p in pts) for i in range(3))


def view_pixels(points, eye, aim, size):
    eye, aim = Vector(eye), Vector(aim)
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
    views = (("seat", SEAT_EYE, (1280, 720)), ("phone", phone_eye(), PHONE))
    print(f"phone eye {fmt(phone_eye())}")
    print(f"{'node':<18} {'min (x, y, z)':<28} {'max (x, y, z)':<28} {'tris':>5}  seat 1280x720: x0 y0 x1 y1 w%   phone 390x844: x0 y0 x1 y1 w%")
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type != "MESH":
            continue
        lo, hi = bounds(obj)
        n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        tris += n
        if not obj.name.startswith("Piece_"):
            lo_all = [min(a, b) for a, b in zip(lo_all, lo)]
            hi_all = [max(a, b) for a, b in zip(hi_all, hi)]
        line = f"{obj.name:<18} {fmt(lo):<28} {fmt(hi):<28} {n:>5}"
        pts = [G(obj.matrix_world @ v.co) for v in obj.data.vertices]
        for _, eye, size in views:
            px = view_pixels(pts, eye, SEAT_AIM, size)
            xs, ys = [p[0] for p in px], [p[1] for p in px]
            line += f"  {min(xs):5.0f} {min(ys):5.0f} {max(xs):5.0f} {max(ys):5.0f} {(max(xs) - min(xs)) / size[0] * 100:4.1f}%"
        if obj.name.startswith("Lamp_Sq_") and obj.name not in ("Lamp_Sq_0", "Lamp_Sq_7", "Lamp_Sq_56", "Lamp_Sq_63", "Lamp_Sq_27"):
            continue
        if obj.name.startswith(("Lamp_Problem_", "Lamp_Run_")) and not obj.name.endswith(("_0", "_13", "_7")):
            continue
        print(line)
    print(f"{'ALL (no pieces)':<18} {fmt(lo_all):<28} {fmt(hi_all):<28} {tris:>5}")


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
    """The floor and the wall behind, so pictures show the machine standing somewhere."""
    for name, color, rough in (("pv_floor", (0.16, 0.16, 0.155), 0.25), ("pv_wall", (0.012, 0.022, 0.050), 0.5)):
        material(name, color=color, rough=rough)
    for mat, size, pos in (("pv_floor", (9, 0.1, 9), (0, -0.05, 2.0)), ("pv_wall", (9, 3.2, 0.1), (0, 1.6, -0.65)),
                           ("pv_wall", (9, 0.1, 9), (0, 3.25, 2.0))):
        bm = bmesh.new()
        verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.transform(bm, matrix=Matrix.Translation(B(*pos)) @ Matrix.Diagonal((size[0], size[2], size[1], 1.0)), verts=verts)
        mesh_object(mat, bm, [mat])


VIEWS = {"seat": (SEAT_EYE, SEAT_AIM, (1024, 576)), "hero": (HERO_EYE, HERO_AIM, (768, 1024)),
         "phone": (phone_eye(), SEAT_AIM, (390 * 2, 844 * 2))}

# Prinz's own problem, set out for pictures: 5Kbk/6pp/6P1/8/8/8/8/7R.
SHOW = {"f8": "W_K", "g8": "B_B", "h8": "B_K", "g7": "B_P", "h7": "B_P", "g6": "W_P", "h1": "W_R"}


def set_out():
    """Copies of the templates on the board, in Prinz's position. For pictures only, after export."""
    board = bpy.data.objects["Prinz_Board"]
    for name, which in SHOW.items():
        i = (int(name[1]) - 1) * 8 + ord(name[0]) - ord("a")
        x, z = square_local(i)
        src = bpy.data.objects[f"Piece_{which}"]
        obj = src.copy()
        bpy.context.collection.objects.link(obj)
        obj.parent = board
        obj.matrix_basis = Matrix.Translation(Vector((x, -z, 0)))
    for c in "WB":
        for k in "KQRBNP":
            bpy.data.objects[f"Piece_{c}_{k}"].hide_render = True


def flat(depth):
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
    """Line art and depth (near is white) from the seat and a three-quarter view, drawn where the depth
    jumps or the surface turns."""
    import numpy as np
    from PIL import Image

    os.makedirs(out, exist_ok=True)
    room_shell()
    set_out()
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
        far = 3.0 if name == "seat" else 5.0
        paths = {}
        for kind in ("depth", "normal"):
            layer.material_override = flat((0.4, far) if kind == "depth" else None)
            paths[kind] = scene.render.filepath = os.path.join(out, f"_prinz_{name}_{kind}.png")
            bpy.ops.render.render(write_still=True)
        d = np.asarray(Image.open(paths["depth"]).convert("RGB")).astype(np.float32)[:, :, 0] / 255.0
        n = np.asarray(Image.open(paths["normal"]).convert("RGB")).astype(np.float32) / 255.0
        line = np.zeros(d.shape, bool)
        for axis in (0, 1):
            dd = np.abs(np.diff(d, axis=axis, append=d.take([-1], axis=axis)))
            dn = np.abs(np.diff(n, axis=axis, append=n.take([-1], axis=axis))).sum(axis=2)
            line |= (dd > 0.010) | (dn > 0.30)
        ink = Image.fromarray(np.where(line, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)
        ink.save(os.path.join(out, f"prinz_{name}_lines.png"), optimize=True)
        Image.fromarray((d * 255).astype(np.uint8)).resize(size, Image.LANCZOS).save(os.path.join(out, f"prinz_{name}_depth.png"), optimize=True)
        for p in paths.values():
            os.remove(p)
        print("wrote", name, "lines and depth")
    layer.material_override = None


def preview(path, view):
    """A look at the machine, lit roughly as the room is. Only for checking the model by eye."""
    scene = bpy.context.scene
    room_shell()
    set_out()
    material("ring_lit", color=(0, 0, 0), emit=(1.0, 0.62, 0.22), emit_strength=6.0)
    material("ring_sel", color=(0, 0, 0), emit=(1.0, 0.92, 0.75), emit_strength=9.0)
    material("white_lit", color=(0, 0, 0), emit=(1.0, 0.86, 0.62), emit_strength=5.0)
    # The rook on h1 picked up: its square selected, its moves lit.
    bpy.data.objects["Lamp_Sq_7"].data.materials[0] = MATS["ring_sel"]
    for i in (15, 23, 31, 39, 47) + tuple(range(0, 7)):
        if i != 5:
            bpy.data.objects[f"Lamp_Sq_{i}"].data.materials[0] = MATS["ring_lit"]
    bpy.data.objects["Lamp_White"].data.materials[0] = MATS["white_lit"]
    for i in (0, 1, 2):
        bpy.data.objects[f"Lamp_Problem_{i}"].data.materials[0] = MATS["neon_on"]
    eye, aim, size = VIEWS[view]
    camera(eye, aim)
    for at, energy, color, soft in (((0.8, 3.0, 2.4), 420, (1.0, 0.86, 0.70), 0.6), ((-2.0, 2.4, 2.2), 260, (1.0, 0.80, 0.62), 0.8),
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
    scene.render.resolution_x, scene.render.resolution_y = size if view != "phone" else (390, 844)
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

    path = os.path.join(OUT, "prinz.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_image_format="AUTO",
        export_tangents=False,
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
