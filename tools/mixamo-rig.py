# A rigged Tripo export (its own Mixamo-named skeleton and skin weights, fingers and all) given the game's clips from
# Mixamo .fbx files, bone by bone: each bone turned in the world as the clip's bone turns from its T-pose, so the
# two skeletons' bone axes need not agree. The hips go where the clip's go, scaled to these legs; walks, runs and
# strafes have their travel taken out (the game moves people itself).
#   Blender -b --python tools/mixamo-rig.py -- <rigged.fbx> <out.glb> <height in metres> <set: person|fighter|both>
import bpy, sys, os
from mathutils import Matrix, Vector, Quaternion
FBX, OUT, H, SET = sys.argv[sys.argv.index("--")+1:][:4]
AN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations")
PERSON = {"idle": "kyle/Idle.fbx", "walk": "kyle/Standard Walk.fbx", "sprint": "kyle/Running (2).fbx", "jump": "kyle/Jumping.fbx",
    "dance": "kyle/Swing Dancing.fbx", "talk": "talk on phone/Talking.fbx", "talk2": "talk on phone/Talking.fbx",
    "ride": "rigs/Sitting Idle.fbx", "swim": "rigs/Swimming.fbx", "fly": "rigs/Flying.fbx", "salsa": "rigs/Salsa Dancing.fbx",
    "flip": "rigs/flip copy.fbx", **{n: "rigs/locomotion/%s.fbx" % n for n in ("walk_back", "walk_left", "walk_right", "sprint_back", "sprint_left", "sprint_right")}}
FIGHTER = {k: PERSON[k] for k in ("idle", "walk", "sprint", "talk", "talk2", "walk_back", "walk_left", "walk_right")}
FIGHTER.update({"fight": "NoisyBoy/Bouncing Fight Idle.fbx", "jab": "NoisyBoy/Punching.fbx", "cross": "NoisyBoy/Cross Punch.fbx",
    "hook": "NoisyBoy/Hook Punch.fbx", "kick": "NoisyBoy/Kicking.fbx", "block": "NoisyBoy/Block.fbx", "hit": "NoisyBoy/Taking Punch.fbx",
    "stagger": "NoisyBoy/Receive Uppercut To The Face.fbx", "ko": "NoisyBoy/Sweep Fall.fbx", "fall": "NoisyBoy/Dying.fbx",
    "getup": "NoisyBoy/Crouch To Stand.fbx", "roar": "NoisyBoy/Mutant Roaring.fbx"})
CLIPS = PERSON if SET == "person" else FIGHTER if SET == "fighter" else {**PERSON, **FIGHTER}      # both: a person who also fights (the Director)
TRAVEL = {"walk", "sprint", "walk_back", "walk_left", "walk_right", "sprint_back", "sprint_left", "sprint_right", "swim", "fly"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)
T = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for a in list(bpy.data.actions): bpy.data.actions.remove(a)       # (Tripo's own sample clip)
if T.animation_data: T.animation_data_clear()
ms = [o for o in bpy.data.objects if o.type == 'MESH']
# its size: the tallest point of the mesh at H metres, its feet on the floor
bpy.context.view_layer.update()
zs = [(o.matrix_world @ v.co).z for o in ms for v in o.data.vertices]
k = float(H)/(max(zs) - min(zs))
T.scale = T.scale*k; bpy.context.view_layer.update()
zs = [(o.matrix_world @ v.co).z for o in ms for v in o.data.vertices]
T.location.z -= min(zs); bpy.context.view_layer.update()
W = T.matrix_world.copy(); Wr = W.to_quaternion(); Wri = Wr.inverted()
TB = T.data.bones
rest_w = {b.name: (W @ b.matrix_local).to_quaternion() for b in TB}             # each bone's rest turn, in the world
hipsT = (W @ TB["mixamorig:Hips"].head_local)
footT = min((W @ b.head_local).z for b in TB if "Foot" in b.name)
def order(bs):
    out = []; seen = set()
    def go(b):
        if b.name in seen: return
        if b.parent: go(b.parent)
        seen.add(b.name); out.append(b)
    for b in bs: go(b)
    return out
ORD = order(list(TB))

def clip(name, path):
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.join(AN, path))
    new = [o for o in bpy.data.objects if o not in before]
    S = [o for o in new if o.type == 'ARMATURE'][0]
    src = [a for a in bpy.data.actions if a not in acts0][0]
    S.animation_data.action = src
    f0, f1 = int(src.frame_range[0]), int(src.frame_range[1])
    sc = bpy.context.scene; sc.frame_set(f0)
    SW = S.matrix_world.copy()
    SB = S.data.bones
    srest_w = {b.name: (SW @ b.matrix_local).to_quaternion() for b in SB}
    # NoisyBoy's clips, whose rest is not a T-pose (his arms hang): each bone's rest turned onto ours first
    C = {}
    for b in SB:
        if b.name not in TB or not path.startswith("NoisyBoy/"): continue
        ds = ((SW @ b.matrix_local).to_3x3() @ Vector((0, 1, 0))).normalized()
        dt = ((W @ TB[b.name].matrix_local).to_3x3() @ Vector((0, 1, 0))).normalized()
        C[b.name] = dt.rotation_difference(ds)
    # the clip's hips measured from its own feet on its first frame (some clips' rest is nowhere near where they stand)
    hp0 = SW @ S.pose.bones["mixamorig:Hips"].matrix.translation
    ground = min((SW @ pb.head).z for pb in S.pose.bones if "Foot" in pb.name or "Toe" in pb.name)
    ratio = (hipsT.z - footT)/max(1e-6, hp0.z - ground)
    act = bpy.data.actions.new(name); T.animation_data_create(); T.animation_data.action = act
    frames = list(range(f0, f1 + 1))
    hip_d = []
    pose = {}
    for f in frames:
        sc.frame_set(f)
        P = {}
        for b in ORD:
            pb = S.pose.bones.get(b.name)
            if pb is None or b.name not in srest_w: continue
            P[b.name] = (SW @ pb.matrix).to_quaternion() @ srest_w[b.name].inverted() @ C.get(b.name, Quaternion())   # the clip's bone's turn from a T-pose
        hp = SW @ S.pose.bones["mixamorig:Hips"].matrix.translation
        hip_d.append(Vector(((hp.x - hp0.x)*ratio, (hp.y - hp0.y)*ratio, footT + (hp.z - ground)*ratio - hipsT.z)))
        pose[f] = P
    if name in TRAVEL:                                         # travel out: the drift from first frame to last, taken away
        n = len(hip_d) - 1
        a, z = hip_d[0].copy(), hip_d[-1].copy()
        for i in range(len(hip_d)):
            t = i/max(1, n); hip_d[i] = Vector((hip_d[i].x - a.x - (z.x - a.x)*t, hip_d[i].y - a.y - (z.y - a.y)*t, hip_d[i].z))
    for i, f in enumerate(frames):
        P = pose[f]; arm = {}
        for b in ORD:
            d = P.get(b.name)
            wq = (d @ rest_w[b.name]) if d is not None else None
            if wq is None:                                     # a bone the clip lacks: held at rest under its parent
                par = arm.get(b.parent.name) if b.parent else None
                rl = (b.parent.matrix_local.inverted() @ b.matrix_local).to_quaternion() if b.parent else b.matrix_local.to_quaternion()
                arm[b.name] = (par @ rl) if par is not None else b.matrix_local.to_quaternion(); continue
            aq = Wri @ wq; arm[b.name] = aq                    # in the armature's space
            pb = T.pose.bones[b.name]
            if b.parent:
                rest_rel = (b.parent.matrix_local.inverted() @ b.matrix_local).to_quaternion()
                q = rest_rel.inverted() @ arm[b.parent.name].inverted() @ aq
            else:
                q = b.matrix_local.to_quaternion().inverted() @ aq
            pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f - f0 + 1)
        hb = T.pose.bones["mixamorig:Hips"]; hr = TB["mixamorig:Hips"].matrix_local
        dl = (W.inverted().to_3x3() @ hip_d[i])                # the hips' move, in the armature's space, then the bone's
        hb.location = hr.to_3x3().inverted() @ dl
        hb.keyframe_insert("location", frame=f - f0 + 1)
    T.animation_data.action = None
    tr = T.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 1, act)
    if len(act.slots): st.action_slot = act.slots[0]
    for o in new: bpy.data.objects.remove(o)
    bpy.data.actions.remove(src)
    print("CLIP", name, len(frames))

for nm, p in CLIPS.items(): clip(nm, p)
for pb in T.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=False)
print("DONE", OUT)
