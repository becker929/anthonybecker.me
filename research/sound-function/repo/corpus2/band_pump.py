#!/usr/bin/env python3
"""Per-band ducking on the separated excerpts, for H34, H39 and H42:
sub-band vs low-band pump on the bass stem, the recovery rise time after the dip, and the
high-band pump on the drum stem. All folded on the beat grid locked on the drum stem.
    python3 corpus2/band_pump.py [--workers 4] -> corpus2/band_pump.json"""
import argparse, json, sys
from pathlib import Path
from multiprocessing import Pool
import numpy as np, librosa
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from analysis import grid, pump as pump_mod
ROOT = Path(__file__).resolve().parent


def curve(env_band, bpm, ph):
    beat = grid.FR * 60 / bpm; L = int(beat); rows = []
    for b in range(int((len(env_band) - ph) // beat)):
        s = int(round(ph + b * beat))
        if s + L <= len(env_band) and env_band[s:s + L].max() > 0: rows.append(env_band[s:s + L])
    if len(rows) < 8: return None
    m = np.median(np.stack(rows), axis=0); return 10 * np.log10(m / (m.max() + 1e-12) + 1e-9)


def recovery_rise_ms(c):
    """After the trough, time from 10% to 90% of the climb back (in dB terms), ms."""
    if c is None: return None
    k = int(90 / (1000 / grid.FR)); tail = c[k:-5]
    if len(tail) < 10: return None
    later = np.maximum.accumulate(tail[::-1])[::-1]; i = int((later - tail).argmax()); top = later[i]; bottom = tail[i]
    if top - bottom < 3: return None
    seg = tail[i:]; t10 = np.argmax(seg >= bottom + 0.1 * (top - bottom)); t90 = np.argmax(seg >= bottom + 0.9 * (top - bottom))
    return round(float((t90 - t10) * 1000 / grid.FR), 1)


def one(tid):
    d = ROOT / "stems" / tid
    try:
        yd, _ = librosa.load(d / "drums.wav", sr=grid.SR, mono=True); yb, _ = librosa.load(d / "bass.wav", sr=grid.SR, mono=True)
        envd, atkd = grid.envelopes(yd); _, bpm, ph = grid.lock(atkd[0], grid.coarse_tempo(yd))
        envb, _ = grid.envelopes(yb)
        cs, cl = curve(envb[0], bpm, ph), curve(envb[1], bpm, ph); ch = curve(envd[5], bpm, ph)
        ms = pump_mod.measure(cs, bpm) if cs is not None else {}; ml = pump_mod.measure(cl, bpm) if cl is not None else {}; mh = pump_mod.measure(ch, bpm) if ch is not None else {}
        lvl_b = float(20 * np.log10(np.sqrt(np.mean(yb ** 2)) + 1e-12)) - float(20 * np.log10(np.sqrt(np.mean(yd ** 2)) + 1e-12))
        return tid, dict(tempo=round(float(bpm), 2), bass_rel_db=round(lvl_b, 1), sub_pump=ms.get("pump_depth_db"), low_pump=ml.get("pump_depth_db"), low_return=ml.get("pump_return_ms"),
                         high_pump=mh.get("pump_depth_db"), recovery_rise_ms=recovery_rise_ms(cl))
    except Exception as e:
        return tid, dict(error=f"{type(e).__name__}: {e}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--workers", type=int, default=4); a = ap.parse_args()
    ids = sorted(p.name for p in (ROOT / "stems").iterdir() if (p / "bass.wav").exists())
    out = {}
    with Pool(a.workers, maxtasksperchild=8) as pool:
        for i, (tid, r) in enumerate(pool.imap_unordered(one, ids, chunksize=4), 1):
            out[tid] = r
            if i % 50 == 0: print(f"  {i}/{len(ids)}", file=sys.stderr, flush=True)
    json.dump(out, open(ROOT / "band_pump.json", "w"), indent=1)
    ok = [r for r in out.values() if "error" not in r and r.get("bass_rel_db", -99) > -18 and r.get("sub_pump") is not None and r.get("low_pump") is not None]
    print(f"{len(out)} excerpts, {len(ok)} with a bass stem: sub pump median {np.median([r['sub_pump'] for r in ok]):.1f} dB, low pump median {np.median([r['low_pump'] for r in ok]):.1f} dB, high-band pump median {np.median([r['high_pump'] for r in ok if r.get('high_pump') is not None]):.1f} dB", file=sys.stderr)
