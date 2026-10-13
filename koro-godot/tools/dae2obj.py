"""A static Collada (.dae) — positions, normals, uvs, polylists/triangles, node matrices — into an OBJ with one group per
geometry and its material name, so Blender (which has no Collada importer since 5.0) can take it.
   python3 tools/dae2obj.py in.dae out.obj"""
import re, sys, xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
ns = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
t = ET.parse(src).getroot()
def arr(el): return [float(x) for x in el.text.split()]
geos = {}
for g in t.iterfind('.//c:library_geometries/c:geometry', ns):
    m = g.find('c:mesh', ns); sources = {}
    for s in m.iterfind('c:source', ns):
        fa = s.find('c:float_array', ns); stride = int(s.find('.//c:accessor', ns).get('stride', '3'))
        v = arr(fa); sources['#' + s.get('id')] = [v[i:i + stride] for i in range(0, len(v), stride)]
    vin = m.find('c:vertices', ns); vmap = {'#' + vin.get('id'): sources[vin.find('c:input[@semantic="POSITION"]', ns).get('source')]}
    prims = []
    for p in list(m.iterfind('c:polylist', ns)) + list(m.iterfind('c:triangles', ns)):
        inputs = [(i.get('semantic'), int(i.get('offset')), i.get('source')) for i in p.iterfind('c:input', ns)]
        stride = max(o for _, o, _ in inputs) + 1
        idx = [int(x) for x in p.find('c:p', ns).text.split()]
        vc = [int(x) for x in p.find('c:vcount', ns).text.split()] if p.find('c:vcount', ns) is not None else [3]*(len(idx)//stride//3)
        prims.append((p.get('material'), inputs, stride, idx, vc))
    geos['#' + g.get('id')] = (sources, vmap, prims)
lines = []; vo = to = no = 0
def mat4(n):
    m = n.find('c:matrix', ns)
    return [float(x) for x in m.text.split()] if m is not None else [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
def mul(a, b): return [sum(a[r*4 + k]*b[k*4 + c] for k in range(4)) for r in range(4) for c in range(4)]
def walk(n, M):
    global vo, to, no
    M = mul(M, mat4(n))
    for ig in n.iterfind('c:instance_geometry', ns):
        sources, vmap, prims = geos[ig.get('url')]
        lines.append('o ' + ig.get('url')[1:])
        for mat, inputs, stride, idx, vc in prims:
            pos = norm = uv = None
            for sem, off, s in inputs:
                if sem == 'VERTEX': pos = (off, vmap[s])
                elif sem == 'NORMAL': norm = (off, sources[s])
                elif sem == 'TEXCOORD' and uv is None: uv = (off, sources[s])
            lines.append('usemtl ' + (mat or 'default'))
            k = 0
            for c in vc:
                f = []
                for j in range(c):
                    base = (k + j)*stride
                    p = pos[1][idx[base + pos[0]]]
                    x = M[0]*p[0] + M[1]*p[1] + M[2]*p[2] + M[3]; y = M[4]*p[0] + M[5]*p[1] + M[6]*p[2] + M[7]; z = M[8]*p[0] + M[9]*p[1] + M[10]*p[2] + M[11]
                    lines.append(f'v {x} {y} {z}'); vo += 1; ref = f'{vo}'
                    if uv: q = uv[1][idx[base + uv[0]]]; lines.append(f'vt {q[0]} {q[1]}'); to += 1; ref += f'/{to}'
                    else: ref += '/'
                    if norm: q = norm[1][idx[base + norm[0]]]; lines.append(f'vn {q[0]} {q[1]} {q[2]}'); no += 1; ref += f'/{no}'
                    f.append(ref)
                lines.append('f ' + ' '.join(f)); k += c
    for ch in n.iterfind('c:node', ns): walk(ch, M)
for vs in t.iterfind('.//c:library_visual_scenes/c:visual_scene', ns):
    for n in vs.iterfind('c:node', ns): walk(n, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])
open(out, 'w').write('\n'.join(lines) + '\n'); print(out, vo, 'verts')
