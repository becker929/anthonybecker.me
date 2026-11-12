"""Builds the arcade's cabinet and room in Blender and exports them as assets/arcade.glb.

Run with Blender's Python module (bpy), not the app:

    <bpy venv>/bin/python blender/build.py

Everything here is written in the game's coordinates (metres, Y up, the cabinet at the origin
facing +Z) and converted on the way in. The glTF exporter converts back, so a point given here
as (x, y, z) is at (x, y, z) in the game.

    <bpy venv>/bin/python blender/build.py --bake   also bakes the light first (minutes)

The game finds these objects by name (src/cabinet.rs): Screen, Marquee, Knob_Elevation,
Knob_Charge, Button_Fire. Everything else is scenery, joined into one mesh per material and named
Cabinet_<material> or Room_<material>. Scenery has two UV maps: the first for its texture, the
second for its place in the group's lightmap. LM_Cabinet and LM_Room carry the lightmaps.
"""

import math
import os

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")
TEXDIR = os.path.join(HERE, "tex")    # tiling material textures, made by textures.py
BAKEDIR = os.path.join(HERE, "bake")  # baked lightmaps, made by `build.py --bake`
LM_SIZE = 1024

# ---------------------------------------------------------------- coordinates


def B(x, y, z):
    """Game coordinates to Blender's (Z up, the cabinet facing -Y)."""
    return Vector((x, -z, y))


# Rotation about the game's X axis is rotation about Blender's X axis; the sign is the same.
def rot_x(a):
    return Matrix.Rotation(a, 4, "X")


# ---------------------------------------------------------------- materials

MATS = {}

# One texture repeat covers this many metres.
TEX_METRES = {"walnut": 0.70, "steel": 0.25, "concrete": 2.0, "navy": 1.0}
# Materials that take no baked light: metal has no diffuse colour, and lamps light themselves.
NO_LM = {"steel", "glow", "cove", "slot", "pip", "ink", "tube", "dome", "dome_fire"}


def material(name, color=(1, 1, 1), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, tex=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if tex:
        base = nt.nodes.new("ShaderNodeTexImage")
        base.image = bpy.data.images.load(os.path.join(TEXDIR, tex + ".jpg"))
        nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
        # Green is roughness and blue is metal, as glTF packs them.
        orm = nt.nodes.new("ShaderNodeTexImage")
        orm.image = bpy.data.images.load(os.path.join(TEXDIR, tex + "_orm.jpg"))
        orm.image.colorspace_settings.name = "Non-Color"
        split = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(orm.outputs["Color"], split.inputs[0])
        nt.links.new(split.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(split.outputs["Blue"], bsdf.inputs["Metallic"])
    mat["tex_scale"] = 1.0 / TEX_METRES[tex] if tex else 1.0
    MATS[name] = mat
    return mat


# ---------------------------------------------------------------- geometry

# Scenery gathers here, one bmesh per (group, material), and becomes one object each at the end.
BUCKETS = {}
# Plain upright boxes, as (min, max) corners. A face buried in one of these is never seen.
SOLIDS = []


def bucket(group, mat):
    key = (group, mat)
    if key not in BUCKETS:
        bm = bmesh.new()
        bm.loops.layers.uv.new("UVMap")
        bm.loops.layers.uv.new("LM")
        bm.faces.layers.float.new("lm_weight")
        BUCKETS[key] = bm
    return BUCKETS[key]


def set_weight(bm, faces, weight):
    """How much lightmap room these faces get, relative to their area."""
    layer = bm.faces.layers.float["lm_weight"]
    for f in faces:
        f[layer] = weight


def box_uv(bm, faces, scale=1.0):
    """Projects each face along its main axis, in metres. The V axis is up, so wood grain stands."""
    uv = bm.loops.layers.uv["UVMap"]
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


def long_uv(bm, faces, scale=1.0):
    """Lays U along each face's longest edge, so brushed steel is brushed along every strip."""
    uv = bm.loops.layers.uv["UVMap"]
    for f in faces:
        edge = max(f.edges, key=lambda e: e.calc_length())
        u_axis = (edge.verts[1].co - edge.verts[0].co).normalized()
        v_axis = f.normal.cross(u_axis)
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (p.dot(u_axis) * scale, p.dot(v_axis) * scale)


def paint_uv(bm, faces, mat):
    scale = MATS[mat]["tex_scale"]
    (long_uv if mat == "steel" else box_uv)(bm, faces, scale)


def add_box(group, mat, size, pos, tilt=0.0, pivot=None, weight=1.0, frame=None):
    """A box of `size` centred on `pos` (game coordinates). `tilt` rotates it about the game's
    X axis around `pivot` (default: its own centre). `frame` places it in another frame instead."""
    bm = bucket(group, mat)
    sx, sy, sz = size
    made = bmesh.ops.create_cube(bm, size=1.0)
    verts = made["verts"]
    if frame is not None:
        m = frame @ Matrix.Translation(Vector((pos[0], -pos[2], pos[1]))) @ Matrix.Diagonal((sx, sz, sy, 1.0))
    else:
        centre = B(*pos)
        piv = B(*pivot) if pivot else centre
        m = Matrix.Translation(piv) @ rot_x(tilt) @ Matrix.Translation(centre - piv) @ Matrix.Diagonal((sx, sz, sy, 1.0))
        if tilt == 0.0:
            half = Vector((sx, sz, sy)) / 2
            SOLIDS.append((centre - half, centre + half))
    bmesh.ops.transform(bm, matrix=m, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    bm.normal_update()
    paint_uv(bm, faces, mat)
    set_weight(bm, faces, weight)


def add_floor(group, mat, lo, hi, y, weight=1.0):
    """One flat face looking up. The game mirrors the room under the floor, so it has no underside."""
    bm = bucket(group, mat)
    (x0, z0), (x1, z1) = lo, hi
    verts = [bm.verts.new(B(x, y, z)) for x, z in ((x0, z1), (x1, z1), (x1, z0), (x0, z0))]
    f = bm.faces.new(verts)
    bm.normal_update()
    paint_uv(bm, [f], mat)
    set_weight(bm, [f], weight)


def add_strip(group, mat, a, b, width, thick, x):
    """A flat bar from `a` to `b`, both (z, y) points on a side panel's edge, `width` across x."""
    (z0, y0), (z1, y1) = a, b
    length = math.hypot(z1 - z0, y1 - y0)
    tilt = math.atan2(z1 - z0, y1 - y0)  # 0 when the bar stands upright
    mid = (x, (y0 + y1) / 2, (z0 + z1) / 2)
    add_box(group, mat, (width, length, thick), mid, tilt=tilt or 1e-9)


def lathe(bm, profile, segs=48, mat_index=0, smooth=True, hard=True, knurl=0.0, matrix=None, uv_scale=4.0):
    """Turns a profile of (radius, height) points about the up axis, bottom to top. With `hard`, each
    band has its own vertices, so bands meet at a crisp edge. `knurl` cuts flutes of that depth."""
    uv = bm.loops.layers.uv["UVMap"]

    def ring(r, z):
        if r <= 1e-9:
            return [bm.verts.new((0, 0, z))]
        out = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = r - (knurl if i % 2 else 0.0)
            out.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        return out

    faces = []
    run = 0.0
    rings = None if hard else [ring(r, z) for r, z in profile]
    for k, ((r0, z0), (r1, z1)) in enumerate(zip(profile, profile[1:])):
        lo, hi = (ring(r0, z0), ring(r1, z1)) if hard else (rings[k], rings[k + 1])
        step = math.hypot(r1 - r0, z1 - z0)
        for i in range(segs):
            j = (i + 1) % segs
            if len(lo) == 1:
                vs, us = [lo[0], hi[j], hi[i]], [(i + 0.5, 0), (i + 1, 1), (i, 1)]
            elif len(hi) == 1:
                vs, us = [lo[i], lo[j], hi[0]], [(i, 0), (i + 1, 0), (i + 0.5, 1)]
            else:
                vs, us = [lo[i], lo[j], hi[j], hi[i]], [(i, 0), (i + 1, 0), (i + 1, 1), (i, 1)]
            f = bm.faces.new(vs)
            f.smooth = smooth
            f.material_index = mat_index
            for loop, (ua, vt) in zip(f.loops, us):
                # U runs round the axis, so brushed steel reads as turned on a lathe.
                loop[uv].uv = (ua / segs * uv_scale, (run + vt * step) * 4.0)
            faces.append(f)
        run += step
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=list({v for f in faces for v in f.verts}))
    return faces


def hidden(f):
    """True when the face lies wholly inside the plain boxes: against a wall, or between two parts."""
    centre = f.calc_center_median()
    for v in [None] + list(f.verts):
        p = centre if v is None else centre + (v.co - centre) * 0.9
        p = p + f.normal * 0.002
        if not any(all(lo[i] + 5e-4 < p[i] < hi[i] - 5e-4 for i in range(3)) for lo, hi in SOLIDS):
            return False
    return True


def pack_lightmap(group):
    """Gives every face that takes baked light its own rectangle in the group's lightmap. The scale is
    the largest at which everything fits. Hidden faces and metal share one spare texel."""
    rects = []  # [w, h, bm, face, u_axis, v_axis, origin]
    spare = []
    for (g, mat), bm in BUCKETS.items():
        if g != group:
            continue
        weight = bm.faces.layers.float["lm_weight"]
        for f in bm.faces:
            if mat in NO_LM or f[weight] <= 0.0 or hidden(f):
                spare.append((bm, f))
                continue
            edge = max(f.edges, key=lambda e: e.calc_length())
            ua = (edge.verts[1].co - edge.verts[0].co).normalized()
            va = f.normal.cross(ua)
            us = [v.co.dot(ua) for v in f.verts]
            vs = [v.co.dot(va) for v in f.verts]
            w, h = (max(us) - min(us)) * f[weight], (max(vs) - min(vs)) * f[weight]
            rects.append((w, h, bm, f, ua, va, (min(us), min(vs), max(us) - min(us), max(vs) - min(vs))))
    pad = 2

    def place(scale):
        """Shelf packing, tallest first. Returns the places, or None if they overflow."""
        sized = sorted(((max(2, math.ceil(r[0] * scale)), max(2, math.ceil(r[1] * scale)), i) for i, r in enumerate(rects)),
                       key=lambda t: (-t[1], -t[0]))
        x, y, row = 8, pad, 0  # the first 8 pixels of the first row are the spare texel
        out = {}
        for w, h, i in sized:
            if w + 2 * pad > LM_SIZE:
                return None
            if x + w + 2 * pad > LM_SIZE:
                x, y, row = 0, y + row + pad, 0
            if y + h + pad > LM_SIZE:
                return None
            out[i] = (x + pad, y, w, h)
            x += w + pad
            row = max(row, h)
        return out

    lo, hi = 1.0, 4000.0
    for _ in range(24):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if place(mid) else (lo, mid)
    places = place(lo)
    for i, (w, h, bm, f, ua, va, (u0, v0, du, dv)) in enumerate(rects):
        uv = bm.loops.layers.uv["LM"]
        x, y, pw, ph = places[i]
        for loop in f.loops:
            s = (loop.vert.co.dot(ua) - u0) / max(du, 1e-9)
            t = (loop.vert.co.dot(va) - v0) / max(dv, 1e-9)
            loop[uv].uv = ((x + s * pw) / LM_SIZE, (y + t * ph) / LM_SIZE)
    for bm, f in spare:
        uv = bm.loops.layers.uv["LM"]
        for loop in f.loops:
            loop[uv].uv = (3.0 / LM_SIZE, 3.0 / LM_SIZE)
    print(f"lightmap {group}: {len(rects)} faces at {lo:.0f} px per metre, {len(spare)} spare")


def finish_buckets():
    for group in sorted({g for g, _ in BUCKETS}):
        for bm in (bm for (g, _), bm in BUCKETS.items() if g == group):
            bm.normal_update()
        pack_lightmap(group)
    for (group, mat), bm in BUCKETS.items():
        mesh = bpy.data.meshes.new(f"{group}_{mat}")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(MATS[mat])
        obj = bpy.data.objects.new(f"{group}_{mat}", mesh)
        bpy.context.collection.objects.link(obj)


def mesh_object(name, bm, mats, parent=None, location=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
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
            f.smooth = True
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


def deck_frame():
    """The deck's own frame: x across, y up the deck away from the player, z out of its face."""
    return Matrix.Translation(B(*DECK_C)) @ rot_x(DECK_TILT)


def dome_profile(r, z, rise, steps=8):
    return [(r * math.cos(t), z + rise * math.sin(t)) for t in (math.pi / 2 * i / steps for i in range(steps + 1))]


def knob(name, parent, at):
    """A rotary selector from a switchboard: a fixed steel dial plate with engraved ticks, and on it a
    knurled steel drum with an opal cap and a thick pointer bar whose nose hangs over the dial.
    The drum's origin is on the deck and it turns about its own up axis. At rest it points up the deck."""
    here = deck_frame() @ Matrix.Translation((at[0], -at[2], at[1]))
    # Fixed parts are scenery: they take the baked shadows and never move.
    steel = bucket("Cabinet", "steel")
    faces = lathe(steel, [(0.082, 0.0), (0.082, 0.005), (0.079, 0.007), (0.0, 0.007)], segs=64, matrix=here)
    set_weight(steel, faces, 0.0)
    for i in range(19):
        a = math.radians(-135 + 15 * i)
        long = i % 3 == 0
        length = 0.015 if long else 0.009
        add_box("Cabinet", "ink", (0.0030 if long else 0.0020, 0.0008, length), (0, 0.0072, -(0.0775 - length / 2)),
                frame=here @ Matrix.Rotation(-a, 4, "Z"), weight=0.0)

    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    r = 0.058
    lathe(bm, [(0.050, 0.008), (r, 0.010)], segs=96)
    lathe(bm, [(r, 0.010), (r - 0.003, 0.010)], segs=96)          # closes the foot of the flutes
    lathe(bm, [(r, 0.010), (r, 0.044)], segs=96, smooth=False, knurl=0.0024)
    lathe(bm, [(r - 0.003, 0.044), (r, 0.044)], segs=96)          # and their top
    lathe(bm, [(r, 0.044), (r, 0.047), (r - 0.003, 0.050), (0.049, 0.050)], segs=96)
    lathe(bm, dome_profile(0.049, 0.050, 0.009), segs=48, mat_index=1, hard=False)

    def block(size, centre, mat_index):
        made = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=made["verts"], vec=size)
        bmesh.ops.translate(bm, verts=made["verts"], vec=centre)
        for f in {f for v in made["verts"] for f in v.link_faces}:
            f.material_index = mat_index

    # The pointer: a bar across the cap, running out past the drum and down its side as a nose.
    block((0.024, 0.118, 0.008), (0, 0.019, 0.052), 0)
    block((0.020, 0.114, 0.010), (0, 0.019, 0.061), 0)
    block((0.024, 0.024, 0.038), (0, 0.066, 0.029), 0)
    # A cream line let into the bar and the nose, so the direction reads from the seat.
    block((0.007, 0.074, 0.0014), (0, 0.038, 0.0667), 2)
    block((0.007, 0.0014, 0.050), (0, 0.0787, 0.037), 2)
    long_uv(bm, [f for f in bm.faces if not f.smooth and f.material_index == 0 and len(f.verts) == 4 and f.calc_area() > 1e-4], 4.0)
    obj = mesh_object(name, bm, ["steel", "dome", "pip"], parent=parent)
    obj.location = (at[0], -at[2], at[1])
    return obj


def plunger(name, parent, at):
    """A fat push button: a fixed steel collar on a flange, and a domed amber plunger that sinks into it."""
    here = deck_frame() @ Matrix.Translation((at[0], -at[2], at[1]))
    steel = bucket("Cabinet", "steel")
    faces = lathe(steel, [(0.068, 0.0), (0.068, 0.004), (0.065, 0.006), (0.057, 0.006)], segs=64, matrix=here)
    faces += lathe(steel, [(0.057, 0.006), (0.057, 0.027), (0.054, 0.030), (0.0445, 0.030)], segs=64, matrix=here)
    faces += lathe(steel, [(0.0445, 0.030), (0.0445, 0.0)], segs=64, matrix=here)
    set_weight(steel, faces, 0.0)
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    lathe(bm, [(0.0430, -0.014), (0.0430, 0.035)], segs=48)
    lathe(bm, dome_profile(0.0430, 0.035, 0.017), segs=48, hard=False)
    obj = mesh_object(name, bm, ["dome_fire"], parent=parent)
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
        paint_uv(bm, faces, "wood")
        set_weight(bm, faces, 1.0)
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
    add_box(g, wood, (dw, dt, dd), DECK_C, tilt=DECK_TILT, weight=2.5)
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
    knob("Knob_Elevation", deck, (-0.22, top, 0.0))
    knob("Knob_Charge", deck, (0.22, top, 0.0))
    plunger("Button_Fire", deck, (0.0, top, 0.03))


# ---------------------------------------------------------------- the room

ROOM_MIN, ROOM_MAX, ROOM_H = (-4.0, -0.6), (4.0, 6.4), 3.2


def room():
    g = "Room"
    (x0, z0), (x1, z1) = ROOM_MIN, ROOM_MAX
    w, d = x1 - x0, z1 - z0
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    add_floor(g, "concrete", ROOM_MIN, ROOM_MAX, 0.0, weight=1.0)
    add_box(g, "ceiling", (w, 0.1, d), (cx, ROOM_H + 0.05, cz), weight=0.3)
    plinth, gap, pt = 0.24, 0.018, 0.04

    def wall(along_x, fixed, lo, hi, inward):
        """One wall: a dark backing, tall panels with shadow gaps, and a light cove at the floor."""
        length = hi - lo
        mid = (lo + hi) / 2
        if along_x:
            add_box(g, "backing", (length, ROOM_H, 0.1), (mid, ROOM_H / 2, fixed - inward * 0.05), weight=0.25)
        else:
            add_box(g, "backing", (0.1, ROOM_H, length), (fixed - inward * 0.05, ROOM_H / 2, mid), weight=0.25)
        count = max(1, round(length / 1.35))
        pw = length / count
        for i in range(count):
            c = lo + pw * (i + 0.5)
            for (y_lo, y_hi) in ((plinth, 2.05), (2.05 + gap, ROOM_H)):
                size_h = y_hi - y_lo
                yc = (y_lo + y_hi) / 2
                if along_x:
                    add_box(g, "navy", (pw - gap, size_h, pt), (c, yc, fixed + inward * pt / 2), weight=0.8)
                else:
                    add_box(g, "navy", (pt, size_h, pw - gap), (fixed + inward * pt / 2, yc, c), weight=0.8)
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
        add_box(g, "wood", (0.045, ROOM_H - plinth - 0.02, 0.07), (x0 + pt + 0.0225, (ROOM_H + plinth) / 2, z), weight=0.5)


# ---------------------------------------------------------------- build and export


def build_scene():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    material("wood", rough=0.42, tex="walnut")
    material("concrete", rough=0.25, tex="concrete")
    # Full metal: it shows only what it mirrors, which is the room picture the game carries (assets/env.bin).
    material("steel", rough=0.34, metal=1.0, tex="steel")
    material("navy", rough=0.36, tex="navy")
    material("black", color=(0.006, 0.006, 0.007), rough=0.85)
    material("ink", color=(0.004, 0.004, 0.004), rough=0.8)
    material("door", color=(0.020, 0.020, 0.024), rough=0.45)
    material("backing", color=(0.008, 0.010, 0.016), rough=0.9)
    material("ceiling", color=(0.020, 0.022, 0.030), rough=0.9)
    material("glow", color=(0, 0, 0), emit=(1.0, 0.56, 0.22), emit_strength=3.4)
    material("cove", color=(0, 0, 0), emit=(1.0, 0.62, 0.32), emit_strength=3.2)
    material("slot", color=(0, 0, 0), emit=(1.0, 0.34, 0.06), emit_strength=3.0)
    material("pip", color=(0.55, 0.50, 0.40), rough=0.4, emit=(1.0, 0.80, 0.52), emit_strength=0.9)
    material("dome", color=(0.62, 0.60, 0.55), rough=0.22, emit=(1.0, 0.92, 0.80), emit_strength=0.10)
    material("dome_fire", color=(0.70, 0.27, 0.05), rough=0.16, emit=(1.0, 0.38, 0.06), emit_strength=0.55)
    # The game replaces this on Screen and Marquee with its own lit textures.
    material("tube", color=(0.0, 0.0, 0.0), rough=0.08)

    cabinet()
    room()
    finish_buckets()


# ---------------------------------------------------------------- baked light

# The game draws with no bounce light, soft shadows or reflections of its own, so Cycles works them
# out here once. A lightmap holds the light that falls on each face (not its colour). The game
# multiplies it by the face's own texture.

GROUPS = ("Cabinet", "Room")
BAKE_SAMPLES = 512
# A lightmap pixel of 1.0 is this much light. src/cabinet.rs has the same number.
LM_WHITE = 6.0
# The lamps are brighter in the bake than they are drawn: a drawn strip is only the lit slot's lip.
BAKE_EMIT = {"cove": 14.0, "glow": 6.0, "slot": 3.0}
# The key light: a big soft panel up and to the left of the player, aimed at the cabinet.
KEY_AT, KEY_AIM, KEY_SIZE, KEY_POWER = (-1.1, 3.0, 2.0), (0.0, 1.1, 0.2), 1.5, 6.0
KEY_COLOR = (1.0, 0.90, 0.80)
# Two wide, weak, cool panels overhead keep the far walls from going black.
FILLS = [((-2.4, 3.12, 4.2), 2.2, 0.35), ((2.4, 3.12, 2.4), 2.2, 0.35)]
FILL_COLOR = (0.62, 0.74, 1.0)
# The room picture for reflections is taken from here, in front of the cabinet at chest height.
ENV_AT = (0.0, 1.25, 0.75)
ENV_SIZE, DIFFUSE_SIZE, ENV_WHITE = 64, 8, 8.0


def use_gpu(scene):
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as err:  # no GPU: slower, same picture
        print("cycles on the CPU:", err)
        scene.cycles.device = "CPU"


def panel_light(name, at, aim, size, power, color):
    """A glowing square. It is a mesh, not a lamp, so it also shows in the reflection picture."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*color, 1)
    emit.inputs["Strength"].default_value = power
    nt.links.new(emit.outputs[0], out.inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=size)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    obj.location = B(*at)
    # A plane's face looks along its +Z; turn that toward the aim.
    obj.rotation_euler = (B(*aim) - B(*at)).to_track_quat("Z", "Y").to_euler()
    return obj


def light_scene():
    """Adds the lamps that exist only for the bake, and turns the drawn ones up."""
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("dark")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)
    panel_light("key", KEY_AT, KEY_AIM, KEY_SIZE, KEY_POWER, KEY_COLOR)
    for i, (at, size, power) in enumerate(FILLS):
        panel_light(f"fill{i}", at, (at[0], 0.0, at[2]), size, power, FILL_COLOR)
    for name, gain in BAKE_EMIT.items():
        MATS[name].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value *= gain
    # The sign glows amber in the game; give it that here so its spill is baked.
    sign = material("bake_sign", color=(0, 0, 0), emit=(1.0, 0.62, 0.26), emit_strength=1.6)
    bpy.data.objects["Marquee"].data.materials[0] = sign


def srgb(a):
    import numpy as np
    a = np.clip(a, 0.0, 1.0)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)


def bake_lightmaps():
    import numpy as np
    from PIL import Image

    os.makedirs(BAKEDIR, exist_ok=True)
    scene = bpy.context.scene
    use_gpu(scene)
    scene.cycles.samples = BAKE_SAMPLES
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 3
    scene.render.bake.use_clear = False
    for group in GROUPS:
        img = bpy.data.images.new("lm_bake_" + group, LM_SIZE, LM_SIZE, float_buffer=True, alpha=False)
        objs = [o for o in bpy.data.objects if o.name.startswith(group + "_") and o.type == "MESH"]
        for o in objs:
            # Cycles bakes into the image of each material's active texture node, through the active UV map.
            nt = o.data.materials[0].node_tree
            node = nt.nodes.get("LM") or nt.nodes.new("ShaderNodeTexImage")
            node.name = "LM"
            node.image = img
            nt.nodes.active = node
            o.data.uv_layers["UVMap"].active_render = True
            o.data.uv_layers.active = o.data.uv_layers["LM"]
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
        px = np.empty(LM_SIZE * LM_SIZE * 4, np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(LM_SIZE, LM_SIZE, 4)[::-1, :, :3]
        print(f"baked {group}: mean {px.mean():.3f}, 99th percentile {np.percentile(px, 99):.2f}, max {px.max():.1f}")
        out = (srgb(px / LM_WHITE) * 255 + 0.5).astype(np.uint8)
        Image.fromarray(out).save(os.path.join(BAKEDIR, f"lm_{group}.jpg"), quality=90, optimize=True)


def render_env():
    """Photographs the room as a cube from in front of the cabinet, blurs it for each roughness, and
    writes assets/env.bin: the mirror picture for steel, glass and varnish, and the soft light for
    the moving controls. src/room.rs reads it."""
    import tempfile

    import numpy as np

    scene = bpy.context.scene
    use_gpu(scene)
    scene.cycles.samples = 192
    scene.cycles.use_denoising = True
    hide = [o for o in bpy.data.objects if o.name.startswith(("Cabinet_", "Knob_", "Button_", "Screen", "Marquee", "LM_"))]
    for o in hide:
        o.hide_render = True
    cam = bpy.data.cameras.new("env")
    cam.sensor_fit = "VERTICAL"
    cam.angle = math.pi / 2
    cam.clip_start = 0.02
    obj = bpy.data.objects.new("env", cam)
    bpy.context.collection.objects.link(obj)
    scene.camera = obj
    n = ENV_SIZE * 2  # rendered at twice the size and halved, which smooths it
    scene.render.resolution_x = scene.render.resolution_y = n
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "32"
    # Cube faces in the order +X -X +Y -Y +Z -Z, as (look, up) in cube space. The game flips Z when it
    # looks a direction up in a cube, so cube space is game space with Z negated.
    faces = [((1, 0, 0), (0, 1, 0)), ((-1, 0, 0), (0, 1, 0)), ((0, 1, 0), (0, 0, -1)),
             ((0, -1, 0), (0, 0, 1)), ((0, 0, 1), (0, 1, 0)), ((0, 0, -1), (0, 1, 0))]
    cube = np.zeros((6, ENV_SIZE, ENV_SIZE, 3), np.float32)
    tmp = tempfile.mkdtemp()
    for i, (look, up) in enumerate(faces):
        look_b = B(look[0], look[1], -look[2]).normalized()
        up_b = B(up[0], up[1], -up[2]).normalized()
        right_b = look_b.cross(up_b)
        obj.matrix_world = Matrix.Translation(B(*ENV_AT)) @ Matrix((right_b, up_b, -look_b)).transposed().to_4x4()
        scene.render.filepath = os.path.join(tmp, f"face{i}.exr")
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(scene.render.filepath)
        px = np.empty(n * n * 4, np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(n, n, 4)[::-1, :, :3]
        cube[i] = px.reshape(ENV_SIZE, 2, ENV_SIZE, 2, 3).mean(axis=(1, 3))
    for o in hide:
        o.hide_render = False

    def directions(size):
        """Unit directions and solid angles of a cube's texels, face by face."""
        c = (np.arange(size) + 0.5) / size * 2 - 1
        s, t = np.meshgrid(c, c)  # s runs right, t runs down
        one = np.ones_like(s)
        d = np.stack([np.stack(v, -1) for v in ((one, -t, -s), (-one, -t, s), (s, one, t), (s, -one, -t), (s, -t, one), (-s, -t, -one))])
        length = np.linalg.norm(d, axis=-1, keepdims=True)
        return (d / length).reshape(-1, 3), (1.0 / length[..., 0] ** 3).reshape(-1)

    def blurred(size, power):
        """Each texel becomes the average of the room seen through a lobe of cos^power about it."""
        src_size = min(ENV_SIZE, 32)
        src = cube.reshape(6, src_size, ENV_SIZE // src_size, src_size, ENV_SIZE // src_size, 3).mean(axis=(2, 4)).reshape(-1, 3)
        sd, sw = directions(src_size)
        od, _ = directions(size)
        w = np.clip(od @ sd.T, 0, 1) ** power * sw
        return ((w @ src) / w.sum(1, keepdims=True)).reshape(6, size, size, 3)

    levels = [cube]
    size, level = ENV_SIZE // 2, 1
    last = int(math.log2(ENV_SIZE))
    while size >= 1:
        # The game picks a level by roughness. A lobe this wide matches that roughness.
        alpha = max((level / last) ** 2, 1e-3)
        power = max(2.0 / (alpha * alpha) - 2.0, 1.0)
        if power > 400:
            prev = levels[-1]
            levels.append(prev.reshape(6, size, 2, size, 2, 3).mean(axis=(2, 4)))
        else:
            levels.append(blurred(size, power))
        size, level = size // 2, level + 1
    diffuse = blurred(DIFFUSE_SIZE, 1.0)

    def pack(a):
        rgb = (srgb(a / ENV_WHITE) * 255 + 0.5).astype(np.uint8)
        return np.concatenate([rgb, np.full(rgb.shape[:-1] + (1,), 255, np.uint8)], axis=-1)

    with open(os.path.join(OUT, "env.bin"), "wb") as f:
        # One face after another, each with all its sizes, then the soft cube the same way.
        for face in range(6):
            for lv in levels:
                f.write(pack(lv[face]).tobytes())
        for face in range(6):
            f.write(pack(diffuse[face]).tobytes())
    print("env: mean", cube.mean(axis=(0, 1, 2)).round(3), "max", float(cube.max()), "face means", cube.mean(axis=(1, 2, 3)).round(3),
          "diffuse up/down", diffuse[2].mean().round(3), diffuse[3].mean().round(3))


def carry_lightmaps():
    """Puts the baked lightmaps in the model file. Each rides on a small hidden part named LM_<group>;
    the game takes the picture from that part's material and hides the part."""
    for group in GROUPS:
        mat = bpy.data.materials.new("lm_" + group)
        mat.use_nodes = True
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(BAKEDIR, f"lm_{group}.jpg"))
        mat.node_tree.links.new(tex.outputs["Color"], mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
        mesh = bpy.data.meshes.new("LM_" + group)
        mesh.from_pydata([(0, 0, 0), (0.01, 0, 0), (0, 0.01, 0)], [], [(0, 1, 2)])
        mesh.uv_layers.new(name="UVMap")
        mesh.materials.append(mat)
        obj = bpy.data.objects.new("LM_" + group, mesh)
        obj.location = B(0, -1.0, 0)
        bpy.context.collection.objects.link(obj)


def export():
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
    print("wrote", path, os.path.getsize(path), "bytes")


def main():
    import sys

    build_scene()
    if "--bake" in sys.argv:
        # Slow: a few minutes on the GPU. The results are kept in blender/bake and assets/env.bin.
        light_scene()
        bake_lightmaps()
        render_env()
        # Start again clean, so nothing from the bake's lamps reaches the model file.
        BUCKETS.clear()
        SOLIDS.clear()
        MATS.clear()
        build_scene()
    carry_lightmaps()
    export()


if __name__ == "__main__":
    main()
