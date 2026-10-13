"""THE WFC OFFICER: the downloaded future police knight (a static model) rigged with the game's own officer skeleton
and animations (people/thug-a.glb: idle, walk, sprint, the fight's moves), by copying that body's skin weights.

  1. the knight (wfc_src/knight → tools/dae2obj.py → knight.obj) scaled to the officer's height, feet on the floor
  2. the officer's arms posed up to the knight's (his arms are raised, the officer's hang lower)
  3. the officer's skin weights copied onto the knight from the posed body (nearest face)
  4. the knight bent back into the officer's rest pose (the inverse of the skinning, vertex by vertex)
  5. bound to the officer's armature, the officer's own body removed, the knight's textures on; exported with every action

  /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/wfc_officer.py -- knight.obj out.glb
"""
import bpy, bmesh, math, mathutils, os, sys
args = sys.argv[sys.argv.index('--') + 1:]; OBJ, OUT = args[0], args[1]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
TEX = os.path.join(ROOT, 'assets/tsh/wfc_src/knight/textures')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'assets/tsh/people/thug-a.glb'))
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
body = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == arm][0]
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o.parent != arm: bpy.data.objects.remove(o)
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis = mathutils.Matrix.Identity(4)
bpy.context.view_layer.update()
def bounds(objs):
    mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
    for o in objs:
        dg = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for v in dg.to_mesh().vertices:
            w = o.matrix_world @ v.co; mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
        dg.to_mesh_clear()
    return mn, mx
bmn, bmx = bounds([body])

# 1 · the knight, at the officer's height, centred, feet on the floor
bpy.ops.wm.obj_import(filepath=OBJ)
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in (body,)]
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
mats = {'meshId0': 'lambert2SG', 'meshId1': 'initialShadingGroup'}
def tex(name):
    p = os.path.join(TEX, name)
    for ext in ('.png', '.jpg', '.jpeg'):
        if os.path.exists(p + ext): return bpy.data.images.load(p + ext)
    return None
def make_mat(key):
    mat = bpy.data.materials.new('wfc_' + key); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    for suf, inp in (('_albedo', 'Base Color'), ('_metallic', 'Metallic'), ('_roughness', 'Roughness')):
        im = tex(key + suf)
        if im:
            n = nt.nodes.new('ShaderNodeTexImage'); n.image = im
            if inp != 'Base Color': im.colorspace_settings.name = 'Non-Color'
            nt.links.new(n.outputs['Color'], bsdf.inputs[inp])
    im = tex(key + '_normal')
    if im:
        im.colorspace_settings.name = 'Non-Color'; n = nt.nodes.new('ShaderNodeTexImage'); n.image = im; nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    em = tex('Emissive') if key == 'lambert2SG' else None
    return mat
for o in parts:
    o.data.materials.clear(); o.data.materials.append(make_mat(mats.get(o.name.split('.')[0], 'initialShadingGroup')))
bpy.ops.object.join(); knight = bpy.context.view_layer.objects.active; knight.name = 'wfc_officer'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
kmn, kmx = bounds([knight])
s = (bmx.z - bmn.z)/(kmx.z - kmn.z)
for v in knight.data.vertices:
    v.co = (v.co - mathutils.Vector(((kmn.x + kmx.x)/2, (kmn.y + kmx.y)/2, kmn.z)))*s + mathutils.Vector(((bmn.x + bmx.x)/2, (bmn.y + bmx.y)/2, bmn.z))
# faces the same way as the officer? (its toes: the front of the feet)
def front_y(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices if (o.matrix_world @ v.co).z < bmn.z + 0.06]
    return sum(v.y for v in vs)/max(1, len(vs)) - (bmn.y + bmx.y)/2
if (front_y(knight) > 0) != (front_y(body) > 0):
    for v in knight.data.vertices: c = (bmn.x + bmx.x)/2, (bmn.y + bmx.y)/2; v.co.x = 2*c[0] - v.co.x; v.co.y = 2*c[1] - v.co.y
    print('turned round')

# 2 · the officer's arms up to the knight's: the angle from his shoulder to his furthest hand vertex, matched
def world_head(name): return arm.matrix_world @ arm.data.bones[name].head_local
for side, sgn in (('Left', 1), ('Right', -1)):
    sh = world_head('mixamorig:%sArm' % side)
    kv = [knight.matrix_world @ v.co for v in knight.data.vertices]
    tip_k = max(kv, key=lambda p: sgn*p.x)
    tip_b = max([body.matrix_world @ v.co for v in body.data.vertices], key=lambda p: sgn*p.x)
    ak = math.atan2(tip_k.z - sh.z, abs(tip_k.x - sh.x)); ab = math.atan2(tip_b.z - sh.z, abs(tip_b.x - sh.x))
    d = ak - ab
    pb = arm.pose.bones['mixamorig:%sArm' % side]
    axis = (arm.matrix_world.to_3x3() @ arm.data.bones[pb.name].matrix_local.to_3x3()).inverted() @ mathutils.Vector((0, 1, 0))      # world forward, in the bone's frame
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = mathutils.Quaternion(axis, -sgn*d)
    print(side, 'arm raised by', round(math.degrees(d), 1))
bpy.context.view_layer.update()

# 3 · the officer's weights onto the knight, from his posed body
for g in body.vertex_groups: knight.vertex_groups.new(name=g.name)
dt = knight.modifiers.new('w', 'DATA_TRANSFER'); dt.object = body; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.context.view_layer.objects.active = knight
bpy.ops.object.modifier_apply(modifier='w')

# 4 · back into the rest pose: each vertex through the inverse of its own blend of the posed bones
deform = {pb.name: (arm.matrix_world @ pb.matrix @ arm.data.bones[pb.name].matrix_local.inverted() @ arm.matrix_world.inverted()) for pb in arm.pose.bones}
gname = {g.index: g.name for g in knight.vertex_groups}
for v in knight.data.vertices:
    M = mathutils.Matrix(((0,)*4,)*4); tot = 0.0
    for ge in v.groups:
        n = gname[ge.group]
        if n in deform and ge.weight > 0: M += deform[n]*ge.weight; tot += ge.weight
    if tot <= 0: continue
    M = M*(1.0/tot)
    v.co = knight.matrix_world.inverted() @ (M.inverted() @ (knight.matrix_world @ v.co))
for pb in arm.pose.bones: pb.matrix_basis = mathutils.Matrix.Identity(4)

# 5 · bound to his armature; his own body gone; the knight's textures
knight.parent = arm; knight.matrix_parent_inverse = arm.matrix_world.inverted()
am = knight.modifiers.new('arm', 'ARMATURE'); am.object = arm
bpy.data.objects.remove(body)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); knight.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_image_format='WEBP')
print('wrote', OUT)
