# A Mixamo clip (.fbx) added to one of the game's people (.glb) under a name, by bone name: Mixamo bones share their
# axes, so the clip's rotations play on the person's own rest; the hips keep their height (no travel).
#   Blender -b --python tools/add-clip.py -- <person.glb> <clip.fbx> <name> <out.glb>
import bpy, sys
GLB, FBX, NAME, OUT = sys.argv[sys.argv.index("--")+1:][:4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
A = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
acts = list(bpy.data.actions)
before = set(bpy.data.objects); bpy.ops.import_scene.fbx(filepath=FBX)
new = [o for o in bpy.data.objects if o not in before]
src = [a for a in bpy.data.actions if a not in acts][0]
for o in new: bpy.data.objects.remove(o)
src.name = NAME
have = {b.name for b in A.data.bones}
def bags(ac):
    for ly in ac.layers:
        for st in ly.strips:
            for cb in st.channelbags: yield cb
idle = [a for a in acts if a.name.startswith("idle")][0]; HIP = [0.0, 0.0, 0.0]
for cb in bags(idle):
    for i in range(3):
        fc = cb.fcurves.find('pose.bones["mixamorig:Hips"].location', index=i)
        if fc: HIP[i] = fc.keyframe_points[0].co[1]
for cb in bags(src):
    for fc in list(cb.fcurves):
        bone = fc.data_path.split('"')[1] if '"' in fc.data_path else ""
        if bone not in have or fc.data_path.endswith("location") or fc.data_path.endswith("scale"): cb.fcurves.remove(fc)
for cb in bags(src):                                            # the hips held where the idle stands them
    for i in range(3):
        fc = cb.fcurves.new('pose.bones["mixamorig:Hips"].location', index=i, group_name="mixamorig:Hips")
        fc.keyframe_points.insert(src.frame_range[0], HIP[i]); fc.keyframe_points.insert(src.frame_range[1], HIP[i])
    break
ad = A.animation_data or A.animation_data_create()
tr = ad.nla_tracks.new(); tr.name = NAME; st = tr.strips.new(NAME, int(src.frame_range[0]), src)
if len(src.slots): st.action_slot = src.slots[0]
for t in ad.nla_tracks: t.mute = False
ad.action = None
print("CLIPS", sorted(t.name for t in ad.nla_tracks))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=False)
