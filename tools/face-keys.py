# HER FACE: morph targets as Robin's and Kai's are (jawOpen, mouthO, smile, frown, browUp, browDown, blink), sculpted
# where her features are — FACE=<json> gives them in the world, standing as mixamo-rig.py stands her (metres; [x, z]
# from the front, each one's depth found on her skin) — and scaled to the size of her face (Kai's: 7 cm between the eyes).
# Run from tools/mixamo-rig.py (exec'd there: body, json, os, Vector, Matrix in scope).
import json, math
from mathutils import Matrix, Vector
LM = json.load(open(os.environ["FACE"]))
MW = body.matrix_world; MWi = MW.inverted(); R3 = MWi.to_3x3()
P = [MW @ v.co for v in body.data.vertices]
def surf(xz, back=0.0):                      # the front of her skin at [x, z] (her face looks along -y) — or [x, z, y] given
    if len(xz) > 2: return Vector((xz[0], xz[2] + back, xz[1]))
    best = None
    for q in P:
        if abs(q.x - xz[0]) < 0.004 and abs(q.z - xz[1]) < 0.004 and (best is None or q.y < best): best = q.y
    return Vector((xz[0], (best if best is not None else 0.0) + back, xz[1]))
fs = (Vector(LM["eyeL"]) - Vector(LM["eyeR"])).length/0.07
EYE = {"L": surf(LM["eyeL"], 0.004*fs), "R": surf(LM["eyeR"], 0.004*fs)}
MOUTH = surf(LM["mouth"]); CORNER = {"L": surf(LM["cornerL"]), "R": surf(LM["cornerR"])}
BROW = {"L": surf(LM["browL"]), "R": surf(LM["browR"])}; CHIN = surf(LM["chin"])
LID = {k: v + Vector((0, -0.007*fs, 0.007*fs)) for k, v in EYE.items()}
JAW = Vector((MOUTH.x, MOUTH.y + 0.075*fs, MOUTH.z + 0.022*fs))
mid = (EYE["L"] + EYE["R"] + MOUTH)/3
print("FACE scale", round(fs, 3), "eyes", EYE, "mouth", MOUTH)
def near(p, c, r): return math.exp(-((p - c).length/r)**2)
face = lambda p: (p - mid).length < 0.11*fs and p.y < mid.y + 0.045*fs
# A MOUTH THAT OPENS (as glb files/face/mouth.mjs did for Robin): her lips are one painted surface, so a jaw shape only
# stretched them. Cut the face along the line where her lips meet (the corners left joined), and behind the lips put a
# mouth — a dark inside and a row of teeth top and bottom — skinned to her head; the jaw shape then takes the lower lip,
# the lower teeth and the floor of the mouth down, away from the upper lip.
import bmesh
UPPER = set()
if body.data.shape_keys is None and os.environ.get("MOUTH", "1") == "1":
    bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
    mx = (LM["cornerL"][0] + LM["cornerR"][0])/2; half = (LM["cornerL"][0] - LM["cornerR"][0])/2
    Wv = lambda v: MW @ v.co
    box = [f for f in bm.faces if abs((MW @ f.calc_center_median()).x - mx) < half + 0.012 and abs((MW @ f.calc_center_median()).z - MOUTH.z) < 0.014
           and (MW @ f.calc_center_median()).y < MOUTH.y + 0.02]
    geom = list({v for f in box for v in f.verts}) + list({e for f in box for e in f.edges}) + box
    print("MOUTH geom", len(geom))
    # first finer there: the triangles round her lips cut three ways each, so the opening can follow the lip line
    fine = [e for e in bm.edges if all((MW @ v.co - MOUTH).length < 0.026 for v in e.verts)]
    bmesh.ops.subdivide_edges(bm, edges=fine, cuts=2, use_grid_fill=True)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    pc = MWi @ MOUTH; pn = (R3 @ Vector((0, 0, 1))).normalized()
    ds = sorted((v.co - pc).dot(pn) for f in box for v in f.verts); print("MOUTH signed", round(ds[0], 4), round(ds[-1], 4), "pn", pn, "MWscale", MW.to_scale())
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=pc, plane_no=pn)      # (the whole mesh: a region alone would not cut)
    cut = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    print("MOUTH geom_cut", len(res["geom_cut"]), [type(x).__name__ for x in res["geom_cut"][:4]], "box z", sorted(round((MW @ f.calc_center_median()).z, 3) for f in box)[:6], "mouth", MOUTH)
    inner = [e for e in cut if all(abs(Wv(v).x - mx) < half - 0.002 and (Wv(v) - MOUTH).length < half + 0.004 and Wv(v).y < MOUTH.y + 0.01 for v in e.verts)]
    print("MOUTH near", sorted({tuple(round(c, 3) for c in Wv(v)) for e in cut for v in e.verts if abs(Wv(v).x - mx) < 0.02 and Wv(v).y < -0.035}))
    print("MOUTH faces", len(box), "cut edges", len(cut), "split", len(inner))
    out = bmesh.ops.split_edges(bm, edges=inner)
    bm.verts.ensure_lookup_table(); bm.normal_update()
    # which copy of each cut vertex is the upper lip's: the one whose faces sit above the line
    for v in {v for e in out["edges"] for v in e.verts}:
        if v.link_faces and sum((MW @ f.calc_center_median()).z for f in v.link_faces)/len(v.link_faces) > MOUTH.z: UPPER.add(v.index)
    dl = bm.verts.layers.deform.verify()
    hg = body.vertex_groups.get("mixamorig:Head") or body.vertex_groups.new(name="mixamorig:Head")
    def mat(name, col, rough):
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = col; b.inputs["Roughness"].default_value = rough
        body.data.materials.append(m); return len(body.data.materials) - 1
    m_in = mat("MouthInside", (0.09, 0.02, 0.025, 1), 0.6); m_tooth = mat("Teeth", (0.85, 0.82, 0.76, 1), 0.3)
    from mathutils.kdtree import KDTree
    skin = [v for v in bm.verts if (MW @ v.co - MOUTH).length < 0.06 and (MW @ v.co).y < MOUTH.y + 0.03]
    kd = KDTree(len(skin))
    for i, v in enumerate(skin): kd.insert(MW @ v.co, i)
    kd.balance()
    def add(make, mi):
        before = set(bm.verts); make(); new = [v for v in bm.verts if v not in before]
        for f in {f for v in new for f in v.link_faces}: f.material_index = mi
        for v in new:                                          # weighted as the skin nearest it is: it moves as her lips do
            q = MW @ v.co; q = Vector((q.x, MOUTH.y, q.z))
            src = skin[kd.find(q)[1]]
            v[dl].clear()
            for gi, w in src[dl].items(): v[dl][gi] = w
        return new
    S3 = lambda x, y, z: MWi.to_3x3() @ Vector((x, y, z))
    back = MOUTH + Vector((0, 0.016*fs/0.618, 0))
    def cavity():
        r = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
        for v in r["verts"]: v.co = MWi @ (back + Vector((v.co.x*half*1.05, v.co.y*0.013*fs/0.618, v.co.z*0.011*fs/0.618)))
        bmesh.ops.reverse_faces(bm, faces=list({f for v in r["verts"] for f in v.link_faces}))
    add(cavity, m_in)
    for dz in (0.0022, -0.0024):
        def teeth(dz=dz):
            r = bmesh.ops.create_cube(bm, size=1.0)
            for v in r["verts"]: v.co = MWi @ (MOUTH + Vector((0, 0.0075*fs/0.618, dz*fs/0.618)) + Vector((v.co.x*half*0.95, v.co.y*0.003, v.co.z*0.0028*fs/0.618)))
        add(teeth, m_tooth)
    bm.to_mesh(body.data); bm.free(); body.data.update()
    P = [MW @ v.co for v in body.data.vertices]
if body.data.shape_keys is None: body.shape_key_add(name="Basis")
def key(name, f):
    k = body.shape_key_add(name=name, from_mix=False)
    for v in body.data.vertices:
        p = P[v.index]
        if not face(p): continue
        JAW_I[0] = v.index
        d = f(p)
        if d is not None and d.length > 1e-7: k.data[v.index].co = v.co + R3 @ d
U = 2.6*fs                                    # Kai's sculpt was in his 0..1 units times 1.93: the same moves, her size
JAW_I = [None]
def jaw(p):
    if JAW_I[0] in UPPER: return None                         # the upper lip's side of the cut stays
    if p.z > MOUTH.z + 0.0004: return None
    w = 1.0 if UPPER else min(1.0, (MOUTH.z + 0.0015*U - p.z)/(0.006*U))
    if UPPER and p.z > MOUTH.z - 0.03: w = 1.0
    elif UPPER: w = max(0.0, 1.0 - (MOUTH.z - 0.03 - p.z)/0.03)
    q = Matrix.Rotation(math.radians(15)*w, 3, 'X') @ (p - JAW) + JAW
    return q - p
key("jawOpen", jaw)
key("mouthO", lambda p: (Vector((-(p.x - MOUTH.x)*0.7, -0.008*U, 0)))*near(p, MOUTH, 0.019*U))
key("smile", lambda p: sum((Vector((0.0055*U*(1 if k == "L" else -1), 0.003*U, 0.009*U))*near(p, c, 0.013*U) for k, c in CORNER.items()), Vector()))
key("frown", lambda p: sum((Vector((0.001*U*(1 if k == "L" else -1), 0, -0.008*U))*near(p, c, 0.013*U) for k, c in CORNER.items()), Vector()))
above = lambda p, f: f(p) if p.z > max(EYE["L"].z, EYE["R"].z) + 0.0065 else None     # the brows move; the lids under them do not
key("browUp", lambda p: above(p, lambda p: sum((Vector((0, -0.001*U, 0.0085*U))*near(p, c, 0.015*U) for c in BROW.values()), Vector())))
key("browDown", lambda p: above(p, lambda p: sum((Vector((-0.003*U*(1 if k == "L" else -1), -0.002*U, -0.0065*U))*near(p, c, 0.014*U) for k, c in BROW.items()), Vector())))
def blink(p):                                                  # the upper lid only, down over the eye to just under its middle
    for c in EYE.values():
        dx = (p.x - c.x)/0.0135; dz = (p.z - c.z)
        if abs(dx) >= 1 or dz < -0.0005 or dz > 0.011: continue
        w = (1 - dx*dx)**1.5 * (1.0 if dz < 0.0065 else max(0.0, 1 - (dz - 0.0065)/0.0045))
        return Vector((0, -0.0012, -(dz + 0.0048)*w))          # to the lower lash line: shut
    return None
key("blink", blink)
print("FACE keys", [k.name for k in body.data.shape_keys.key_blocks])
