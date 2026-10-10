"""One Doc Ock mechanical arm out of the Maya file, as data: its mesh in bind pose (positions, faces, UVs), the
joints that bend it (name, parent, bind world matrix), and each vertex's weights. python3 -I extract.py <ma> <out.json>"""
import sys, json, re
sys.path.insert(0, '.')
from ma import load
nodes, conns = load(sys.argv[1])
by = {}
for n in nodes: by.setdefault(n.name, n)
SC, SHAPE = 'mechArm_skinCluster4', 'mechArm_geometry01ShapeOrig1'

def ranged(node, prefix):
    """every '.prefix[a:b]' / '.prefix[a]' value list on a node, as {index: [values...]} with `per` values each"""
    out = []
    for name, typ, vals in node.attrs:
        m = re.fullmatch(re.escape(prefix) + r'\[(\d+)(?::(\d+))?\]', name)
        if m: out.append((int(m.group(1)), int(m.group(2) or m.group(1)), typ, vals))
    return sorted(out)

sh = by[SHAPE]
vt = []
for a, b, typ, vals in ranged(sh, '.vt'):
    f = [float(x) for x in vals]; assert len(f) == (b - a + 1)*3, (a, b, len(f)); vt += [f[i:i + 3] for i in range(0, len(f), 3)]
uv = []
for a, b, typ, vals in ranged(sh, '.uvst[0].uvsp'):
    f = [float(x) for x in vals]; uv += [f[i:i + 2] for i in range(0, len(f), 2)]
ed = []
for a, b, typ, vals in ranged(sh, '.ed'):
    f = [int(float(x)) for x in vals]; ed += [f[i:i + 3] for i in range(0, len(f), 3)]
faces = []
for a, b, typ, vals in ranged(sh, '.fc'):
    i = 0
    while i < len(vals):
        tag = vals[i]
        if tag == 'f':
            n = int(vals[i + 1]); es = [int(x) for x in vals[i + 2:i + 2 + n]]; i += 2 + n
            vs = [ed[e][0] if e >= 0 else ed[-e - 1][1] for e in es]
            faces.append({ 'v':vs, 'uv':None })
        elif tag == 'mu':
            n = int(vals[i + 2]); faces[-1]['uv'] = [int(x) for x in vals[i + 3:i + 3 + n]]; i += 3 + n
        elif tag in ('h',):
            n = int(vals[i + 1]); i += 2 + n; print('hole skipped')
        elif tag == 'mc':
            n = int(vals[i + 2]); i += 3 + n
        else: raise SystemExit('unknown face tag ' + tag)
sc = by[SC]
# weights: '.wl[a:b].w' is, per vertex, "count  idx w  idx w ..."
W = []
for name, typ, vals in sc.attrs:
    m = re.fullmatch(r'\.wl\[(\d+)(?::(\d+))?\]\.w', name)
    if m:
        a, b = int(m.group(1)), int(m.group(2) or m.group(1)); f = vals; i = 0
        for v in range(a, b + 1):
            n = int(f[i]); w = { int(f[i + 1 + 2*k]):float(f[i + 2 + 2*k]) for k in range(n) }; i += 1 + 2*n
            while len(W) <= v: W.append({})
            W[v] = w
    m = re.fullmatch(r'\.wl\[(\d+)\]\.w\[(\d+)(?::(\d+))?\]', name)
    if m:
        v = int(m.group(1)); a, b = int(m.group(2)), int(m.group(3) or m.group(2))
        while len(W) <= v: W.append({})
        for k, x in enumerate(vals): W[v][a + k] = float(x)
pm = {}
for name, typ, vals in sc.attrs:
    m = re.fullmatch(r'\.pm\[(\d+)\]', name)
    if m: pm[int(m.group(1))] = [float(x) for x in vals]
joints = {}
for a, b in conns:
    m = re.fullmatch(re.escape(SC) + r'\.ma\[(\d+)\]', b)
    if m: joints[int(m.group(1))] = a[:-3]          # strip '.wm'
names = [joints[i].split('|')[-1] for i in sorted(joints)]
paths = [joints[i] for i in sorted(joints)]
out = { 'vt':vt, 'uv':uv, 'faces':faces, 'weights':[{str(k):v for k, v in w.items()} for w in W], 'pm':[pm[i] for i in sorted(joints)],
        'joints':names, 'paths':paths }
json.dump(out, open(sys.argv[2], 'w'))
print('verts', len(vt), 'uvs', len(uv), 'edges', len(ed), 'faces', len(faces), 'weights', len(W), 'joints', len(names))
print(names)
