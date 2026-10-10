import bpy, json, sys, os
from mathutils import Matrix, Vector
J = json.load(open(sys.argv[-3])); TEX = sys.argv[-2]; OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
# Maya is y-up: (x, y, z) -> Blender (x, -z, y)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
def mm(v16):                      # a Maya matrix (row vectors, translation in the last row) as a Blender column matrix
    return Matrix([v16[0:4], v16[4:8], v16[8:12], v16[12:16]]).transposed()
world = [C @ mm(p).inverted() for p in J['pm']]
heads = [w.to_translation() for w in world]
names = J['joints']
# the mesh
verts = [C @ Vector(v) for v in J['vt']]
# sturdier than Doc Ock's (the arm is slender for a body her size): every point pushed out from the arm's axis
AX_Y, AX_Z, THICK = (C @ mm(J['pm'][0]).inverted()).to_translation().y, (C @ mm(J['pm'][0]).inverted()).to_translation().z, 1.5
verts = [Vector((v.x, AX_Y + (v.y - AX_Y)*THICK, AX_Z + (v.z - AX_Z)*THICK)) for v in verts]
faces = [f['v'] for f in J['faces']]
me = bpy.data.meshes.new('mechArm'); me.from_pydata(verts, [], faces); me.update()
uvl = me.uv_layers.new(name='UV')
for poly, f in zip(me.polygons, J['faces']):
    for li, ui in zip(poly.loop_indices, f['uv'] or []): uvl.data[li].uv = J['uv'][ui]
ob = bpy.data.objects.new('mechArm', me); bpy.context.scene.collection.objects.link(ob)
for p in me.polygons: p.use_smooth = True
# the armature: the chain, then the claw on the end of it
parent = {}
for i, n in enumerate(names):
    if i > 0 and i <= 18: parent[n] = names[i - 1]
parent['mechArm_arm_ClawBase'] = 'mechArm_arm_MechArm18'
for a, b in [('mechArm_arm_Claw1', 'mechArm_arm_ClawBase'), ('mechArm_arm_Claw2', 'mechArm_arm_Claw1'), ('mechArm_arm_Claw7', 'mechArm_arm_ClawBase'),
             ('mechArm_arm_Claw8', 'mechArm_arm_Claw7'), ('mechArm_arm_Claw4', 'mechArm_arm_ClawBase'), ('mechArm_arm_Claw5', 'mechArm_arm_Claw4')]: parent[a] = b
kids = {}
for c, p in parent.items(): kids.setdefault(p, []).append(c)
ad = bpy.data.armatures.new('rig'); ao = bpy.data.objects.new('rig', ad); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
idx = {n:i for i, n in enumerate(names)}
for i, n in enumerate(names):
    b = ad.edit_bones.new(n.replace('mechArm_arm_', '')); b.head = heads[i]
    ks = kids.get(n, [])
    if len(ks) == 1 and n != 'mechArm_arm_MechArm18': b.tail = heads[idx[ks[0]]]
    elif n == 'mechArm_arm_MechArm18': b.tail = heads[idx['mechArm_arm_ClawBase']]
    else:
        prev = heads[idx[parent[n]]] if n in parent else heads[i] - Vector((0, 0, 0.1))
        d = (heads[i] - prev); d = d.normalized() if d.length > 1e-6 else Vector((0, -1, 0)); b.tail = heads[i] + d*0.12
    if (b.tail - b.head).length < 1e-4: b.tail = b.head + Vector((0, -0.05, 0))
for n, p in parent.items(): ad.edit_bones[n.replace('mechArm_arm_', '')].parent = ad.edit_bones[p.replace('mechArm_arm_', '')]
bpy.ops.object.mode_set(mode='OBJECT')
# weights
for n in names: ob.vertex_groups.new(name=n.replace('mechArm_arm_', ''))
for vi, w in enumerate(J['weights']):
    for k, x in w.items():
        if x > 0: ob.vertex_groups[int(k)].add([vi], x, 'REPLACE')
ob.parent = ao; mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = ao
# material: the arm's own textures
mat = bpy.data.materials.new('mechArm'); mat.use_nodes = True; nt = mat.node_tree; bs = nt.nodes['Principled BSDF']
def tex(fn, nonc=False):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEX, fn))
    if nonc: t.image.colorspace_settings.name = 'Non-Color'
    return t
d = tex('Prop_DrOck_Classic_MechArm_Diff.png'); nt.links.new(d.outputs['Color'], bs.inputs['Base Color'])
n_ = tex('Prop_DrOck_Classic_MechArm_Norm.png', True); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n_.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
e = tex('Prop_DrOck_Classic_MechArm_Emiss.png'); nt.links.new(e.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 1.5
bs.inputs['Metallic'].default_value = 0.8; bs.inputs['Roughness'].default_value = 0.35
me.materials.append(mat)
L = [round((heads[i + 1] - heads[i]).length, 3) for i in range(18)]
print('BONES', len(names), 'chain length', round(sum(L), 3), 'segments', L[:4], 'head0', [round(x, 3) for x in heads[0]], 'claw', [round(x, 3) for x in heads[19]])
print('MESH', [round(x, 2) for x in Vector([min(v[k] for v in verts) for k in range(3)])], [round(x, 2) for x in Vector([max(v[k] for v in verts) for k in range(3)])])
bpy.ops.wm.save_mainfile(filepath=OUT.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=False, export_yup=True)
print('EXPORTED')
