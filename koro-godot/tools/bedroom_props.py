"""ROBIN'S ROOM, THE SOFT THINGS: the black cat (asleep, curled nose to tail — its head a part of its own so it can
lift and look), the teddy bear, the heart cushion, the bunny, the pillows. Each sculpted as a sum of soft shapes
(signed distances, smooth-unioned), meshed by marching cubes and painted by whichever shape is nearest, then written
as a glb with vertex colours (assets/tsh/props/room/*.glb). Real sizes, metres, +Y up, resting on y = 0.

  pip install numpy scikit-image trimesh && python3 tools/bedroom_props.py
"""
import os, math
import numpy as np
from skimage import measure
import trimesh

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'tsh', 'props', 'room')
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- shapes: each f(P) -> distance, P is (..., 3)
def ellipsoid(c, r):
    c = np.array(c, float); r = np.array(r, float)
    def f(P):
        q = (P - c)/r; k0 = np.linalg.norm(q, axis=-1); k1 = np.linalg.norm(q/r, axis=-1)
        return k0*(k0 - 1.0)/np.maximum(k1, 1e-9)
    return f
def sphere(c, r): return ellipsoid(c, (r, r, r))
def capsule(a, b, ra, rb=None):
    a = np.array(a, float); b = np.array(b, float); rb = ra if rb is None else rb
    def f(P):
        pa = P - a; ba = b - a; h = np.clip((pa @ ba)/(ba @ ba), 0, 1)
        return np.linalg.norm(pa - h[..., None]*ba, axis=-1) - (ra + (rb - ra)*h)
    return f
def rbox(c, half, r, rot_y=0.0):
    c = np.array(c, float); half = np.array(half, float); cs, sn = math.cos(rot_y), math.sin(rot_y)
    def f(P):
        q = P - c; x = q[..., 0]*cs - q[..., 2]*sn; z = q[..., 0]*sn + q[..., 2]*cs
        q = np.stack([x, q[..., 1], z], -1)
        d = np.abs(q) - (half - r)
        return np.linalg.norm(np.maximum(d, 0), axis=-1) + np.minimum(np.max(d, axis=-1), 0) - r
    return f
def cone(tip, base, rbase, rtip=0.004):
    return capsule(base, tip, rbase, rtip)
def chain(pts, radii):
    parts = [capsule(pts[i], pts[i + 1], radii[i], radii[i + 1]) for i in range(len(pts) - 1)]
    return lambda P: np.min(np.stack([p(P) for p in parts]), 0)

def smin(a, b, k):
    h = np.clip(0.5 + 0.5*(b - a)/k, 0, 1)
    return b*(1 - h) + a*h - k*h*(1 - h)

# a model: [(shape, colour, blend k)], meshed over its box at a step
def build(name, parts, lo, hi, step=0.003, flatten=None):
    lo = np.array(lo, float); hi = np.array(hi, float)
    n = np.ceil((hi - lo)/step).astype(int) + 1
    xs = [lo[i] + np.arange(n[i])*step for i in range(3)]
    P = np.stack(np.meshgrid(*xs, indexing='ij'), -1)
    D = None; ds = []
    for shape, col, k in parts:
        d = shape(P); ds.append(d)
        D = d if D is None else smin(D, d, k)
    if flatten is not None: D = np.maximum(D, flatten - P[..., 1])          # sits flat on its base
    D = np.pad(D, 1, constant_values=1.0)
    v, f, nrm, _ = measure.marching_cubes(D, 0.0, spacing=(step, step, step))
    v = v - step + lo
    # colour: the nearest shape's, blended over a few millimetres
    cols = np.array([c for _, c, _ in parts], float)
    W = []
    for s, _, _ in parts: W.append(s(v))
    W = np.stack(W)                                               # (parts, verts)
    w = np.exp(-(W - W.min(0))/0.004); w /= w.sum(0)
    vc = (w.T @ cols)
    m = trimesh.Trimesh(v, f, vertex_colors=np.clip(np.c_[vc, np.ones(len(vc))]*255, 0, 255).astype(np.uint8), process=True)
    trimesh.smoothing.filter_taubin(m, iterations=6)
    m.export(os.path.join(OUT, name + '.glb'))
    print(name, len(m.vertices), 'verts', np.round(m.bounds, 3).tolist())

# ---------------------------------------------------------------- the cat, asleep: curled anticlockwise from above,
# its back to +Z, its face tucked at the front (-Z, +X side) over its paws, the tail round its front to its nose
BLACK = (0.022, 0.02, 0.023); PAD = (0.06, 0.04, 0.045); NOSE = (0.11, 0.07, 0.08)
def arc(r, a0, a1, y, n, cx=0.0, cz=0.0):
    return [(cx + r*math.cos(math.radians(a0 + (a1 - a0)*i/(n - 1))), y, cz + r*math.sin(math.radians(a0 + (a1 - a0)*i/(n - 1)))) for i in range(n)]
# its tail from the rump round the front of it, the tip by its nose
tail_pts = [(-0.16, 0.03, 0.05), (-0.185, 0.028, -0.03), (-0.15, 0.026, -0.1), (-0.08, 0.025, -0.14), (0.0, 0.025, -0.155), (0.06, 0.028, -0.155), (0.1, 0.035, -0.14)]
tail_r = [0.028, 0.025, 0.023, 0.022, 0.021, 0.019, 0.016]
cat = [
    (ellipsoid((-0.01, 0.07, 0.02), (0.165, 0.075, 0.12)), BLACK, 0.03),          # the body, curled into an oval
    (ellipsoid((-0.075, 0.085, 0.045), (0.105, 0.085, 0.095)), BLACK, 0.04),      # the haunch, high and round
    (ellipsoid((0.085, 0.075, -0.015), (0.08, 0.07, 0.085)), BLACK, 0.04),        # the shoulder under the head
    (ellipsoid((0.0, 0.06, -0.06), (0.12, 0.055, 0.07)), BLACK, 0.04),            # the belly's curve, filled in
    (ellipsoid((0.08, 0.024, -0.105), (0.026, 0.02, 0.032)), BLACK, 0.015),       # the front paws, tucked
    (ellipsoid((0.125, 0.024, -0.095), (0.024, 0.019, 0.03)), BLACK, 0.015),
    (ellipsoid((-0.12, 0.028, -0.06), (0.045, 0.026, 0.04)), BLACK, 0.02),        # a back foot, by the tail
    (chain(tail_pts, tail_r), BLACK, 0.012),
]
build('cat_body', cat, (-0.24, 0.0, -0.22), (0.24, 0.2, 0.22), step=0.004, flatten=0.0)

# the head: its own part, its pivot at the neck (the origin); resting on its paws, chin down, face to -Z
head = [
    (ellipsoid((0, 0.0, -0.035), (0.058, 0.05, 0.055)), BLACK, 0.02),             # the skull
    (ellipsoid((0, -0.016, -0.08), (0.03, 0.022, 0.024)), BLACK, 0.015),          # the muzzle
    (ellipsoid((0.0, -0.008, -0.1), (0.008, 0.006, 0.005)), NOSE, 0.003),         # the nose
    (ellipsoid((-0.04, -0.008, -0.055), (0.03, 0.03, 0.03)), BLACK, 0.02),        # cheeks
    (ellipsoid((0.04, -0.008, -0.055), (0.03, 0.03, 0.03)), BLACK, 0.02),
    (cone((-0.04, 0.072, -0.02), (-0.032, 0.03, -0.03), 0.024), BLACK, 0.012),    # the ears, up and a little back
    (cone((0.04, 0.072, -0.02), (0.032, 0.03, -0.03), 0.024), BLACK, 0.012),
    (ellipsoid((-0.037, 0.045, -0.035), (0.012, 0.018, 0.004)), PAD, 0.003),      # inside the ears
    (ellipsoid((0.037, 0.045, -0.035), (0.012, 0.018, 0.004)), PAD, 0.003),
]
build('cat_head', head, (-0.09, -0.06, -0.12), (0.09, 0.09, 0.04), step=0.0025)

# ---------------------------------------------------------------- the teddy bear, sitting, facing -Z
FUR = (0.62, 0.45, 0.28); SNOUT = (0.86, 0.74, 0.58); EYE = (0.02, 0.015, 0.012); PADB = (0.78, 0.64, 0.48)
bear = [
    (ellipsoid((0, 0.12, 0), (0.1, 0.12, 0.085)), FUR, 0.03),
    (sphere((0, 0.29, -0.01), 0.085), FUR, 0.03),
    (ellipsoid((0, 0.27, -0.085), (0.04, 0.032, 0.03)), SNOUT, 0.012),
    (sphere((0, 0.285, -0.115), 0.012), EYE, 0.004),
    (sphere((-0.032, 0.315, -0.074), 0.009), EYE, 0.003), (sphere((0.032, 0.315, -0.074), 0.009), EYE, 0.003),
    (sphere((-0.065, 0.36, 0.0), 0.032), FUR, 0.015), (sphere((0.065, 0.36, 0.0), 0.032), FUR, 0.015),
    (ellipsoid((-0.062, 0.362, -0.012), (0.018, 0.018, 0.008)), SNOUT, 0.004), (ellipsoid((0.062, 0.362, -0.012), (0.018, 0.018, 0.008)), SNOUT, 0.004),
    (capsule((-0.09, 0.19, -0.02), (-0.115, 0.09, -0.07), 0.034, 0.03), FUR, 0.02),
    (capsule((0.09, 0.19, -0.02), (0.115, 0.09, -0.07), 0.034, 0.03), FUR, 0.02),
    (capsule((-0.06, 0.04, -0.02), (-0.075, 0.04, -0.13), 0.042, 0.04), FUR, 0.02),
    (capsule((0.06, 0.04, -0.02), (0.075, 0.04, -0.13), 0.042, 0.04), FUR, 0.02),
    (ellipsoid((-0.075, 0.042, -0.168), (0.03, 0.033, 0.006)), PADB, 0.004),
    (ellipsoid((0.075, 0.042, -0.168), (0.03, 0.033, 0.006)), PADB, 0.004),
]
build('teddy', bear, (-0.18, 0.0, -0.2), (0.18, 0.4, 0.12), step=0.0035, flatten=0.0)

# ---------------------------------------------------------------- the bunny plush, white, lop ears, sitting
WHITE = (0.9, 0.88, 0.85); PINK = (0.93, 0.62, 0.66)
bunny = [
    (ellipsoid((0, 0.09, 0), (0.08, 0.09, 0.07)), WHITE, 0.03),
    (ellipsoid((0, 0.215, -0.01), (0.07, 0.06, 0.065)), WHITE, 0.03),
    (sphere((0, 0.205, -0.072), 0.009), PINK, 0.004),
    (sphere((-0.026, 0.228, -0.06), 0.007), EYE, 0.003), (sphere((0.026, 0.228, -0.06), 0.007), EYE, 0.003),
    (capsule((-0.045, 0.25, 0.0), (-0.085, 0.13, -0.01), 0.022, 0.03), WHITE, 0.02),
    (capsule((0.045, 0.25, 0.0), (0.085, 0.13, -0.01), 0.022, 0.03), WHITE, 0.02),
    (capsule((-0.045, 0.03, -0.02), (-0.05, 0.03, -0.1), 0.03), WHITE, 0.02),
    (capsule((0.045, 0.03, -0.02), (0.05, 0.03, -0.1), 0.03), WHITE, 0.02),
    (sphere((0, 0.06, 0.075), 0.025), WHITE, 0.015),
]
build('bunny', bunny, (-0.14, 0.0, -0.14), (0.14, 0.3, 0.12), step=0.003, flatten=0.0)

# ---------------------------------------------------------------- the heart cushion, pink, plump, standing up
HEART = (0.95, 0.66, 0.72)
def heart(P):
    # Inigo Quilez's heart (its point at the origin, 1 tall), 0.3 m tall, puffed in Z: thickest in the middle
    S = 0.3; x = np.abs(P[..., 0])/S; y = P[..., 1]/S
    d1 = np.sqrt((x - 0.25)**2 + (y - 0.75)**2) - math.sqrt(2)/4
    m = 0.5*np.maximum(x + y, 0)
    d2 = np.sqrt(np.minimum(x**2 + (y - 1)**2, (x - m)**2 + (y - m)**2))*np.sign(x - y)
    d = np.where(x + y > 1, d1, d2)*S
    puff = 0.012 + 0.05*np.sqrt(np.clip(-d/0.09, 0, 1))
    return np.maximum(d + 0.01, np.abs(P[..., 2]) - puff)
build('heart', [(heart, HEART, 0.01)], (-0.2, -0.05, -0.08), (0.2, 0.34, 0.08), step=0.003)

# ---------------------------------------------------------------- the pillows: plump, their corners pulled out
def pillow(w, h, t, col, name):
    def f(P):
        x = P[..., 0]/w; y = P[..., 1]/h
        # thinner to the edges, a little pinched at the corners
        th = t*(1 - 0.75*np.clip(np.maximum(np.abs(x), np.abs(y)), 0, 1)**3)
        d2 = np.maximum(np.abs(P[..., 0]) - w, np.abs(P[..., 1]) - h)
        return np.maximum(d2 + 0.015, np.abs(P[..., 2]) - np.maximum(th, 0.008))
    build(name, [(f, col, 0.01)], (-w - 0.02, -h - 0.02, -t - 0.02), (w + 0.02, h + 0.02, t + 0.02), step=0.004)
pillow(0.33, 0.24, 0.075, (0.93, 0.9, 0.84), 'pillow_cream')
pillow(0.24, 0.24, 0.06, (0.4, 0.27, 0.2), 'pillow_brown')
pillow(0.2, 0.2, 0.055, (0.08, 0.07, 0.07), 'pillow_black')
