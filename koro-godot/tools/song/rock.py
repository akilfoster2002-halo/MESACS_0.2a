"""ROBIN'S SONG — the rock track in her room, composed and rendered here, with the chart the guitar game plays.

140 BPM, E minor, 4/4. Two stems so the game can drop the lead out when she misses (as Guitar Hero does): the band
(drums, bass, two rhythm guitars hard left and right) and the lead guitar. And the chart: every lead note from the
first verse on, its time, how long it is, and which of the five frets it is (its pitch, ranked within its phrase).

  python3 tools/song/rock.py      → assets/tsh/music/rock_band.mp3, rock_lead.mp3, assets/tsh/rock_chart.json
"""
import json, os, subprocess, numpy as np

SR = 44100
BPM = 140.0
BEAT = 60.0/BPM
BAR = 4*BEAT
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
rng = np.random.default_rng(7)

# ------------------------------------------------------------------ the form (bars)
INTRO, VERSE1, CHORUS1, VERSE2, CHORUS2, SOLO, OUTRO = 0, 8, 16, 24, 32, 40, 48
END = 52
PLAY_FROM = VERSE1          # the game starts here; the montage plays over the intro
N = int((END*BAR + 3.0)*SR)

def t2i(t): return int(round(t*SR))
def midi_hz(m): return 440.0*2**((m - 69)/12)

# ------------------------------------------------------------------ voices
def saw(f, n, ph=0.0):
    t = np.arange(n)/SR
    return 2*((f*t + ph) % 1.0) - 1
def env_adsr(n, a=0.005, d=0.08, s=0.7, r=0.06):
    e = np.ones(n)*s
    na, nd, nr = max(1, t2i(a)), max(1, t2i(d)), max(1, t2i(r))
    e[:na] = np.linspace(0, 1, na)
    e[na:na+nd] = np.linspace(1, s, len(e[na:na+nd]))
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def onepole_lp(x, fc):
    a = np.exp(-2*np.pi*fc/SR); y = np.empty_like(x); z = 0.0
    # a running filter: vectorised by blocks would be faster; the song is short enough
    for i in range(len(x)): z = (1 - a)*x[i] + a*z; y[i] = z
    return y
def biquad(x, kind, f, q=0.707):
    w = 2*np.pi*f/SR; al = np.sin(w)/(2*q); c = np.cos(w)
    if kind == 'lp': b = [(1 - c)/2, 1 - c, (1 - c)/2]
    elif kind == 'hp': b = [(1 + c)/2, -(1 + c), (1 + c)/2]
    else: b = [al, 0, -al]
    a = [1 + al, -2*c, 1 - al]
    from scipy.signal import lfilter
    return lfilter(np.array(b)/a[0], np.array(a)/a[0], x)

def place(buf, at, sig, gain=1.0):
    i = t2i(at); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i]*gain

# a distorted guitar: two detuned saws per string (root, fifth, octave for a power chord), driven hard, a cabinet
def guitar(midis, dur, mute=False, bright=1.0):
    n = t2i(dur + 0.08)
    x = np.zeros(n)
    for m in midis:
        f = midi_hz(m)
        x += saw(f*1.003, n, rng.random()) + saw(f*0.997, n, rng.random())
    x *= env_adsr(n, 0.003, 0.05 if mute else 0.2, 0.25 if mute else 0.8, 0.05)
    x = np.tanh(x*(5.0 if mute else 4.0))
    x = biquad(x, 'lp', (1400 if mute else 3200)*bright, 0.9)
    x = biquad(x, 'hp', 90)
    return x*0.5
def lead_note(m, dur, slide_from=None):
    n = t2i(dur + 0.12); t = np.arange(n)/SR
    f = np.full(n, midi_hz(m))
    if slide_from is not None:
        k = np.minimum(1, t/0.05); f = midi_hz(slide_from)*(1 - k) + f*k
    if dur > 0.45:                                    # vibrato on the long ones, coming in late
        vib = np.clip((t - 0.25)/0.3, 0, 1)*0.012*np.sin(2*np.pi*5.5*t); f = f*(1 + vib)
    ph = np.cumsum(f)/SR
    x = 2*(ph % 1.0) - 1 + 0.5*np.sign(np.sin(2*np.pi*ph*2))
    x *= env_adsr(n, 0.004, 0.15, 0.85, 0.08)
    x = np.tanh(x*3.0)
    x = biquad(x, 'lp', 4200, 1.1); x = biquad(x, 'hp', 180)
    return x*0.42
def bass_note(m, dur):
    n = t2i(dur); t = np.arange(n)/SR; f = midi_hz(m)
    x = 0.7*np.sin(2*np.pi*f*t) + 0.35*saw(f, n)
    x = biquad(np.tanh(x*1.5), 'lp', 700)
    return x*env_adsr(n, 0.004, 0.1, 0.8, 0.04)*0.55
def kick():
    n = t2i(0.35); t = np.arange(n)/SR
    f = 45 + 95*np.exp(-t*30); ph = np.cumsum(f)/SR
    x = np.sin(2*np.pi*ph)*np.exp(-t*9) + 0.4*rng.standard_normal(n)*np.exp(-t*200)
    return np.tanh(x*1.6)*0.9
def snare():
    n = t2i(0.25); t = np.arange(n)/SR
    nz = biquad(rng.standard_normal(n), 'bp', 2400, 0.7)*np.exp(-t*16)
    tone = np.sin(2*np.pi*185*t)*np.exp(-t*22)
    return (nz*1.1 + tone*0.6)*0.7
def hat(open_=False):
    n = t2i(0.3 if open_ else 0.06); t = np.arange(n)/SR
    return biquad(rng.standard_normal(n), 'hp', 7500)*np.exp(-t*(9 if open_ else 70))*0.25
def crash():
    n = t2i(1.8); t = np.arange(n)/SR
    return biquad(rng.standard_normal(n), 'hp', 4500)*np.exp(-t*2.2)*0.35

# ------------------------------------------------------------------ the parts
E, G, A, C, D, B = 40, 43, 45, 48, 50, 47          # power-chord roots, low
def pc(r): return [r, r + 7, r + 12]

band_L = np.zeros(N); band_R = np.zeros(N); drums = np.zeros(N); bass = np.zeros(N); lead = np.zeros(N)
chart = []

def bar_t(b, beat=0.0): return b*BAR + beat*BEAT

# the riff (verse, intro): eighths, palm-muted chugs on E with stabs
RIFF = [[E, 1, 1], [E, 1, 1], [E, 0, 1], [G, 0, 1], [E, 1, 1], [E, 1, 1], [A, 0, 1], [G, 0, 1],
        [E, 1, 1], [E, 1, 1], [E, 0, 1], [D, 0, 1], [E, 1, 1], [E, 1, 1], [C, 0, 2], [B, 0, 0]]
def riff(b0, bars, full=True):
    for b in range(b0, b0 + bars, 2):
        t = bar_t(b)
        for i, (r, mute, ln) in enumerate(RIFF):
            if ln == 0: continue
            d = BEAT*0.5*ln
            at = t + i*BEAT*0.5
            place(band_L, at, guitar(pc(r), d*0.95, mute=bool(mute)))
            place(band_R, at + 0.012, guitar(pc(r), d*0.95, mute=bool(mute), bright=0.9))
            if full: place(bass, at, bass_note(r - 12 + 12, d*0.9))
CHORDS = [E, C, G, D]
def chorus_band(b0, bars):
    for b in range(b0, b0 + bars):
        r = CHORDS[(b - b0) % 4]; t = bar_t(b)
        for i in range(8):                                 # driving eighths, open on the one
            d = BEAT*0.5; mute = i not in (0, 4)
            place(band_L, t + i*d, guitar(pc(r), d*0.95, mute=mute))
            place(band_R, t + i*d + 0.012, guitar(pc(r), d*0.95, mute=mute, bright=0.9))
            place(bass, t + i*d, bass_note(r, d*0.9))

def beat_drums(b0, bars, chorus=False, fill_last=True, intro_build=False):
    for b in range(b0, b0 + bars):
        t = bar_t(b)
        if (b - b0) % 4 == 0 and not intro_build: place(drums, t, crash())
        kicks = [0, 1.5, 2, 3.5] if chorus else [0, 1.5, 2.5]
        for k in kicks: place(drums, t + k*BEAT, kick())
        last = fill_last and b == b0 + bars - 1
        for s in [1, 3]:
            if not (last and s == 3): place(drums, t + s*BEAT, snare())
        if last:
            for i in range(4): place(drums, t + (3 + i*0.25)*BEAT, snare(), 0.6 + i*0.12)
        for i in range(8):
            if last and i >= 6: continue
            place(drums, t + i*0.5*BEAT, hat(open_=chorus and i % 2 == 1))

def melody(b0, notes, playable=True):
    """notes: (bar offset, beat, length in beats, midi[, slide from])"""
    for nt in notes:
        bo, bt, ln, m = nt[:4]; sl = nt[4] if len(nt) > 4 else None
        at = bar_t(b0 + bo, bt); d = ln*BEAT
        place(lead, at, lead_note(m, d*0.92, sl))
        if playable: chart.append({"t": at, "len": d, "m": m, "bar": b0 + bo})

# the lead's lines (E minor: E4 64, F#66, G67, A69, B71, C72, D74, E5 76, F#78, G79, A81, B83)
VERSE_A = [(0, 0, 1, 71), (0, 1, .5, 74), (0, 1.5, .5, 71), (0, 2, 1, 69), (0, 3, 1, 67),
           (1, 0, 1.5, 64), (1, 1.5, .5, 67), (1, 2, 2, 69),
           (2, 0, 1, 71), (2, 1, .5, 74), (2, 1.5, .5, 76), (2, 2, 1, 74), (2, 3, .5, 71), (2, 3.5, .5, 69),
           (3, 0, 3, 71),
           (4, 0, 1, 71), (4, 1, .5, 74), (4, 1.5, .5, 71), (4, 2, 1, 69), (4, 3, 1, 67),
           (5, 0, 1, 69), (5, 1, 1, 71), (5, 2, 2, 74),
           (6, 0, .5, 76), (6, .5, .5, 74), (6, 1, .5, 71), (6, 1.5, .5, 69), (6, 2, 1, 67), (6, 3, 1, 69),
           (7, 0, 3, 64)]
VERSE_B = [(0, 0, .5, 64), (0, .5, .5, 67), (0, 1, 1, 69), (0, 2, .5, 71), (0, 2.5, .5, 69), (0, 3, 1, 67),
           (1, 0, 1, 69), (1, 1, 1, 71), (1, 2, 2, 74),
           (2, 0, .5, 76), (2, .5, .5, 74), (2, 1, 1, 71), (2, 2, .5, 74), (2, 2.5, .5, 76), (2, 3, 1, 79),
           (3, 0, 3, 76, 74),
           (4, 0, 1, 79), (4, 1, .5, 76), (4, 1.5, .5, 74), (4, 2, 1, 71), (4, 3, 1, 74),
           (5, 0, 1.5, 76), (5, 1.5, .5, 74), (5, 2, 2, 71),
           (6, 0, .5, 69), (6, .5, .5, 71), (6, 1, .5, 74), (6, 1.5, .5, 71), (6, 2, 1, 69), (6, 3, 1, 67),
           (7, 0, 3, 64)]
CHORUS = [(0, 0, 1.5, 76), (0, 1.5, .5, 74), (0, 2, 1, 76), (0, 3, 1, 79),
          (1, 0, 2, 76), (1, 2, 1, 74), (1, 3, 1, 72),
          (2, 0, 1.5, 74), (2, 1.5, .5, 72), (2, 2, 1, 71), (2, 3, 1, 74),
          (3, 0, 3, 74), (3, 3, .5, 72), (3, 3.5, .5, 71),
          (4, 0, 1.5, 76), (4, 1.5, .5, 79), (4, 2, 1, 81), (4, 3, 1, 79),
          (5, 0, 2, 76), (5, 2, 1, 79), (5, 3, 1, 76),
          (6, 0, 1, 74), (6, 1, 1, 76), (6, 2, 1, 79), (6, 3, 1, 78),
          (7, 0, 3, 76, 74)]
def solo_line():
    out = []; up = [64, 67, 69, 71, 74, 76, 79, 81]; down = up[::-1]
    pats = [up, down, [71, 74, 76, 74, 71, 69, 67, 69], [76, 79, 81, 79, 76, 74, 76, 79],
            [81, 83, 81, 79, 76, 79, 76, 74], [74, 76, 74, 71, 69, 71, 69, 67], [64, 67, 69, 71, 69, 71, 74, 76]]
    for b in range(7):
        for i, m in enumerate(pats[b]): out.append((b, i*0.5, .5, m))
    out.append((7, 0, 3, 83, 81))
    return out

# ------------------------------------------------------------------ the arrangement
# INTRO (the montage): two bars of the riff alone, the band in, the drums building
riff(INTRO, 2, full=False)
riff(INTRO + 2, 6)
for b in range(INTRO + 2, INTRO + 4):
    for i in range(4): place(drums, bar_t(b, i), kick(), 0.8); place(drums, bar_t(b, i + 0.5), hat())
beat_drums(INTRO + 4, 4)
melody(INTRO + 4, [(2, 0, 1, 71), (2, 1, 1, 74), (2, 2, 2, 76), (3, 0, 3, 79, 76)], playable=False)   # a call before the verse
# VERSE 1, CHORUS 1, VERSE 2, CHORUS 2, SOLO, OUTRO
riff(VERSE1, 8); beat_drums(VERSE1, 8); melody(VERSE1, VERSE_A)
chorus_band(CHORUS1, 8); beat_drums(CHORUS1, 8, chorus=True); melody(CHORUS1, CHORUS)
riff(VERSE2, 8); beat_drums(VERSE2, 8); melody(VERSE2, VERSE_B)
chorus_band(CHORUS2, 8); beat_drums(CHORUS2, 8, chorus=True); melody(CHORUS2, CHORUS)
chorus_band(SOLO, 8); beat_drums(SOLO, 8, chorus=True); melody(SOLO, solo_line())
# the end: four big hits and the last chord ringing
for i, r in enumerate([E, C, D, E]):
    at = bar_t(OUTRO + i)
    place(band_L, at, guitar(pc(r), BAR*0.95 if i < 3 else 2.6)); place(band_R, at + 0.012, guitar(pc(r), BAR*0.95 if i < 3 else 2.6, bright=0.9))
    place(bass, at, bass_note(r, BAR*0.9 if i < 3 else 2.4)); place(drums, at, crash()); place(drums, at, kick())
    if i < 3:
        for k in range(4): place(drums, bar_t(OUTRO + i, k), kick(), 0.7); place(drums, bar_t(OUTRO + i, k + 0.5), snare(), 0.5)
melody(OUTRO, [(0, 0, 1, 76), (0, 1, 1, 79), (0, 2, 2, 81), (1, 0, 2, 79), (1, 2, 2, 76), (2, 0, 2, 74), (2, 2, 2, 78), (3, 0, 4, 76, 74)])

# ------------------------------------------------------------------ the mix
def reverb(x, wet=0.18):
    """Schroeder: four feedback combs in parallel, two allpasses after — stable (every gain under one)"""
    from scipy.signal import lfilter
    acc = np.zeros_like(x)
    for dsec, g in [(0.0297, 0.77), (0.0371, 0.75), (0.0411, 0.73), (0.0437, 0.71)]:
        D = t2i(dsec); a = np.zeros(D + 1); a[0] = 1; a[D] = -g
        acc += lfilter([1.0], a, x)
    for dsec, g in [(0.005, 0.7), (0.0017, 0.7)]:
        D = t2i(dsec); b = np.zeros(D + 1); b[0] = -g; b[D] = 1; a = np.zeros(D + 1); a[0] = 1; a[D] = -g
        acc = lfilter(b, a, acc)
    return x + acc*wet/4
def stereo(*parts):
    L = sum(p[0] for p in parts); R = sum(p[1] for p in parts); return np.stack([L, R], 1)
d = reverb(drums, 0.12)
bandmix = stereo((band_L*0.9 + band_R*0.25, band_R*0.9 + band_L*0.25), (bass, bass), (d, d))
leadmix = reverb(lead, 0.22); leadmix = np.stack([leadmix*0.95, leadmix], 1)
peak = max(np.abs(bandmix + leadmix).max(), 1e-6)
g = 0.92/peak
def write(name, x):
    x = np.tanh(x*g*1.15)/np.tanh(1.15)
    wav = os.path.join('/tmp', name + '.wav')
    from scipy.io import wavfile
    wavfile.write(wav, SR, (np.clip(x, -1, 1)*32767).astype(np.int16))
    out = os.path.join(ROOT, 'assets', 'tsh', 'music', name + '.mp3')
    subprocess.run(['lame', '--quiet', '-b', '192', wav, out], check=True)
    print(name, out, os.path.getsize(out))
write('rock_band', bandmix); write('rock_lead', leadmix)

# ------------------------------------------------------------------ the chart: five frets, by pitch within each phrase
chart.sort(key=lambda n: n['t'])
phrases = {}
for nt in chart: phrases.setdefault(nt['bar']//4, []).append(nt)
for ph in phrases.values():
    ms = sorted(set(n['m'] for n in ph))
    for n in ph:
        k = ms.index(n['m']); n['lane'] = int(round(k*4/max(1, len(ms) - 1))) if len(ms) > 1 else 2
out = {"bpm": BPM, "play_from": PLAY_FROM*BAR, "end": END*BAR + 2.6, "sections": {"verse1": VERSE1*BAR, "chorus1": CHORUS1*BAR, "verse2": VERSE2*BAR,
       "chorus2": CHORUS2*BAR, "solo": SOLO*BAR, "outro": OUTRO*BAR},
       "notes": [{"t": round(n['t'], 4), "len": round(n['len'], 4), "lane": n['lane']} for n in chart]}
json.dump(out, open(os.path.join(ROOT, 'assets', 'tsh', 'rock_chart.json'), 'w'))
print('notes', len(chart), 'length', END*BAR)
