#!/usr/bin/env python3
"""
Lower Manhattan, packed for TSH (public/tshnyc.js).

    python3 tools/pack-nyc.py            # maps/new-york-city-manhattan -> public/tsh/nyc/

The source is a photographed model of the Financial District (an OBJ in a
zip, one 8K texture). What the game gets:

  nyc.bin  the model in game metres, cut open where the district stands,
           with its own ground thrown away (the game lays its wet road
           there instead), quantised: int16 positions at 5 cm, uint16 uvs,
           uint32 indices — and the land as rectangles on a 4 m grid, so the
           road can be laid on the island and not on the harbour.
  nyc.jpg  the texture at 4096.

WHERE THE DISTRICT SITS: model units are about 160 m; the district's centre
is at (0.68, 1.28) in the model, turned 60 degrees, which is where its two
streets line up best with real streets running out of it (found by
searching every centre and angle for clear road along all four arms).

Needs numpy and scipy, and `sips` (macOS) for the texture.
"""
import numpy as np, struct, sys, os, zipfile, io, subprocess
from scipy.ndimage import minimum_filter, binary_closing, binary_opening

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'maps', 'new-york-city-manhattan')
OUT = os.path.join(ROOT, 'public', 'tsh', 'nyc')

S = 160.0                 # metres per model unit
CX, CZ, ROT = 0.68, 1.28, 60.0
G0 = -1.174               # street level in the model
# the district and its fence, with a margin, and the WFC tower's footprint (game metres)
HOLES = [(-128, 128, -104, 104), (-32, 32, -298, -232)]
Q = 0.05                  # position step, metres

def read_obj():
    z = zipfile.ZipFile(os.path.join(SRC, 'source', 'ny_clean_up2.zip'))
    V, T, F = [], [], []
    with z.open('ny_clean_up2.obj') as f:
        for line in io.TextIOWrapper(f, encoding='utf8'):
            if line.startswith('v '): V.append(line.split()[1:4])
            elif line.startswith('vt '): T.append(line.split()[1:3])
            elif line.startswith('f '):           # loose edges (`l`) are skipped: they are not surfaces
                idx = [(int(p.split('/')[0])-1, int(p.split('/')[1])-1) for p in line.split()[1:]]
                for k in range(1, len(idx)-1): F.append((idx[0], idx[k], idx[k+1]))
    return np.array(V, float), np.array(T, float), np.array(F, np.int64)

def main():
    V, T, F = read_obj()
    P = V[F[:, :, 0]]
    n = np.cross(P[:, 1]-P[:, 0], P[:, 2]-P[:, 0]); n /= (np.linalg.norm(n, axis=1)[:, None]+1e-12)
    c = P.mean(1)
    # THE GROUND: the lowest upward surface near each spot is the ground there
    CELL = 0.03
    gi = ((c[:, 0]-V[:, 0].min())/CELL).astype(int); gk = ((c[:, 2]-V[:, 2].min())/CELL).astype(int)
    up = n[:, 1] > 0.75
    low = np.full((gi.max()+1, gk.max()+1), np.inf)
    np.minimum.at(low, (gi[up], gk[up]), c[up, 1])
    g = low.copy(); g[np.isinf(g)] = 10; g = minimum_filter(g, size=5); g[g >= 10] = np.nan
    ground = up & (c[:, 1] < g[gi, gk] + 0.022)

    # to game metres: centred, turned, scaled, the street at y = 0
    x = V[:, 0]-CX; zz = V[:, 2]-CZ; r = np.radians(ROT); cs, sn = np.cos(r), np.sin(r)
    GV = np.stack([(cs*x - sn*zz)*S, (V[:, 1]-G0)*S, (sn*x + cs*zz)*S], 1)
    GP = GV[F[:, :, 0]]; cen = GP.mean(1)
    cut = np.zeros(len(F), bool)
    for x1, x2, z1, z2 in HOLES: cut |= (cen[:, 0] > x1) & (cen[:, 0] < x2) & (cen[:, 2] > z1) & (cen[:, 2] < z2)
    keep = ~ground & ~cut

    # one vertex per (position, uv) pair
    pairs = F[keep].reshape(-1, 2)
    key = pairs[:, 0].astype(np.int64)*len(T) + pairs[:, 1]
    uk, inv = np.unique(key, return_inverse=True)
    pos = GV[uk//len(T)]; uv = T[uk % len(T)]
    qp = np.round(pos/Q).astype(np.int32); assert np.abs(qp).max() < 32767
    qp = qp.astype(np.int16); qu = np.round(np.clip(uv, 0, 1)*65535).astype(np.uint16); idx = inv.astype(np.uint32)

    # THE LAND: under the capture's own ground at street level, and under anything standing near the ground
    C = 4.0; lo = -1400.0; N = int(2800/C)
    land = np.zeros((N, N), bool)
    for tri in GV[F[ground][:, :, 0]]:
        if tri[:, 1].mean() < -6: continue            # the harbour floor
        i1, i2 = int((tri[:, 0].min()-lo)/C), int((tri[:, 0].max()-lo)/C)+1
        j1, j2 = int((tri[:, 2].min()-lo)/C), int((tri[:, 2].max()-lo)/C)+1
        ii, jj = np.meshgrid(np.arange(max(i1, 0), min(i2, N)), np.arange(max(j1, 0), min(j2, N)), indexing='ij')
        px = lo+(ii+0.5)*C; pz = lo+(jj+0.5)*C
        a, b, cc = tri[0][[0, 2]], tri[1][[0, 2]], tri[2][[0, 2]]
        sg = lambda p1, p2: (px-p2[0])*(p1[1]-p2[1]) - (p1[0]-p2[0])*(pz-p2[1])
        d1, d2, d3 = sg(a, b), sg(b, cc), sg(cc, a)
        inside = ~(((d1 < 0) | (d2 < 0) | (d3 < 0)) & ((d1 > 0) | (d2 > 0) | (d3 > 0)))
        land[ii[inside], jj[inside]] = True
    kp = GP[keep]
    for p in kp[kp[:, :, 1].min(1) < 8][:, :, [0, 2]].mean(1):
        i, j = int((p[0]-lo)/C), int((p[1]-lo)/C)
        if 0 <= i < N and 0 <= j < N: land[i, j] = True
    land = binary_opening(binary_closing(land, iterations=3), iterations=1)
    # rows of land as runs, runs repeated on the next row merged into rectangles
    rects, open_ = [], {}
    for j in range(N):
        row = land[:, j]; i = 0
        while i < N:
            if not row[i]: i += 1; continue
            s0 = i
            while i < N and row[i]: i += 1
            k = (s0, i)
            if k in open_ and open_[k][3] == j-1: open_[k][3] = j
            else:
                if k in open_: rects.append(open_[k])
                open_[k] = [s0, i, j, j]
    rects += list(open_.values())
    R = np.array([[lo+a*C, lo+b*C, lo+j1*C, lo+(j2+1)*C] for a, b, j1, j2 in rects], np.float32)

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'nyc.bin'), 'wb') as f:
        f.write(b'NYC1'); f.write(struct.pack('<IIIf', len(qp), len(idx), len(R), Q))
        f.write(qp.tobytes()); f.write(qu.tobytes())
        if f.tell() % 4: f.write(b'\0'*(4 - f.tell() % 4))
        f.write(idx.tobytes()); f.write(R.tobytes())
    subprocess.run(['sips', '-Z', '4096', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70',
                    os.path.join(SRC, 'textures', 'tex.jpg'), '--out', os.path.join(OUT, 'nyc.jpg')],
                   check=True, capture_output=True)
    print(f'{len(qp)} vertices, {len(idx)//3} triangles, {len(R)} land rectangles')

if __name__ == '__main__':
    main()
