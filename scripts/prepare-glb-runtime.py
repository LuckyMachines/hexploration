import json
import os
import sys

import bpy
import numpy as np
from mathutils import Vector


def script_args():
    if "--" not in sys.argv:
        raise RuntimeError("Expected: -- input.glb output.glb ratio [material_override_json]")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) not in (3, 4):
        raise RuntimeError("Expected: input.glb output.glb ratio [material_override_json]")
    input_path, output_path, ratio_text = args[:3]
    ratio = float(ratio_text)
    if not 0 < ratio <= 1:
        raise RuntimeError("ratio must be above 0 and at most 1")
    material_override = json.loads(args[3]) if len(args) == 4 else {}
    return input_path, output_path, ratio, material_override


def hex_color(value):
    text = value.lstrip("#")
    return np.array([int(text[index : index + 2], 16) / 255.0 for index in (0, 2, 4)], dtype=np.float32)


def linked_images(socket, visited=None):
    visited = visited or set()
    found = []
    for link in socket.links:
        node = link.from_node
        if node in visited:
            continue
        visited.add(node)
        if node.type == "TEX_IMAGE" and node.image:
            found.append(node.image)
        else:
            for node_input in node.inputs:
                found.extend(linked_images(node_input, visited))
    return found


def remap_base_color(image, contract):
    pixel_count = len(image.pixels)
    if not pixel_count:
        return False
    pixels = np.empty(pixel_count, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape((-1, 4))
    rgb = pixels[:, :3]
    luminance = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    black_point = float(contract.get("blackPoint", 0.0))
    white_point = max(black_point + 0.001, float(contract.get("whitePoint", 1.0)))
    gamma = max(0.01, float(contract.get("gamma", 1.0)))
    tone = np.power(np.clip((luminance - black_point) / (white_point - black_point), 0.0, 1.0), gamma)
    shadow = hex_color(contract["shadow"])
    highlight = hex_color(contract["highlight"])
    pixels[:, :3] = shadow + (highlight - shadow) * tone[:, None]
    image.pixels.foreach_set(pixels.ravel())
    image.update()
    image.pack()
    return True


def apply_material_override(materials, override):
    if not override:
        return 0
    tuned = 0
    for material in materials:
        if not material:
            continue
        material.use_nodes = True
        principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if not principled:
            continue
        base_color_remap = override.get("baseColorRemap")
        if base_color_remap:
            for image in linked_images(principled.inputs.get("Base Color")):
                remap_base_color(image, base_color_remap)
        for key, socket_name, property_name in (
            ("metallicFactor", "Metallic", "metallic"),
            ("roughnessFactor", "Roughness", "roughness"),
        ):
            if key not in override:
                continue
            value = max(0.0, min(1.0, float(override[key])))
            socket = principled.inputs.get(socket_name)
            if socket:
                for link in list(socket.links):
                    material.node_tree.links.remove(link)
                socket.default_value = value
            setattr(material, property_name, value)
        tuned += 1
    return tuned


def world_bounds(objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    return minimum, maximum


def main():
    input_path, output_path, ratio, material_override = script_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=input_path)

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("Input contains no mesh objects")
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    if len(mesh_objects) > 1:
        bpy.ops.object.join()
    model = bpy.context.view_layer.objects.active
    model.name = "xenovoya_runtime_asset"
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tuned_materials = apply_material_override(model.data.materials, material_override)

    # Generated meshes can contain invalid indices, zero-area faces, or stale
    # custom data that collapse into long spikes during aggressive LOD work.
    # Repair the source deterministically before measuring or decimating it.
    source_mesh_was_repaired = model.data.validate(verbose=True, clean_customdata=True)
    model.data.update(calc_edges=True)

    source_triangles = sum(len(polygon.vertices) - 2 for polygon in model.data.polygons)
    modifier = model.modifiers.new(name="Xenovoya Runtime Decimation", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = model
    bpy.ops.object.modifier_apply(modifier=modifier.name)

    minimum, maximum = world_bounds([model])
    model.location += Vector((-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    model.select_set(True)
    bpy.context.view_layer.objects.active = model
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )

    output_triangles = sum(len(polygon.vertices) - 2 for polygon in model.data.polygons)
    print(json.dumps({
        "input": input_path,
        "output": output_path,
        "ratio": ratio,
        "sourceTriangles": source_triangles,
        "outputTriangles": output_triangles,
        "materials": len(model.data.materials),
        "materialOverride": material_override,
        "tunedMaterials": tuned_materials,
        "sourceMeshWasRepaired": source_mesh_was_repaired,
    }))


if __name__ == "__main__":
    main()
