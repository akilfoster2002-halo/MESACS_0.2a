# Rigs the Tripo alien (alien+creature+3d+model.zip → tripo_convert_*.fbx) on the tyrannosaur's own skeleton and exports
# koro-godot/assets/tsh/monster/alien.glb, the Maya monster's body, with the tyrannosaur's clips (idle, run, bite, roar,
# attack_tail). Each tyrannosaur bone is moved onto the alien's matching joint by the least turn that points it there, so
# its twist — and every clip's bends — come along. Front is -Y, the floor is z=0.
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/alien-rig.py -- <fbx> <trexhead.glb> <out.glb>
import bpy, sys
from mathutils import Vector, Matrix
FBX, TREX, OUT = sys.argv[-3], sys.argv[-2], sys.argv[-1]
S = 5.1                                             # the model is 0.98 tall; the goose stood ~5
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=TREX)
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH': bpy.data.objects.remove(o)
bpy.ops.import_scene.fbx(filepath=FBX)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]; ob.name = "Alien"
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for v in ob.data.vertices: v.co = v.co*S
dm = ob.modifiers.new("dec", 'DECIMATE'); dm.ratio = 0.035; bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.002); bpy.ops.object.mode_set(mode='OBJECT')
# the alien's joints (in its own 0..1 height units; L is +X)
J = {"bn_Spine": ((0, -0.05, 0.47), (0, -0.06, 0.50)),
     "bn_Spine1": ((0, -0.06, 0.50), (0, -0.09, 0.62)), "bn_Spine2": ((0, -0.09, 0.62), (0, -0.12, 0.74)),
     "bn_Neck": ((0, -0.12, 0.74), (0, -0.135, 0.79)), "bn_Neck1": ((0, -0.135, 0.79), (0, -0.145, 0.825)),
     "bn_Neck2": ((0, -0.145, 0.825), (0, -0.16, 0.86)), "bn_Head": ((0, -0.16, 0.86), (0, -0.34, 0.87)),
     "bn_Jaw": ((0, -0.18, 0.845), (0, -0.32, 0.825))}
tail = [(0, -0.01, 0.46), (0, 0.05, 0.41), (0, 0.10, 0.36), (0, 0.15, 0.29), (0, 0.19, 0.23), (0, 0.24, 0.16), (0, 0.28, 0.11), (0, 0.32, 0.08), (0, 0.35, 0.07)]
for i in range(8): J["bn_Tail%02d" % (i + 1)] = (tail[i], tail[i + 1])
for sd, s in (("Left", 1), ("Right", -1)):
    m = lambda p: (s*p[0], p[1], p[2])
    J["bn_%sShoulder" % sd] = (m((0.03, -0.12, 0.77)), m((0.10, -0.12, 0.79)))
    J["bn_%sArm" % sd] = (m((0.10, -0.12, 0.79)), m((0.15, -0.15, 0.63)))
    J["bn_%sForeArm" % sd] = (m((0.15, -0.15, 0.63)), m((0.17, -0.22, 0.48)))
    J["bn_%sHand" % sd] = (m((0.17, -0.22, 0.48)), m((0.175, -0.24, 0.43)))
    J["bn_%sUpLeg" % sd] = (m((0.06, -0.04, 0.47)), m((0.075, -0.11, 0.33)))
    J["bn_%sUpLegTwist" % sd] = (m((0.068, -0.075, 0.40)), m((0.075, -0.11, 0.33)))
    J["bn_%sLeg" % sd] = (m((0.075, -0.11, 0.33)), m((0.08, -0.01, 0.16)))
    J["bn_%sFoot" % sd] = (m((0.08, -0.01, 0.16)), m((0.085, -0.04, 0.03)))
    J["bn_%sBall" % sd] = (m((0.085, -0.04, 0.03)), m((0.085, -0.07, 0.02)))
    J["bn_%sChest" % sd] = (m((0.05, -0.15, 0.70)), m((0.02, -0.16, 0.67)))
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
E = arm.data.edit_bones; mw = arm.matrix_world; inv = mw.inverted()
base = lambda n: n.split(".")[0]
old = {e.name: (mw @ e.head, mw @ e.tail, (mw.to_3x3() @ e.matrix.to_3x3()).normalized()) for e in E}
new = {}
K = 0.45                                            # the tyrannosaur's small bones (fingers, toes, face) come over this much smaller
def place(e):
    oh, ot, orot = old[e.name]
    if base(e.name) in J:
        a, b = J[base(e.name)]; h, t = Vector(a)*S, Vector(b)*S
    else:                                           # follow its parent: the same offset, turned and shrunk as the parent was
        p = e.parent; ph, pt, prot = old[p.name]; nh, nt, nrot = new[p.name]
        d = nrot @ prot.inverted()
        h = nh + d @ (oh - ph)*K; t = h + d @ (ot - oh)*K
    od = (ot - oh); nd = (t - h)
    if od.length < 1e-6: od = orot.col[1].copy()
    if nd.length < 1e-6: nd = od.copy()
    rot = od.rotation_difference(nd).to_matrix() @ orot
    new[e.name] = (h, t if (t - h).length > 1e-4 else h + nd.normalized()*0.02, rot)
    for c in e.children: place(c)
for e in E:
    if e.parent is None: place(e)
for e in E:
    h, t, rot = new[e.name]; L = max((t - h).length, 0.02)
    M = (mw.inverted().to_3x3() @ rot).to_4x4(); M.translation = inv @ h
    e.use_connect = False; e.matrix = M; e.length = L/mw.to_scale()[0]
bpy.ops.object.mode_set(mode='OBJECT')
# a clip's moves are in each bone's own axes and the tyrannosaur's size: turn them into the new bone's, and shrink them
HIP = 0.47*S/old["bn_Spine.4" if "bn_Spine.4" in old else [n for n in old if base(n) == "bn_Spine"][0]][0].z
def curves(ac):                                     # Blender 5 keeps an action's curves in its layers' channel bags
    for ly in ac.layers:
        for st in ly.strips:
            for cb in st.channelbags: yield cb.fcurves
for ac in bpy.data.actions:
  for FC in curves(ac):
      for bn in old:
          fc = [FC.find('pose.bones["%s"].location' % bn, index=i) for i in range(3)]
          if not all(fc): continue
          R = new[bn][2].inverted() @ old[bn][2]
          for k in range(len(fc[0].keyframe_points)):
              v = R @ Vector([fc[i].keyframe_points[k].co[1] for i in range(3)])*HIP
              for i in range(3): fc[i].keyframe_points[k].co[1] = v[i]; fc[i].keyframe_points[k].handle_left_type = fc[i].keyframe_points[k].handle_right_type = 'AUTO_CLAMPED'
          for f in fc: f.update()
# the face's little bones carry no skin of their own
for b in arm.data.bones:
    if any(k in b.name for k in ("Eye", "Pupil", "Lid", "Lip", "Tongue")): b.use_deform = False
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print("GROUPS", len(ob.vertex_groups), "UNWEIGHTED", sum(1 for v in ob.data.vertices if not v.groups))
# every clip back on the armature as an NLA strip so all of them export
ad = arm.animation_data or arm.animation_data_create()
for ac in bpy.data.actions:
    tr = ad.nla_tracks.new(); tr.name = ac.name; tr.strips.new(ac.name, int(ac.frame_range[0]), ac)
ad.action = None
if "--check" not in sys.argv:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=False)
