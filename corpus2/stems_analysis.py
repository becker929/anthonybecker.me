#!/usr/bin/env python3
"""Measure the separated corpus excerpts: pump on the bass stem, hits from the drum
stem named by the role model, kick landing pitch, stem levels, true sidechain.

    python3 corpus2/stems_analysis.py [--workers 2]     -> corpus2/stems_results.json (resumable)

The excerpt's mix is rebuilt as the sum of the four stems so the grid (tempo,
phase, bar one) is locked on the same audio the stems came from.
"""
import argparse, json, sys, traceback
from pathlib import Path
from multiprocessing import Pool
import numpy as np, soundfile as sf
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
ROOT = Path(__file__).resolve().parent
STEMS_DIR = ROOT / "stems"; OUT = ROOT / "stems_results"; OUT.mkdir(exist_ok=True)


def one(tid):
    from analysis import stems, grid
    d = STEMS_DIR / tid; res = OUT / f"{tid}.json"
    if res.exists(): return tid, "skip"
    try:
        parts = {s: str(d / f"{s}.wav") for s in stems.STEMS}
        ys = [sf.read(parts[s])[0] for s in stems.STEMS]; n = min(len(y) for y in ys)
        mix = sum(y[:n] for y in ys); mix = mix / (np.abs(mix).max() + 1e-9)
        mixp = d / "mix.wav"; sf.write(mixp, mix, 22050)
        g = stems.grid_of(str(mixp))
        bp = stems.bass_pump(parts["bass"], g)
        hits = stems.harvest_hits(parts["drums"])
        roles = stems.role_summary(hits, g["duration_s"])
        kp = stems.kick_pitch(parts["drums"], hits)
        sc = stems.sidechain_between(parts["drums"], parts["bass"])
        levels = stems.stem_levels(parts)
        # keep the per-hit features of the kicks, hats and claps: this is the real in-genre hit library
        keep = [dict(t=h["t"], role=h["role"], conf=h["probs"][h["role"]], **{k: round(float(v), 5) for k, v in h["features"].items()}) for h in hits]
        r = dict(id=tid, tempo=g["tempo"], lock=g["lock"], beat_one=g["downbeat"]["beat_one"], beat_one_strength=g["downbeat"]["beat_one_strength"],
                 pump_mix=g["pump_mix"]["pump_depth_db"], pump_mix_return=g["pump_mix"]["pump_return_ms"],
                 pump_bass=bp["pump_depth_db"], pump_bass_return=bp["pump_return_ms"], bass_sub_share=bp.get("bass_sub_share"),
                 sidechain=sc.get("pump_depth_db"), sidechain_return=sc.get("pump_return_ms"), n_kicks_on_beat=sc.get("n_kicks"),
                 kick_pitch_hz=kp, levels=levels, roles=roles, hits=keep, kick_off_share=g["kick_off_share"])
        json.dump(r, open(res, "w")); mixp.unlink(missing_ok=True)
        return tid, f"ok bpm {g['tempo']:.1f} pump mix {r['pump_mix']} bass {r['pump_bass']} sc {r['sidechain']} kick {kp} hits {len(hits)}"
    except Exception as e:
        return tid, "FAIL " + traceback.format_exc().splitlines()[-1]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--workers", type=int, default=2); ap.add_argument("--limit", type=int, default=0); a = ap.parse_args()
    ids = sorted(p.name for p in STEMS_DIR.iterdir() if (p / "bass.wav").exists())
    if a.limit: ids = ids[: a.limit]
    with Pool(a.workers, maxtasksperchild=4) as pool:
        for tid, msg in pool.imap_unordered(one, ids):
            print(f"{tid[:44]:44s} {msg}", file=sys.stderr, flush=True)
    rows = [json.load(open(p)) for p in sorted(OUT.glob("*.json"))]
    json.dump(rows, open(ROOT / "stems_results.json", "w")); print(f"{len(rows)} tracks -> corpus2/stems_results.json", file=sys.stderr)


if __name__ == "__main__":
    main()
