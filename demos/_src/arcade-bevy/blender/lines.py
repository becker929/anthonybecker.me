"""Renders line-art and depth views of the model, as structure references for image models.

    <bpy venv>/bin/python blender/lines.py [out_dir]

Writes <view>_lines.png and <view>_depth.png (near is white, 16 bit) into reference/ by default.
The views match src/shot.rs, so generated art lines up with the game's own captures.
"""

import math
import os
import sys

import bpy  # must come first
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build

# Eye and aim in game coordinates, as in src/shot.rs. The game's vertical field of view is 68 degrees.
VIEWS = {
    "hero": ((-0.24, 1.74, 0.98), (0.02, 1.27, 0.20)),
    "playing": ((0.0, 1.52, 1.12), (0.0, 1.33, 0.16)),
    "wide": ((2.6, 1.6, 5.2), (0.0, 1.2, 0.0)),
    "controls": ((0.0, 1.38, 0.86), (0.0, 1.02, 0.42)),
}
FOV = math.radians(68.0)
SIZE = (1280, 720)


def camera(eye, aim):
    cam = bpy.data.cameras.new("cam")
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = FOV
    cam.clip_start, cam.clip_end = 0.05, 50
    obj = bpy.data.objects.new("cam", cam)
    bpy.context.collection.objects.link(obj)
    obj.location = build.B(*eye)
    look = build.B(*aim) - build.B(*eye)
    obj.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = obj
    return obj


def flat(name, depth):
    """A flat emission material: distance from the camera as grey, or the surface normal as colour."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs[0], out.inputs[0])
    if depth:
        cam = nt.nodes.new("ShaderNodeCameraData")
        rng = nt.nodes.new("ShaderNodeMapRange")
        rng.inputs["From Min"].default_value = 0.4
        rng.inputs["From Max"].default_value = depth
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


def edges(depth_path, normal_path, out_path):
    """Black lines on white wherever the depth jumps or the surface turns. Freestyle finds no strokes
    in this headless build, so the lines are drawn from the two passes instead."""
    import numpy as np
    from PIL import Image

    d = np.asarray(Image.open(depth_path).convert("I;16")).astype(np.float32) / 65535.0
    n = np.asarray(Image.open(normal_path).convert("RGB")).astype(np.float32) / 255.0
    line = np.zeros(d.shape, bool)
    for axis in (0, 1):
        dd = np.abs(np.diff(d, axis=axis, append=d.take([-1], axis=axis)))
        dn = np.abs(np.diff(n, axis=axis, append=n.take([-1], axis=axis))).sum(axis=2)
        line |= (dd > 0.012) | (dn > 0.35)
    Image.fromarray(np.where(line, 0, 255).astype(np.uint8)).save(out_path)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(build.HERE, "..", "reference")
    os.makedirs(out, exist_ok=True)
    build.build_scene()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.filter_width = 0.01  # no blur across edges: the edge finder wants hard steps
    scene.render.resolution_x, scene.render.resolution_y = SIZE
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "16"
    scene.view_settings.view_transform = "Raw"
    scene.world = bpy.data.worlds.new("w")
    layer = scene.view_layers[0]
    for name, (eye, aim) in VIEWS.items():
        camera(eye, aim)
        far = 9.0 if name == "wide" else 2.6
        paths = {}
        for kind in ("depth", "normal"):
            layer.material_override = flat(kind, far if kind == "depth" else None)
            paths[kind] = scene.render.filepath = os.path.join(out, f"{name}_{kind}.png")
            bpy.ops.render.render(write_still=True)
        edges(paths["depth"], paths["normal"], os.path.join(out, f"{name}_lines.png"))
        os.remove(paths["normal"])
        print("wrote", name)


if __name__ == "__main__":
    main()
