"""
MISSION CONTROL, AS A TEMPLE — built in Blender from nothing but this file.

    blender -b --python build.py -- preview      # geometry + EEVEE renders, fast
    blender -b --python build.py -- bake         # + baked light, GLB, layout.js

The whole building is code so it can be changed and rebuilt, not hand-edited
in a .blend nobody can diff. It writes:

    public/temple/temple.glb     every surface, two UV sets (texture, light)
    public/temple/lm_*.jpg       the baked light, one map per material
    public/temple/layout.js      walls, stations, the pool, the roof heights —
                                 the numbers the game needs synchronously,
                                 from the same constants the geometry used

AXES. Blender is Z-up with the front of the building at -Y. glTF export turns
that into the game's Y-up with the door at +Z, so game z = -blender y. The
layout written for the game is converted once, at the bottom.
"""
import bpy, bmesh, math, os, sys, json, random
from mathutils import Vector, Matrix
import numpy as np

ARGS = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
MODE = ARGS[0] if ARGS else "preview"
ONLY = ARGS[1].split(",") if len(ARGS) > 1 else None      # preview: which cameras
HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, "src")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT  = os.path.join(ROOT, "public", "temple")
REN  = os.path.join(HERE, "renders")
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)
random.seed(7); np.random.seed(7)

# ------------------------------------------------------------------ the plan
PR = 320.0                      # Senio's radius: the apron falls away with it
HW, HD = 32.0, 23.0             # half the footprint the game already knows
APRON = min(9.0, 64/7)          # planet.js apronOf()
T = 0.6                         # wall thickness
PASS_H = 5.8                    # every inner doorway
DOOR_W, DOOR_H = 9.0, 7.5       # the front door: the gap the game has always had
PAV_H, WING_H, INNER_H = 10.0, 9.0, 10.0
RC = Vector((0.0, 4.0))         # the atrium's centre
R_IN, R_OUT, RING_TOP, ATRIUM_CEIL = 10.0, 10.8, 11.2, 9.9
OCULUS = 6.6
POOL_R, CURB_R, CURB_Z, WATER_Z = 6.0, 6.45, 0.30, 0.20
GALLERY_CEIL = 8.4
SOLIDS = []                     # (x0,x1,y0,y1,z0,z1) in Blender axes

def plateY(x, y):
    """planet.js plateY(): 0 on the building, the ball at the rim of the apron."""
    ox = max(0.0, abs(x)-(HW+1)); oy = max(0.0, abs(y)-(HD+1))
    k = min(1.0, math.hypot(ox, oy)/APRON); s = k*k*(3-2*k)
    p = math.hypot(x, y)
    return (math.sqrt(max(0.0, PR*PR-p*p))-PR)*s

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# --------------------------------------------------------------- textures
def img_np(im):
    w, h = im.size
    return np.array(im.pixels[:], np.float32).reshape(h, w, 4)
def save_np(name, arr, path, quality=90):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.pixels.foreach_set(np.ascontiguousarray(arr, np.float32).ravel())
    im.filepath_raw = path; im.file_format = 'JPEG'
    im.save(filepath=path, quality=quality)
    im.source = 'FILE'
    return im
def tinted(src, name, mul, add=(0,0,0), gamma=1.0, size=1024):
    """a Higgsfield source, resized and tinted into the colour this building
       wants — baked into the file, because glTF carries an image, not a mix"""
    im = bpy.data.images.load(os.path.join(SRC, src)); im.scale(size, size)
    a = img_np(im)
    rgb = np.power(np.clip(a[:,:,:3],0,1), gamma)*np.array(mul,np.float32)+np.array(add,np.float32)
    a[:,:,:3] = np.clip(rgb, 0, 1)
    return save_np(name, a, os.path.join(HERE, "work", name+".jpg"))
def shoji_tex():
    N = 512; a = np.ones((N, N, 4), np.float32)
    a[:,:,:3] = np.array([0.93,0.90,0.82],np.float32)*(0.97+0.03*np.random.rand(N,N,1))
    fr = np.array([0.16,0.10,0.06],np.float32)
    for k in range(5): c=int(k*N/4); a[:, max(0,c-5):c+5, :3] = fr
    for k in range(6): c=int(k*N/5); a[max(0,c-5):c+5, :, :3] = fr
    return save_np("shoji", a, os.path.join(HERE, "work", "shoji.jpg"))
os.makedirs(os.path.join(HERE, "work"), exist_ok=True)

TEX = {}
TEX['tiles']     = tinted("tex_tiles.png",    "tiles",     (0.50,0.52,0.56), gamma=1.15)
TEX['lacquer']   = tinted("tex_lacquer.png",  "lacquer",   (0.80,0.62,0.58), gamma=1.25)
TEX['lime']      = tinted("tex_lime.png",     "lime",      (0.86,0.84,0.80))
TEX['granite']   = tinted("tex_granite.png",  "granite",   (0.78,0.76,0.72), gamma=1.1)
TEX['gravel']    = tinted("tex_gravel.png",   "gravel",    (0.80,0.79,0.76))
TEX['mossg']     = tinted("tex_moss.png",     "mossg",     (0.62,0.70,0.52), gamma=1.2)
TEX['cedar']     = tinted("tex_cedar.png",    "cedar",     (0.62,0.55,0.50), gamma=1.25)
TEX['floor']     = tinted("tex_wood.png",     "floor",     (0.50,0.43,0.38), gamma=1.3)
TEX['darkwood']  = tinted("tex_cedar.png",    "darkwood",  (0.46,0.38,0.33), gamma=1.35)
TEX['plaster_o'] = tinted("tex_plaster.png",  "plaster_o", (0.90,0.90,0.83))
TEX['plaster_w'] = tinted("tex_plaster.png",  "plaster_w", (0.30,0.28,0.26), add=(0.62,0.60,0.55))
TEX['concrete']  = tinted("tex_concrete.png", "concrete",  (0.95,0.94,0.92))
TEX['stone']     = tinted("tex_concrete.png", "stone",     (0.60,0.56,0.51), gamma=1.3)
TEX['shoji']     = shoji_tex()
ARTS = ("pine","mountains","crane","bamboo","koi","enso")
for a in ARTS:
    TEX['art_'+a] = bpy.data.images.load(os.path.join(SRC, "art_"+a+".png"))

# -------------------------------------------------------------- materials
MATS = {}
def material(name, color=(0.8,0.8,0.8), tex=None, scale=3.0, rough=0.85, emit=0.0,
             bump=0.25, grime=0.55, vary=0.12, low=0.0, bevel=0.015):
    """A Cycles material that has been somewhere. On top of the texture:
       large, slow colour variation so no two walls are the same (vary);
       dirt collected wherever the geometry closes in, from an ambient-
       occlusion probe (grime); splash-back along the bottom metre (low);
       relief from the texture itself (bump); and edges rounded in the
       shading, not the mesh (bevel) — the thin highlight that separates a
       real timber from a grey box. All of it is baked into the game's
       textures, so none of it costs the game anything."""
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    if tex:
        t = N.new("ShaderNodeTexImage"); t.image = TEX[tex]; col = t.outputs["Color"]
    else:
        rgb = N.new("ShaderNodeRGB"); rgb.outputs[0].default_value = (*color, 1); col = rgb.outputs[0]
    if emit:
        L.new(col, b.inputs["Base Color"]); L.new(col, b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit
    else:
        geo = N.new("ShaderNodeNewGeometry")
        # slow variation over the building
        nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.12
        nz.inputs["Detail"].default_value = 3.0
        L.new(geo.outputs["Position"], nz.inputs["Vector"])
        vr = N.new("ShaderNodeMapRange"); vr.inputs[3].default_value = 1-vary; vr.inputs[4].default_value = 1+vary
        L.new(nz.outputs["Fac"], vr.inputs[0])
        m1 = N.new("ShaderNodeMix"); m1.data_type = 'RGBA'; m1.blend_type = 'MULTIPLY'
        m1.inputs[0].default_value = 1.0
        L.new(col, m1.inputs[6]); L.new(vr.outputs[0], m1.inputs[7])
        cur = m1.outputs[2]
        # dirt in the creases
        if grime:
            ao = N.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.9
            ao.samples = 8
            inv = N.new("ShaderNodeMapRange"); inv.inputs[1].default_value = 0.35; inv.inputs[2].default_value = 1.0
            inv.inputs[3].default_value = grime; inv.inputs[4].default_value = 0.0
            L.new(ao.outputs["AO"], inv.inputs[0])
            dirt = N.new("ShaderNodeMix"); dirt.data_type = 'RGBA'; dirt.blend_type = 'MULTIPLY'
            dirt.inputs[7].default_value = (0.42, 0.38, 0.33, 1)
            L.new(inv.outputs[0], dirt.inputs[0]); L.new(cur, dirt.inputs[6])
            cur = dirt.outputs[2]
        # splash-back and damp along the foot of walls
        if low:
            sep = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep.inputs[0])
            nz2 = N.new("ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = 2.5
            L.new(geo.outputs["Position"], nz2.inputs["Vector"])
            add = N.new("ShaderNodeMath"); add.operation = 'ADD'
            L.new(sep.outputs[2], add.inputs[0]); L.new(nz2.outputs["Fac"], add.inputs[1])
            ht = N.new("ShaderNodeMapRange"); ht.inputs[1].default_value = 0.5; ht.inputs[2].default_value = 1.6
            ht.inputs[3].default_value = low; ht.inputs[4].default_value = 0.0
            L.new(add.outputs[0], ht.inputs[0])
            sp = N.new("ShaderNodeMix"); sp.data_type = 'RGBA'; sp.blend_type = 'MULTIPLY'
            sp.inputs[7].default_value = (0.5, 0.46, 0.4, 1)
            L.new(ht.outputs[0], sp.inputs[0]); L.new(cur, sp.inputs[6])
            cur = sp.outputs[2]
        L.new(cur, b.inputs["Base Color"])
        # relief and rounded edges
        nrm = None
        if bevel:
            bv = N.new("ShaderNodeBevel"); bv.inputs["Radius"].default_value = bevel; bv.samples = 6
            nrm = bv.outputs["Normal"]
        if tex and bump:
            bw = N.new("ShaderNodeRGBToBW"); L.new(col, bw.inputs[0])
            bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
            bp.inputs["Distance"].default_value = 0.02
            L.new(bw.outputs[0], bp.inputs["Height"])
            if nrm is not None: L.new(nrm, bp.inputs["Normal"])
            nrm = bp.outputs["Normal"]
        if nrm is not None: L.new(nrm, b.inputs["Normal"])
    MATS[name] = dict(mat=m, scale=scale, emit=emit)

material("tiles",     tex="tiles", scale=2.4, rough=0.5, grime=0.35, bump=0.5, bevel=0)
material("ridge",     color=(0.075,0.08,0.09), rough=0.45, grime=0.3)
material("floor",     tex="floor", scale=3.6, rough=0.35, grime=0.45, bump=0.12)
material("darkwood",  tex="darkwood", scale=2.5, rough=0.6, grime=0.5, bump=0.35, bevel=0.02)
material("lacquer",   tex="lacquer", scale=1.6, rough=0.45, grime=0.6, low=0.35, bump=0.2, bevel=0.025)
material("plaster_w", tex="lime", scale=3.2, grime=0.55, low=0.45, bump=0.15)
material("plaster_o", tex="plaster_o", scale=3.0, grime=0.5, low=0.2, bump=0.15)
material("concrete",  tex="concrete", scale=5.4, rough=0.75, grime=0.45, bump=0.1, bevel=0.01)
material("stone",     tex="granite", scale=3.0, grime=0.6, low=0.3, bump=0.45, bevel=0.03)
material("gravel",    tex="gravel", scale=2.0, grime=0.3, bump=0.6, bevel=0)
material("gold",      color=(0.55,0.40,0.14), rough=0.3, grime=0.5)
material("moss",      tex="mossg", scale=1.6, grime=0.5, bump=0.8, bevel=0)
material("hedge",     tex="mossg", scale=0.9, grime=0.6, bump=1.0, bevel=0)
material("pine",      color=(0.055,0.11,0.05))
material("bark",      tex="cedar", scale=0.8, grime=0.4, bump=0.8)
material("blossom",   color=(0.96,0.76,0.83), rough=0.9, grime=0.4)
material("basin",     color=(0.018,0.024,0.028), rough=0.2, grime=0)
material("black",     color=(0.025,0.025,0.025), rough=0.4, grime=0)
material("shoji",     tex="shoji", scale=1.3, emit=0.55)
material("shoji_in",  tex="shoji", scale=1.3, emit=2.6)
material("lamp",      color=(1.0,0.76,0.45), emit=5.0)
for a in ARTS:
    material("art_"+a, tex="art_"+a, rough=0.9, grime=0.2, bump=0.05, vary=0.03, bevel=0)

# ------------------------------------------------------------- primitives
ZONE = ['ext']                  # which bake group geometry goes into; set by each builder
DETAIL = [False]                # small pieces bake into their own map (see unwrap())
BMS = {}
def _bm(mname, zone=None):
    key = ((zone or ZONE[0]) + ('_d' if DETAIL[0] else ''), mname)
    if key not in BMS:
        bm = bmesh.new(); bm.loops.layers.uv.new("UV"); bm.faces.layers.int.new("cuv")
        BMS[key] = bm
    return BMS[key]
class detail:
    """with detail(): ... — rafters, tile ends, brackets, slats. Thousands of
       little pieces each want their own padded patch of a bake, and packed
       in with the walls they squeezed every wall and roof down to a few
       pixels: the roof's 4K map came out five percent used. So they get a
       map of their own and the big surfaces get theirs."""
    def __enter__(self): DETAIL.insert(0, True)
    def __exit__(self, *a): DETAIL.pop(0)

class zone:
    """with zone('wings'): ... — what is built inside goes into that bake group"""
    def __init__(self, z): self.z = z
    def __enter__(self): ZONE.insert(0, self.z)
    def __exit__(self, *a): ZONE.pop(0)

def box(mname, x0, x1, y0, y1, z0, z1, rot=0.0, pivot=None, bevel=0.0):
    bm = _bm(mname)
    c = Vector(((x0+x1)/2, (y0+y1)/2, (z0+z1)/2)); s = Vector((abs(x1-x0), abs(y1-y0), abs(z1-z0)))
    S = Matrix.Diagonal((*s, 1))
    if rot:
        p = Vector(pivot) if pivot is not None else c
        mat = Matrix.Translation(p) @ Matrix.Rotation(rot,4,'Z') @ Matrix.Translation(c-p) @ S
    else:
        mat = Matrix.Translation(c) @ S
    verts = bmesh.ops.create_cube(bm, size=1.0, matrix=mat)['verts']
    if bevel > 0:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=min(bevel, min(s)*0.4), offset_type='OFFSET',
                        segments=1, profile=0.5, affect='EDGES')

def boxc(mname, cx, cy, cz, sx, sy, sz, rot=0.0, bevel=0.0):
    box(mname, cx-sx/2, cx+sx/2, cy-sy/2, cy+sy/2, cz-sz/2, cz+sz/2, rot=rot, bevel=bevel)

def cyl(mname, x, y, z0, z1, r, seg=12, r2=None, rotx=0.0):
    h = z1-z0
    mat = Matrix.Translation((x, y, z0+h/2))
    bmesh.ops.create_cone(_bm(mname), cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r, radius2=(r if r2 is None else r2), depth=h, matrix=mat)

def seg_between(mname, a, b, r0, r1=None, seg=8):
    """a tapered rod from point a to point b — trunks, cords, hip ridges"""
    a, b = Vector(a), Vector(b); d = b-a; L = d.length
    if L < 1e-6: return
    q = d.normalized().to_track_quat('Z', 'Y')
    mat = Matrix.Translation((a+b)/2) @ q.to_matrix().to_4x4()
    DETAIL.insert(0, True); bm = _bm(mname); DETAIL.pop(0)
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r0, radius2=(r0 if r1 is None else r1), depth=L, matrix=mat)

def ico(mname, x, y, z, r, sub=1, scl=(1,1,1), jitter=0.0):
    c = Vector((x,y,z))
    vs = bmesh.ops.create_icosphere(_bm(mname), subdivisions=sub, radius=r,
            matrix=Matrix.Translation(c) @ Matrix.Diagonal((*scl,1)))['verts']
    if jitter:
        for v in vs: v.co = c + (v.co-c)*(1+random.uniform(-jitter, jitter))

def face(mname, pts, uvs=None, n=None):
    """one polygon with its own UVs (or box-mapped later if none given).
       `n` is roughly which way it should face: if the winding says
       otherwise it is turned round, because a face baked from behind bakes
       black, and a hand-made loop of vertices is easy to wind backwards."""
    bm = _bm(mname)
    if n is not None:
        P = [Vector(p) for p in pts]
        nn = Vector((0,0,0))
        for i in range(len(P)):
            a, b = P[i], P[(i+1) % len(P)]
            nn += Vector(((a.y-b.y)*(a.z+b.z), (a.z-b.z)*(a.x+b.x), (a.x-b.x)*(a.y+b.y)))
        if nn.dot(Vector(n)) < 0:
            pts = list(pts)[::-1]
            if uvs is not None: uvs = list(uvs)[::-1]
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    if uvs is not None:
        uv = bm.loops.layers.uv["UV"]; cu = bm.faces.layers.int["cuv"]
        for l, t in zip(f.loops, uvs): l[uv].uv = t
        f[cu] = 1
    return f

def solid(x0, x1, y0, y1, z0, z1):
    SOLIDS.append((min(x0,x1), max(x0,x1), min(y0,y1), max(y0,y1), z0, z1))

# ------------------------------------------------------------------ walls
def wall(axis, a0, a1, c, z0, z1, mat_lo, mat_hi, holes=(), coll=True, t=T, zlo=None, zhi=None):
    """A wall along `axis` ('x' or 'y') from a0 to a1, centred on c across it.
       Two skins, so each side can be its own material: mat_lo faces the
       lower coordinate across the wall, mat_hi the higher. `holes` are
       (from, to, head) doorways, with the wall carried over them as a lintel."""
    holes = sorted(holes)
    spans, cur = [], a0
    for h0, h1, top in holes:
        if h0 > cur: spans.append((cur, h0, z0, z1))
        spans.append((h0, h1, top, z1))              # the lintel
        cur = h1
    if cur < a1: spans.append((cur, a1, z0, z1))
    for s0, s1, zb, zt in spans:
        if zt - zb < 0.01 or s1 - s0 < 0.01: continue
        for m, lo, hi, zn in ((mat_lo, c-t/2, c, zlo), (mat_hi, c, c+t/2, zhi)):
            with zone(zn or ZONE[0]):
                if axis == 'x': box(m, s0, s1, lo, hi, zb, zt)
                else:           box(m, lo, hi, s0, s1, zb, zt)
        if coll:
            if axis == 'x': solid(s0, s1, c-t/2, c+t/2, zb, zt)
            else:           solid(c-t/2, c+t/2, s0, s1, zb, zt)

def frame_door(axis, h0, h1, c, top, side=1, mat='lacquer', post=0.34):
    """posts and a head round a doorway, standing proud of the wall"""
    if axis == 'x':
        for x in (h0-post/2+0.02, h1+post/2-0.02):
            box(mat, x-post/2, x+post/2, c-T/2-0.12, c+T/2+0.12, 0, top+0.02)
        box(mat, h0-post, h1+post, c-T/2-0.14, c+T/2+0.14, top, top+0.45)
    else:
        for y in (h0-post/2+0.02, h1+post/2-0.02):
            box(mat, c-T/2-0.12, c+T/2+0.12, y-post/2, y+post/2, 0, top+0.02)
        box(mat, c-T/2-0.14, c+T/2+0.14, h0-post, h1+post, top, top+0.45)

# ------------------------------------------------------------------ roofs
def smooth(k): k=max(0.0,min(1.0,k)); return k*k*(3-2*k)

def roof(outer, inner, ze, zt, curve=1.7, up=1.0, thick=0.45, reach=5.5,
         rafters=True, cap=True, ridge_line=False):
    """A temple roof, as a surface lofted from the eave rectangle `outer`
       (x0,x1,y0,y1 at height ze) to `inner` (at zt). Concave — flat at the
       eave, steep at the top — which is the whole curve of a Japanese roof,
       and the corners lift, which is its whole character. An inner with no
       depth is a ridge: that is a hip roof. Anything else is a skirt round
       a storey above it.

       The corners lift by `up` metres, easing in over `reach` metres of
       eave either side. Tiles go on top, the rafters' dark underside below,
       a fascia round the edge, a rounded ridge down every hip."""
    ox0, ox1, oy0, oy1 = outer; ix0, ix1, iy0, iy1 = inner
    O = [Vector((ox0,oy0)), Vector((ox1,oy0)), Vector((ox1,oy1)), Vector((ox0,oy1))]
    I = [Vector((ix0,iy0)), Vector((ix1,iy0)), Vector((ix1,iy1)), Vector((ix0,iy1))]
    NV = 16
    def point(side, t, v, dz=0.0):
        a, b = O[side], O[(side+1)%4]; p, q = I[side], I[(side+1)%4]
        e = a+(b-a)*t; i = p+(q-p)*t
        L = (b-a).length
        d = min(t, 1-t)*L
        cw = max(0.0, 1-d/reach)**2
        xy = e+(i-e)*v
        # the corner flares outward as well as up, along its own diagonal
        if cw > 0:
            diag = (e - (O[0]+O[2])/2).normalized()
            xy = xy + diag*(up*0.55*cw*(1-v)**2)
        z = ze + (zt-ze)*(v**curve) + up*cw*(1-v)**2.4 + dz
        return Vector((xy.x, xy.y, z))
    uvT = MATS['tiles']['scale']
    hips = []
    ZONE.insert(0, 'roof')
    for side in range(4):
        a, b = O[side], O[(side+1)%4]; L = (b-a).length
        Li = (I[(side+1)%4]-I[side]).length
        NU = max(6, int(L*1.3))
        top = [[point(side, i/NU, j/NV) for j in range(NV+1)] for i in range(NU+1)]
        bot = [[point(side, i/NU, j/NV, -thick) for j in range(NV+1)] for i in range(NU+1)]
        # slope distance along each column, for the tile V
        for i in range(NU):
            for j in range(NV):
                p00, p10, p11, p01 = top[i][j], top[i+1][j], top[i+1][j+1], top[i][j+1]
                s0 = sum((top[i][k+1]-top[i][k]).length for k in range(j))
                s1 = s0 + (top[i][j+1]-top[i][j]).length
                u0 = (i/NU)*(L+(Li-L)*j/NV)/uvT; u1 = ((i+1)/NU)*(L+(Li-L)*j/NV)/uvT
                u0b = (i/NU)*(L+(Li-L)*(j+1)/NV)/uvT; u1b = ((i+1)/NU)*(L+(Li-L)*(j+1)/NV)/uvT
                face('tiles', [p00, p10, p11, p01], [(u0,s0/uvT),(u1,s0/uvT),(u1b,s1/uvT),(u0b,s1/uvT)])
                q00, q10, q11, q01 = bot[i][j], bot[i+1][j], bot[i+1][j+1], bot[i][j+1]
                face('darkwood', [q01, q11, q10, q00])
            # the fascia along the eave
            face('lacquer', [bot[i][0], bot[i+1][0], top[i+1][0], top[i][0]])
        hips.append([top[0][j] for j in range(NV+1)])
        # round tile ends (nokigawara) along the eave, one per row of tiles
        n = int(L/0.34)
        for k in range(1, n):
            t = k/n
            e = point(side, t, 0.0, 0.07); f = point(side, t, 0.035, 0.07)
            d = (e-f).normalized()
            seg_between('ridge', e - d*0.04, e + d*0.1, 0.12, 0.12, seg=8)
        if rafters:
            n = int(L/0.5)
            for k in range(2, n-1):
                t = k/n
                if min(t,1-t)*L < 1.2: continue
                e = point(side, t, 0.0, -thick-0.02); f = point(side, t, 0.1, -thick-0.02)
                seg_between('darkwood', e, f, 0.09, 0.09, seg=4)
                e2 = point(side, t, 0.07, -thick-0.2); f2 = point(side, t, 0.2, -thick-0.2)
                box_between('darkwood', e2, f2, 0.16, 0.2)
    for h in hips:          # a rounded ridge down each hip
        for j in range(len(h)-1):
            seg_between('ridge', h[j]+Vector((0,0,0.12)), h[j+1]+Vector((0,0,0.12)), 0.2, 0.2, seg=6)
        # and the tip of the corner turned up into a little horn
        tip = h[0]+Vector((0,0,0.1)); d = (h[0]-h[2]); d.z = 0; d.normalize()
        seg_between('ridge', tip, tip + d*0.7 + Vector((0,0,0.55)), 0.2, 0.06, seg=6)
    if cap and not ridge_line:
        # flashing where a skirt roof meets the storey above it
        box('ridge', ix0-0.25, ix1+0.25, iy0-0.25, iy0+0.05, zt-0.05, zt+0.35)
        box('ridge', ix0-0.25, ix1+0.25, iy1-0.05, iy1+0.25, zt-0.05, zt+0.35)
        box('ridge', ix0-0.25, ix0+0.05, iy0, iy1, zt-0.05, zt+0.35)
        box('ridge', ix1-0.05, ix1+0.25, iy0, iy1, zt-0.05, zt+0.35)
    if ridge_line:
        y = (iy0+iy1)/2
        seg_between('ridge', (ix0-0.3, y, zt+0.25), (ix1+0.3, y, zt+0.25), 0.42, 0.42, seg=8)
        box('ridge', ix0-0.2, ix1+0.2, y-0.3, y+0.3, zt-0.1, zt+0.45)
        for sx, x in ((-1, ix0), (1, ix1)):       # onigawara: the ridge ends, raised
            box('ridge', x-0.55, x+0.55, y-0.45, y+0.45, zt, zt+1.2, bevel=0.12)
            seg_between('ridge', (x, y, zt+1.1), (x+sx*0.9, y, zt+1.9), 0.32, 0.08, seg=6)

    ZONE.pop(0)

def box_between(mname, a, b, w, h):
    """a square-section timber from a to b (a rafter, a strut)"""
    a, b = Vector(a), Vector(b); d = b-a; L = d.length
    if L < 1e-6: return
    q = d.normalized().to_track_quat('X', 'Z')
    mat = Matrix.Translation((a+b)/2) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((L, w, h, 1))
    DETAIL.insert(0, True); bm = _bm(mname); DETAIL.pop(0)
    bmesh.ops.create_cube(bm, size=1.0, matrix=mat)

def brackets(pts, z, depth=1.0, mat='lacquer'):
    """tokyō: a stack of blocks at the head of a column, stepping out to
       carry the eave. Three tiers of wood, which is what makes an eave look
       held up rather than glued on."""
    with zone('ext'), detail():
      for (x, y, nx, ny) in pts:
        box(mat, x-0.36, x+0.36, y-0.36, y+0.36, z-0.05, z+0.28)                # the bearing block
        for k in range(3):
            o = k*depth*0.38; zz = z+0.28+k*0.36; L = 0.9+k*0.35
            cx, cy = x+nx*o, y+ny*o
            # an arm along the wall and one out from it, each with a block on its ends
            box(mat, cx-L/2, cx+L/2, cy-0.13, cy+0.13, zz, zz+0.2)
            box(mat, cx-0.13, cx+0.13, cy-L/2, cy+L/2, zz, zz+0.2)
            for ex, ey in ((L/2-0.14, 0), (-L/2+0.14, 0), (0, L/2-0.14), (0, -L/2+0.14)):
                box(mat, cx+ex-0.17, cx+ex+0.17, cy+ey-0.17, cy+ey+0.17, zz+0.2, zz+0.36)

# ================================================================ BUILDING
def podium():
    box('stone', -HW-1.8, HW+1.8, -HD-1.8, HD+1.8, -3.4, -0.02)
    # a border course round the top edge, and a darker plinth line below it
    for (x0,x1,y0,y1) in ((-HW-1.9,HW+1.9,-HD-1.9,-HD-1.4),(-HW-1.9,HW+1.9,HD+1.4,HD+1.9),
                          (-HW-1.9,-HW-1.4,-HD-1.4,HD+1.4),(HW+1.4,HW+1.9,-HD-1.4,HD+1.4)):
        box('stone', x0,x1,y0,y1,-0.35,0.06, bevel=0.05)
    # a rail along the front edge, either side of the stairs
    railing(-HW-1.5, -7.6, -HD-1.55); railing(7.6, HW+1.5, -HD-1.55)
    # grand stairs, down to where the ground actually is
    y = -HD-1.9; n = 8
    zb = plateY(0, y-8.2)
    for i in range(n):
        z = -(i+1)*(-zb)/n
        box('stone', -7.2, 7.2, y-(i+1)*1.02, y-i*1.02, z-0.6, z+(-zb)/n, bevel=0.03)
    for sx in (-1, 1):   # cheek walls either side of the flight
        for i in range(n):
            z = -(i+1)*(-zb)/n
            box('stone', sx*7.2-0.35, sx*7.2+0.35, y-(i+1)*1.02, y-i*1.02, z-0.8, z+(-zb)/n+0.55)

def railing(x0, x1, y, z=0.0, h=1.05):
    """a temple rail: posts with gold caps (giboshi), two rails, a kicker"""
    DETAIL.insert(0, True)
    n = max(1, int((x1-x0)/1.9))
    for k in range(n+1):
        x = x0 + k*(x1-x0)/n
        box('lacquer', x-0.09, x+0.09, y-0.09, y+0.09, z, z+h)
        ico('gold', x, y, z+h+0.1, 0.12, sub=2, scl=(1,1,1.4))
    for zz, t in ((z+h-0.12, 0.12), (z+0.55, 0.08), (z+0.08, 0.1)):
        box('lacquer', x0, x1, y-0.07, y+0.07, zz, zz+t)
    DETAIL.pop(0)
    solid(x0, x1, y-0.2, y+0.2, z, z+h)

def grounds():
    """moss round the podium, following the apron the game drapes over the
       ball, so the building sits in a garden instead of on grey plate"""
    X, Y = HW+1+APRON, HD+1+APRON
    N = 1.5
    xs = np.arange(-X, X+0.01, N); ys = np.arange(-Y, Y+0.01, N)
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            x0, x1, y0, y1 = xs[i], xs[i+1], ys[j], ys[j+1]
            if abs(x0) < HW+1.8 and abs(x1) < HW+1.8 and abs(y0) < HD+1.8 and abs(y1) < HD+1.8:
                continue
            cx, cy = (x0+x1)/2, (y0+y1)/2
            m = 'gravel' if (abs(cx) < 22 and cy < -HD-1) else 'moss'
            face(m, [(x0,y0,plateY(x0,y0)+0.07),(x1,y0,plateY(x1,y0)+0.07),
                     (x1,y1,plateY(x1,y1)+0.07),(x0,y1,plateY(x0,y1)+0.07)], n=(0,0,1))

def exterior_frame(axis, a0, a1, c, h, out, bays, skip=(), shoji=(5.4, 7.2)):
    """The timber frame on the outside of a wall: lacquered columns every bay,
       tie beams, and a band of paper lattice under the eave. `out` is which
       way the wall faces (+1/-1 across it)."""
    ZONE.insert(0, 'ext')
    n = max(1, round((a1-a0)/bays)); step = (a1-a0)/n
    face_c = c + out*(T/2)
    for k in range(n+1):
        a = a0 + k*step
        if any(s0 <= a <= s1 for s0, s1 in skip): continue
        if axis == 'x':
            cyl('lacquer', a, face_c+out*0.12, 0.25, h, 0.3, seg=16)
            cyl('stone', a, face_c+out*0.12, -0.05, 0.25, 0.46, seg=16, r2=0.4)     # the foundation stone
        else:
            cyl('lacquer', face_c+out*0.12, a, 0.25, h, 0.3, seg=16)
            cyl('stone', face_c+out*0.12, a, -0.05, 0.25, 0.46, seg=16, r2=0.4)
    # tie beams: the low one stops at a doorway instead of crossing it
    runs = [(a0, a1)]
    for q0, q1 in skip:
        runs = [r for rr in runs for r in ((rr[0], min(rr[1], q0)), (max(rr[0], q1), rr[1])) if r[1]-r[0] > 0.05]
    for (z0, z1), rr in (((2.9, 3.3), runs), ((h-0.9, h-0.3), [(a0, a1)])):
        for r0, r1 in rr:
            if axis == 'x': box('lacquer', r0, r1, face_c, face_c+out*0.3, z0, z1)
            else:           box('lacquer', face_c, face_c+out*0.3, r0, r1, z0, z1)
    def slab(m, u0, u1, depth, z0, z1, off=0.0):
        """a panel on the wall face, from u0 to u1 along it"""
        if axis == 'x': box(m, u0, u1, face_c+out*off, face_c+out*(off+depth), z0, z1)
        else:           box(m, face_c+out*off, face_c+out*(off+depth), u0, u1, z0, z1)
    for k in range(n):
        s0, s1 = a0+k*step+0.32, a0+(k+1)*step-0.32
        if any(not (s1 < q0 or s0 > q1) for q0, q1 in skip): continue
        # the lower half is boarded: vertical planks, a rail on top of them
        slab('darkwood', s0-0.3, s1+0.3, 0.05, 0.25, 2.85)
        DETAIL.insert(0, True)
        nb = int((s1-s0)/0.34)
        for j in range(nb+1):
            a = s0 + j*(s1-s0)/max(1, nb)
            slab('darkwood', a-0.025, a+0.025, 0.09, 0.25, 2.85)
        # the window band: a deep frame, paper at the back of it, and on
        # every other bay a screen of square slats in front (renji-mado)
        z0, z1 = shoji
        slab('darkwood', s0, s1, 0.16, z0-0.14, z0)
        slab('darkwood', s0, s1, 0.16, z1, z1+0.14)
        slab('darkwood', s0-0.02, s0+0.12, 0.16, z0, z1); slab('darkwood', s1-0.12, s1+0.02, 0.16, z0, z1)
        slab('shoji', s0+0.1, s1-0.1, 0.02, z0, z1, off=-0.05)
        if k % 2 == 0:
            ns = int((s1-s0)/0.16)
            for j in range(1, ns):
                a = s0 + j*(s1-s0)/ns
                slab('darkwood', a-0.035, a+0.035, 0.08, z0, z1, off=0.02)
        DETAIL.pop(0)
    ZONE.pop(0)
    return step

def painting(name, x, y, z, w, h, facing):
    """a framed ink painting hung on a wall; facing is the direction it looks"""
    fx, fy = facing
    d = 0.06
    if fx:
        box('darkwood', x, x+fx*d*2, y-w/2-0.12, y+w/2+0.12, z-h/2-0.12, z+h/2+0.12)
        xx = x+fx*(d*2+0.005)
        pts = [(xx, y+w/2*fx, z-h/2), (xx, y-w/2*fx, z-h/2), (xx, y-w/2*fx, z+h/2), (xx, y+w/2*fx, z+h/2)]
    else:
        box('darkwood', x-w/2-0.12, x+w/2+0.12, y, y+fy*d*2, z-h/2-0.12, z+h/2+0.12)
        yy = y+fy*(d*2+0.005)
        pts = [(x-w/2*fy, yy, z-h/2), (x+w/2*fy, yy, z-h/2), (x+w/2*fy, yy, z+h/2), (x-w/2*fy, yy, z+h/2)]
    face('art_'+name, pts, [(0,0),(1,0),(1,1),(0,1)])

def pavilion():
    x0, x1, y0, y1, h = -15, 15, -HD, -9, PAV_H
    box('floor', x0+0.3, x1-0.3, y0+0.3, y1-0.3, -0.02, 0.1)
    # front: the door the game has always had, framed and deep
    wall('x', x0, x1, y0, 0, h, 'plaster_w', 'plaster_w', holes=[(-DOOR_W/2, DOOR_W/2, DOOR_H)], zlo='ext')
    with zone('ext'): frame_door('x', -DOOR_W/2, DOOR_W/2, y0, DOOR_H, post=0.55)
    # back: through to the atrium
    wall('x', x0, x1, y1, 0, h, 'plaster_w', 'plaster_o', holes=[(-2.6, 2.6, PASS_H+0.6)], zhi='inner')
    frame_door('x', -2.6, 2.6, y1, PASS_H+0.6)
    exterior_frame('x', x0, x1, y0, h, -1, 5.0, skip=[(-DOOR_W/2-0.4, DOOR_W/2+0.4)])
    # sliding lattice doors, slid open either side of the doorway
    for sx in (-1, 1):
        box('darkwood', sx*DOOR_W/2, sx*(DOOR_W/2+2.3), y0+T/2, y0+T/2+0.1, 0.1, DOOR_H-0.1)
        box('shoji', sx*(DOOR_W/2+0.15), sx*(DOOR_W/2+2.15), y0+T/2+0.1, y0+T/2+0.12, 1.0, DOOR_H-0.4)
    # the plaque over the door: the game paints the name onto its face
    with zone('ext'):
        box('darkwood', -3.8, 3.8, y0-T/2-0.35, y0-T/2-0.05, 8.1, 9.7, bevel=0.06)
        box('gold', -3.95, 3.95, y0-T/2-0.3, y0-T/2-0.02, 7.95, 9.85)
    # inside: a coffered ceiling on lacquered columns, and lanterns
    box('darkwood', x0, x1, y0, y1, h-0.6, h-0.3)
    for k in range(1, 12):
        x = x0 + k*(x1-x0)/12
        box('darkwood', x-0.12, x+0.12, y0+0.3, y1-0.3, h-1.0, h-0.6)
    for k in range(1, 6):
        y = y0 + k*(y1-y0)/6
        box('darkwood', x0+0.3, x1-0.3, y-0.12, y+0.12, h-1.0, h-0.6)
    for (x, y) in ((-8.5,-19.5),(8.5,-19.5),(-8.5,-12.5),(8.5,-12.5)):
        cyl('stone', x, y, 0.1, 0.5, 0.62, seg=12)
        cyl('lacquer', x, y, 0.5, h-1.0, 0.38, seg=16)
        brackets([(x, y, 0, 0)], h-1.9, depth=0)
        solid(x-0.62, x+0.62, y-0.62, y+0.62, 0, h)
    for (x, y) in ((-4.8,-18),(4.8,-18),(-4.8,-13),(4.8,-13),(0,-15.5)):
        seg_between('black', (x, y, h-1.0), (x, y, 6.6), 0.02)
        cyl('lamp', x, y, 5.0, 6.6, 0.55, seg=16)
        cyl('black', x, y, 6.55, 6.75, 0.4, seg=12)
        cyl('black', x, y, 4.85, 5.05, 0.4, seg=12)
    # a painting either side of the way through
    painting('mountains', -8.0, y1-T/2, 3.4, 4.4, 3.3, (0,-1))
    painting('pine', 8.0, y1-T/2, 3.4, 4.4, 3.3, (0,-1))

def pagoda():
    """the three roofs over the pavilion — picture 1 — each with a storey,
       a balcony and brackets, getting smaller as it goes up"""
    # tier 1 roof over the hall
    roof((-18.5, 18.5, -HD-3.6, -7.6), (-11.5, 11.5, -19.5, -12.5), PAV_H+0.35, 13.7, up=1.25, reach=6.5)
    brackets([(x, -HD-0.1, 0, -1) for x in (-15, -10, -5, 5, 10, 15)] +
             [(x, -9.1, 0, 1) for x in (-15, -10, 10, 15)] +
             [(-15.1, y, -1, 0) for y in (-18, -13)] + [(15.1, y, 1, 0) for y in (-18, -13)],
             PAV_H-0.95)
    def storey(x0, x1, y0, y1, z0, z1, bays, bal):
        for axis, a0, a1, c, out in (('x',x0,x1,y0,-1),('x',x0,x1,y1,1),('y',y0,y1,x0,-1),('y',y0,y1,x1,1)):
            if axis == 'x': box('plaster_w', a0, a1, c-0.3, c+0.3, z0, z1)
            else:           box('plaster_w', c-0.3, c+0.3, a0, a1, z0, z1)
            n = max(1, round((a1-a0)/bays)); st = (a1-a0)/n
            for k in range(n+1):
                a = a0+k*st
                if axis == 'x': cyl('lacquer', a, c+out*0.35, z0, z1, 0.26, seg=10)
                else:           cyl('lacquer', c+out*0.35, a, z0, z1, 0.26, seg=10)
            for k in range(n):
                s0, s1 = a0+k*st+0.3, a0+(k+1)*st-0.3
                w0, w1 = z0+1.5, z1-1.1
                def sl(m, u0, u1, d, zz0, zz1, off=0.3):
                    if axis == 'x': box(m, u0, u1, c+out*off, c+out*(off+d), zz0, zz1)
                    else:           box(m, c+out*off, c+out*(off+d), u0, u1, zz0, zz1)
                sl('darkwood', s0, s1, 0.12, w0-0.12, w0); sl('darkwood', s0, s1, 0.12, w1, w1+0.12)
                sl('shoji', s0+0.08, s1-0.08, 0.02, w0, w1, off=0.28)
                if k % 2 == 0:
                    ns = int((s1-s0)/0.16)
                    for j in range(1, ns):
                        a = s0 + j*(s1-s0)/ns
                        sl('darkwood', a-0.035, a+0.035, 0.08, w0, w1, off=0.31)
                sl('darkwood', s0-0.28, s1+0.28, 0.05, z0+0.05, z0+1.2)
            if axis == 'x': box('lacquer', a0, a1, c+out*0.3, c+out*0.55, z1-0.7, z1-0.2)
            else:           box('lacquer', c+out*0.3, c+out*0.55, a0, a1, z1-0.7, z1-0.2)
        # the balcony round it, on brackets, with a lacquered rail
        bx0, bx1, by0, by1 = x0-bal, x1+bal, y0-bal, y1+bal
        zb = z0+0.15
        box('darkwood', bx0, bx1, by0, by1, zb-0.25, zb)
        DETAIL.insert(0, True)
        for (a0, a1, c, axis) in ((bx0,bx1,by0,'x'),(bx0,bx1,by1,'x'),(by0,by1,bx0,'y'),(by0,by1,bx1,'y')):
            n = int((a1-a0)/1.1)
            for k in range(n+1):
                a = a0+k*(a1-a0)/n
                if axis == 'x': box('lacquer', a-0.07, a+0.07, c-0.07, c+0.07, zb, zb+1.05)
                else:           box('lacquer', c-0.07, c+0.07, a-0.07, a+0.07, zb, zb+1.05)
            for zz in (zb+0.45, zb+1.0):
                if axis == 'x': box('lacquer', a0, a1, c-0.08, c+0.08, zz, zz+0.1)
                else:           box('lacquer', c-0.08, c+0.08, a0, a1, zz, zz+0.1)
        DETAIL.pop(0)
    storey(-11.5, 11.5, -19.5, -12.5, PAV_H, 16.6, 4.0, 1.1)
    roof((-14.6, 14.6, -22.9, -9.1), (-7.5, 7.5, -18.5, -13.5), 16.75, 19.4, up=1.0, reach=5.0)
    brackets([(x, -19.6, 0, -1) for x in (-11.5, -4, 4, 11.5)] + [(x, -12.4, 0, 1) for x in (-11.5, 11.5)],
             16.6-0.95)
    storey(-7.5, 7.5, -18.5, -13.5, 19.2, 22.0, 3.8, 0.8)
    roof((-10.6, 10.6, -21.6, -10.4), (-3.4, 3.4, -16.0, -16.0), 22.15, 27.0, up=0.95, reach=4.0,
         cap=False, ridge_line=True)
    brackets([(x, -18.6, 0, -1) for x in (-7.5, 0, 7.5)] + [(x, -13.4, 0, 1) for x in (-7.5, 7.5)], 22.0-0.95)
    # a finial on the ridge, gold rings on a spire
    ZONE.insert(0, 'roof')
    for k in range(6):
        cyl('gold', 0, -16, 27.4+k*0.45, 27.62+k*0.45, 0.55-k*0.06, seg=16)
    cyl('gold', 0, -16, 27.3, 30.3, 0.12, seg=8)
    ico('gold', 0, -16, 30.5, 0.32, sub=2)
    ZONE.pop(0)

def wing(sx):
    """a gallery — picture 2 — seventeen metres wide and the depth of the building"""
    xi, xo = sx*15, sx*HW
    lo, hi = min(xi, xo), max(xi, xo)
    box('floor', lo+0.3, hi-0.3, -HD+0.3, HD-0.3, -0.02, 0.1)
    # the outer wall, the ends, and the partition shared with the middle
    wall('y', -HD, HD, xo, 0, WING_H, *(('plaster_o','plaster_w') if sx > 0 else ('plaster_w','plaster_o')),
         **({'zhi':'ext'} if sx > 0 else {'zlo':'ext'}))
    for y in (-HD, HD):
        wall('x', lo, hi, y, 0, WING_H, *(('plaster_w','plaster_o') if y < 0 else ('plaster_o','plaster_w')),
             **({'zlo':'ext'} if y < 0 else {'zhi':'ext'}))
    holes = [(-19.0,-15.0,PASS_H),(2.0,6.0,PASS_H),(17.0,21.0,PASS_H)]
    # up to the middle's roof, so no gap shows over the gallery ceiling;
    # white on the entrance hall's side of it, olive everywhere else
    for (a0, a1, mid) in ((-HD, -9.0, 'plaster_w'), (-9.0, HD, 'plaster_o')):
        hs = [h for h in holes if a0 <= h[0] and h[1] <= a1]
        other = 'pav' if a1 <= -9.0 else 'inner'
        wall('y', a0, a1, xi, 0, INNER_H+0.6, *(( mid, 'plaster_o') if sx > 0 else ('plaster_o', mid)), holes=hs,
             **({'zlo': other} if sx > 0 else {'zhi': other}))
    for h0, h1, top in holes: frame_door('y', h0, h1, xi, top, mat='darkwood')
    # the partition shows above the gallery's eave: cap it in stone, like a parapet
    with zone('roof'):
        box('stone', min(xi, xi+sx*0.45), max(xi, xi+sx*0.45), -9.0, HD, WING_H-0.1, INNER_H+0.95)
    exterior_frame('y', -HD, HD, xo, WING_H, sx, 4.6)
    exterior_frame('x', lo, hi, -HD, WING_H, -1, 4.25)
    exterior_frame('x', lo, hi, HD, WING_H, 1, 4.25)
    # inside: the clerestory band of paper along the outer wall
    xin = xo - sx*(T/2+0.02)
    for k in range(10):
        y0 = -HD+0.8 + k*(2*HD-1.6)/10; y1 = y0 + (2*HD-1.6)/10 - 0.25
        box('shoji_in', min(xin-sx*0.03, xin), max(xin-sx*0.03, xin), y0, y1, 6.0, 7.6)
    box('darkwood', min(xin, xin-sx*0.2), max(xin, xin-sx*0.2), -HD, HD, 5.8, 6.0)
    box('darkwood', min(xin, xin-sx*0.2), max(xin, xin-sx*0.2), -HD, HD, 7.6, 7.8)
    # the ceiling: boards, cross beams, a head beam on a colonnade
    box('darkwood', lo, hi, -HD, HD, GALLERY_CEIL, GALLERY_CEIL+0.3)
    for k in range(16):
        y = -HD+1.5 + k*(2*HD-3)/15
        box('darkwood', lo+0.3, hi-0.3, y-0.17, y+0.17, GALLERY_CEIL-0.55, GALLERY_CEIL)
    xc = sx*21.0
    box('darkwood', xc-0.22, xc+0.22, -HD+0.3, HD-0.3, GALLERY_CEIL-0.75, GALLERY_CEIL)
    for k in range(9):
        y = -18.4 + k*4.6
        box('darkwood', xc-0.19, xc+0.19, y-0.19, y+0.19, 0.1, GALLERY_CEIL-0.7)
        solid(xc-0.25, xc+0.25, y-0.25, y+0.25, 0, GALLERY_CEIL)
    # track lighting: two black rails, cans along them
    for xr in (sx*24.0, sx*28.8):
        box('black', xr-0.05, xr+0.05, -HD+1, HD-1, GALLERY_CEIL-0.7, GALLERY_CEIL-0.6)
        for k in range(12):
            y = -20 + k*(40/11)
            seg_between('black', (xr, y, GALLERY_CEIL-0.7), (xr-sx*0.18, y, GALLERY_CEIL-1.05), 0.09, 0.11, seg=10)
    # paintings on the outer wall, lit by those cans
    order = ARTS if sx > 0 else ARTS[::-1]
    for k, a in enumerate(order):
        y = -19 + k*7.6
        w, h = (2.6, 3.4) if a not in ('koi','enso') else (3.6, 2.7)
        painting(a, xin, y, 3.3, w, h, (-sx, 0))
    # and a few on the partition wall, between its doors
    for a, y in ((ARTS[1], -6.5), (ARTS[3], 11.5)):
        painting(a, xi + sx*(T/2+0.01), y, 3.3, 2.6, 3.4, (sx, 0))
    # benches down the middle aisle
    for y in (-10, 10):
        box('darkwood', sx*25.4, sx*27.4, y-2.2, y+2.2, 0.1, 0.55, bevel=0.04)
        solid(sx*25.3, sx*27.5, y-2.3, y+2.3, 0, 0.9)
    # the roof: a hip over the whole wing
    ro = (min(sx*14.2, sx*34.6), max(sx*14.2, sx*34.6), -HD-2.4, HD+2.4)
    rx = sx*24.4
    roof(ro, (rx-0.01, rx+0.01, -14.5, 14.5), WING_H+0.25, 15.2, up=1.1, reach=6.0, cap=False)
    with zone('roof'):
        seg_between('ridge', (rx, -14.8, 15.45), (rx, 14.8, 15.45), 0.42, 0.42, seg=8)
        box('ridge', rx-0.3, rx+0.3, -14.8, 14.8, 15.0, 15.55)
        for y in (-14.8, 14.8):
            box('ridge', rx-0.5, rx+0.5, y-0.55, y+0.55, 15.0, 16.1, bevel=0.1)
            seg_between('ridge', (rx, y, 16.0), (rx, y+(0.9 if y > 0 else -0.9), 16.8), 0.32, 0.08, seg=6)
    brackets([(xo+sx*0.2, y, sx, 0) for y in (-18.4, -9.2, 0, 9.2, 18.4)], WING_H-0.95)

def ring_wall():
    """the atrium — picture 3: board-marked concrete, a round room, and a
       circle cut out of its ceiling"""
    N = 96
    openings = [0.0, math.pi/2, math.pi, 3*math.pi/2]
    half = 2.3/R_IN
    def in_open(a):
        for o in openings:
            d = abs((a-o+math.pi) % (2*math.pi) - math.pi)
            if d < half: return True
        return False
    sc = MATS['concrete']['scale']
    P = lambda r, a, z: Vector((RC.x+r*math.cos(a), RC.y+r*math.sin(a), z))
    for i in range(N):
        a0, a1 = 2*math.pi*i/N, 2*math.pi*(i+1)/N
        am = (a0+a1)/2
        zb = PASS_H if in_open(am) else 0.0
        u0, u1 = a0*R_IN/sc, a1*R_IN/sc
        rad = Vector((math.cos(am), math.sin(am), 0))
        for r, rev, z0, z1, zn in ((R_IN, True, zb, RING_TOP, 'inner'), (R_OUT, False, zb, INNER_H-0.6, 'inner'),
                                   (R_OUT, False, INNER_H+0.6, RING_TOP, 'roof')):
            if z1 <= z0: continue
            q = [P(r,a0,z0), P(r,a1,z0), P(r,a1,z1), P(r,a0,z1)]
            uv = [(u0,z0/sc),(u1,z0/sc),(u1,z1/sc),(u0,z1/sc)]
            with zone(zn): face('concrete', q, uv, n=(-rad if rev else rad))
        with zone('roof'):
            face('concrete', [P(R_IN,a0,RING_TOP),P(R_IN,a1,RING_TOP),P(R_OUT,a1,RING_TOP),P(R_OUT,a0,RING_TOP)],
                 [(u0,0),(u1,0),(u1,0.3),(u0,0.3)], n=(0,0,1))
        if zb > 0:     # the soffit over a doorway
            face('concrete', [P(R_IN,a0,zb),P(R_OUT,a0,zb),P(R_OUT,a1,zb),P(R_IN,a1,zb)],
                 [(u0,0),(u0,0.3),(u1,0.3),(u1,0)], n=(0,0,-1))
        # jambs where a doorway starts or stops
        prev = in_open(am - 2*math.pi/N); nxt = in_open(am + 2*math.pi/N)
        if zb == 0 and nxt and not in_open(am):
            face('concrete', [P(R_IN,a1,0),P(R_OUT,a1,0),P(R_OUT,a1,PASS_H),P(R_IN,a1,PASS_H)],
                 [(0,0),(0.3,0),(0.3,PASS_H/sc),(0,PASS_H/sc)], n=(-math.sin(a1), math.cos(a1), 0))
        if zb == 0 and prev and not in_open(am):
            face('concrete', [P(R_OUT,a0,0),P(R_IN,a0,0),P(R_IN,a0,PASS_H),P(R_OUT,a0,PASS_H)],
                 [(0,0),(0.3,0),(0.3,PASS_H/sc),(0,PASS_H/sc)], n=(math.sin(a0), -math.cos(a0), 0))
        # (collision for the ring is a true circle — see write_layout's circles —
        # not boxes: ninety-six squares round a curve is a staircase you snag on)
    # pilasters on the inside face, the rhythm in picture 3
    for k in range(32):
        a = 2*math.pi*(k+0.5)/32
        if in_open(a) or in_open(a+0.06) or in_open(a-0.06): continue
        c = P(R_IN-0.09, a, 0)
        boxc('concrete', c.x, c.y, ATRIUM_CEIL/2, 0.55, 0.2, ATRIUM_CEIL, rot=a)
    # the ceiling: a concrete ring with the oculus through it
    M2 = 128
    for i in range(M2):
        a0, a1 = 2*math.pi*i/M2, 2*math.pi*(i+1)/M2
        u0, u1 = a0*OCULUS/sc, a1*OCULUS/sc
        am = (a0+a1)/2; rad = Vector((math.cos(am), math.sin(am), 0))
        face('concrete', [P(OCULUS,a1,ATRIUM_CEIL),P(OCULUS,a0,ATRIUM_CEIL),P(R_IN,a0,ATRIUM_CEIL),P(R_IN,a1,ATRIUM_CEIL)],
             [(u1,0),(u0,0),(u0,1.2),(u1,1.2)], n=(0,0,-1))
        ZONE.insert(0, 'roof')
        face('concrete', [P(OCULUS,a0,RING_TOP),P(OCULUS,a1,RING_TOP),P(R_OUT,a1,RING_TOP),P(R_OUT,a0,RING_TOP)],
             [(u0,0),(u1,0),(u1,1.4),(u0,1.4)], n=(0,0,1))
        face('concrete', [P(OCULUS,a0,ATRIUM_CEIL),P(OCULUS,a1,ATRIUM_CEIL),P(OCULUS,a1,RING_TOP),P(OCULUS,a0,RING_TOP)],
             [(u0,0),(u1,0),(u1,0.5),(u0,0.5)], n=-rad)
        # the planted ring on top, for the cherry trees
        face('moss', [P(7.4,a0,RING_TOP+0.25),P(7.4,a1,RING_TOP+0.25),P(10.3,a1,RING_TOP+0.25),P(10.3,a0,RING_TOP+0.25)], n=(0,0,1))
        for r, sgn in ((7.3, -1), (10.4, 1)):
            face('concrete', [P(r,a0,RING_TOP),P(r,a1,RING_TOP),P(r,a1,RING_TOP+0.35),P(r,a0,RING_TOP+0.35)],
                 [(u0,0),(u1,0),(u1,0.13),(u0,0.13)], n=rad*sgn)
        ZONE.pop(0)

def atrium_floor():
    M2 = 128; sc = MATS['stone']['scale']
    P = lambda r, a, z: Vector((RC.x+r*math.cos(a), RC.y+r*math.sin(a), z))
    for i in range(M2):
        a0, a1 = 2*math.pi*i/M2, 2*math.pi*(i+1)/M2
        am = (a0+a1)/2; rad = Vector((math.cos(am), math.sin(am), 0))
        face('stone', [P(CURB_R,a0,0.12),P(CURB_R,a1,0.12),P(R_IN,a1,0.12),P(R_IN,a0,0.12)], n=(0,0,1))
        face('stone', [P(POOL_R,a0,CURB_Z),P(POOL_R,a1,CURB_Z),P(CURB_R,a1,CURB_Z),P(CURB_R,a0,CURB_Z)], n=(0,0,1))
        face('stone', [P(CURB_R,a0,0.12),P(CURB_R,a1,0.12),P(CURB_R,a1,CURB_Z),P(CURB_R,a0,CURB_Z)], n=rad)
        face('basin', [P(POOL_R,a0,-0.6),P(POOL_R,a1,-0.6),P(POOL_R,a1,CURB_Z),P(POOL_R,a0,CURB_Z)], n=-rad)
        face('basin', [P(0,a0,-0.6),P(POOL_R,a0,-0.6),P(POOL_R,a1,-0.6)], n=(0,0,1))
    # nobody walks into the pool: a disk collider, written with the layout

def rect_minus_disk(mname, x0, x1, y0, y1, r, z, up=True):
    """a flat rectangle with the circle round RC taken out of it, as a fan of
       quads from the circle to the rectangle's edge — one clean ring, not a
       staircase of squares round a round room"""
    corners = [(x1,y1),(x0,y1),(x0,y0),(x1,y0)]
    angs = [2*math.pi*i/160 for i in range(160)]
    angs += [math.atan2(cy-RC.y, cx-RC.x) % (2*math.pi) for cx, cy in corners]
    angs = sorted(set(round(a, 6) for a in angs))
    def edge(a):
        dx, dy = math.cos(a), math.sin(a); ts = []
        if dx > 1e-9: ts.append((x1-RC.x)/dx)
        if dx < -1e-9: ts.append((x0-RC.x)/dx)
        if dy > 1e-9: ts.append((y1-RC.y)/dy)
        if dy < -1e-9: ts.append((y0-RC.y)/dy)
        t = min(ts); return (RC.x+dx*t, RC.y+dy*t)
    for i in range(len(angs)):
        a0, a1 = angs[i], angs[(i+1) % len(angs)] + (2*math.pi if i == len(angs)-1 else 0)
        i0 = (RC.x+r*math.cos(a0), RC.y+r*math.sin(a0)); i1 = (RC.x+r*math.cos(a1), RC.y+r*math.sin(a1))
        e0, e1 = edge(a0), edge(a1)
        face(mname, [(*i0, z), (*i1, z), (*e1, z), (*e0, z)], n=(0, 0, 1 if up else -1))

def inner_zone():
    """the ring's surroundings: the ambulatory round it and the back hall"""
    x0, x1, y0, y1 = -15, 15, -9, HD
    # floor, ceiling and flat roof: the rectangle with the ring cut out of it
    rect_minus_disk('floor', x0, x1, y0, y1, R_OUT-0.2, 0.1, up=True)
    rect_minus_disk('darkwood', x0, x1, y0, y1, R_OUT, INNER_H-0.6, up=False)
    with zone('roof'):
        rect_minus_disk('gravel', x0, x1, y0, y1, R_OUT, INNER_H+0.6, up=True)
    # the back wall, with an alcove (tokonoma) in the middle of it
    wall('x', x0, x1, y1, 0, INNER_H+0.6, 'plaster_o', 'plaster_w', holes=[(-3.2, 3.2, 7.2)], zhi='ext')
    box('plaster_o', -3.4, 3.4, y1+1.8, y1+2.1, 0, INNER_H)          # the alcove's back
    box('plaster_o', -3.8, -3.2, y1, y1+2.0, 0, INNER_H); box('plaster_o', 3.2, 3.8, y1, y1+2.0, 0, INNER_H)
    solid(-3.8, 3.8, y1, y1+2.0, 0, INNER_H)
    box('darkwood', -3.2, 3.2, y1-0.1, y1+1.9, 0.1, 0.55, bevel=0.03)   # its raised floor
    frame_door('x', -3.2, 3.2, y1, 7.2, mat='darkwood')
    painting('enso', 0, y1+1.8, 4.0, 3.6, 2.7, (0,-1))
    # an ikebana on the alcove floor: a dark vase and one branch of blossom
    cyl('black', 2.0, y1+1.2, 0.55, 1.35, 0.28, seg=16, r2=0.18)
    seg_between('bark', (2.0, y1+1.2, 1.3), (1.2, y1+1.1, 2.6), 0.05, 0.02)
    seg_between('bark', (1.4, y1+1.1, 2.3), (0.6, y1+1.2, 2.9), 0.03, 0.015)
    for p in ((1.2,y1+1.1,2.62),(0.6,y1+1.2,2.95),(1.5,y1+1.1,2.4),(0.9,y1+1.15,2.8)):
        ico('blossom', *p, 0.2, sub=2, jitter=0.25)
    # the back hall's lanterns and a lacquered beam across its middle
    box('darkwood', x0+0.3, x1-0.3, 18.8, 19.2, INNER_H-1.3, INNER_H-0.6)
    for x in (-10, -3.5, 3.5, 10):
        seg_between('black', (x, 18.1, INNER_H-0.6), (x, 18.1, 7.0), 0.02)
        cyl('lamp', x, 18.1, 5.6, 7.0, 0.45, seg=16)
        cyl('black', x, 18.1, 6.95, 7.12, 0.33, seg=12); cyl('black', x, 18.1, 5.45, 5.62, 0.33, seg=12)
    # parapet round the flat roof
    with zone('roof'):
        box('stone', x0, x1, y1-0.3, y1+0.3, INNER_H+0.6, INNER_H+1.2)
        # a dry garden on the flat roof round the ring: moss islands in the gravel
        for (mx, my, r) in ((-11.5, -6.5, 1.8), (11.8, -5.5, 1.5), (-12.0, 17.5, 2.2), (12.2, 19.0, 1.9),
                            (-4.5, 19.8, 1.4), (5.5, 20.5, 1.6), (-12.8, 6.0, 1.3), (12.9, 8.5, 1.4)):
            ico('moss', mx, my, INNER_H+0.55, r, sub=3, scl=(1.3, 1.0, 0.28), jitter=0.05)
    for (mx, my, sz) in ((-11.8, 17.2, 1.3), (12.0, -5.2, 1.0), (5.2, 20.4, 0.9)):
        PROPS.append(('boulder', mx, my, INNER_H+0.5, sz, random.uniform(0, 6.28), None))

def cherry(x, y, z, lean, s=1.0):
    """a cherry tree leaning in over the oculus: a trunk in three bends,
       branches, and a cloud of blossom out on their ends"""
    lx, ly = lean
    p0 = Vector((x, y, z))
    p1 = p0 + Vector((lx*0.8*s, ly*0.8*s, 2.2*s))
    p2 = p1 + Vector((lx*1.4*s, ly*1.4*s, 1.9*s))
    seg_between('bark', p0, p1, 0.36*s, 0.28*s, seg=8)
    seg_between('bark', p1, p2, 0.28*s, 0.2*s, seg=8)
    tips = []
    for k in range(6):
        a = k*math.pi/3 + random.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        d = (d + Vector((lx, ly, 0))*0.9).normalized()
        e = p2 + d*random.uniform(1.6, 2.6)*s + Vector((0, 0, random.uniform(0.6, 1.8)*s))
        seg_between('bark', p2, e, 0.16*s, 0.06*s, seg=6)
        tips.append(e)
    for e in tips + [p2+Vector((0,0,1.4*s))]:
        for _ in range(7):
            o = Vector((random.uniform(-1,1), random.uniform(-1,1), random.uniform(-0.5,0.7)))*1.1*s
            ico('blossom', *(e+o), random.uniform(0.55, 0.95)*s, sub=1,
                scl=(1, 1, 0.8), jitter=0.25)

def pine(x, y, z, s=1.0):
    """a cloud-pruned pine: a crooked trunk and flat pads of needles"""
    pts = [Vector((x, y, z))]
    d = Vector((random.uniform(-1,1), random.uniform(-1,1), 0)).normalized()
    for k in range(4):
        pts.append(pts[-1] + Vector((d.x*0.9*s, d.y*0.9*s, 1.5*s)))
        d = Vector((-d.y, d.x, 0)) if k % 2 else d
    for k in range(len(pts)-1):
        seg_between('bark', pts[k], pts[k+1], (0.42-0.08*k)*s, (0.34-0.08*k)*s, seg=8)
    for k, p in enumerate(pts[1:]):
        for side in (-1, 1):
            a = random.uniform(0, 2*math.pi)
            e = p + Vector((math.cos(a)*2.2*s*side, math.sin(a)*2.2*s*side, 0.3*s))
            seg_between('bark', p, e, 0.14*s, 0.08*s, seg=6)
            for _ in range(5):
                o = Vector((random.uniform(-1,1), random.uniform(-1,1), random.uniform(-0.1,0.2)))*1.1*s
                ico('pine', *(e+o), random.uniform(0.8, 1.2)*s, sub=1, scl=(1.3,1.3,0.5), jitter=0.2)
    top = pts[-1] + Vector((0,0,0.5*s))
    for _ in range(6):
        o = Vector((random.uniform(-1,1), random.uniform(-1,1), random.uniform(0,0.4)))*1.0*s
        ico('pine', *(top+o), random.uniform(0.9,1.3)*s, sub=1, scl=(1.3,1.3,0.55), jitter=0.2)

def lantern(x, y, z, s=1.0):
    """tōrō: a stone lantern — base, shaft, the box with the light in it,
       a wide roof with turned-up corners and a jewel on top"""
    cyl('stone', x, y, z, z+0.25*s, 0.75*s, seg=6)
    cyl('stone', x, y, z+0.25*s, z+1.35*s, 0.24*s, seg=10)
    cyl('stone', x, y, z+1.35*s, z+1.6*s, 0.62*s, seg=6)
    cyl('lamp', x, y, z+1.6*s, z+2.2*s, 0.36*s, seg=6)
    for k in range(6):
        a = k*math.pi/3
        seg_between('stone', (x+math.cos(a)*0.42*s, y+math.sin(a)*0.42*s, z+1.6*s),
                    (x+math.cos(a)*0.42*s, y+math.sin(a)*0.42*s, z+2.2*s), 0.07*s)
    cyl('stone', x, y, z+2.2*s, z+2.5*s, 1.0*s, seg=6, r2=0.55*s)
    cyl('stone', x, y, z+2.5*s, z+2.85*s, 0.55*s, seg=6, r2=0.12*s)
    ico('stone', x, y, z+2.95*s, 0.17*s, sub=1)

def garden():
    # lanterns: at the foot of the stairs, before each wing, and down the sides
    for (x, y, r) in ((-9.4, -31.0, 0.3), (9.4, -31.0, -0.3), (-24, -28.0, 0.1), (24, -28.0, -0.2),
                      (-37.5, 12, 1.2), (37.5, 12, -1.1), (-37.5, -12, 1.5), (37.5, -12, -1.4)):
        PROPS.append(('lantern', x, y, plateY(x, y), 2.9, r, None))
    # pines at the corners and down the flanks
    for (x, y, h) in ((-30.5, -29.8, 6.4), (31.0, -29.4, 5.6), (-38.5, -1, 5.2), (38.6, -3, 6.0),
                      (-37, 26, 5.4), (36.8, 20, 6.2)):
        PROPS.append(('pine', x, y, plateY(x, y), h, random.uniform(0, 6.28), None))
    # boulders among the moss
    for k in range(18):
        x = random.uniform(-41, 41); y = random.uniform(-32, 32)
        if abs(x) < HW+3.2 and abs(y) < HD+3.2: continue
        if abs(x) < 9 and y < -HD: continue
        PROPS.append(('boulder', x, y, plateY(x, y)-0.15, random.uniform(0.7, 1.8), random.uniform(0, 6.28), None))
    # clipped shrubs along the front of the podium
    for sx in (-1, 1):
        for k in range(8):
            x = sx*(10.8 + k*2.6); y = -HD-3.4 + random.uniform(-0.3, 0.3)
            ico('hedge', x, y, plateY(x, y)+0.3, random.uniform(0.85, 1.25), sub=3, scl=(1.2,1,0.72), jitter=0.05)
    for k in range(26):
        x = random.uniform(-40, 40); y = random.uniform(-31, 31)
        if abs(x) < HW+3 and abs(y) < HD+3: continue
        if abs(x) < 8 and y < -HD: continue
        ico('moss', x, y, plateY(x, y)-0.1, random.uniform(0.9, 1.6), sub=3, scl=(1.4,1.2,0.4), jitter=0.06)
    # cherries in the back corners of the grounds
    for (x, y) in ((-38, 30), (38, 30.5)):
        PROPS.append(('cherry', x, y, plateY(x, y), 8.0, random.uniform(0, 6.28), None))

def atrium_trees():
    for k, a in enumerate((0.35, 1.65, 2.75, 3.95, 5.2)):
        x = RC.x + 8.9*math.cos(a); y = RC.y + 8.9*math.sin(a)
        # leaning in over the oculus, so their blossom hangs across the sky
        PROPS.append(('cherry', x, y, RING_TOP+0.25, 6.4+0.5*(k % 2), a+math.pi, (RC.x-x, RC.y-y)))

PROP_SIZE = {'lantern': 'height', 'pine': 'height', 'cherry': 'height', 'boulder': 'height'}
def import_props():
    """Higgsfield's models of the real thing where they exist; the hand-made
       ones where they do not, so a missing file is a worse garden, not a
       broken build. One mesh per kind, linked into every place it stands."""
    col = bpy.data.collections.new("Props"); scene.collection.children.link(col)
    tmpl = {}
    for kind in sorted({p[0] for p in PROPS}):
        path = os.path.join(SRC, "props", kind+".glb")
        if not os.path.exists(path): continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        meshes = [o for o in new if o.type == 'MESH']
        if not meshes: continue
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new("P_"+kind); bm = bmesh.new()
        for o in meshes:
            t = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); t.transform(o.matrix_world)
            bm.from_mesh(t); bpy.data.meshes.remove(t)
        mats = []
        for o in meshes:
            for m in o.data.materials:
                if m and m not in mats: mats.append(m)
        # Higgsfield ships the colour as an emissive map at full strength and
        # no metalness, which reads as a glowing chrome object. Matte it.
        for m in mats:
            b = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
            if not b: continue
            for l in list(b.inputs["Emission Color"].links): m.node_tree.links.remove(l)
            b.inputs["Emission Strength"].default_value = 0.0
            b.inputs["Metallic"].default_value = 0.0
            b.inputs["Roughness"].default_value = 0.85
        # stand it on its own base, centred, one unit tall
        xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
        h = max(zs)-min(zs)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(-(max(xs)+min(xs))/2, -(max(ys)+min(ys))/2, -min(zs)))
        bmesh.ops.scale(bm, verts=bm.verts, vec=(1/h, 1/h, 1/h))
        bm.to_mesh(me); bm.free()
        for m in mats: me.materials.append(m)
        for o in new: bpy.data.objects.remove(o, do_unlink=True)
        tmpl[kind] = me
    placed = 0
    for kind, x, y, z, size, rot, lean in PROPS:
        if kind in tmpl:
            ob = bpy.data.objects.new("P_"+kind, tmpl[kind]); col.objects.link(ob)
            ob.location = (x, y, z); ob.scale = (size, size, size)
            e = [0.0, 0.0, rot]
            if lean:
                d = Vector((lean[0], lean[1], 0)).normalized()*0.2       # ~11 degrees in over the oculus
                e[0] = -d.y; e[1] = d.x
            ob.rotation_euler = e
            placed += 1
        else:
            with zone('props'):
                if kind == 'cherry':
                    cherry(x, y, z, tuple((Vector(lean).normalized()*0.55)[:2]) if lean else (0, -0.3), size/7.0)
                elif kind == 'pine': pine(x, y, z, size/5.5)
                elif kind == 'lantern': lantern(x, y, z, size/2.9)
                elif kind == 'boulder': ico('stone', x, y, z+0.2, size*0.55, sub=2, scl=(1.3,1,0.7), jitter=0.2)
    print("PROPS", placed, "imported of", len(PROPS), "kinds:", sorted(tmpl))
    return col

# ---------------------------------------------------------------- assemble
PROPS = []           # (kind, x, y, z, size, rotation, lean): Higgsfield models, placed below
with zone('ext'):     podium()
with zone('grounds'): grounds()
with zone('pav'):     pavilion()
with zone('ext'):     pagoda()
with zone('wings'):   wing(1); wing(-1)
with zone('inner'):   ring_wall(); atrium_floor(); inner_zone()
with zone('grounds'): garden()
atrium_trees()
import_props()

OBJS = {}
def finalize():
    col = bpy.data.collections.new("Temple"); scene.collection.children.link(col)
    zones = sorted({z for z, _ in BMS})
    for zn in zones:
        me = bpy.data.meshes.new("T_"+zn); bm_all = bmesh.new()
        uvA = bm_all.loops.layers.uv.new("UV")
        slots = []
        for (z, name), bm in BMS.items():
            if z != zn or not bm.faces: continue
            bm.normal_update()
            uv = bm.loops.layers.uv["UV"]; cu = bm.faces.layers.int["cuv"]; sc = MATS[name]['scale']
            for f in bm.faces:
                if f[cu]: continue
                n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
                for l in f.loops:
                    c = l.vert.co
                    u, v = ((c.x, c.y) if ax == 2 else (c.x, c.z) if ax == 1 else (c.y, c.z))
                    l[uv].uv = (u/sc, v/sc)
            tmp = bpy.data.meshes.new("tmp"); bm.to_mesh(tmp)
            idx = len(slots); slots.append(name)
            for poly in tmp.polygons: poly.material_index = idx
            bm_all.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        bmesh.ops.remove_doubles(bm_all, verts=bm_all.verts, dist=0.0005)
        bm_all.to_mesh(me); bm_all.free()
        for name in slots: me.materials.append(MATS[name]['mat'])
        ob = bpy.data.objects.new("T_"+zn, me); col.objects.link(ob)
        OBJS[zn] = ob
    return col
finalize()
tris = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in OBJS.values())
print("TEMPLE", len(OBJS), "zones", tris, "triangles", len(SOLIDS), "solids")

# ------------------------------------------------------------ light & sky
SUN_DIR = Vector((150, -76, 120)).normalized()      # toward the sun, planet.js SUN_*
def lighting(bake=False):
    w = bpy.data.worlds.new("Senio"); scene.world = w
    try: w.use_nodes = True
    except Exception: pass
    nt = w.node_tree; bg = nt.nodes["Background"]
    # what lights things: the game's hemisphere fill; what you see: its navy sky
    lp = nt.nodes.new("ShaderNodeLightPath"); mix = nt.nodes.new("ShaderNodeMixShader")
    fill = nt.nodes.new("ShaderNodeBackground"); fill.inputs[0].default_value = (0.72, 0.82, 1.0, 1)
    fill.inputs[1].default_value = 0.62/math.pi
    bg.inputs[0].default_value = (0.0024, 0.003, 0.012, 1); bg.inputs[1].default_value = 1.0
    out = nt.nodes["World Output"]
    nt.links.new(fill.outputs[0], mix.inputs[1]); nt.links.new(bg.outputs[0], mix.inputs[2])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0]); nt.links.new(mix.outputs[0], out.inputs[0])
    sun = bpy.data.lights.new("Sun", 'SUN'); sun.energy = 1.62
    sun.color = (1.0, 0.95, 0.88); sun.angle = math.radians(1.5)
    so = bpy.data.objects.new("Sun", sun); scene.collection.objects.link(so)
    so.rotation_euler = (-SUN_DIR).to_track_quat('-Z', 'Y').to_euler()
    # the interior lamps the bake remembers: gallery cans, lanterns
    def point(name, p, watts, col=(1.0, 0.82, 0.62), r=0.15, spot=None):
        L = bpy.data.lights.new(name, 'SPOT' if spot else 'POINT'); L.energy = watts; L.color = col
        L.shadow_soft_size = r
        if spot: L.spot_size = spot; L.spot_blend = 0.6
        o = bpy.data.objects.new(name, L); o.location = p; scene.collection.objects.link(o)
        return o
    for sx in (-1, 1):
        for xr in (sx*24.0, sx*28.8):
            for k in range(12):
                y = -20 + k*(40/11)
                o = point("can", (xr-sx*0.2, y, GALLERY_CEIL-1.1), 180, spot=math.radians(55))
                tgt = Vector((sx*31.5 if abs(xr) > 26 else sx*21, y, 1.8))
                o.rotation_euler = (tgt-o.location).to_track_quat('-Z','Y').to_euler()
    for (x, y) in ((-4.8,-18),(4.8,-18),(-4.8,-13),(4.8,-13),(0,-15.5)):
        point("lantern", (x, y, 5.8), 420, r=0.5)
    for (x, y) in ((-13.5, -20), (13.5, -20), (-13.5, -11.5), (13.5, -11.5)):
        point("cove", (x, y, 8.6), 260, col=(1.0, 0.85, 0.68), r=0.9)
    for x in (-10, -3.5, 3.5, 10):
        point("lantern", (x, 18.1, 6.3), 320, r=0.45)
    point("alcove", (0, 21.5, 7.0), 220, spot=math.radians(70)).rotation_euler = (0.0, 0, 0)
    for (x, y) in ((-9.2, -30.6), (9.2, -30.6), (-24, -27.8), (24, -27.8), (-37.5, 12), (37.5, 12)):
        point("toro", (x, y, plateY(x, y)+2.05), 25, r=0.3)
    def panel_light(name, p, size, watts, col=(1.0, 0.88, 0.74), shape='RECTANGLE'):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = watts; L.color = col
        L.shape = shape
        if shape == 'DISK': L.size = size
        else: L.size, L.size_y = size
        o = bpy.data.objects.new(name, L); o.location = p; scene.collection.objects.link(o)
        o.visible_camera = False; o.visible_glossy = False
        return o
    # the galleries: a grid of soft panels between the ceiling beams
    for sx in (-1, 1):
        for xc in (sx*18.2, sx*23.5, sx*28.8):
            for k in range(8):
                y = -19.7 + k*(39.4/7)
                panel_light("gal", (xc, y, GALLERY_CEIL-0.6), (3.6, 2.4), 150)
    # the entrance hall and the back hall
    for x in (-10, 0, 10):
        for y in (-19.5, -12.5):
            panel_light("pav", (x, y, PAV_H-1.1), (4.0, 3.0), 170)
        panel_light("backhall", (x, 18.8, INNER_H-1.3), (4.0, 3.0), 170)
    for sx in (-1, 1):
        for y in (-6, 1, 8, 13):
            panel_light("amb", (sx*12.9, y, INNER_H-1.3), (2.6, 3.0), 110)
    # sky light down through the oculus: the open sky the world's navy
    # backdrop does not give, cool and soft
    panel_light("sky", (RC.x, RC.y, RING_TOP-0.2), 2*OCULUS*0.95, 520, col=(0.82, 0.9, 1.0), shape='DISK')
    # the ambulatory is lit by its doorways and a few coves
    for (x, y) in ((-12.9, -3), (12.9, -3), (-12.9, 10), (12.9, 10)):
        point("cove", (x, y, 8.8), 160, col=(1.0, 0.86, 0.7), r=0.8)

# ------------------------------------------------------------------ preview
CAMS = {
    'front':   ((40, -84, 6.0),  (0, -8, 11.0), 40),
    'stairs':  ((9, -42, 2.4),   (0, -22, 7.5), 58),
    'aerial':  ((62, -74, 58),   (0, 0, 4),     36),
    'hall':    ((0, -21.0, 1.9), (0, 10, 3.2),  60),
    'atrium':  ((6.8, -0.5, 1.6),(-3, 8, 7.5),  78),
    'gallery': ((22.6, -21.5, 1.9),(23.5, 12, 2.6), 62),
    'back':    ((0, 12.6, 1.9),  (0, 23, 3.4),  64),
}
def use_gpu():
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences
        pr.compute_device_type = 'METAL'; pr.get_devices()
        for d in pr.devices: d.use = True
        scene.cycles.device = 'GPU'
    except Exception as e:
        print("GPU unavailable:", e)

def render_views(names, path_fmt, engine='CYCLES', samples=64):
    scene.render.engine = engine
    if engine == 'CYCLES':
        use_gpu()
        scene.cycles.samples = samples; scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 6
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.view_settings.view_transform = 'AgX'
    try: scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    for n in names:
        loc, tgt, lens = CAMS[n]
        cd = bpy.data.cameras.new(n); cd.lens_unit = 'FOV'; cd.angle = math.radians(lens)
        cd.clip_start = 0.1; cd.clip_end = 600
        co = bpy.data.objects.new("cam_"+n, cd); scene.collection.objects.link(co)
        co.location = loc
        co.rotation_euler = (Vector(tgt)-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.camera = co
        scene.render.filepath = path_fmt % n
        bpy.ops.render.render(write_still=True)
        print("RENDERED", scene.render.filepath)

if MODE == "preview":
    lighting(bake=False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "temple.blend"))
    render_views(ONLY or list(CAMS), os.path.join(REN, "%s.png"))

# ==================================================================== BAKE
def deselect_all():
    """objects removed after the prop import can linger in the view layer as
       empty entries until it next updates; skip them rather than trip on them"""
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        try: o.select_set(False)
        except Exception: pass
ZONE_SIZE = {'roof': 4096, 'ext': 4096, 'wings': 4096, 'inner': 4096, 'pav': 2048, 'grounds': 2048, 'props': 1024,
             'roof_d': 2048, 'ext_d': 2048, 'wings_d': 1024, 'inner_d': 1024, 'pav_d': 1024, 'grounds_d': 1024, 'props_d': 1024}

def unwrap(ob):
    """a second UV set that gives every face its own patch of the bake"""
    deselect_all()
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    lm = ob.data.uv_layers.new(name="LM"); ob.data.uv_layers.active = lm
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.0012, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.0012)
    bpy.ops.object.mode_set(mode='OBJECT')
    return lm

def bake_zone(zn, ob, samples):
    """Everything Cycles sees — texture, weather, sun, bounce, the lamps —
       into one image per area. Glossy is left out: a reflection belongs to
       where you stand, and a bake has to be true from everywhere."""
    size = ZONE_SIZE.get(zn, 2048)
    img = bpy.data.images.new("bake_"+zn, size, size, float_buffer=True)
    for m in ob.data.materials:
        nt = m.node_tree
        n = nt.nodes.get("BAKE") or nt.nodes.new("ShaderNodeTexImage"); n.name = "BAKE"
        n.image = img
        for x in nt.nodes: x.select = False
        n.select = True; nt.nodes.active = n
    deselect_all()
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    scene.cycles.samples = samples
    bpy.ops.object.bake(type='COMBINED', pass_filter={'EMIT', 'DIRECT', 'INDIRECT', 'DIFFUSE'},
                        margin=8, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
    # scene-linear radiance, straight into sRGB bytes: the game shows it
    # unlit and its own tone mapping does the rest, as it does for everything
    a = np.array(img.pixels[:], np.float32).reshape(size, size, 4)
    rgb = np.clip(a[:, :, :3], 0, 1)
    srgb = np.where(rgb <= 0.0031308, rgb*12.92, 1.055*np.power(rgb, 1/2.4)-0.055)
    out = np.dstack([srgb, np.ones((size, size, 1), np.float32)])
    path = os.path.join(HERE, "work", "bake_"+zn+".png")
    im = bpy.data.images.new("baked_"+zn, size, size, alpha=False)
    im.pixels.foreach_set(out.ravel()); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(img)
    print("BAKED", zn, size, "->", path)
    return path

def swap_to_baked(zn, ob, path):
    """what the game gets: one material, the baked picture, on the LM set"""
    im = bpy.data.images.load(path)
    m = bpy.data.materials.new("B_"+zn)
    try: m.use_nodes = True
    except Exception: pass
    t = m.node_tree.nodes.new("ShaderNodeTexImage"); t.image = im
    b = m.node_tree.nodes["Principled BSDF"]
    m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0
    ob.data.materials.clear(); ob.data.materials.append(m)
    for p in ob.data.polygons: p.material_index = 0
    ob.data.uv_layers.remove(ob.data.uv_layers["UV"])

def roof_grid():
    """what you land on when you fly over it: the highest surface under each
       metre, props left out, the oculus left open so you can drop through"""
    for o in bpy.data.objects:
        if o.name.startswith("P_"): o.hide_viewport = True
    dg = bpy.context.evaluated_depsgraph_get()
    x0, x1, y0, y1 = -37.0, 37.0, -28.0, 28.0
    cell = 1.0
    nx, ny = int((x1-x0)/cell)+1, int((y1-y0)/cell)+1
    rows = []
    for j in range(ny):
        row = []
        for i in range(nx):
            x, y = x0+i*cell, y0+j*cell
            hit, loc, *_ = scene.ray_cast(dg, Vector((x, y, 60)), Vector((0, 0, -1)))
            row.append(round(loc.z, 2) if hit and loc.z > 2.5 else None)
        rows.append(row)
    for o in bpy.data.objects:
        if o.name.startswith("P_"): o.hide_viewport = False
    return dict(x0=x0, y0=y0, cell=cell, nx=nx, ny=ny, rows=rows)

def write_layout(grid):
    """the numbers the game needs before the model has even loaded, in the
       game's own axes: x across, y up, z toward the door (= -blender y)"""
    G = lambda bx0, bx1, by0, by1, z0, z1: dict(x1=round(bx0,3), x2=round(bx1,3), z1=round(-by1,3),
                                               z2=round(-by0,3), y1=round(z0,3), y2=round(z1,3))
    # the grid, re-indexed so rows run along game z
    gz = [[grid['rows'][j][i] for i in range(grid['nx'])] for j in range(grid['ny']-1, -1, -1)]
    L = dict(
        solids=[G(*s) for s in SOLIDS],
        stations=[dict(id='ring', x=8.0, z=-16.1, r=0.0), dict(id='pong', x=-8.0, z=-16.1, r=0.0)],
        pool=dict(x=RC.x, z=-RC.y, r=POOL_R, y=WATER_Z),
        # round walls are circles, not staircases of boxes: the ring with its
        # four doorways (angles in blender's sense: x=cos, -z=sin), and the pool
        circles=[dict(kind="wall", x=RC.x, z=-RC.y, r0=R_IN, r1=R_OUT, y1=0, y2=RING_TOP, head=PASS_H,
                      gaps=[dict(a=a, half=2.3/R_IN) for a in (0.0, math.pi/2, math.pi, 3*math.pi/2)]),
                 dict(kind="disk", x=RC.x, z=-RC.y, r1=CURB_R, y1=0, y2=1.4)],
        oculus=dict(x=RC.x, z=-RC.y, r=OCULUS, y=RING_TOP),
        plaque=dict(x=0.0, y=8.9, z=HD+T/2+0.36, w=7.4, h=1.45),
        roof=dict(x0=grid['x0'], z0=-(grid['y0']+(grid['ny']-1)*grid['cell']), cell=grid['cell'],
                  nx=grid['nx'], nz=grid['ny'], rows=gz),
        rooms=dict(pav=[-15,15,9,23], wings=[[15,32,-23,23],[-32,-15,-23,23]], atrium=[RC.x,-RC.y,R_IN],
                   back=[-15,15,-23,-14.8]),
    )
    path = os.path.join(OUT, "layout.js")
    with open(path, "w") as f:
        f.write("/* written by glb files/temple/build.py — do not edit, rebuild */\n")
        f.write("window.TEMPLE_LAYOUT=" + json.dumps(L, separators=(",", ":")) + ";\n")
    print("LAYOUT", path, len(L['solids']), "solids")

def export_glb():
    deselect_all()
    keep = [o for o in bpy.data.objects if o.type == 'MESH' and (o.name.startswith("T_") or o.name.startswith("P_"))]
    for o in keep: o.select_set(True)
    # the props' own textures, down to what a wall of lanterns needs
    for im in bpy.data.images:
        if im.size[0] > 1024 and not im.name.startswith("baked_") and im.source == 'FILE' \
           and any(u for u in [im.users]) and im.filepath and 'props' in bpy.path.abspath(im.filepath or ''):
            im.scale(1024, 1024)
    path = os.path.join(HERE, "work", "temple_raw.glb")
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
              export_yup=True, export_texcoords=True, export_normals=True,
              export_cameras=False, export_lights=False, export_animations=False, export_extras=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_image_format='JPEG', export_image_quality=86)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    print("EXPORTED", path, os.path.getsize(path))

if MODE == "bake":
    lighting(bake=True)
    use_gpu(); scene.render.engine = 'CYCLES'
    scene.render.bake.use_selected_to_active = False
    only = set(ARGS[1].split(",")) if len(ARGS) > 1 else None
    baked = {}
    for zn, ob in OBJS.items():
        unwrap(ob)
    for zn, ob in OBJS.items():
        if only and zn not in only:
            continue
        baked[zn] = bake_zone(zn, ob, 128 if zn.split('_')[0] in ('wings', 'inner', 'pav') else 64)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "temple_baked.blend"))
    grid = roof_grid()
    for zn, ob in OBJS.items():
        p = baked.get(zn) or os.path.join(HERE, "work", "bake_"+zn+".png")
        swap_to_baked(zn, ob, p)
    write_layout(grid)
    export_glb()
