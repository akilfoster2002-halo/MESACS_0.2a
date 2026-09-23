"""THE PANDA, RIGGED — a four-legged skeleton on the Higgsfield/Meshy mesh.

    /Applications/Blender.app/Contents/MacOS/Blender -b --python rig_panda.py

Meshy's auto-rigger only knows humans: two legs, two arms, a Mixamo-shaped
skeleton, and a library of 678 clips every one of which is a person. On a
panda that is a bear standing up. So the rig is made here, by hand:

  root ── hips ── chest ── head
            │        └── FL_up ─ FL_lo,  FR_up ─ FR_lo
            └── BL_up ─ BL_lo,  BR_up ─ BR_lo

The weights are computed, not painted and not Blender's bone-heat: a
generated mesh is one shell with no clean topology between the legs, and
heat weighting on it either fails or glues a leg to the belly. A panda's
legs are four columns under a barrel, so a vertex belongs to a leg if it is
low and near that leg's axis, and to the body otherwise — split front to back
between chest and hips, and forward of the neck to the head.

Two clips: Walk (a diagonal gait — front-left with back-right — one stride a
second) and Idle (looking about and breathing). Out to ../../public/wano/
panda.glb at 1024 texture; tools then meshopt it (see README in this folder).

Axes: Blender Z up, the panda's nose at -Y. glTF export turns that into the
game's Y up with the nose at +Z, which is the way a beast walks there.
"""
import bpy, math, os
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, 'panda.raw.glb')
OUT  = os.path.join(HERE, 'panda.rigged.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
# flatten whatever node transform the import left on it
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o is not mesh: bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- measured
# (probe.py): ground at z=-0.65, back at ~0.5, head top 0.65 with the ears.
GROUND = -0.65
LEGS = {                     # x, y of each foot column
    'FL': (-0.22, -0.36), 'FR': (0.22, -0.36),
    'BL': (-0.26,  0.58), 'BR': (0.26,  0.58),
}
TOP, KNEE = 0.02, -0.34      # shoulder / hip joint height, knee height

# ---------------------------------------------------------------- skeleton
arm_data = bpy.data.armatures.new('PandaRig')
arm = bpy.data.objects.new('PandaRig', arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, h, t, parent=None):
    b = eb.new(name); b.head = Vector(h); b.tail = Vector(t)
    if parent: b.parent = eb[parent]
    return b
bone('root',  (0, 0.1, GROUND), (0, 0.1, GROUND + 0.3))
bone('hips',  (0, 0.45, 0.10), (0, 0.02, 0.12), 'root')
bone('chest', (0, 0.02, 0.12), (0, -0.45, 0.18), 'hips')
bone('head',  (0, -0.50, 0.22), (0, -0.92, 0.30), 'chest')
for k, (x, y) in LEGS.items():
    par = 'chest' if k[0] == 'F' else 'hips'
    bone(k + '_up', (x, y, TOP),  (x, y, KNEE), par)
    bone(k + '_lo', (x, y, KNEE), (x, y, GROUND + 0.03), k + '_up')
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- weights
def ss(a, b, x):             # smoothstep from a to b (either direction)
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

groups = {b.name: mesh.vertex_groups.new(name=b.name) for b in arm_data.bones if b.name != 'root'}
for v in mesh.data.vertices:
    p = v.co
    w = {}
    # the nearest leg column, measured as an ellipse (paws reach forward)
    best, bd = None, 9
    for k, (x, y) in LEGS.items():
        d = math.hypot((p.x - x) / 0.20, (p.y - y) / 0.24)
        if d < bd: best, bd = k, d
    leg = 0.0
    if bd < 1.25:
        leg = ss(-0.08, -0.30, p.z) * ss(1.25, 0.95, bd)
    if leg > 0:
        lo = ss(-0.26, -0.42, p.z)
        w[best + '_up'] = leg * (1 - lo)
        w[best + '_lo'] = leg * lo
    body = 1 - leg
    if body > 0:
        hd = ss(-0.48, -0.64, p.y) * ss(-0.05, 0.12, p.z)   # the head, not the paws under it
        ch = ss(0.32, -0.10, p.y)
        w['head']  = body * hd
        w['chest'] = body * (1 - hd) * ch
        w['hips']  = body * (1 - hd) * (1 - ch)
    for n, x in w.items():
        if x > 1e-4: groups[n].add([v.index], x, 'REPLACE')

mesh.parent = arm
mod = mesh.modifiers.new('Armature', 'ARMATURE'); mod.object = arm

# ---------------------------------------------------------------- posing
"""Rotations are written about WORLD axes and converted into each bone's own
frame, so "swing the leg forward" is one sign for all four legs whatever
roll Blender gave each bone. Forward is -Y, so a negative turn about +X
carries a foot forward."""
rest = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
def rot(pb, axis, ang):
    B = rest[pb.name]
    R = Matrix.Rotation(ang, 3, axis)
    return (B.inverted() @ R @ B).to_quaternion()
def key(pb, frame, *turns, loc=None):
    q = Quaternion()
    for axis, ang in turns: q = rot(pb, axis, ang) @ q
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = q
    pb.keyframe_insert('rotation_quaternion', frame=frame)
    if loc is not None:
        pb.location = loc; pb.keyframe_insert('location', frame=frame)

X, Y, Z = 'X', 'Y', 'Z'
P = arm.pose.bones
FPS = 24
bpy.context.scene.render.fps = FPS
arm.animation_data_create()

def clip(name, frames, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data.action = act
    for pb in P: pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
    for f in range(frames + 1):
        fn(f / frames, f)
    for fc in getattr(act, 'fcurves', []):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    tr = arm.animation_data.nla_tracks.new(); tr.name = name
    tr.strips.new(name, 1, act); tr.mute = True
    arm.animation_data.action = None
    return act

TAU = 2 * math.pi
PHASE = {'FL': 0.0, 'BR': 0.0, 'FR': 0.5, 'BL': 0.5}   # diagonal pairs
def walk(t, f):
    for k, ph in PHASE.items():
        a = TAU * (t + ph)
        swing = -0.38 * math.sin(a)                   # forward at the top of the arc
        lift = max(0.0, math.cos(a))                  # swinging through: knee folds
        key(P[k + '_up'], f, (X, swing))
        key(P[k + '_lo'], f, (X, 0.55 * lift * (1 if k[0] == 'B' else 0.8)))
    # the barrel rolls towards whichever side is standing, and dips twice a stride
    key(P['root'], f, (Y, 0.06 * math.sin(TAU * t)),
        loc=(0, 0.03 * abs(math.sin(TAU * t)), 0))    # root points up: its local Y is world Z
    key(P['chest'], f, (Z, 0.05 * math.sin(TAU * t)))
    key(P['head'], f, (X, 0.06 * math.sin(2 * TAU * t)), (Z, -0.06 * math.sin(TAU * t)))
    key(P['hips'], f, (Z, -0.04 * math.sin(TAU * t)))

def idle(t, f):
    for k in PHASE:
        key(P[k + '_up'], f); key(P[k + '_lo'], f)
    key(P['root'], f, loc=(0, 0.012 * math.sin(TAU * t * 2), 0))   # breathing
    key(P['hips'], f)
    key(P['chest'], f, (X, 0.015 * math.sin(TAU * t * 2)))
    # a slow look to one side, back, and down at something on the ground
    look = 0.45 * math.sin(TAU * t)
    nod = -0.18 * max(0.0, math.sin(TAU * (t - 0.5))) ** 2
    key(P['head'], f, (Z, look), (X, nod))

clip('Walk', FPS, walk)            # one stride a second
clip('Idle', FPS * 4, idle)        # four seconds of looking about

# ---------------------------------------------------------------- export
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
                          export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_image_format='JPEG', export_image_quality=88,
                          export_skins=True, export_def_bones=False,
                          export_force_sampling=True, export_optimize_animation_size=True)
print('WROTE', OUT)
