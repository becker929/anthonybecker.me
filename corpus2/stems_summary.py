#!/usr/bin/env python3
"""Digest corpus2/stems_results.json: the pump three ways, where real kicks land,
what the drum stems hold, and a real in-genre hit library harvested from them.

    python3 corpus2/stems_summary.py   -> corpus2/stems_summary.json, out/library_corpus.csv
"""
import json, csv, statistics as st
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent
R = json.load(open(ROOT / "stems_results.json"))
S = json.load(open(ROOT / "summary.json")); keep = {t["id"] for t in S["tracks"]}
R = [r for r in R if r["id"] in keep]
med = lambda xs: round(float(np.median(xs)), 3) if xs else None
q = lambda xs, p: round(float(np.quantile(xs, p)), 3) if xs else None

def vals(k, cond=lambda r: True): return [r[k] for r in R if r.get(k) is not None and cond(r)]

# bass stem present? if the bass stem is more than 18 dB under the drums, Demucs found little bass
has_bass = lambda r: r["levels"].get("bass", -99) > -18
out = dict(n=len(R), n_with_bass=sum(has_bass(r) for r in R))
out["pump"] = dict(
    mix_median=med(vals("pump_mix")), bass_median=med(vals("pump_bass", has_bass)), sidechain_median=med(vals("sidechain", has_bass)),
    sidechain_q25=q(vals("sidechain", has_bass), 0.25), sidechain_q75=q(vals("sidechain", has_bass), 0.75),
    sidechain_over_3db=sum(v > 3 for v in vals("sidechain", has_bass)), sidechain_over_6db=sum(v > 6 for v in vals("sidechain", has_bass)),
    sidechain_return_median=med(vals("sidechain_return", has_bass)), bass_gap_tracks=sum(1 for r in R if has_bass(r) and (r.get("pump_bass") or 0) > 25),
    bass_sub_share_median=med(vals("bass_sub_share", has_bass)))
kp = vals("kick_pitch_hz")
out["kick_pitch_hz"] = dict(n=len(kp), median=med(kp), q25=q(kp, 0.25), q75=q(kp, 0.75), under_50=sum(v < 50 for v in kp), over_65=sum(v > 65 for v in kp),
                            hist={str(b): int(((np.array(kp) >= b) & (np.array(kp) < b + 5)).sum()) for b in range(35, 100, 5)})
out["levels_db_below_drums"] = {s: med([r["levels"][s] for r in R if s in r["levels"]]) for s in ("bass", "other", "vocals")}
# what the drum stems hold
roles = {}
for job in ("kick", "hat", "clap", "hook", "space", "rumble"):
    per_min = [r["roles"][job]["per_minute"] for r in R if job in r["roles"]]
    conf = [r["roles"][job]["mean_confidence"] for r in R if job in r["roles"]]
    roles[job] = dict(tracks_with=len(per_min), per_minute_median=med(per_min), confidence_median=med(conf))
out["drum_stem_roles"] = roles
# the in-genre hit library: confident hits, capped per track so no track dominates
rows = []; caps = {"kick": 12, "hat": 12, "clap": 8, "hook": 8, "space": 4, "rumble": 4}
for r in R:
    seen = {}
    for h in sorted(r["hits"], key=lambda h: -h["conf"]):
        if h["conf"] < 0.6 or seen.get(h["role"], 0) >= caps[h["role"]]: continue
        seen[h["role"]] = seen.get(h["role"], 0) + 1
        rows.append(dict(file=f"corpus:{r['id']}@{h['t']}", sound=h["role"], param="corpus", value=h["t"], **{k: v for k, v in h.items() if k not in ("t", "role", "conf")}, conf=h["conf"]))
fields = list(rows[0].keys()) if rows else []
with open(ROOT.parent / "out" / "library_corpus.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
out["hit_library"] = {job: sum(1 for x in rows if x["sound"] == job) for job in caps}
# medians of the in-genre kicks/hats/claps vs the three libraries, on the measures that matter
def lib_medians(path, role_map):
    rs = list(csv.DictReader(open(path))); o = {}
    for job in ("kick", "hat", "clap"):
        sel = [x for x in rs if role_map(x["sound"]) == job]
        o[job] = {k: med([float(x[k]) for x in sel if x.get(k) not in (None, "", "nan")]) for k in ("decay40_ms", "sustain_share", "band_sub_share", "band_air_share", "spectral_centroid_hz", "crest_factor_db")}
    return o
rm = lambda s: {"hat_closed": "hat", "hat_open": "hat"}.get(s, s)
out["medians"] = dict(corpus=lib_medians(ROOT.parent / "out" / "library_corpus.csv", rm), real_packs=lib_medians(ROOT.parent / "out" / "library_real.csv", rm),
                      synth_v1=lib_medians(ROOT.parent / "out" / "library_synth.csv", rm), synth_v2=lib_medians(ROOT.parent / "out" / "library_synth2.csv", rm))
json.dump(out, open(ROOT / "stems_summary.json", "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "medians"}, indent=1))
for job in ("kick", "hat", "clap"):
    print(job, {lib: {k: v for k, v in out["medians"][lib][job].items() if k in ("decay40_ms", "band_sub_share", "spectral_centroid_hz")} for lib in out["medians"]})
