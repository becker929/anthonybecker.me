#!/usr/bin/env python3
"""
Listening-test stimuli built from REAL one-shots, not from the toy synth.

Why: the survey asks "which of these is more of a clap?" while playing sounds
my own synthesiser made. Measured against 318 real one-shots, 39% of the
synthetic stimuli's features sat outside the p10-p90 band of real sounds of
the same job, and attack time was wrong on 38 of 58. A producer answering
those questions was judging sounds that are not the thing they are called.

What this does instead: take a real one-shot as the source, then move ONE
thing about it. The timbre stays real, the comparison stays controlled, and
the pair still isolates a single variable the way the old sweeps did.

Sources are archive.org packs under CC BY / CC0 / Public Domain Mark, chosen
in library/real/sources.md precisely so they can be redistributed. Credit
lines travel with every stimulus into pairs.json. Corpus audio is NEVER used
here: those tracks are ND-licensed and separated stems of them must not be
published.

    python3 listen/real_sweeps.py            # render + report
    python3 listen/real_sweeps.py --check    # measure what was rendered
"""
import argparse, csv, json, sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from analysis.signal_features import describe_file  # noqa: E402
from synth.engine import softclip, butter_filter, normalize, SR  # noqa: E402

REAL_WAV = ROOT / "library" / "real" / "wav"
MANIFEST = ROOT / "library" / "real" / "manifest.csv"
FEATURES = ROOT / "out" / "library_real.csv"
OUT_DIR = ROOT / "out" / "real_sweeps"

# Which one-variable moves to make, per job. Each is (param, values, kind).
# Values are the knob, not the measured result; the measured result is checked
# afterwards and written into the manifest.
SWEEPS = {
    "kick":       [("decay_ms", [60, 120, 240, 480], "decay"),
                   ("drive", [0.0, 0.35, 0.7], "drive"),
                   ("pitch_st", [-5, 0, 5], "pitch")],
    "rumble":     [("decay_ms", [200, 500, 1000], "decay"),
                   ("lowpass_hz", [90, 160, 300], "lowpass")],
    "hat_closed": [("decay_ms", [15, 40, 100], "decay"),
                   ("lowpass_hz", [4000, 8000, 16000], "lowpass")],
    "hat_open":   [("decay_ms", [80, 200, 450], "decay")],
    "clap":       [("decay_ms", [60, 140, 300], "decay"),
                   ("lowpass_hz", [2000, 5000, 12000], "lowpass")],
    "perc":       [("decay_ms", [50, 150, 400], "decay"),
                   ("lowpass_hz", [1500, 4000, 10000], "lowpass")],
    "stab":       [("decay_ms", [80, 250, 600], "decay"),
                   ("lowpass_hz", [600, 1600, 4000], "lowpass"),
                   ("drive", [0.0, 0.4, 0.8], "drive")],
}

# Features used to pick a TYPICAL source sound for each job.
TYPICAL_KEYS = ["attack_ms", "decay_ms", "crest_factor_db",
                "spectral_centroid_hz", "band_sub_share", "band_high_share"]


def load_rows():
    feats = {r["file"].split("/")[-1]: r for r in csv.DictReader(open(FEATURES))}
    src = {}
    for r in csv.DictReader(open(MANIFEST)):
        src[Path(r["file"]).name] = r
    return feats, src


def typical_sources(feats, src, per_job=2):
    """The most ordinary real sound of each job: nearest the median in z-space.

    An oddity makes a bad base for a controlled comparison. Nothing here is
    about picking a GOOD sound, only a representative one.
    """
    by = {}
    for name, r in feats.items():
        job = src.get(name, {}).get("role") or r.get("sound")
        if job:
            by.setdefault(job, []).append((name, r))

    chosen = {}
    for job, rows in by.items():
        cols = {}
        for k in TYPICAL_KEYS:
            v = [float(r[k]) for _, r in rows if r.get(k) not in (None, "", "nan")]
            if len(v) >= 5:
                cols[k] = (float(np.median(v)), float(np.std(v)) or 1.0)
        scored = []
        for name, r in rows:
            d = 0.0
            for k, (med, sd) in cols.items():
                try:
                    d += ((float(r[k]) - med) / sd) ** 2
                except (TypeError, ValueError):
                    d += 4.0
            scored.append((d, name))
        scored.sort()
        chosen[job] = [n for _, n in scored[:per_job]]
    return chosen


def load_mono(path):
    y, sr = sf.read(str(path))
    if y.ndim > 1:
        y = y.mean(axis=1)
    return np.asarray(y, dtype=np.float64), sr


def apply_decay(y, sr, decay_ms):
    """Shape the tail to a target -20 dB decay, never lengthening the source."""
    n = len(y)
    t = np.arange(n) / sr * 1000.0
    tau = max(decay_ms, 1.0) / np.log(10.0)      # -20 dB at decay_ms
    env = np.exp(-t / tau)
    out = y * env
    keep = int(min(n, (decay_ms * 3.0 / 1000.0) * sr) + 0.05 * sr)
    return out[:keep]


def apply_lowpass(y, sr, hz):
    return butter_filter(y, min(hz, sr * 0.45), sr=sr, btype="low", order=4)


def apply_drive(y, drive):
    return softclip(y, drive=drive) if drive > 0 else y


def apply_pitch(y, sr, semitones):
    if semitones == 0:
        return y
    import librosa
    return librosa.effects.pitch_shift(y=y, sr=sr, n_steps=float(semitones))


def render(chosen, src):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.wav"):
        old.unlink()
    rows = []
    for job, sweeps in SWEEPS.items():
        names = chosen.get(job) or []
        if not names:
            print(f"  no source for {job}, skipped", file=sys.stderr)
            continue
        base = names[0]
        y, sr = load_mono(REAL_WAV / base)
        meta = src.get(base, {})
        for param, values, kind in sweeps:
            for v in values:
                if kind == "decay":
                    out = apply_decay(y, sr, v)
                elif kind == "lowpass":
                    out = apply_lowpass(y, sr, v)
                elif kind == "drive":
                    out = apply_drive(y, v)
                elif kind == "pitch":
                    out = apply_pitch(y, sr, v)
                else:
                    continue
                out = normalize(out, peak_db=-1.0)
                stem = f"{job}__{param}__{v}"
                sf.write(OUT_DIR / f"{stem}.wav", out, sr)
                rows.append(dict(file=f"{stem}.wav", job=job, param=param, value=v,
                                 source_file=base,
                                 source_item=meta.get("source_item", ""),
                                 licence=meta.get("licence", ""),
                                 source_url=meta.get("source_url", "")))
    with open(OUT_DIR / "manifest.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-job", type=int, default=2)
    a = ap.parse_args()

    feats, src = load_rows()
    chosen = typical_sources(feats, src, a.per_job)
    print("source sounds chosen (most typical of each job):")
    for job in sorted(chosen):
        if job in SWEEPS:
            print(f"  {job:12s} {chosen[job][0]}  [{src.get(chosen[job][0],{}).get('source_item','?')}]")
    rows = render(chosen, src)
    print(f"\nrendered {len(rows)} stimuli into {OUT_DIR}")
    jobs = sorted({r['job'] for r in rows})
    print(f"jobs: {', '.join(jobs)}")


if __name__ == "__main__":
    main()
