#!/usr/bin/env python3
"""Stage 4 summary: the phrase questions, answered over the big corpus.

    python3 corpus2/summarise.py            -> corpus2/summary.json (+ a printed digest)

Per track (after corpus2/exclude.json and a tempo/lock sanity filter):
  * rotate the 16-step profiles onto the found downbeat
  * kick on the beats: share of sub-band attacks on steps 0,4,8,12
  * clap on 2 and 4: of mid+high attack mass on the four beats, the share on beats 2 and 4
  * bars regrouped from beat one; kick-off runs >= 2 bars = breakdowns; their lengths;
    the bar where the kick returns, relative to the phrase start, mod 4 / 8 / 16
  * pump depth and return time (from analysis/pump.py)
Then the same headline numbers per producer with >= 3 tracks, so we can see
whether the findings hold across people or belong to one prolific artist.
"""
import json, re, statistics as st
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from analysis import downbeat as DB

ROOT = Path(__file__).resolve().parent
ASYM_MIN = 0.05   # a beat-pair split of 0.55/0.45 or more counts as a clear backbeat
TEMPO_LO, TEMPO_HI, MIN_LOCK = 128, 180, 0.2


def excluded(m, rules):
    for r in rules:
        if r["contains"].lower() in str(m.get(r["field"], "")).lower():
            return r["reason"]
    return None


def bars_from_beats(be_low, beat_one):
    nb = (len(be_low) - beat_one) // 4
    if nb < 4: return None, None
    bars = np.array(be_low[beat_one:beat_one + nb * 4]).reshape(nb, 4).mean(axis=1)
    ref = np.percentile(bars, 90) + 1e-12
    on = (bars / ref) > 0.3
    on[0] = on[1]; on[-1] = on[-2]
    return bars, on


def runs_of(on):
    runs, i = [], 0
    while i < len(on):
        j = i
        while j < len(on) and on[j] == on[i]: j += 1
        runs.append((bool(on[i]), i, j)); i = j
    return runs


def find_beat_one(r):
    """Beat one from two clues. Section changes vote for a beat (as in analysis/downbeat.py,
    recomputed here from the stored per-beat energies). The backbeat picks the pair: in this
    music the clap sits on beats 2 and 4, so the beat pair with the bigger mid+high attack
    share is (2, 4) and beat one is in the other pair. When the pairs are near-equal there
    is no clap to lean on and the vote alone decides."""
    pa0 = np.array(r["profile_attack"]); mh = pa0[3] + pa0[4]
    pairA, pairB = mh[[0, 8]].sum(), mh[[4, 12]].sum()
    share_B = pairB / (pairA + pairB + 1e-12)          # share on the pair starting at beat index 1
    asym = abs(share_B - 0.5)
    be = np.array(r["beat_energy"]); E = np.log10(be + 1e-4)
    nov = DB.novelty(E, 4); peaks = DB.peaks_of(nov, 3, 0.10)
    hist = np.bincount(peaks % 4, weights=nov[peaks], minlength=4) if len(peaks) else np.zeros(4)
    if asym >= ASYM_MIN:
        cands = [0, 2] if share_B > 0.5 else [1, 3]      # beat one is in the pair with fewer claps
        o = max(cands, key=lambda c: hist[c])
    else:
        o = int(hist.argmax()) if hist.sum() > 0 else r["downbeat"]["beat_one"]
    strength = round(float(hist[o] / (hist.sum() + 1e-12) * 4), 2) if hist.sum() > 0 else 0.0
    return o, strength, round(float(asym), 3)


def per_track(r, m):
    o, o_strength, asym = find_beat_one(r); pb = r["downbeat"]["phrase_bar"]
    pe = np.roll(np.array(r["profile_energy"]), -4 * o, axis=1)
    pa = np.roll(np.array(r["profile_attack"]), -4 * o, axis=1)
    beats = [0, 4, 8, 12]
    sub_on_beats = float(pa[0][beats].sum())
    mh = pa[3] + pa[4]                                   # mid + high attacks: claps, snares
    mh_beats = mh[beats]; clap24 = float((mh_beats[1] + mh_beats[3]) / (mh_beats.sum() + 1e-12))
    hat_off = float((pa[5][[2, 6, 10, 14]].sum()) / (pa[5][beats].sum() + pa[5][[2, 6, 10, 14]].sum() + 1e-12))  # air attacks on the off-8ths vs beats
    be = np.array(r["beat_energy"])
    bars, on = bars_from_beats(be[1], o)
    out = dict(id=r["file"].rsplit("/", 1)[-1][:-4], artist=m["artist"], title=m["title"], year=m.get("year"), label=m.get("label"),
               tempo=r["tempo"], lock=r["lock"], beat_one=o, beat_one_strength=o_strength, beat_one_novelty_only=r["downbeat"]["beat_one"],
               phrase_strength=r["downbeat"]["group4_strength"], backbeat_asym=asym, clear_backbeat=bool(asym >= ASYM_MIN),
               sub_on_beats=round(sub_on_beats, 3), clap_on_2_4=round(clap24, 3), hat_off_8ths=round(hat_off, 3),
               pump_depth_db=r["pump"].get("pump_depth_db"), pump_return_ms=r["pump"].get("pump_return_ms"),
               profile_energy=pe.round(4).tolist(), profile_attack=pa.round(4).tolist())
    if bars is None: return out
    runs = runs_of(on)
    breaks = [(s, e) for k, s, e in runs if not k and e - s >= 2 and s > 0 and e < len(on)]
    returns = [e for s, e in breaks]
    rel = [(b - pb) % 16 for b in returns]
    out.update(n_bars=int(len(on)), kick_off_share=round(float((~on).sum() / len(on)), 3), breakdowns=[(int(s), int(e - s)) for s, e in breaks],
               break_lengths=[int(e - s) for s, e in breaks], longest_off_bars=max([e - s for s, e in breaks], default=0),
               returns_rel_phrase=rel, kick_runs=[int(e - s) for k, s, e in runs if k])
    return out


def digest(tracks):
    def med(k): 
        v = [t[k] for t in tracks if t.get(k) is not None]; return round(float(st.median(v)), 3) if v else None
    lens = [L for t in tracks for L in t.get("break_lengths", [])]
    rel = [x for t in tracks for x in t.get("returns_rel_phrase", [])]
    kr = [L for t in tracks for L in t.get("kick_runs", [])]
    d = dict(n=len(tracks), producers=len({t["artist"] for t in tracks}),
             tempo_median=med("tempo"), tempo_range=[min(t["tempo"] for t in tracks), max(t["tempo"] for t in tracks)],
             sub_on_beats_median=med("sub_on_beats"), sub_on_beats_over_half=sum(t["sub_on_beats"] > 0.5 for t in tracks),
             clap_on_2_4_median=med("clap_on_2_4"), clear_backbeat=sum(t["clear_backbeat"] for t in tracks),
             backbeat_asym_median=med("backbeat_asym"), clap_on_2_4_over_60=sum(t["clap_on_2_4"] > 0.6 for t in tracks),
             beat_one_agrees_with_novelty=sum(t["beat_one"] == t["beat_one_novelty_only"] for t in tracks),
             hat_off_8ths_median=med("hat_off_8ths"),
             pump_depth_median=med("pump_depth_db"), pump_over_6db=sum((t.get("pump_depth_db") or 0) > 6 for t in tracks),
             pump_return_median=med("pump_return_ms"),
             kick_off_share_median=med("kick_off_share"), tracks_with_breakdown=sum(bool(t.get("breakdowns")) for t in tracks),
             breakdowns=len(lens), break_length_median=(st.median(lens) if lens else None),
             break_len_mult4=(sum(L % 4 == 0 for L in lens) / len(lens) if lens else None),
             break_len_mult8=(sum(L % 8 == 0 for L in lens) / len(lens) if lens else None),
             break_len_hist=dict(sorted(Counter(lens).items())),
             return_on_8_line=(sum(x % 8 == 0 for x in rel) / len(rel) if rel else None),
             return_on_4_line=(sum(x % 4 == 0 for x in rel) / len(rel) if rel else None),
             return_on_16_line=(sum(x == 0 for x in rel) / len(rel) if rel else None),
             kick_run_median=(st.median(kr) if kr else None), kick_run_mult8=(sum(L % 8 == 0 for L in kr) / len(kr) if kr else None),
             downbeat_confident=sum(t["beat_one_strength"] >= 2 for t in tracks))
    return d


def main():
    manifest = {m["id"]: m for m in json.load(open(ROOT / "manifest.json"))}
    rules = json.load(open(ROOT / "exclude.json"))["rules"]
    results = [json.load(open(p)) for p in sorted((ROOT / "results").glob("*.json"))]
    tracks, dropped = [], Counter()
    for r in results:
        if "error" in r: dropped["analysis error"] += 1; continue
        m = manifest.get(r["file"].rsplit("/", 1)[-1][:-4])
        if not m: dropped["not in manifest"] += 1; continue
        why = excluded(m, rules)
        if why: dropped[why] += 1; continue
        if not (TEMPO_LO <= r["tempo"] <= TEMPO_HI): dropped[f"tempo outside {TEMPO_LO}-{TEMPO_HI}"] += 1; continue
        if r["lock"] < MIN_LOCK: dropped["weak beat lock"] += 1; continue
        tracks.append(per_track(r, m))
    by_artist = defaultdict(list)
    for t in tracks: by_artist[t["artist"]].append(t)
    per_producer = {a: digest(ts) for a, ts in by_artist.items() if len(ts) >= 3}
    by_label = defaultdict(list)
    for t in tracks: by_label[t["label"] or "?"].append(t)
    per_label = {a: digest(ts) for a, ts in by_label.items() if len(ts) >= 5}
    # the pilot corpus, run through the same code, for comparison
    summary = dict(n_results=len(results), dropped=dict(dropped), all=digest(tracks), per_producer=per_producer, per_label=per_label,
                   filters=dict(tempo=[TEMPO_LO, TEMPO_HI], min_lock=MIN_LOCK),
                   mean_profile_attack=np.mean([t["profile_attack"] for t in tracks], axis=0).round(4).tolist() if tracks else None,
                   mean_profile_energy=np.mean([t["profile_energy"] for t in tracks], axis=0).round(4).tolist() if tracks else None,
                   tracks=tracks)
    json.dump(summary, open(ROOT / "summary.json", "w"))
    a = summary["all"]
    print(f"{len(results)} results, dropped {dict(dropped)}\n{a['n']} tracks from {a['producers']} producers, tempo median {a['tempo_median']} range {a['tempo_range']}")
    for k in ["sub_on_beats_median", "sub_on_beats_over_half", "clap_on_2_4_median", "clear_backbeat", "backbeat_asym_median", "clap_on_2_4_over_60", "beat_one_agrees_with_novelty", "hat_off_8ths_median",
              "pump_depth_median", "pump_over_6db", "pump_return_median", "kick_off_share_median", "tracks_with_breakdown", "breakdowns", "break_length_median",
              "break_len_mult4", "break_len_mult8", "return_on_4_line", "return_on_8_line", "return_on_16_line", "kick_run_median", "kick_run_mult8", "downbeat_confident"]:
        v = a[k]; print(f"  {k:28s} {round(v, 3) if isinstance(v, float) else v}")
    print("  break lengths:", a["break_len_hist"])
    print(f"labels with >=5 tracks: {len(per_label)}")
    for name, d in sorted(per_label.items(), key=lambda x: -x[1]["n"]):
        print(f"  {name[:28]:28s} n={d['n']:2d} backbeat {d['clear_backbeat']}/{d['n']} pump {d['pump_depth_median']} off {d['kick_off_share_median']} ret8 {d['return_on_8_line'] and round(d['return_on_8_line'],2)}")
    print(f"producers with >=3 tracks: {len(per_producer)}")
    for name, d in sorted(per_producer.items(), key=lambda x: -x[1]["n"]):
        print(f"  {name[:28]:28s} n={d['n']:2d} clap24 {d['clap_on_2_4_median']} pump {d['pump_depth_median']} off {d['kick_off_share_median']} ret8 {d['return_on_8_line'] and round(d['return_on_8_line'],2)}")


if __name__ == "__main__":
    main()
