"""THE WFC'S MACHINES from the downloads (assets/tsh/wfc_src): the Buster drone and the Dodge Charger police car, as
game-ready glbs — textures found and attached, the drone's display stand taken away, both at their real size,
facing +Z (Godot's forward for the game's props: the car's nose, the drone's eye).

  /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/wfc_props.py
"""
import bpy, mathutils, os, glob
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets/tsh/wfc_src'); OUT = os.path.join(ROOT, 'assets/tsh/wfc')

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
def bounds(objs):
    mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c); mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
    return mn, mx
def find_tex(dirs, name):
    base = os.path.splitext(os.path.basename(name))[0].lower()
    for d in dirs:
        for f in glob.glob(os.path.join(d, '**', '*'), recursive=True):
            if os.path.splitext(os.path.basename(f))[0].lower() == base: return f
    return None
def relink(dirs):
    for im in bpy.data.images:
        if im.filepath and not os.path.exists(bpy.path.abspath(im.filepath)):
            f = find_tex(dirs, im.filepath)
            if f: im.filepath = f; im.reload()
def fit(objs, size_axis, size, ground=True):
    """scaled so its extent along size_axis is `size`; centred; on the floor (or centred on 0 for something that flies)"""
    root = bpy.data.objects.new('root', None); bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None: o.parent = root
    bpy.context.view_layer.update()
    mn, mx = bounds(objs); ext = (mx - mn)[size_axis]
    k = size/ext; root.scale = (k, k, k); bpy.context.view_layer.update()
    mn, mx = bounds(objs); c = (mn + mx)/2
    root.location = (-c.x, -c.y, -mn.z if ground else -c.z)
    return root
def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='WEBP', export_animations=False, export_apply=True)
    print('wrote', path, os.path.getsize(path))

# ---- the drone
reset()
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, 'drone/BusterDrone.fbx'))
relink([os.path.join(SRC, 'drone/tex')])
for o in list(bpy.context.scene.objects):
    n = o.name.lower()
    if o.type in ('CAMERA', 'LIGHT') or 'boden' in n or 'ground' in n or 'floor' in n or 'plane' in n: bpy.data.objects.remove(o)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# the stand: a flat, wide mesh at the bottom
mn, mx = bounds(meshes)
for o in list(meshes):
    a, b = bounds([o])
    if (b - a).z < 0.05*(mx - mn).z and (b - a).x > 0.6*(mx - mn).x: print('stand', o.name); bpy.data.objects.remove(o); meshes.remove(o)
print('drone meshes', len(meshes), [o.name for o in meshes][:12])
# its materials, rebuilt plainly (the FBX's came through blown out): albedo, normal, roughness, metal, a faint emissive
T = os.path.join(SRC, 'drone/tex')
def pbr(key):
    mat = bpy.data.materials.new('drone_' + key); mat.use_nodes = True; nt = mat.node_tree; b = nt.nodes['Principled BSDF']
    def img(f, inp, data=False):
        p = os.path.join(T, f)
        if not os.path.exists(p): return None
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(p)
        if data: n.image.colorspace_settings.name = 'Non-Color'
        if inp: nt.links.new(n.outputs['Color'], b.inputs[inp])
        return n
    img(key + '_albedo.png', 'Base Color'); img(key + '_metallic.png', 'Metallic', True); img(key + '_roughness.png', 'Roughness', True)
    n = img(key + '_normal.png', None, True)
    if n: nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    e = img(key + '_emissive.png', 'Emission Color')
    if e: b.inputs['Emission Strength'].default_value = 2.0
    return mat
M = {'body': pbr('body'), 'leg': pbr('leg')}
for o in meshes:
    for sl in o.material_slots:
        if sl.material and sl.material.name.split('.')[0] in M: sl.material = M[sl.material.name.split('.')[0]]
fit([o for o in bpy.context.scene.objects], 0, 1.1, ground=False)
export(os.path.join(OUT, 'drone.glb'))

# ---- the police car
reset()
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, 'car/DODGE_CHALLENGER_POLICE.fbx'))
relink([os.path.join(SRC, 'car/TEXTURES'), os.path.join(SRC, 'car')])
for o in list(bpy.context.scene.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o)
objs = list(bpy.context.scene.objects)
mn, mx = bounds([o for o in objs if o.type == 'MESH'])
L = 1 if (mx - mn).y > (mx - mn).x else 0                    # its length along Blender's y (or x)
fit(objs, L, 5.1)
missing = [im.name for im in bpy.data.images if not im.has_data]
print('car images', len(bpy.data.images), 'missing', len(missing), missing[:6])
export(os.path.join(OUT, 'police_car.glb'))
