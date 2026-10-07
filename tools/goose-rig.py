# Rigs animations/mia/goose/source/goose_low.obj and exports public/tsh/monster/goose.glb (the Maya monster's skeleton).
# Run from animations/mia/goose:  ffmpeg -i textures/Material.001_Normal_DirectX.png -vf lutrgb=g=negval <dir>/normal_gl.png
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/goose-rig.py -- <dir>/goose.glb
import bpy, bmesh, math, os, sys, mathutils
from mathutils import Vector
OUT = sys.argv[-1]; S = os.path.dirname(OUT)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=os.path.abspath("source/goose_low.obj"))
ob = [o for o in bpy.context.scene.objects if o.type=='MESH'][0]; ob.name = "Goose"
K, Z0 = 0.22, -19.976                              # metres per unit; the floor
T = lambda p: Vector(((p[0])*K, (p[1])*K, (p[2]-Z0)*K))
# bake the import transform and our scale into the mesh
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for v in ob.data.vertices: v.co = T(v.co)
# material: colour, normal (flipped to OpenGL), roughness, metal
m = bpy.data.materials.new("GooseSkin"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
def img(path, nonc=False):
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(path)
    if nonc: t.image.colorspace_settings.name = 'Non-Color'
    return t
nt.links.new(img(os.path.abspath("textures/Material.001_Base_Color.png")).outputs[0], b.inputs["Base Color"])
nt.links.new(img(os.path.abspath("textures/Material.001_Roughness.png"), True).outputs[0], b.inputs["Roughness"])
nt.links.new(img(os.path.abspath("textures/Material.001_Metallic.png"), True).outputs[0], b.inputs["Metallic"])
nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(img(S + "/normal_gl.png", True).outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
ob.data.materials.clear(); ob.data.materials.append(m)
# THE SKELETON (front is -Y)
arm = bpy.data.armatures.new("GooseRig"); ao = bpy.data.objects.new("GooseRig", arm); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
E = arm.edit_bones
def bone(name, a, c, parent=None, connect=False):
    e = E.new(name); e.head = T(a); e.tail = T(c)
    if parent: e.parent = E[parent]; e.use_connect = connect
    return e
bone("Hips",  (0, 8.6, -8.4), (0, 6.2, -6.0))
bone("Spine", (0, 6.2, -6.0), (0, 3.6, -3.4), "Hips", True)
bone("Chest", (0, 3.6, -3.4), (0, 1.2, -1.2), "Spine", True)
bone("Neck",  (0, 1.2, -1.2), (0, 0.2, 0.4), "Chest", True)
bone("Head",  (0, 0.2, 0.4), (0, -0.6, 2.9), "Neck", True)
for s, sd in ((1, "L"), (-1, "R")):
    bone("Shoulder."+sd, (s*0.6, 1.4, -1.6), (s*2.4, 1.0, -1.7), "Chest")
    bone("UpperArm."+sd, (s*2.4, 1.0, -1.7), (s*4.4, 0.6, -10.0), "Shoulder."+sd, True)
    bone("Forearm."+sd,  (s*4.4, 0.6, -10.0), (s*6.4, -4.6, -20.0), "UpperArm."+sd, True)
    bone("Thigh."+sd, (s*2.0, 8.8, -8.8), (s*3.8, 5.6, -14.6), "Hips")
    bone("Shin."+sd,  (s*3.8, 5.6, -14.6), (s*5.0, 13.0, -15.2), "Thigh."+sd, True)
    bone("Foot."+sd,  (s*5.0, 13.0, -15.2), (s*5.4, 13.3, -19.4), "Shin."+sd, True)
bpy.ops.object.mode_set(mode='OBJECT')
# skin it
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active = ao
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print("GROUPS", len(ob.vertex_groups), "UNWEIGHTED", sum(1 for v in ob.data.vertices if not v.groups))
# export
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=False, export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=False)
