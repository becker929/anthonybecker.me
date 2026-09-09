#!/usr/bin/env python3
"""
How real do the listening-test stimuli sound, by the numbers?

Every stimulus in out/sweeps is a synthetic sound that the survey names as a
job ("which is more of a clap?"). This checks each one against the measured
distribution of REAL one-shots of the same job in out/library_real.csv.

A stimulus is "out of range" on a feature when it sits outside the p10-p90
band of real sounds of its job. Out-of-range on the features a listener
actually keys on (attack, decay, brightness) means the question is being asked
about a sound that is not the thing it is called.

Usage: python3 listen/realism_check.py [--json out/listen_realism.json]
"""
import argparse, csv, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from analysis.signal_features import describe_file

ROOT = Path(__file__).resolve().parent.parent
SWEEPS = ROOT / "out" / "sweeps"
REAL_CSV = ROOT / "out" / "library_real.csv"

# The features a listener keys on when naming a drum sound's job.
FEATURES = [
    "attack_ms",
    "decay_ms",
    "crest_factor_db",
    "spectral_centroid_hz",
    "band_sub_share",
    "band_high_share",
]

# sweep <sound> -> library <sound>. The library splits hats; sweeps do not.
SOUND_ALIAS = {"hat": "hat_closed"}


def real_bands():
    rows = list(csv.DictReader(open(REAL_CSV)))
    by = {}
    for r in rows:
        by.setdefault(r["sound"], []).append(r)
    bands = {}
    for sound, rs in by.items():
        b = {}
        for k in FEATURES:
            v = sorted(float(r[k]) for r in rs if r.get(k) not in (None, "", "nan"))
            if len(v) < 5:
                continue
            n = len(v)
            b[k] = (v[n // 10], v[n // 2], v[(9 * n) // 10])
        bands[sound] = dict(n=len(rs), bands=b)
    return bands


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=str(SWEEPS), help="folder of stimuli to check")
    ap.add_argument("--json", default=str(ROOT / "out" / "listen_realism.json"))
    a = ap.parse_args()
    sweeps_dir = Path(a.dir)

    bands = real_bands()
    out, misses = [], 0
    for wav in sorted(sweeps_dir.glob("*.wav")):
        sound = wav.stem.split("__")[0]
        ref = SOUND_ALIAS.get(sound, sound)
        if ref not in bands:
            continue
        f = describe_file(str(wav))
        row = {"file": wav.name, "sound": sound, "ref_sound": ref, "features": {}}
        for k, (lo, mid, hi) in bands[ref]["bands"].items():
            val = f.get(k)
            if val is None:
                continue
            ok = lo <= val <= hi
            if not ok:
                misses += 1
            row["features"][k] = {
                "value": val, "real_p10": lo, "real_p50": mid, "real_p90": hi,
                "in_range": ok,
                "ratio_to_median": (val / mid) if mid else None,
            }
        row["out_of_range"] = sum(1 for v in row["features"].values() if not v["in_range"])
        out.append(row)

    checked = sum(len(r["features"]) for r in out)
    summary = {
        "stimuli": len(out),
        "feature_checks": checked,
        "out_of_range": misses,
        "share_out_of_range": round(misses / checked, 3) if checked else None,
        "worst": sorted(out, key=lambda r: -r["out_of_range"])[:10],
        "by_feature": {},
    }
    for k in FEATURES:
        bad = [r for r in out if k in r["features"] and not r["features"][k]["in_range"]]
        tot = [r for r in out if k in r["features"]]
        if tot:
            summary["by_feature"][k] = {"out": len(bad), "of": len(tot)}

    Path(a.json).write_text(json.dumps({"summary": summary, "stimuli": out}, indent=1))
    print(f"{len(out)} stimuli checked against real one-shots")
    print(f"{misses} of {checked} feature checks fall outside the real p10-p90 band "
          f"({summary['share_out_of_range']:.0%})")
    for k, v in summary["by_feature"].items():
        print(f"  {k:22s} out of range: {v['out']}/{v['of']}")
    print(f"\nworst stimuli:")
    for r in summary["worst"][:6]:
        print(f"  {r['file']:38s} {r['out_of_range']} features off")
    print(f"\nwrote {a.json}")


if __name__ == "__main__":
    main()
