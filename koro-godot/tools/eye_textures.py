"""Her irises and the white that covers the painted ones (assets/tsh/eyes/): drawn here, soft-edged, alpha outside."""
import numpy as np, os
from scipy.io import wavfile  # noqa (numpy only really)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tsh', 'eyes')
def save(name, rgba):
    import zlib, struct
    h, w, _ = rgba.shape
    raw = b''.join(b'\x00' + (np.clip(rgba[y], 0, 1)*255).astype(np.uint8).tobytes() for y in range(h))
    def chunk(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(os.path.join(OUT, name), 'wb').write(png)
N = 256
y, x = np.mgrid[0:N, 0:N]; u = (x + 0.5)/N*2 - 1; v = (y + 0.5)/N*2 - 1
r = np.sqrt(u*u + v*v); ang = np.arctan2(v, u)
rng = np.random.default_rng(3)
# the iris: dark brown, lighter round the pupil, fibres running out, a dark ring at its edge; the pupil; a catchlight
streak = 0.5 + 0.5*np.sin(ang*37 + 2*np.sin(ang*5)) * np.sin(ang*61 + 1.3)
base = np.stack([0.13, 0.078, 0.045])[None, None, :]*np.ones((N, N, 3))
lift = np.clip(1 - (r - 0.3)/0.6, 0, 1)[..., None]
col = base*(0.75 + 0.5*lift) + (np.array([0.10, 0.06, 0.02])*streak[..., None])*lift
col *= (1 - 0.65*np.clip((r - 0.78)/0.2, 0, 1))[..., None]                 # the limbal ring
pupil = np.clip((0.34 - r)/0.04, 0, 1)[..., None]
col = col*(1 - pupil) + np.array([0.02, 0.015, 0.012])*pupil
alpha = np.clip((0.98 - r)/0.05, 0, 1)
save('iris.png', np.dstack([col, alpha]))
# the catchlight (it stays where the light is, not with the iris)
hl = np.clip((0.12 - np.sqrt((u + 0.35)**2 + (v + 0.35)**2))/0.05, 0, 1)
save('glint.png', np.dstack([np.ones((N, N, 3)), hl*0.9]))
# the white: a soft ellipse, warm, a little shadow at its top (the lid's)
e = np.sqrt((u/1.0)**2 + (v/0.62)**2)
wcol = np.array([0.86, 0.80, 0.78])*np.ones((N, N, 3))
wcol *= (0.82 + 0.18*np.clip((v + 0.6)/1.2, 0, 1))[..., None]
save('white.png', np.dstack([wcol, np.clip((1.0 - e)/0.12, 0, 1)]))
print('eyes drawn')
