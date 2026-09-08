#!/usr/bin/env python3
"""Loudness of every separated excerpt: the four stems summed back to the excerpt at its original
level. Writes corpus2/loudness.json.   python3 corpus2/loudness_corpus.py"""
import json, sys
from pathlib import Path
import numpy as np, soundfile as sf
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from analysis.loudness import measure
ROOT = Path(__file__).resolve().parent
out = {}
for d in sorted((ROOT / "stems").iterdir()):
    if not (d / "bass.wav").exists(): continue
    ys = [sf.read(d / f"{s}.wav")[0] for s in ("drums", "bass", "other", "vocals")]; n = min(len(y) for y in ys)
    mix = sum(y[:n] for y in ys)
    out[d.name] = measure(mix, 22050)
json.dump(out, open(ROOT / "loudness.json", "w"), indent=1)
v = [x["lufs"] for x in out.values() if x["lufs"] is not None and x["lufs"] > -60]
print(f"{len(out)} excerpts; integrated loudness median {np.median(v):.1f} LUFS, quartiles {np.quantile(v, .25):.1f} / {np.quantile(v, .75):.1f}; crest median {np.median([x['crest_db'] for x in out.values() if x['crest_db']]):.1f} dB", file=sys.stderr)
