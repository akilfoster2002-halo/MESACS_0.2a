# A Tripo model (a T-posed mesh, 0.98 tall) put on the skeleton of one of the game's people (a .glb with a 24-bone
# Mixamo skeleton and its clips), with all those clips — so every scene that moves that person moves the new body.
#   Blender -b --python tools/person-rig.py -- <model.fbx> <person.glb> <out.glb> <height in metres>
# The main thug (KIND big, people/thug-a.glb) is canon+new+rig.zip — red sweatshirt, baggy black jeans — at 1.87.
# How (as tools/kai-rig.py): a copy of theo's skeleton fitted to Canon in his T-pose (each bone turned the least way
# onto his joints), he is skinned to it there, then every bone turned back to theo's rest and his mesh bent with it.
import bpy, sys
from mathutils import Vector
import os
FBX, THEO, OUT, H = sys.argv[sys.argv.index("--")+1:][:4]
LEG = float(os.environ.get("LEG", "1"))                       # longer-legged models: hips and knees raised by this much
S = float(H)/0.98                                            # the model is 0.98 tall
J = {"Hips": (0, 0, 0.50), "Spine": (0, 0, 0.56), "Spine1": (0, 0, 0.63), "Spine2": (0, 0, 0.71), "Neck": (0, 0, 0.80),
     "Head": (0, 0, 0.845), "HeadTop_End": (0, 0, 0.975), "headfront": (0, -0.06, 0.9)}
for sd, s in (("Left", 1), ("Right", -1)):
    m = lambda p: (s*p[0], p[1], p[2])
    J.update({sd + "Shoulder": m((0.04, 0, 0.78)), sd + "Arm": m((0.11, 0, 0.765)), sd + "ForeArm": m((0.205, 0, 0.715)),
        sd + "Hand": m((0.30, 0, 0.675)), sd + "HandIndex1": m((0.33, 0, 0.665)),
        sd + "UpLeg": m((0.07, 0, 0.49)), sd + "Leg": m((0.085, 0, 0.255)), sd + "Foot": m((0.095, 0.01, 0.06)),
        sd + "ToeBase": m((0.10, -0.05, 0.015)), sd + "Toe_End": m((0.10, -0.09, 0.012))})
if os.environ.get("JOINTS"):                                    # a model's own measured joints (left side; mirrored), as Kai's
    import json
    for k, v in json.load(open(os.environ["JOINTS"])).items():
        if k.startswith("Left"): J[k] = tuple(v); J["Right" + k[4:]] = (-v[0], v[1], v[2])
        else: J[k] = tuple(v)
for k in list(J):
    if "UpLeg" in k or k.endswith("Leg") or k == "Hips": J[k] = (J[k][0], J[k][1], min(J[k][2]*LEG, 0.54 if k != "Hips" else 0.545))
nm = lambda b: b.replace("mixamorig:", "")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=THEO)
A = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
for b in A.data.bones:                                   # (some rigs spell them mixamorigHips; the clips follow the rename)
    if b.name.startswith("mixamorig") and not b.name.startswith("mixamorig:"): b.name = "mixamorig:" + b.name[9:]
for o in list(bpy.data.objects):
    if o.type == 'MESH': bpy.data.objects.remove(o)
acts = list(bpy.data.actions)
A.animation_data_clear() if A.animation_data else None
bpy.ops.object.select_all(action='DESELECT'); A.select_set(True); bpy.context.view_layer.objects.active = A
print("PARENT", A.parent, A.matrix_world.to_scale()[:])
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')        # (the .glb hangs it under a node of its own)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
AR = {b.name: b.matrix_local.copy() for b in A.data.bones}
feetA = min(AR[n].translation.z for n in AR if "Toe" in n or "Foot" in n)
hA = AR["mixamorig:Hips"].translation.z - feetA
missing = [b for b in AR if nm(b) not in J]; print("MISSING", missing)
bpy.ops.object.mode_set(mode='EDIT')
E = A.data.edit_bones; T = {}
for e in E:
    h = Vector(J[nm(e.name)])*S
    kids = [c for c in e.children]
    ad = (AR[e.name].to_3x3() @ Vector((0, 1, 0))).normalized()
    t = Vector(J[nm(kids[0].name)])*S if kids else h + ad*0.04
    rot = ad.rotation_difference((t - h).normalized()).to_matrix() @ AR[e.name].to_3x3().normalized()
    T[e.name] = (h, t, rot)
for e in E:
    h, t, rot = T[e.name]; e.use_connect = False
    M = rot.to_4x4(); M.translation = h; e.matrix = M; e.length = max((t - h).length, 0.02)
bpy.ops.object.mode_set(mode='OBJECT')
before = set(bpy.data.objects); bpy.ops.import_scene.fbx(filepath=FBX)
ob = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]; ob.name = "char1"
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
C = Vector(((min(xs) + max(xs))/2, (min(ys) + max(ys))/2, min(zs))); K = 0.98/(max(zs) - min(zs))
print("CENTRE", C, "SCALE", K)                                  # (some exports sit off the origin, or not 0.98 tall)
for v in ob.data.vertices: v.co = (v.co - C)*K*S
d = ob.modifiers.new("d", 'DECIMATE'); d.ratio = 0.03; bpy.ops.object.modifier_apply(modifier="d")
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.001); bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); A.select_set(True); bpy.context.view_layer.objects.active = A
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print("UNWEIGHTED", sum(1 for v in ob.data.vertices if not v.groups), "OF", len(ob.data.vertices))
# back to theo's rest, the mesh bent with it
bpy.ops.object.select_all(action='DESELECT'); A.select_set(True); bpy.context.view_layer.objects.active = A
bpy.ops.object.mode_set(mode='POSE')
def depth(b): return 0 if b.parent is None else 1 + depth(b.parent)
for pb in sorted(A.pose.bones, key=depth):
    bpy.context.view_layer.update()
    M = AR[pb.name].to_3x3().normalized().to_4x4(); M.translation = pb.head.copy(); pb.matrix = M
bpy.context.view_layer.update(); bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
mod = [m for m in ob.modifiers if m.type == 'ARMATURE'][0]; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action='DESELECT'); A.select_set(True); bpy.context.view_layer.objects.active = A
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
m2 = ob.modifiers.new("Armature", 'ARMATURE'); m2.object = A; ob.parent = A
# the clips' hips moves, scaled to his legs; his feet on the floor
hK = A.data.bones["mixamorig:Hips"].head_local.z - min(b.head_local.z for b in A.data.bones if "Toe" in b.name or "Foot" in b.name)
LOC = 0.01*hK/hA                                       # (the clips keep the hips in centimetres)
def bags(ac):
    for ly in ac.layers:
        for st in ly.strips:
            for cb in st.channelbags: yield cb
for ac in acts:
    for cb in bags(ac):
        for i in range(3):
            fc = cb.fcurves.find('pose.bones["mixamorig:Hips"].location', index=i)
            if fc is None: continue
            for k in fc.keyframe_points: k.co[1] *= LOC; k.handle_left[1] *= LOC; k.handle_right[1] *= LOC
            fc.update()
ad = A.animation_data or A.animation_data_create()
for ac in acts:
    tr = ad.nla_tracks.new(); tr.name = ac.name; st = tr.strips.new(ac.name, int(ac.frame_range[0]), ac)
    if len(ac.slots): st.action_slot = ac.slots[0]
# stand him on the floor: his feet in the idle, wherever they came out, put at z = 0 in every clip
ref = [a for a in acts if a.name.startswith("idle")][0]
ad.action = ref
if len(ref.slots): ad.action_slot = ref.slots[0]
bpy.context.scene.frame_set(int(ref.frame_range[0])); bpy.context.view_layer.update()
lift = min((A.matrix_world @ pb.head).z for pb in A.pose.bones if "Toe" in pb.name or "Foot" in pb.name) - 0.03
Rh = A.data.bones["mixamorig:Hips"].matrix_local.to_3x3().normalized()
hp = A.matrix_world @ A.pose.bones["mixamorig:Hips"].head          # (and over the origin: some clips carry the hips off to one side)
down = Rh.inverted() @ Vector((-hp.x, -hp.y, -lift))
for ac in acts:
    for cb in bags(ac):
        for i in range(3):
            fc = cb.fcurves.find('pose.bones["mixamorig:Hips"].location', index=i)
            if fc is None: continue
            for k in fc.keyframe_points: k.co[1] += down[i]; k.handle_left[1] += down[i]; k.handle_right[1] += down[i]
            fc.update()
print("LIFT", lift)
ad.action = None
print("CLIPS", sorted(a.name for a in acts), "LOC", LOC)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=False)
