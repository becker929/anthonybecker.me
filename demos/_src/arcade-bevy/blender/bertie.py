"""Builds the arcade's second machine, a homage to Bertie the Brain (1950), as assets/bertie.glb.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/bertie.py
    <bpy venv>/bin/python blender/bertie.py --preview /some/dir/bertie.png   (also renders a quick look)

It follows blender/build.py: everything is written in the game's coordinates (metres, Y up) and
converted on the way in. The machine stands at its own origin facing +Z, so the game can put it
anywhere. The helpers are copied from build.py so that file can change without breaking this one.

The real machine was about four metres tall. The room's ceiling is at 3.2 m, so this one is 3.0 m.
What it keeps (see the sources in src/bertie.rs): a tall upright board of nine squares with an X lamp
and an O lamp in each, a sign either side that says whose turn it is, each with a "Win" lamp, and a
raised panel in front with nine lit keys in a three by three grid.

The game finds these objects by name (src/bertie_machine.rs):

    Lamp_X_0..8, Lamp_O_0..8   the board's lamps; cell 0 is top left as the player sees it, row by row
    Key_0..8                   the keypad's caps, numbered the same way
    Sign_Player, Sign_Machine  whose turn it is; Sign_Win, Sign_Lose, Sign_Draw   how it ended
    Dial_Difficulty            a knob with five notches
    Button_Reset               starts a new game
    Marquee_Bertie             the name board; the game paints its lettering

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
TEX = 1024

# ---------------------------------------------------------------- coordinates


def B(x, y, z):
    """Game coordinates to Blender's (Z up, the machine facing -Y)."""
    return Vector((x, -z, y))


def G(v):
    """Blender coordinates back to the game's."""
    return (v.x, v.z, -v.y)


def rot_x(a):
    return Matrix.Rotation(a, 4, "X")


# ---------------------------------------------------------------- textures


def bake(name, build_nodes):
    """Bakes a procedural colour to an image by rendering its emission on a unit plane."""
    img = bpy.data.images.new(name, TEX, TEX)
    mat = bpy.data.materials.new("bake_" + name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs[0], out.inputs[0])
    nt.links.new(build_nodes(nt), emit.inputs["Color"])
    target = nt.nodes.new("ShaderNodeTexImage")
    target.image = img
    nt.nodes.active = target

    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.active_object
    plane.data.materials.append(mat)
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 1
    bpy.context.scene.cycles.device = "CPU"
    bpy.ops.object.bake(type="EMIT")
    path = os.path.join(OUT, "_bertie_" + name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.objects.remove(plane)
    bpy.data.materials.remove(mat)
    return img, path


def wood_nodes(nt):
    """The same dark walnut as the first cabinet (build.py), so the two stand together."""
    n, l = nt.nodes, nt.links
    coord = n.new("ShaderNodeTexCoord")
    stretch = n.new("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (4.0, 0.35, 1.0)
    l.new(coord.outputs["UV"], stretch.inputs["Vector"])
    wobble = n.new("ShaderNodeTexNoise")
    wobble.inputs["Scale"].default_value = 2.2
    wobble.inputs["Detail"].default_value = 3.0
    l.new(stretch.outputs[0], wobble.inputs["Vector"])
    wave = n.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 0.9
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 2.5
    wave.inputs["Detail Scale"].default_value = 1.4
    l.new(stretch.outputs[0], wave.inputs["Vector"])
    streak_map = n.new("ShaderNodeMapping")
    streak_map.inputs["Scale"].default_value = (55.0, 1.5, 1.0)
    l.new(coord.outputs["UV"], streak_map.inputs["Vector"])
    streak = n.new("ShaderNodeTexNoise")
    streak.inputs["Scale"].default_value = 1.0
    streak.inputs["Detail"].default_value = 2.0
    l.new(streak_map.outputs[0], streak.inputs["Vector"])
    mix = n.new("ShaderNodeMath")
    mix.operation = "ADD"
    scale_a = n.new("ShaderNodeMath")
    scale_a.operation = "MULTIPLY"
    scale_a.inputs[1].default_value = 0.55
    l.new(wave.outputs["Fac"], scale_a.inputs[0])
    scale_b = n.new("ShaderNodeMath")
    scale_b.operation = "MULTIPLY"
    scale_b.inputs[1].default_value = 0.22
    l.new(streak.outputs["Fac"], scale_b.inputs[0])
    l.new(scale_a.outputs[0], mix.inputs[0])
    l.new(scale_b.outputs[0], mix.inputs[1])
    cloud = n.new("ShaderNodeMath")
    cloud.operation = "MULTIPLY_ADD"
    cloud.inputs[1].default_value = 0.45
    l.new(wobble.outputs["Fac"], cloud.inputs[0])
    l.new(mix.outputs[0], cloud.inputs[2])
    ramp = n.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.15, (0.012, 0.0055, 0.0035, 1)
    e[1].position, e[1].color = 1.05, (0.056, 0.026, 0.014, 1)
    mid = e.new(0.6)
    mid.color = (0.028, 0.013, 0.0075, 1)
    l.new(cloud.outputs[0], ramp.inputs[0])
    return ramp.outputs["Color"]


# ---------------------------------------------------------------- materials

MATS = {}


def material(name, color=(1, 1, 1), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, image=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if image:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.extension = "MIRROR"  # hides the seam where the bake repeats
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    MATS[name] = mat
    return mat


# ---------------------------------------------------------------- geometry

# Scenery gathers here, one bmesh per material, and becomes one object each at the end.
BUCKETS = {}
# These are shaded smooth, so their few corners are shared and the file stays small.
SMOOTH = {"bulb", "bulb_on"}
GROUP = "Bertie"


def bucket(mat):
    if mat not in BUCKETS:
        bm = bmesh.new()
        # Only the wood has a picture, so only it needs UVs.
        if mat == "wood":
            bm.loops.layers.uv.new("UVMap")
        BUCKETS[mat] = bm
    return BUCKETS[mat]


def box_uv(bm, faces, scale=1.0):
    """Projects each face along its main axis, in metres. The V axis is up, so wood grain stands."""
    uv = bm.loops.layers.uv.verify()
    for f in faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            p = loop.vert.co
            if az >= ax and az >= ay:
                u, v = p.y, p.x
            elif ax >= ay:
                u, v = p.y, p.z
            else:
                u, v = p.z, p.x
            loop[uv].uv = (u * scale, v * scale)


def add_box(mat, size, pos, tilt=0.0, pivot=None):
    """A box of `size` centred on `pos` (game coordinates). `tilt` rotates it about the game's
    X axis around `pivot` (default: its own centre)."""
    bm = bucket(mat)
    sx, sy, sz = size
    made = bmesh.ops.create_cube(bm, size=1.0)
    verts = made["verts"]
    centre = B(*pos)
    piv = B(*pivot) if pivot else centre
    m = Matrix.Translation(piv) @ rot_x(tilt) @ Matrix.Translation(centre - piv) @ Matrix.Diagonal((sx, sz, sy, 1.0))
    bmesh.ops.transform(bm, matrix=m, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    bm.normal_update()
    if mat == "wood":
        box_uv(bm, faces)


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


def add_ball(mat, r, pos):
    bm = bucket(mat)
    made = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    bmesh.ops.translate(bm, verts=made["verts"], vec=B(*pos))


def finish_buckets():
    for mat, bm in BUCKETS.items():
        mesh = bpy.data.meshes.new(f"{GROUP}_{mat}")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(f"{GROUP}_{mat}", mesh)
        bpy.context.collection.objects.link(obj)
        for poly in mesh.polygons:
            poly.use_smooth = mat in SMOOTH


def mesh_object(name, bm, mats, parent=None, location=(0, 0, 0), smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for m in mats:
        mesh.materials.append(MATS[m])
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = smooth
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
    return mesh_object(name, bm, [mat], location=B(*pos), smooth=False)


def control(name, parent, at, collar_r, collar_h, dome_r, dome_mat, pip):
    """A domed control on a steel collar, as on the first cabinet. Its origin is on the deck; it
    turns about its own up axis."""
    bm = bmesh.new()
    made = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=collar_r, radius2=collar_r * 0.94, depth=collar_h)
    bmesh.ops.translate(bm, verts=made["verts"], vec=(0, 0, collar_h / 2))
    before = set(bm.faces)
    ball = bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=dome_r)
    low = [v for v in ball["verts"] if v.co.z < -1e-6]
    bmesh.ops.delete(bm, geom=low, context="VERTS")
    dome_verts = [v for v in bm.verts if any(f not in before for f in v.link_faces)]
    bmesh.ops.scale(bm, verts=dome_verts, vec=(1, 1, 0.62))
    bmesh.ops.translate(bm, verts=dome_verts, vec=(0, 0, collar_h * 0.9))
    for f in bm.faces:
        if f not in before:
            f.material_index = 1
    if pip:
        # A steel tab with a lit line shows where the dial points. At rest it points up the deck.
        made = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=made["verts"], vec=(0.016, 0.052, 0.012))
        bmesh.ops.translate(bm, verts=made["verts"], vec=(0, collar_r + 0.020, 0.006))
        before = set(bm.faces)
        made = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=made["verts"], vec=(0.006, 0.046, 0.002))
        bmesh.ops.translate(bm, verts=made["verts"], vec=(0, collar_r + 0.020, 0.013))
        for f in bm.faces:
            if f not in before:
                f.material_index = 2
    bm.normal_update()
    obj = mesh_object(name, bm, ["steel", dome_mat, "pip"], parent=parent)
    # `at` is in the deck's own frame: x across, y out of the deck, z down the deck toward the player.
    obj.location = (at[0], -at[2], at[1])
    return obj


# ---------------------------------------------------------------- the machine

# Fixed points the game also relies on (src/bertie_machine.rs). BERTIE.md lists them.
HEIGHT = 2.98
BODY_HALF = 0.75      # half the width between the side panels
PANEL_T = 0.05
FACE_Z = 0.10         # the front of the tower, which carries the board
BOARD_C = (0.0, 2.08)
CELL, CELL_GAP = 0.28, 0.02
# The deck matches the first cabinet's, so the keys come to hand at the same height and reach.
DECK_C = (0.0, 1.00, 0.40)
DECK_TILT = 0.30
DECK_T, DECK_D = 0.05, 0.44
KEY_PITCH, KEY_SIZE, KEY_H = 0.095, 0.078, 0.020
KEY_PLATE_T = 0.006
DIAL_X, RESET_X = 0.47, -0.47
# The dial's five notches, in radians clockwise from straight up the deck. The game uses the same.
DIAL_STEP = 0.6
LEVELS = 5


def cell_centre(i):
    """Cell 0 is top left as the player sees it."""
    row, col = divmod(i, 3)
    pitch = CELL + CELL_GAP
    return (BOARD_C[0] + (col - 1) * pitch, BOARD_C[1] + (1 - row) * pitch)


def side_profile():
    """The outline of a side panel as (z, y) points, front edge first, top to bottom. Below the
    deck it is the first cabinet's outline; above, it runs straight up to the top."""
    return [(0.20, HEIGHT), (0.20, 1.34), (0.66, 1.07), (0.66, 0.90), (0.36, 0.76), (0.36, 0.0)]


def side_panels():
    front = side_profile()
    outline = front + [(-0.42, 0.0), (-0.42, HEIGHT)]
    for side in (-1, 1):
        x = side * (BODY_HALF + PANEL_T / 2)
        bm = bucket("wood")
        verts_a = [bm.verts.new(B(x - PANEL_T / 2, y, z)) for z, y in outline]
        verts_b = [bm.verts.new(B(x + PANEL_T / 2, y, z)) for z, y in outline]
        faces = [bm.faces.new(verts_a), bm.faces.new(list(reversed(verts_b)))]
        n = len(outline)
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new([verts_a[j], verts_a[i], verts_b[i], verts_b[j]]))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        bm.normal_update()
        box_uv(bm, faces)
        # Steel edging down the front, with a line of warm light set into it.
        for a, b in zip(front, front[1:]):
            add_strip("steel", a, b, PANEL_T + 0.006, 0.014, x)
            if a[1] > 0.95:
                add_strip("glow", (a[0] + 0.004, a[1]), (b[0] + 0.004, b[1]), 0.003, 0.010, x - side * 0.020)


def x_lamp(name, at):
    """Two crossed tubes."""
    bm = bmesh.new()
    for turn in (-1, 1):
        made = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.014, radius2=0.014, depth=0.25)
        bmesh.ops.rotate(bm, verts=made["verts"], matrix=Matrix.Rotation(turn * math.pi / 4, 3, "Y"))
    bm.normal_update()
    return mesh_object(name, bm, ["lamp"], location=B(*at))


def o_lamp(name, at):
    """A ring of tube, standing a little in front of the X so the two never touch."""
    bm = bmesh.new()
    big, small, nu, nv = 0.088, 0.014, 28, 6
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
            bm.faces.new([a[j], a[(j + 1) % nv], b[(j + 1) % nv], b[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    return mesh_object(name, bm, ["lamp"], location=B(*at))


def key_cap(name, parent, at):
    """A square lit key. Its origin is on the plate; pressing sinks it along its own up axis."""
    bm = bmesh.new()
    made = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=made["verts"], vec=(KEY_SIZE, KEY_SIZE, KEY_H))
    bmesh.ops.translate(bm, verts=made["verts"], vec=(0, 0, KEY_H / 2))
    # Draw the top in a little, so the cap has a shoulder to catch the light.
    for v in made["verts"]:
        if v.co.z > KEY_H / 2:
            v.co.x *= 0.90
            v.co.y *= 0.90
    bm.normal_update()
    obj = mesh_object(name, bm, ["key"], parent=parent, smooth=False)
    obj.location = (at[0], -at[2], at[1])
    return obj


def on_deck(x, y, z):
    """A point in the deck's frame (x across, y out of the deck, z down it) before the deck's tilt.
    Pass it to add_box with tilt=DECK_TILT and pivot=DECK_C."""
    return (DECK_C[0] + x, DECK_C[1] + y, DECK_C[2] + z)


def machine():
    wood, steel, black, glow = "wood", "steel", "black", "glow"
    w = 2 * BODY_HALF
    # Lower body, the tower that carries the board, and the apron under the deck.
    add_box(wood, (w, 0.98, 0.70), (0, 0.49, -0.03))
    add_box(wood, (w, HEIGHT - 0.96 - 0.01, 0.50), (0, (HEIGHT - 0.01 + 0.96) / 2, FACE_Z - 0.25))
    add_box(wood, (w, 0.20, 0.30), (0, 0.86, 0.33))
    side_panels()
    # A steel cap over the whole top.
    add_box(steel, (w + 2 * PANEL_T + 0.012, 0.012, 0.64), (0, HEIGHT + 0.006, -0.105))

    # The board: a black field in a steel frame, parted into nine squares.
    bx, by = BOARD_C
    span = 3 * CELL + 2 * CELL_GAP
    add_box(black, (span, span, 0.004), (bx, by, FACE_Z + 0.002))
    add_frame(steel, bx, by, span, span, FACE_Z + 0.055, 0.035, 0.055)
    for s in (-1, 1):
        off = s * (CELL + CELL_GAP) / 2
        add_box(steel, (CELL_GAP, span, 0.016), (bx + off, by, FACE_Z + 0.008))
        add_box(steel, (span, CELL_GAP, 0.016), (bx, by + off, FACE_Z + 0.008))
    # A thin line of light round the frame's face.
    add_frame(glow, bx, by, span + 0.030, span + 0.030, FACE_Z + 0.057, 0.004, 0.004)
    for i in range(9):
        cx, cy = cell_centre(i)
        x_lamp(f"Lamp_X_{i}", (cx, cy, FACE_Z + 0.018))
        o_lamp(f"Lamp_O_{i}", (cx, cy, FACE_Z + 0.036))

    # The name board across the top.
    add_box(black, (w, 0.28, 0.05), (0, 2.80, FACE_Z + 0.025))
    add_box(steel, (w, 0.012, 0.058), (0, 2.80 + 0.134, FACE_Z + 0.029))
    add_box(steel, (w, 0.012, 0.058), (0, 2.80 - 0.134, FACE_Z + 0.029))
    quad_object("Marquee_Bertie", "sign", 1.42, 0.24, (0, 2.80, FACE_Z + 0.0515))

    # The signs either side of the board. The machine's are on the left, the player's on the right,
    # each with its "Win" lamp beneath. The draw lamp sits under the board between them.
    sz = FACE_Z + 0.020
    for name, cx, cy, sw, sh in (
        ("Sign_Machine", -0.625, 2.30, 0.20, 0.30),
        ("Sign_Lose", -0.625, 1.94, 0.20, 0.14),
        ("Sign_Player", 0.625, 2.30, 0.20, 0.30),
        ("Sign_Win", 0.625, 1.94, 0.20, 0.14),
        ("Sign_Draw", 0.0, 1.50, 0.40, 0.10),
    ):
        add_box(black, (sw + 0.02, sh + 0.02, 0.018), (cx, cy, FACE_Z + 0.009))
        add_frame(steel, cx, cy, sw, sh, sz + 0.008, 0.010, 0.028)
        quad_object(name, "sign", sw, sh, (cx, cy, sz))

    # The brain: a black band of small bulbs under the board. A few are lit.
    add_box(black, (1.30, 0.20, 0.004), (0, 1.29, FACE_Z + 0.002))
    add_frame(steel, 0, 1.29, 1.30, 0.20, FACE_Z + 0.012, 0.010, 0.012)
    lit = {3, 8, 17, 22, 30, 37, 41, 52}
    for row in range(3):
        for col in range(19):
            n = row * 19 + col
            add_ball("bulb_on" if n in lit else "bulb", 0.013, (-0.585 + col * 0.065, 1.35 - row * 0.06, FACE_Z + 0.008))

    # The deck: a wooden slab tilted toward the player, edged in steel, as on the first cabinet.
    add_box(wood, (w, DECK_T, DECK_D), DECK_C, tilt=DECK_TILT)
    add_box(steel, (w, DECK_T + 0.008, 0.022), on_deck(0, 0, DECK_D / 2 + 0.011), tilt=DECK_TILT, pivot=DECK_C)
    add_box(steel, (w, 0.006, DECK_D), on_deck(0, -DECK_T / 2 - 0.003, 0), tilt=DECK_TILT, pivot=DECK_C)
    top = DECK_T / 2
    for s in (-1, 1):
        add_box(glow, (0.003, 0.004, DECK_D - 0.02), on_deck(s * (w / 2 - 0.012), top + 0.001, 0), tilt=DECK_TILT, pivot=DECK_C)
    # The keypad's steel plate, with a line of light round it.
    plate = 3 * KEY_PITCH + 0.03
    add_box(steel, (plate, KEY_PLATE_T, plate), on_deck(0, top + KEY_PLATE_T / 2, 0), tilt=DECK_TILT, pivot=DECK_C)
    for s in (-1, 1):
        add_box(glow, (plate + 0.016, 0.003, 0.004), on_deck(0, top + 0.0015, s * (plate / 2 + 0.006)), tilt=DECK_TILT, pivot=DECK_C)
        add_box(glow, (0.004, 0.003, plate + 0.016), on_deck(s * (plate / 2 + 0.006), top + 0.0015, 0), tilt=DECK_TILT, pivot=DECK_C)
    # Five lit ticks round the dial, one for each notch. The gentlest is on the left.
    for level in range(LEVELS):
        a = (level - (LEVELS - 1) / 2) * DIAL_STEP
        add_box("pip", (0.010, 0.003, 0.010), on_deck(DIAL_X + 0.118 * math.sin(a), top + 0.0015, -0.118 * math.cos(a)), tilt=DECK_TILT, pivot=DECK_C)

    # Vents and a kick plate on the lower body.
    for i in range(7):
        add_box(steel, (0.90, 0.012, 0.010), (0, 0.22 + i * 0.06, 0.322))
    add_box(steel, (w, 0.09, 0.006), (0, 0.045, 0.323))

    # Controls hang off an empty that carries the deck's tilt, so they move along the deck's own up.
    deck = bpy.data.objects.new("Bertie_Deck", None)
    deck.location = B(*DECK_C)
    deck.rotation_euler = (DECK_TILT, 0, 0)
    bpy.context.collection.objects.link(deck)
    for i in range(9):
        row, col = divmod(i, 3)
        # Row 0 is the far row, which the player sees as the top.
        key_cap(f"Key_{i}", deck, ((col - 1) * KEY_PITCH, top + KEY_PLATE_T, (row - 1) * KEY_PITCH))
    control("Dial_Difficulty", deck, (DIAL_X, top, 0.0), 0.080, 0.055, 0.062, "dome", pip=True)
    control("Button_Reset", deck, (RESET_X, top, 0.0), 0.060, 0.040, 0.046, "dome_reset", pip=False)


# ---------------------------------------------------------------- checks


def bounds(obj):
    """An object's bounding box in game coordinates, as (min, max)."""
    pts = [G(obj.matrix_world @ Vector(c)) for c in obj.bound_box]
    return tuple(min(p[i] for p in pts) for i in range(3)), tuple(max(p[i] for p in pts) for i in range(3))


def report():
    bpy.context.view_layer.update()
    fmt = lambda p: "(" + ", ".join(f"{v:+.3f}" for v in p) + ")"
    lo_all, hi_all, tris = [1e9] * 3, [-1e9] * 3, 0
    print(f"{'node':<18} {'min (x, y, z)':<28} {'max (x, y, z)':<28} tris")
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type != "MESH":
            continue
        lo, hi = bounds(obj)
        n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        tris += n
        lo_all = [min(a, b) for a, b in zip(lo_all, lo)]
        hi_all = [max(a, b) for a, b in zip(hi_all, hi)]
        print(f"{obj.name:<18} {fmt(lo):<28} {fmt(hi):<28} {n}")
    print(f"{'ALL':<18} {fmt(lo_all):<28} {fmt(hi_all):<28} {tris}")


def preview(path):
    """A quick look, lit roughly as the room is. Only for checking the model by eye."""
    scene = bpy.context.scene
    # Light the lamps of a game in progress, so the board can be judged.
    for name, mat in (("Lamp_X_0", "lamp_x_lit"), ("Lamp_X_4", "lamp_x_lit"), ("Lamp_O_2", "lamp_o_lit"), ("Lamp_O_7", "lamp_o_lit")):
        bpy.data.objects[name].data.materials[0] = MATS[mat]
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.lens = 26
    cam.location = B(1.5, 1.6, 3.6)
    scene.collection.objects.link(cam)
    aim = B(0, 1.55, 0)
    cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for at, energy in (((1.2, 3.0, 2.6), 900), ((-2.0, 2.2, 2.0), 300)):
        lamp = bpy.data.objects.new("L", bpy.data.lights.new("L", "POINT"))
        lamp.data.energy = energy
        lamp.data.shadow_soft_size = 0.5
        lamp.location = B(*at)
        scene.collection.objects.link(lamp)
    scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.012, 0.02, 1)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.render.resolution_x, scene.render.resolution_y = 640, 800
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path)


# ---------------------------------------------------------------- build and export


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    wood, wood_path = bake("wood", wood_nodes)

    # These match build.py, so the two machines share one look.
    material("wood", rough=0.48, image=wood)
    material("steel", color=(0.30, 0.30, 0.29), rough=0.36, metal=0.3)
    material("black", color=(0.004, 0.004, 0.005), rough=0.9)
    material("glow", color=(0, 0, 0), emit=(1.0, 0.52, 0.18), emit_strength=3.2)
    material("pip", color=(0, 0, 0), emit=(1.0, 0.55, 0.20), emit_strength=7.0)
    material("dome", color=(0.80, 0.74, 0.62), rough=0.24, emit=(1.0, 0.90, 0.74), emit_strength=0.55)
    material("dome_reset", color=(0.86, 0.72, 0.60), rough=0.24, emit=(1.0, 0.50, 0.26), emit_strength=1.1)
    # The game swaps these three for lit and unlit ones of its own. Here they are the unlit look.
    material("lamp", color=(0.10, 0.09, 0.08), rough=0.22)
    material("key", color=(0.80, 0.74, 0.62), rough=0.24, emit=(1.0, 0.90, 0.74), emit_strength=0.15)
    material("sign", color=(0.0, 0.0, 0.0), rough=0.3)
    material("bulb", color=(0.55, 0.50, 0.42), rough=0.24, emit=(1.0, 0.90, 0.74), emit_strength=0.08)
    material("bulb_on", color=(0.80, 0.74, 0.62), rough=0.24, emit=(1.0, 0.62, 0.26), emit_strength=4.0)

    machine()
    finish_buckets()
    report()

    path = os.path.join(OUT, "bertie.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_image_format="JPEG",
        export_jpeg_quality=88,
        export_tangents=False,
        export_cameras=False,
        export_lights=False,
    )
    print("wrote", path, os.path.getsize(path), "bytes")

    if "--preview" in sys.argv:
        # After the export, so the preview's camera, lamps and lit materials never reach the file.
        material("lamp_x_lit", color=(0, 0, 0), emit=(1.0, 0.45, 0.14), emit_strength=6.0)
        material("lamp_o_lit", color=(0, 0, 0), emit=(1.0, 0.90, 0.74), emit_strength=6.0)
        preview(sys.argv[sys.argv.index("--preview") + 1])
    os.remove(wood_path)


if __name__ == "__main__":
    main()
