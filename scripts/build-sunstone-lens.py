import math
import os
import sys

import bpy


def material(name, color, metallic, roughness, emission=None, emission_strength=0.0):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    value.diffuse_color = (*color, 1.0)
    node = next(node for node in value.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    node.inputs["Base Color"].default_value = (*color, 1.0)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    if emission and node.inputs.get("Emission Color"):
        node.inputs["Emission Color"].default_value = (*emission, 1.0)
        node.inputs["Emission Strength"].default_value = emission_strength
    return value


def bevel(object_value, width=0.04, segments=2):
    modifier = object_value.modifiers.new(name="Sunstone edge bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = object_value
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_cylinder(name, radius, depth, location, material_value, vertices=8, bevel_width=0.035):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=(math.pi / 2, 0, 0),
    )
    value = bpy.context.object
    value.name = name
    value.data.materials.append(material_value)
    if bevel_width:
        bevel(value, bevel_width, 2)
    return value


def add_torus(name, major_radius, minor_radius, y, z, material_value, segments=8):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=segments,
        minor_segments=6,
        location=(0, y, z),
        rotation=(math.pi / 2, 0, 0),
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    value = bpy.context.object
    value.name = name
    value.data.materials.append(material_value)
    return value


def add_box(name, location, scale, rotation_y, material_value, bevel_width=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=(0, rotation_y, 0))
    value = bpy.context.object
    value.name = name
    value.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    value.data.materials.append(material_value)
    if bevel_width:
        bevel(value, bevel_width, 2)
    return value


def main():
    if "--" not in sys.argv or len(sys.argv[sys.argv.index("--") + 1 :]) != 1:
        raise RuntimeError("Expected: -- output.glb")
    output_path = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
    bpy.ops.wm.read_factory_settings(use_empty=True)

    housing = material("Sunstone weathered housing", (0.055, 0.062, 0.068), 0.62, 0.38)
    amber = material(
        "Sunstone amber lens",
        (0.95, 0.32, 0.035),
        0.04,
        0.2,
        emission=(1.0, 0.18, 0.01),
        emission_strength=2.2,
    )

    center_z = 1.08
    add_cylinder("octagonal load-bearing housing", 1.0, 0.44, (0, 0, center_z), housing, bevel_width=0.055)
    add_torus("front structural bezel", 0.73, 0.105, -0.255, center_z, housing)
    add_cylinder("captured amber aperture", 0.62, 0.1, (0, -0.285, center_z), amber, vertices=48, bevel_width=0.025)
    add_torus("amber lens ring outer", 0.48, 0.035, -0.35, center_z, amber, segments=48)
    add_torus("amber lens ring inner", 0.3, 0.025, -0.355, center_z, amber, segments=48)
    add_cylinder("sunstone luminous core", 0.13, 0.13, (0, -0.37, center_z), amber, vertices=32, bevel_width=0.018)

    add_torus("rear service ring", 0.63, 0.075, 0.255, center_z, housing)
    add_cylinder("rear service plate", 0.5, 0.08, (0, 0.285, center_z), housing, vertices=24, bevel_width=0.025)

    for index in range(8):
        angle = index * math.pi / 4
        x = math.sin(angle) * 0.86
        z = center_z + math.cos(angle) * 0.86
        add_box(
            f"perimeter brace {index + 1}",
            (x, -0.255, z),
            (0.34, 0.1, 0.12),
            -angle,
            housing,
            bevel_width=0.018,
        )

    add_box("grounded pedestal", (0, 0, 0.16), (0.62, 0.52, 0.28), 0, housing, bevel_width=0.06)
    add_box("pedestal neck", (0, 0, 0.38), (0.3, 0.38, 0.24), 0, housing, bevel_width=0.035)

    bpy.ops.object.select_all(action="SELECT")
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
    print(output_path)


if __name__ == "__main__":
    main()
