# Kai: the Tripo soldier (military+character+3d+model.zip) rigged on the Mixamo skeleton his great-sword clips came on,
# the sword (sword-fbx.zip) in his right hand, and those clips under the names fight.gd plays. Exports
# koro-godot/assets/tsh/people/kai.glb.
#   Blender -b --python tools/kai-rig.py -- <kai.fbx> <Sword_FBX.fbx> <dir of the Mixamo .fbx clips> <out.glb>
# How: a copy of the clips' skeleton is fitted to Kai standing in his T-pose (each bone turned the least way onto his
# joints, so its twist is kept), he is skinned to it there, then every bone is turned back to the clips' own rest and
# his mesh bent with it — so the clips play on him as made.
import bpy, sys, os
from mathutils import Vector, Matrix
KAI, SWORD, ANIMS, OUT = sys.argv[-4:]
S = 1.89                                                     # the model is 0.98 tall; Kai is 1.85
J = {"Hips": (0, 0, 0.569), "Spine": (0, 0, 0.62), "Spine1": (0, 0, 0.68), "Spine2": (0, 0, 0.75), "Neck": (0, -0.005, 0.825),
     "Head": (0, -0.01, 0.856), "HeadTop_End": (0, -0.01, 0.98)}
for sd, s in (("Left", 1), ("Right", -1)):
    m = lambda p: (s*p[0], p[1], p[2])
    J.update({sd + "Shoulder": m((0.035, 0, 0.80)), sd + "Arm": m((0.10, 0.005, 0.794)), sd + "ForeArm": m((0.206, 0.01, 0.763)),
        sd + "Hand": m((0.306, 0.01, 0.738)), sd + "HandIndex1": m((0.335, 0.0, 0.733)), sd + "HandIndex2": m((0.345, 0.0, 0.731)),
        sd + "HandIndex3": m((0.353, 0.0, 0.729)), sd + "HandIndex4": m((0.36, 0.0, 0.727)),
        sd + "UpLeg": m((0.05, 0, 0.55)), sd + "Leg": m((0.08, -0.005, 0.30)), sd + "Foot": m((0.105, 0.01, 0.11)),
        sd + "ToeBase": m((0.11, -0.05, 0.025)), sd + "Toe_End": m((0.11, -0.10, 0.02))})
CLIPS = {"Withdrawing Sword": "draw", "Sheathing Sword": "sheath", "Great Sword Walk": "walk", "Great Sword Run": "sprint", "Great Sword Strafe": "walk_left",
    "Great Sword Slash": "hook", "Great Sword Slash (1)": "cross", "Great Sword Kick": "kick", "Sword And Shield Death": "fall"}
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(path):
    before = set(bpy.data.objects); acts = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path)
    return [o for o in bpy.data.objects if o not in before], [a for a in bpy.data.actions if a not in acts]
# the clips' skeleton (A), its own transform baked in
objs, acts = imp(os.path.join(ANIMS, "Withdrawing Sword.fbx"))
A = [o for o in objs if o.type == 'ARMATURE'][0]
for o in objs:
    if o.type == 'MESH': bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); A.select_set(True); bpy.context.view_layer.objects.active = A
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
nm = lambda b: b.replace("mixamorig:", "")
AR = {b.name: b.matrix_local.copy() for b in A.data.bones}
feet = min(AR[n].translation.z for n in AR if "Toe" in n or "Foot" in n)
hA = AR["mixamorig:Hips"].translation.z - feet
# Kai's skeleton (K): A's, fitted to him
K = A.copy(); K.data = A.data.copy(); K.animation_data_clear(); bpy.context.scene.collection.objects.link(K); K.name = "Kai"
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = K; K.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
E = K.data.edit_bones; T = {}
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
KT = {b.name: b.matrix_local.copy() for b in K.data.bones}
# Kai's mesh
objs, _ = imp(KAI); ob = [o for o in objs if o.type == 'MESH'][0]; ob.name = "KaiBody"
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for v in ob.data.vertices: v.co = v.co*S
d = ob.modifiers.new("d", 'DECIMATE'); d.ratio = 0.03; bpy.ops.object.modifier_apply(modifier="d")
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.001); bpy.ops.object.mode_set(mode='OBJECT')
# the sword: its grip in his right fist, the blade forward
objs, _ = imp(SWORD); sw = [o for o in objs if o.type == 'MESH'][0]; sw.name = "Sword"
bpy.ops.object.select_all(action='DESELECT'); sw.select_set(True); bpy.context.view_layer.objects.active = sw
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
grip = Vector((0.084, 0.0, 0.0745)); fist = Vector((-0.335, -0.01, 0.728))*S
Rz = Matrix.Rotation(1.5708, 3, 'Z')
for v in sw.data.vertices: v.co = Rz @ ((v.co - grip)*7.0) + fist
# skin him in his T-pose
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); K.select_set(True); bpy.context.view_layer.objects.active = K
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print("UNWEIGHTED", sum(1 for v in ob.data.vertices if not v.groups), "OF", len(ob.data.vertices))
# turn every bone back to the clips' rest, bend him with it, and make that his rest
bpy.ops.object.select_all(action='DESELECT'); K.select_set(True); bpy.context.view_layer.objects.active = K
bpy.ops.object.mode_set(mode='POSE')
def depth(b): return 0 if b.parent is None else 1 + depth(b.parent)
for pb in sorted(K.pose.bones, key=depth):
    bpy.context.view_layer.update()
    M = AR[pb.name].to_3x3().normalized().to_4x4(); M.translation = pb.head.copy(); pb.matrix = M
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
mod = [m for m in ob.modifiers if m.type == 'ARMATURE'][0]; bpy.ops.object.modifier_apply(modifier=mod.name)
hand = "mixamorig:RightHand"; handPosed = K.matrix_world @ K.pose.bones[hand].matrix
swM = handPosed @ (K.matrix_world @ KT[hand]).inverted()
bpy.ops.object.select_all(action='DESELECT'); K.select_set(True); bpy.context.view_layer.objects.active = K
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
# HIS FACE: morph targets as Robin's are (jawOpen, mouthO, smile, frown, browUp, browDown, blink), sculpted where his
# face is (measured on him standing, in his own 0..1 units) and carried onto his head as it now stands
import math
headM = (K.matrix_world @ K.data.bones["mixamorig:Head"].matrix_local) @ (K.matrix_world @ KT["mixamorig:Head"]).inverted()
HR = headM.to_3x3()
F = lambda p: Vector(p)*S
EYE = {"L": F((0.0185, -0.0435, 0.9025)), "R": F((-0.019, -0.0435, 0.902))}; EYE_R = 0.0088*S
MOUTH = F((0, -0.057, 0.8705)); CORNER = {"L": F((0.0135, -0.053, 0.8705)), "R": F((-0.0135, -0.053, 0.8705))}
BROW = {"L": F((0.019, -0.051, 0.9095)), "R": F((-0.019, -0.051, 0.9095))}; LID = {k: v + F((0, -0.004, 0.0035)) for k, v in EYE.items()}
JAW = F((0, -0.002, 0.886)); CHIN = F((0, -0.052, 0.857))
tpose = {v.index: headM.inverted() @ v.co for v in ob.data.vertices}           # each vertex where it stood in the T-pose
def near(p, c, r): return math.exp(-((p - c).length/r)**2)
face = lambda p: p.y < -0.03*S and abs(p.x) < 0.045*S and 0.835*S < p.z < 0.93*S
ob.shape_key_add(name="Basis")
def key(name, f):
    k = ob.shape_key_add(name=name, from_mix=False)
    for v in ob.data.vertices:
        p = tpose[v.index]
        if not face(p): continue
        d = f(p)
        if d is not None and d.length > 1e-7: k.data[v.index].co = v.co + HR @ d
def jaw(p):
    if p.z > MOUTH.z + 0.0015*S: return None
    w = min(1.0, (MOUTH.z + 0.0015*S - p.z)/(0.006*S))
    q = Matrix.Rotation(math.radians(24)*w, 3, 'X') @ (p - JAW) + JAW
    return q - p
key("jawOpen", jaw)
key("mouthO", lambda p: (Vector((-(p.x - MOUTH.x)*0.7, -0.008*S, 0)))*near(p, MOUTH, 0.019*S))
key("smile", lambda p: sum((Vector((0.0055*S*(1 if k == "L" else -1), 0.003*S, 0.009*S))*near(p, c, 0.013*S) for k, c in CORNER.items()), Vector()))
key("frown", lambda p: sum((Vector((0.001*S*(1 if c.x > 0 else -1), 0, -0.008*S))*near(p, c, 0.013*S) for c in CORNER.values()), Vector()))
key("browUp", lambda p: sum((Vector((0, -0.001*S, 0.0085*S))*near(p, c, 0.015*S) for c in BROW.values()), Vector()))
key("browDown", lambda p: sum((Vector((-0.003*S*(1 if k == "L" else -1), -0.002*S, -0.0065*S))*near(p, c, 0.014*S) for k, c in BROW.items()), Vector()))
key("blink", lambda p: sum((Vector((0, -0.002*S, -0.0085*S))*near(p, c, 0.0075*S) for c in LID.values()), Vector()))
# EYEBALLS that turn: white, an iris, a pupil — set in his sockets, on his head bone
def eyeball(side):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=EYE_R, location=(0, 0, 0))
    e = bpy.context.active_object; e.name = "Eye" + side
    col = e.data.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for v in e.data.vertices:
        c = (-v.co.y)/EYE_R                                     # facing forward (-Y)
        col.data[v.index].color = (0.01, 0.01, 0.01, 1) if c > 0.955 else ((0.2, 0.11, 0.05, 1) if c > 0.8 else ((0.1, 0.06, 0.03, 1) if c > 0.78 else (0.86, 0.84, 0.8, 1)))
    m = bpy.data.materials.new("Eye"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    at = nt.nodes.new("ShaderNodeVertexColor"); at.layer_name = "Col"; nt.links.new(at.outputs[0], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.15
    e.data.materials.append(m)
    e.matrix_world = headM @ Matrix.Translation(EYE[side])
    keep = e.matrix_world.copy(); e.parent = K; e.parent_type = 'BONE'; e.parent_bone = "mixamorig:Head"; bpy.context.view_layer.update(); e.matrix_world = keep
eyeball("L"); eyeball("R")
bpy.ops.object.select_all(action='DESELECT')
m2 = ob.modifiers.new("Armature", 'ARMATURE'); m2.object = K; ob.parent = K
sw.matrix_world = swM @ sw.matrix_world
bpy.context.view_layer.update()
keep = sw.matrix_world.copy(); sw.parent = K; sw.parent_type = 'BONE'; sw.parent_bone = hand; bpy.context.view_layer.update(); sw.matrix_world = keep
# the clips
bpy.data.objects.remove(A)
hK = K.data.bones["mixamorig:Hips"].head_local.z - min(b.head_local.z for b in K.data.bones if "Toe" in b.name or "Foot" in b.name)
LOC = 0.01*hK/hA
Rh = K.data.bones["mixamorig:Hips"].matrix_local.to_3x3().normalized()
def bags(ac):
    for ly in ac.layers:
        for st in ly.strips:
            for cb in st.channelbags: yield cb
out = {}; ref = [None]                                       # his height standing, sword drawn (the end of the draw): the clips' up and down is from that
for f, name in CLIPS.items():
    objs, acts = imp(os.path.join(ANIMS, f + ".fbx"))
    ac = acts[0]; ac.name = name; out[name] = ac
    for o in objs: bpy.data.objects.remove(o)
    for cb in bags(ac):
        fc = [cb.fcurves.find('pose.bones["mixamorig:Hips"].location', index=i) for i in range(3)]
        if not all(fc): continue
        if ref[0] is None: ref[0] = (Rh @ (Vector([c.keyframe_points[-1].co[1] for c in fc])*LOC)).z
        for k in range(len(fc[0].keyframe_points)):
            v = Vector([fc[i].keyframe_points[k].co[1] for i in range(3)])*LOC
            w = Rh @ v; w.x = 0.0; w.y = 0.0; w.z -= ref[0]      # stays where the game puts him: only up and down
            v = Rh.inverted() @ w
            for i in range(3): fc[i].keyframe_points[k].co[1] = v[i]
        for c in fc: c.update()
def derive(src, name, how, a=None, b=None):
    ac = out[src].copy(); ac.name = name; out[name] = ac
    f0, f1 = out[src].frame_range
    for cb in bags(ac):
        for fc in cb.fcurves:
            pts = [(p.co[0], p.co[1]) for p in fc.keyframe_points]
            if how == "hold":
                v = fc.evaluate(f1 if a is None else a); pts = [(1.0, v), (30.0, v)]
            elif how == "rev": pts = [(f0 + f1 - x, y) for x, y in pts][::-1]
            elif how == "cut": pts = [(x, y) for x, y in pts if a <= x <= b]
            fc.keyframe_points.clear()
            for x, y in pts: k = fc.keyframe_points.insert(x, y, options={'FAST'}); k.interpolation = 'LINEAR'
            fc.update()
f0, f1 = out["draw"].frame_range
derive("draw", "idle", "hold"); derive("draw", "fight", "hold"); derive("draw", "talk", "hold"); derive("draw", "block", "hold")
derive("walk", "walk_back", "rev"); derive("walk_left", "walk_right", "rev")
derive("cross", "jab", "cut", *out["cross"].frame_range)
d0, d1 = out["fall"].frame_range
derive("fall", "ko", "hold"); derive("fall", "getup", "rev"); derive("fall", "hit", "cut", d0, d0 + 14); derive("fall", "stagger", "cut", d0, d0 + 18)
ad = K.animation_data or K.animation_data_create()
# stand him on the floor: his feet at the end of the draw, wherever they came out, put at z = 0 in every clip
ad.action = out["draw"]
if len(out["draw"].slots): ad.action_slot = out["draw"].slots[0]
bpy.context.scene.frame_set(int(out["draw"].frame_range[1])); bpy.context.view_layer.update()
lift = min((K.matrix_world @ p.head).z for p in K.pose.bones if "Toe" in p.name or "Foot" in p.name)
down = Rh.inverted() @ Vector((0, 0, -lift + 0.02))
for ac in out.values():
    for cb in bags(ac):
        for i in range(3):
            fc = cb.fcurves.find('pose.bones["mixamorig:Hips"].location', index=i)
            if fc is None: fc = cb.fcurves.new('pose.bones["mixamorig:Hips"].location', index=i, group_name="mixamorig:Hips"); fc.keyframe_points.insert(1, 0.0)
            for k in fc.keyframe_points: k.co[1] += down[i]; k.handle_left[1] += down[i]; k.handle_right[1] += down[i]
            fc.update()
ad.action = None
print("LIFT", lift)
for name, ac in out.items():
    tr = ad.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, int(ac.frame_range[0]), ac)
    if len(ac.slots): st.action_slot = ac.slots[0]
ad.action = None
print("CLIPS", sorted(out))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=False)
