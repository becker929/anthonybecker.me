"""Builds the arcade's cabinet and room in Blender and exports them as assets/arcade.glb.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/build.py

Everything here is written in the game's coordinates (metres, Y up, the cabinet at the origin
facing +Z) and converted on the way in. The glTF exporter converts back, so a point given here
as (x, y, z) is at (x, y, z) in the game.

The game finds these objects by name (src/cabinet.rs): Screen, Marquee, Knob_Elevation,
Knob_Charge, Button_Fire. Everything else is scenery, joined into one mesh per material.
"""

import math
import os

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")
TEX = 1024

# ---------------------------------------------------------------- coordinates


def B(x, y, z):
    """Game coordinates to Blender's (Z up, the cabinet facing -Y)."""
    return Vector((x, -z, y))


# Rotation about the game's X axis is rotation about Blender's X axis; the sign is the same.
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
    path = os.path.join(OUT, "_" + name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.objects.remove(plane)
    bpy.data.materials.remove(mat)
    return img


def wood_nodes(nt):
    """Dark walnut: long wavering grain with fine streaks. The grain runs along V."""
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
    # Walnut, kept dark and close in tone: the grain should be seen, not counted.
    e[0].position, e[0].color = 0.15, (0.012, 0.0055, 0.0035, 1)
    e[1].position, e[1].color = 1.05, (0.056, 0.026, 0.014, 1)
    mid = e.new(0.6)
    mid.color = (0.028, 0.013, 0.0075, 1)
    l.new(cloud.outputs[0], ramp.inputs[0])
    return ramp.outputs["Color"]


def concrete_nodes(nt):
    """Polished concrete: broad cool-grey clouds with a little grit."""
    n, l = nt.nodes, nt.links
    coord = n.new("ShaderNodeTexCoord")
    big = n.new("ShaderNodeTexNoise")
    big.inputs["Scale"].default_value = 3.0
    big.inputs["Detail"].default_value = 6.0
    big.inputs["Roughness"].default_value = 0.6
    l.new(coord.outputs["UV"], big.inputs["Vector"])
    grit = n.new("ShaderNodeTexNoise")
    grit.inputs["Scale"].default_value = 90.0
    grit.inputs["Detail"].default_value = 2.0
    l.new(coord.outputs["UV"], grit.inputs["Vector"])
    add = n.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.18
    l.new(grit.outputs["Fac"], add.inputs[0])
    l.new(big.outputs["Fac"], add.inputs[2])
    ramp = n.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.25, (0.085, 0.087, 0.092, 1)
    e[1].position, e[1].color = 0.90, (0.200, 0.202, 0.210, 1)
    l.new(add.outputs[0], ramp.inputs[0])
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

# Scenery gathers here, one bmesh per (group, material), and becomes one object each at the end.
BUCKETS = {}


def bucket(group, mat):
    key = (group, mat)
    if key not in BUCKETS:
        bm = bmesh.new()
        bm.loops.layers.uv.new("UVMap")
        BUCKETS[key] = bm
    return BUCKETS[key]


def box_uv(bm, faces, scale=1.0):
    """Projects each face along its main axis, in metres. The V axis is up, so wood grain stands."""
    uv = bm.loops.layers.uv.verify()
    for f in faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            p = loop.vert.co
            if az >= ax and az >= ay:
                u, v = p.y, p.x  # a floor or a top: grain runs side to side
            elif ax >= ay:
                u, v = p.y, p.z  # a side: grain stands upright
            else:
                u, v = p.z, p.x  # a front or back: grain runs side to side
            loop[uv].uv = (u * scale, v * scale)


def add_box(group, mat, size, pos, tilt=0.0, pivot=None, uv_scale=1.0):
    """A box of `size` centred on `pos` (game coordinates). `tilt` rotates it about the game's
    X axis around `pivot` (default: its own centre)."""
    bm = bucket(group, mat)
    sx, sy, sz = size
    made = bmesh.ops.create_cube(bm, size=1.0)
    verts = made["verts"]
    centre = B(*pos)
    piv = B(*pivot) if pivot else centre
    m = Matrix.Translation(piv) @ rot_x(tilt) @ Matrix.Translation(centre - piv) @ Matrix.Diagonal((sx, sz, sy, 1.0))
    bmesh.ops.transform(bm, matrix=m, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    bm.normal_update()
    box_uv(bm, faces, uv_scale)


def add_strip(group, mat, a, b, width, thick, x):
    """A flat bar from `a` to `b`, both (z, y) points on a side panel's edge, `width` across x."""
    (z0, y0), (z1, y1) = a, b
    length = math.hypot(z1 - z0, y1 - y0)
    tilt = math.atan2(z1 - z0, y1 - y0)  # 0 when the bar stands upright
    mid = (x, (y0 + y1) / 2, (z0 + z1) / 2)
    add_box(group, mat, (width, length, thick), mid, tilt=tilt)


def finish_buckets():
    for (group, mat), bm in BUCKETS.items():
        mesh = bpy.data.meshes.new(f"{group}_{mat}")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(f"{group}_{mat}", mesh)
        bpy.context.collection.objects.link(obj)


def mesh_object(name, bm, mats, parent=None, location=(0, 0, 0)):
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
        poly.use_smooth = True
    return obj


# ---------------------------------------------------------------- the cabinet

# Fixed points the game also relies on (src/cabinet.rs, src/player.rs).
SCREEN_C = (0.0, 1.42, 0.09)
SCREEN_W, SCREEN_H = 0.69, 0.525
DECK_C = (0.0, 1.00, 0.40)
DECK_TILT = 0.30
BODY_HALF = 0.40      # half the width between the side panels
PANEL_T = 0.03


def screen():
    """The tube face: a rounded rectangle that bulges toward the player. UVs run 0..1."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    nx, ny, r, bulge = 28, 22, 0.07, 0.022
    hw, hh = SCREEN_W / 2, SCREEN_H / 2
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            x, y = (u * 2 - 1) * hw, (v * 2 - 1) * hh
            # Pull the corners in to round them.
            cx, cy = hw - r, hh - r
            dx, dy = abs(x) - cx, abs(y) - cy
            if dx > 0 and dy > 0:
                d = math.hypot(dx, dy)
                k = r / max(d, 1e-6) if d > r else 1.0
                # Squash the square corner onto the circle.
                m = max(dx, dy) / max(d, 1e-6)
                x = math.copysign(cx + dx * m, x)
                y = math.copysign(cy + dy * m, y)
                _ = k
            z = bulge * (1 - (x / hw) ** 2) * (1 - (y / hh) ** 2)
            row.append((bm.verts.new(B(x, y, z)), (u, v)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            quad = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            f = bm.faces.new([q[0] for q in quad])
            for loop, q in zip(f.loops, quad):
                # Image row 0 is the top of the tube.
                loop[uv].uv = (q[1][0], q[1][1])
    bm.normal_update()
    return mesh_object("Screen", bm, ["tube"], location=B(*SCREEN_C))


def quad_object(name, mat, w, h, pos):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    pts = [(-w / 2, -h / 2, 0, 0), (w / 2, -h / 2, 1, 0), (w / 2, h / 2, 1, 1), (-w / 2, h / 2, 0, 1)]
    verts = [bm.verts.new(B(x, y, 0)) for x, y, _, _ in pts]
    f = bm.faces.new(verts)
    for loop, p in zip(f.loops, pts):
        loop[uv].uv = (p[2], p[3])
    return mesh_object(name, bm, [mat], location=B(*pos))


def control(name, parent, at, collar_r, collar_h, dome_r, dome_mat, pip):
    """A domed control on a steel collar. Its origin is on the deck; it turns about its own up axis."""
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    # Collar: material slot 0.
    made = bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=collar_r, radius2=collar_r * 0.94, depth=collar_h)
    bmesh.ops.translate(bm, verts=made["verts"], vec=(0, 0, collar_h / 2))
    # Dome: slot 1. A squashed half sphere sitting in the collar.
    before = set(bm.faces)
    ball = bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=dome_r)
    low = [v for v in ball["verts"] if v.co.z < -1e-6]
    bmesh.ops.delete(bm, geom=low, context="VERTS")
    dome_verts = [v for v in bm.verts if any(f not in before for f in v.link_faces)]
    bmesh.ops.scale(bm, verts=dome_verts, vec=(1, 1, 0.62))
    bmesh.ops.translate(bm, verts=dome_verts, vec=(0, 0, collar_h * 0.9))
    for f in bm.faces:
        if f not in before:
            f.material_index = 1
    if pip:
        # A thick steel tab on the collar shows which way the knob points, with a lit line along it.
        # At rest it points up the deck.
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


def side_profile():
    """The outline of a side panel as (z, y) points, front edge first, top to bottom."""
    return [(0.30, 2.16), (0.30, 1.93), (0.66, 1.07), (0.66, 0.90), (0.36, 0.76), (0.36, 0.0)]


def side_panels():
    front = side_profile()
    outline = front + [(-0.42, 0.0), (-0.42, 2.16)]
    for side in (-1, 1):
        x = side * (BODY_HALF + PANEL_T / 2)
        bm = bucket("Cabinet", "wood")
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
            add_strip("Cabinet", "steel", a, b, PANEL_T + 0.006, 0.014, x)
            if a[1] > 0.95:
                add_strip("Cabinet", "glow", (a[0] + 0.004, a[1]), (b[0] + 0.004, b[1]), 0.003, 0.010, x - side * 0.013)
        # A steel cap along the top edge.
        add_box("Cabinet", "steel", (PANEL_T + 0.012, 0.010, 0.72), (x, 2.165, -0.06))


def cabinet():
    wood, steel, black = "wood", "steel", "black"
    g = "Cabinet"
    # Lower body and the box behind the tube.
    add_box(g, wood, (0.80, 0.98, 0.70), (0, 0.49, -0.03))
    add_box(g, wood, (0.80, 1.18, 0.44), (0, 1.57, -0.18))
    # The frame round the tube opening: two rails and two stiles, standing proud of the tube.
    fz, fd = 0.145, 0.21
    add_box(g, wood, (0.80, 0.23, fd), (0, 1.815, fz))
    add_box(g, wood, (0.80, 0.10, fd), (0, 1.09, fz))
    for s in (-1, 1):
        add_box(g, wood, (0.04, 0.56, fd), (s * 0.38, 1.42, fz))
    # Black hood lining the recess, and the panel the tube sits in.
    add_box(g, black, (0.72, 0.56, 0.004), (0, 1.42, 0.084))
    for s in (-1, 1):
        add_box(g, black, (0.012, 0.56, fd), (s * 0.354, 1.42, fz))
        add_box(g, black, (0.72, 0.012, fd), (0, 1.42 + s * 0.274, fz))
    # A steel lip round the opening.
    lip = 0.012
    add_box(g, steel, (0.76, lip, 0.008), (0, 1.706, 0.253))
    add_box(g, steel, (0.76, lip, 0.008), (0, 1.134, 0.253))
    for s in (-1, 1):
        add_box(g, steel, (lip, 0.56, 0.008), (s * 0.366, 1.42, 0.253))
    # Marquee housing above, with a steel face frame.
    add_box(g, black, (0.80, 0.22, 0.66), (0, 2.05, -0.04))
    add_box(g, steel, (0.80, 0.012, 0.012), (0, 2.154, 0.292))
    add_box(g, steel, (0.80, 0.012, 0.012), (0, 1.946, 0.292))
    # The control deck: a wooden slab tilted toward the player, edged in steel.
    dw, dt, dd = 0.80, 0.05, 0.44
    add_box(g, wood, (dw, dt, dd), DECK_C, tilt=DECK_TILT)
    add_box(g, steel, (dw, dt + 0.008, 0.022), (0, DECK_C[1], DECK_C[2] + dd / 2 + 0.011), tilt=DECK_TILT, pivot=DECK_C)
    add_box(g, steel, (dw, 0.006, dd), (0, DECK_C[1] - dt / 2 - 0.003, DECK_C[2]), tilt=DECK_TILT, pivot=DECK_C)
    for s in (-1, 1):
        add_box(g, "glow", (0.003, 0.004, dd - 0.02), (s * (dw / 2 - 0.012), DECK_C[1] + dt / 2 + 0.001, DECK_C[2]), tilt=DECK_TILT, pivot=DECK_C)
    # Apron under the deck, closing the gap to the body.
    add_box(g, wood, (0.80, 0.20, 0.30), (0, 0.86, 0.33))
    # Coin door, its slot, and a steel kick plate.
    add_box(g, "door", (0.30, 0.40, 0.012), (0, 0.44, 0.326))
    add_box(g, steel, (0.32, 0.012, 0.014), (0, 0.646, 0.327))
    add_box(g, steel, (0.32, 0.012, 0.014), (0, 0.234, 0.327))
    add_box(g, "slot", (0.026, 0.07, 0.004), (0, 0.50, 0.334))
    add_box(g, "slot", (0.07, 0.022, 0.004), (0, 0.38, 0.334))
    add_box(g, steel, (0.80, 0.09, 0.006), (0, 0.045, 0.323))
    side_panels()

    screen()
    quad_object("Marquee", "tube", 0.74, 0.17, (0, 2.05, 0.2935))

    # Controls hang off an empty that carries the deck's tilt, so they turn about the deck's own up.
    deck = bpy.data.objects.new("Deck", None)
    deck.location = B(*DECK_C)
    deck.rotation_euler = (DECK_TILT, 0, 0)
    bpy.context.collection.objects.link(deck)
    top = dt / 2
    control("Knob_Elevation", deck, (-0.22, top, 0.0), 0.072, 0.050, 0.056, "dome", pip=True)
    control("Knob_Charge", deck, (0.22, top, 0.0), 0.072, 0.050, 0.056, "dome", pip=True)
    control("Button_Fire", deck, (0.0, top, 0.03), 0.060, 0.040, 0.046, "dome_fire", pip=False)


# ---------------------------------------------------------------- the room

ROOM_MIN, ROOM_MAX, ROOM_H = (-4.0, -0.6), (4.0, 6.4), 3.2


def room():
    g = "Room"
    (x0, z0), (x1, z1) = ROOM_MIN, ROOM_MAX
    w, d = x1 - x0, z1 - z0
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    add_box(g, "concrete", (w, 0.1, d), (cx, -0.05, cz), uv_scale=0.4)
    add_box(g, "ceiling", (w, 0.1, d), (cx, ROOM_H + 0.05, cz))
    plinth, gap, pt = 0.24, 0.018, 0.04

    def wall(along_x, fixed, lo, hi, inward):
        """One wall: a dark backing, tall panels with shadow gaps, and a light cove at the floor."""
        length = hi - lo
        mid = (lo + hi) / 2
        if along_x:
            add_box(g, "backing", (length, ROOM_H, 0.1), (mid, ROOM_H / 2, fixed - inward * 0.05))
        else:
            add_box(g, "backing", (0.1, ROOM_H, length), (fixed - inward * 0.05, ROOM_H / 2, mid))
        count = max(1, round(length / 1.35))
        pw = length / count
        for i in range(count):
            c = lo + pw * (i + 0.5)
            for (y_lo, y_hi) in ((plinth, 2.05), (2.05 + gap, ROOM_H)):
                size_h = y_hi - y_lo
                yc = (y_lo + y_hi) / 2
                if along_x:
                    add_box(g, "navy", (pw - gap, size_h, pt), (c, yc, fixed + inward * pt / 2))
                else:
                    add_box(g, "navy", (pt, size_h, pw - gap), (fixed + inward * pt / 2, yc, c))
        # The cove: a lit strip tucked under the panels, washing the floor.
        if along_x:
            add_box(g, "cove", (length, 0.03, 0.012), (mid, plinth - 0.03, fixed + inward * 0.012))
        else:
            add_box(g, "cove", (0.012, 0.03, length), (fixed + inward * 0.012, plinth - 0.03, mid))

    wall(True, z0, x0, x1, +1)
    wall(True, z1, x0, x1, -1)
    wall(False, x0, z0, z1, +1)
    wall(False, x1, z0, z1, -1)

    # A run of walnut slats on the left wall.
    for i in range(22):
        z = 1.2 + i * 0.11
        add_box(g, "wood", (0.045, ROOM_H - plinth - 0.02, 0.07), (x0 + pt + 0.0225, (ROOM_H + plinth) / 2, z))


# ---------------------------------------------------------------- build and export


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    wood = bake("wood", wood_nodes)
    concrete = bake("concrete", concrete_nodes)

    material("wood", rough=0.48, image=wood)
    material("concrete", rough=0.28, image=concrete)
    # The game has no surroundings for metal to mirror, and pure metal would render black. Part metal stays grey.
    material("steel", color=(0.30, 0.30, 0.29), rough=0.36, metal=0.3)
    material("black", color=(0.004, 0.004, 0.005), rough=0.9)
    material("door", color=(0.03, 0.03, 0.035), rough=0.4, metal=0.4)
    material("navy", color=(0.026, 0.044, 0.110), rough=0.5)
    material("backing", color=(0.008, 0.010, 0.016), rough=0.9)
    material("ceiling", color=(0.012, 0.014, 0.020), rough=0.9)
    material("glow", color=(0, 0, 0), emit=(1.0, 0.52, 0.18), emit_strength=3.2)
    material("cove", color=(0, 0, 0), emit=(1.0, 0.60, 0.30), emit_strength=3.0)
    material("slot", color=(0, 0, 0), emit=(1.0, 0.34, 0.06), emit_strength=3.0)
    material("pip", color=(0, 0, 0), emit=(1.0, 0.55, 0.20), emit_strength=7.0)
    material("dome", color=(0.80, 0.74, 0.62), rough=0.24, emit=(1.0, 0.90, 0.74), emit_strength=0.55)
    material("dome_fire", color=(0.86, 0.72, 0.60), rough=0.24, emit=(1.0, 0.50, 0.26), emit_strength=1.1)
    # The game replaces this on Screen and Marquee with its own lit textures.
    material("tube", color=(0.0, 0.0, 0.0), rough=0.08)

    cabinet()
    room()
    finish_buckets()

    path = os.path.join(OUT, "arcade.glb")
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
    for name in ("_wood.png", "_concrete.png"):
        os.remove(os.path.join(OUT, name))
    print("wrote", path, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
