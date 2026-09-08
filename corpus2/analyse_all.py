#!/usr/bin/env python3
"""Stage 4 pipeline: grid + pump + downbeat for every track, four at a time.

    python3 corpus2/analyse_all.py [--follow]

Results go to corpus2/results/<id>.json, one file per track, so a crash loses
nothing and a re-run skips what is done. --follow keeps polling corpus2/wav
for new files until corpus2/FETCH_DONE exists, so analysis overlaps the
download. corpus2/results.json is rebuilt at the end from the per-track files.
"""
import glob, json, os, sys, time, traceback
from multiprocessing import Pool
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RES = ROOT / "results"; RES.mkdir(exist_ok=True)
sys.path.insert(0, str(ROOT.parent))


def one(wav):
    import librosa, numpy as np
    from analysis import grid, pump, downbeat
    out = RES / (Path(wav).stem + ".json")
    try:
        y, _ = librosa.load(wav, sr=grid.SR, mono=True)
        env, atk = grid.envelopes(y)
        g = grid.analyse(wav, y=y, env=env, atk=atk)
        g["pump"] = pump.analyse_env(env, g)
        g["downbeat"] = downbeat.find(env, g["tempo"], g["phase"])
        # per-beat energy per band (linear, each band scaled to its own max) so the
        # summary can regroup beats into bars from the found downbeat
        beat = grid.FR * 60 / g["tempo"]
        nbt = int((env.shape[1] - g["phase"]) // beat)
        idx = np.floor((np.arange(env.shape[1]) - g["phase"]) / beat).astype(int)
        ok = (idx >= 0) & (idx < nbt)
        be = np.stack([np.bincount(idx[ok], weights=env[b][ok], minlength=nbt) for b in range(6)])
        be /= be.max(axis=1, keepdims=True) + 1e-12
        g["beat_energy"] = be.round(4).tolist()
        g["duration_s"] = round(len(y) / grid.SR, 1)
        json.dump(g, open(out, "w"))
        return f"ok   {Path(wav).name[:45]:45s} bpm {g['tempo']:7.2f} lock {g['lock']:.2f} off {g['kick_off_share']:.2f} pump {g['pump']['pump_depth_db']} beat1 {g['downbeat']['beat_one']}/{g['downbeat']['beat_one_strength']} phr {g['downbeat']['phrase_bar']}/{g['downbeat']['group4_strength']}"
    except Exception:
        json.dump({"file": wav, "error": traceback.format_exc()[-800:]}, open(out, "w"))
        return f"FAIL {wav}"


def pending():
    done = {p.stem for p in RES.glob("*.json")}
    return sorted(w for w in glob.glob(str(ROOT / "wav" / "*.wav")) if Path(w).stem not in done)


if __name__ == "__main__":
    follow = "--follow" in sys.argv
    with Pool(4, maxtasksperchild=3) as pool:
        while True:
            todo = pending()
            if todo:
                for line in pool.imap_unordered(one, todo):
                    print(line, file=sys.stderr, flush=True)
            elif not follow or (ROOT / "FETCH_DONE").exists():
                break
            else:
                time.sleep(30)
    allr = [json.load(open(p)) for p in sorted(RES.glob("*.json"))]
    json.dump(allr, open(ROOT / "results.json", "w"))
    print(f"{sum('error' not in r for r in allr)} ok, {sum('error' in r for r in allr)} failed -> corpus2/results.json", file=sys.stderr)
