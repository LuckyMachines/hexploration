"""Promote a reviewed GLB into a normalized, lightweight board-ready asset.

Run with Blender in background mode:
  blender --background --python scripts/optimize-board-model.py -- input.glb output.glb 5000 1024
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector


def arguments():
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(values) < 2:
        raise SystemExit("Expected input.glb output.glb [target_faces] [max_texture_size]")
    return (
        os.path.abspath(values[0]),
        os.path.abspath(values[1]),
        int(values[2]) if len(values) > 2 else 5000,
        int(values[3]) if len(values) > 3 else 1024,
    )


def scene_bounds(meshes):
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


input_path, output_path, target_faces, max_texture_size = arguments()
if not os.path.isfile(input_path):
    raise SystemExit(f"Input model does not exist: {input_path}")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=input_path)

for obj in list(bpy.context.scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise SystemExit("Imported model contained no meshes")

source_faces = sum(len(obj.data.polygons) for obj in meshes)
ratio = min(1.0, target_faces / max(1, source_faces))
if ratio < 0.999:
    for obj in meshes:
        if len(obj.data.polygons) < 24:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new(name="Board LOD", type="DECIMATE")
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

for image in bpy.data.images:
    width, height = image.size
    longest = max(width, height)
    if longest > max_texture_size and width > 0 and height > 0:
        scale = max_texture_size / longest
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))

bpy.context.view_layer.update()
minimum, maximum = scene_bounds(meshes)
center = (minimum + maximum) * 0.5
extent = maximum - minimum
largest = max(extent.x, extent.y, extent.z, 0.0001)

root = bpy.data.objects.new("board_asset_root", None)
bpy.context.scene.collection.objects.link(root)
for obj in list(bpy.context.scene.objects):
    if obj == root or obj.parent is not None:
        continue
    obj.parent = root
    obj.matrix_parent_inverse = root.matrix_world.inverted()

root.location = Vector((-center.x, -minimum.y, -center.z))
root.scale = (1.0 / largest,) * 3
bpy.context.view_layer.update()

for obj in meshes:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

os.makedirs(os.path.dirname(output_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_yup=True,
    export_apply=False,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
    export_image_format="AUTO",
)

result_faces = sum(len(obj.data.polygons) for obj in meshes)
print(json.dumps({
    "input": input_path,
    "output": output_path,
    "sourceFaces": source_faces,
    "resultFaces": result_faces,
    "maxTextureSize": max_texture_size,
    "outputBytes": os.path.getsize(output_path),
}, indent=2))
