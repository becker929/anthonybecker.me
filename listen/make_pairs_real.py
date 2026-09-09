#!/usr/bin/env python3
"""
Build listening-test pairs from the REAL-source stimuli in out/real_sweeps.

Same pairing logic as make_pairs.py (lowest against highest, then interior
values), same pairs.json shape, plus three things the synthetic set did not
need:

  set      which stimulus set an answer belongs to, so answers collected
           against the old synthetic sounds stay separable from these
  source   the real one-shot each stimulus was made from
  credit   the licence and credit line, because CC BY requires attribution
           and this audio is published

    python3 listen/make_pairs_real.py [--target 40]
"""
import argparse, csv, json, re, subprocess, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SWEEPS = ROOT / "out" / "real_sweeps"
SITE = Path("/home/user/anthonybecker.me/research/sound-function/listen")
AUDIO_OUT = SITE / "audio"
PAIRS_JSON = SITE / "pairs.json"
SET_ID = "v2-real"

JOB_OF = {"kick": "kick", "rumble": "rumble", "hat_closed": "hat", "hat_open": "hat",
          "clap": "clap", "perc": "hook", "stab": "hook"}

CREDIT = {
    "CC BY 3.0": "licensed under CC BY 3.0",
    "CC BY 4.0": "licensed under CC BY 4.0",
    "CC Public Domain Mark 1.0": "public domain (CC Public Domain Mark 1.0)",
    "CC0 1.0": "public domain (CC0 1.0)",
}


def encode(wav, out_dir):
    """Encode to mp3 under a set-prefixed name.

    The real-source stimuli use the same <job>__<param>__<value> naming as the
    old synthetic ones, so writing them into the shared audio folder unprefixed
    silently overwrites the sounds that earlier answers were given against.
    Prefixing keeps both sets on disk and keeps those answers interpretable.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    mp3 = out_dir / f"{SET_ID}__{wav.stem}.mp3"
    if mp3.exists() and mp3.stat().st_mtime >= wav.stat().st_mtime:
        return mp3
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(wav), "-b:a", "128k", "-ac", "1", str(mp3)], check=True)
    return mp3


def tag(v):
    return re.sub(r"[^a-zA-Z0-9]+", "p", str(v)).strip("p")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=40)
    a = ap.parse_args()

    rows = list(csv.DictReader(open(SWEEPS / "manifest.csv")))
    groups = defaultdict(list)
    for r in rows:
        groups[(r["job"], r["param"])].append(r)
    for k in groups:
        groups[k].sort(key=lambda r: float(r["value"]))

    keys = sorted(groups)
    specs = [(k, groups[k][0], groups[k][-1]) for k in keys]      # lo vs hi
    interior = {k: groups[k][1:-1] for k in keys}                  # then lo vs mid
    while len(specs) < a.target and any(interior.values()):
        progressed = False
        for k in keys:
            if len(specs) >= a.target:
                break
            if interior[k]:
                specs.append((k, groups[k][0], interior[k].pop(0)))
                progressed = True
        if not progressed:
            break

    pairs, used = [], set()
    for i, ((job, param), lo, hi) in enumerate(specs, 1):
        for r in (lo, hi):
            used.add(r["file"])
        lic = lo.get("licence", "")
        credit = f"{lo.get('source_item','')}, {CREDIT.get(lic, lic)}"
        pairs.append({
            "id": f"{i:03d}_{job}_{param}_{tag(lo['value'])}v{tag(hi['value'])}",
            "set": SET_ID,
            "sound": job,
            "param": param,
            "job": JOB_OF.get(job, "hook"),
            "a": {"file": f"audio/{SET_ID}__{Path(lo['file']).stem}.mp3", "value": float(lo["value"])},
            "b": {"file": f"audio/{SET_ID}__{Path(hi['file']).stem}.mp3", "value": float(hi["value"])},
            "source": {"file": lo.get("source_file", ""), "item": lo.get("source_item", ""),
                       "licence": lic, "url": lo.get("source_url", "")},
            "credit": credit,
        })

    for name in sorted(used):
        encode(SWEEPS / name, AUDIO_OUT)

    PAIRS_JSON.write_text(json.dumps(pairs, indent=1))

    credits = sorted({(p["source"]["item"], p["source"]["licence"], p["source"]["url"])
                      for p in pairs})
    (SITE / "credits.json").write_text(json.dumps(
        [{"item": i, "licence": l, "url": u} for i, l, u in credits], indent=1))

    print(f"{len(pairs)} pairs written to {PAIRS_JSON} (set {SET_ID})")
    print(f"{len(used)} stimuli encoded to {AUDIO_OUT}")
    print("credits:")
    for i, l, u in credits:
        print(f"  {i}  [{l}]")


if __name__ == "__main__":
    main()
