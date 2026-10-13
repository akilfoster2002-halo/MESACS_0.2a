"""HER SONG: beabadoobee, "Worth It" — from 2:14 to its end — cut, its beat grid, its sections, and the chart.
The electric guitar's sections (heavy distortion: the harmonic part's spectral flatness) are where the player plays;
around them the scene watches her room. The notes are the guitar's own attacks (onsets of the harmonic part), on
the eighth-note grid, one lane of four (the arrow keys) by their pitch within the phrase.

  PYTHONPATH=<librosa> python3 tools/song/worth_it.py   → assets/tsh/music/worth_it.mp3, assets/tsh/worth_chart.json
"""
import json, os, subprocess, numpy as np, librosa
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'assets/tsh/music/worth_it_full.mp3')
OUT = os.path.join(ROOT, 'assets/tsh/music/worth_it.mp3')
START = 134.0
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(START), '-i', SRC, '-af', 'afade=t=out:st=57.2:d=1.2', '-t', '58.6', '-b:a', '192k', OUT], check=True)
y, sr = librosa.load(OUT, sr=22050)
HOP = 512
tempo, bf = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP)
beats = librosa.frames_to_time(bf, sr=sr, hop_length=HOP)
on = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
phase = int(np.argmax([on[bf[p::4]].mean() for p in range(4)]))
bars = beats[phase::4]
# the guitar's sections: distortion (flatness of the harmonic part), per beat, smoothed over a bar
H, P = librosa.effects.hpss(y)
flat = librosa.util.sync(librosa.feature.spectral_flatness(y=H, hop_length=HOP), bf)[0]
sm = np.convolve(flat, np.ones(4)/4, mode='same')
on_g = sm > 0.03
# into spans, snapped to the bar lines, short gaps (< a bar) filled, short runs (< 4 bars) dropped
spans = []; i = 0
while i < len(on_g):
    if on_g[i]:
        j = i
        while j < len(on_g) and on_g[j]: j += 1
        spans.append([beats[i], beats[min(j, len(beats) - 1)]]); i = j
    else: i += 1
def snap(t): return float(bars[np.argmin(np.abs(bars - t))])
spans = [[snap(a), snap(b)] for a, b in spans]
merged = []
for a, b in spans:
    if merged and a - merged[-1][1] < 2.4: merged[-1][1] = b
    else: merged.append([a, b])
bar = float(np.median(np.diff(bars)))
play = [s for s in merged if s[1] - s[0] >= bar*4 - 0.1]
# split one long section at its middle bar line so the scene can come round between them
if len(play) == 1 and play[0][1] - play[0][0] > bar*12:
    a, b = play[0]; mids = [t for t in bars if a + bar*6 < t < b - bar*6]
    m = mids[len(mids)//2]; play = [[a, float(m) - bar], [float(m) + bar, b]]
# the notes: the guitar's attacks inside the play spans, on the eighth-note grid
# the notes: the guitar's band (400 Hz–4 kHz) at each eighth note of the play spans; in every bar, the five
# strongest of its eight hits (the downbeat always) — a chart a person can play, on the song's own accents
Smel = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=HOP, n_mels=64, fmin=400, fmax=4000)
env = librosa.onset.onset_strength(S=librosa.power_to_db(Smel), sr=sr, hop_length=HOP)
chroma = librosa.feature.chroma_cqt(y=H, sr=sr, hop_length=HOP)
def at(t): f = librosa.time_to_frames(t, sr=sr, hop_length=HOP); return float(env[max(0, f - 1):f + 2].max())
notes = []
for k in range(len(bars) - 1):
    a, b = float(bars[k]), float(bars[k + 1])
    if not any(pa - 0.05 <= a and b <= pb + 0.05 for pa, pb in play): continue
    grid = [a + (b - a)*i/8 for i in range(8)]
    strength = [at(t) for t in grid]
    keep = sorted(sorted(range(8), key=lambda i: -strength[i])[:5] + [0])
    for i in sorted(set(keep)):
        t = grid[i]; f = librosa.time_to_frames(t, sr=sr, hop_length=HOP)
        notes.append({"t": round(t, 4), "len": 0.0, "pc": int(np.argmax(chroma[:, min(f, chroma.shape[1] - 1)]))})
# lanes: pitch class ranked within each bar's notes, spread over four lanes; runs of one pitch walk a lane
for n in notes: n["bar"] = int(np.searchsorted(bars, n["t"]))
by_bar = {}
for n in notes: by_bar.setdefault(n["bar"], []).append(n)
prev = 1
for b, ns in sorted(by_bar.items()):
    pcs = sorted(set(n["pc"] for n in ns))
    for n in ns:
        k = pcs.index(n["pc"]); lane = int(round(k*3/max(1, len(pcs) - 1))) if len(pcs) > 1 else (prev + 1) % 4
        n["lane"] = lane; prev = lane
chart = {"bpm": float(np.atleast_1d(tempo)[0]), "start": START, "end": 58.6, "beats": [round(float(t), 4) for t in beats], "bars": [round(float(t), 4) for t in bars],
         "play": play, "notes": [{"t": n["t"], "len": 0.0, "lane": n["lane"]} for n in notes]}
json.dump(chart, open(os.path.join(ROOT, 'assets/tsh/worth_chart.json'), 'w'))
print('bpm', chart['bpm'], 'beats', len(beats), 'bars', len(bars), 'bar', round(bar, 3), 'play', play, 'notes', len(notes))
