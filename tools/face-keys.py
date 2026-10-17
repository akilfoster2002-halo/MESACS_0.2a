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
if body.data.shape_keys is None: body.shape_key_add(name="Basis")
def key(name, f):
    k = body.shape_key_add(name=name, from_mix=False)
    for v in body.data.vertices:
        p = P[v.index]
        if not face(p): continue
        d = f(p)
        if d is not None and d.length > 1e-7: k.data[v.index].co = v.co + R3 @ d
U = 4.2*fs                                    # Kai's sculpt was in his 0..1 units times 1.93: the same moves, her size
def jaw(p):
    if p.z > MOUTH.z + 0.0015*U: return None
    w = min(1.0, (MOUTH.z + 0.0015*U - p.z)/(0.006*U))
    q = Matrix.Rotation(math.radians(24)*w, 3, 'X') @ (p - JAW) + JAW
    return q - p
key("jawOpen", jaw)
key("mouthO", lambda p: (Vector((-(p.x - MOUTH.x)*0.7, -0.008*U, 0)))*near(p, MOUTH, 0.019*U))
key("smile", lambda p: sum((Vector((0.0055*U*(1 if k == "L" else -1), 0.003*U, 0.009*U))*near(p, c, 0.013*U) for k, c in CORNER.items()), Vector()))
key("frown", lambda p: sum((Vector((0.001*U*(1 if k == "L" else -1), 0, -0.008*U))*near(p, c, 0.013*U) for k, c in CORNER.items()), Vector()))
key("browUp", lambda p: sum((Vector((0, -0.001*U, 0.0085*U))*near(p, c, 0.015*U) for c in BROW.values()), Vector()))
key("browDown", lambda p: sum((Vector((-0.003*U*(1 if k == "L" else -1), -0.002*U, -0.0065*U))*near(p, c, 0.014*U) for k, c in BROW.items()), Vector()))
key("blink", lambda p: sum((Vector((0, -0.0015*U, -0.012*U))*near(p, c, 0.0085*U) for c in LID.values()), Vector()))
print("FACE keys", [k.name for k in body.data.shape_keys.key_blocks])
