#!/usr/bin/env python3
"""The lab runner: fetch pending items from the site, measure them, post reports.

    LAB_TOKEN=... python3 lab/runner.py --base https://anthonybecker.me [--once] [--item ID]

Kinds and what they get:
  track / reference  grid (tempo, lock, bar one, kick on/off, breakdowns), pump on the mix
                     and on the separated bass stem, hits harvested from the drum stem and
                     named by the role model, kick pitch landing, stem levels; every number
                     next to the corpus median (corpus2/summary.json) and, for tracks, next
                     to the median of the owner's own reference items.
  sample             the seven measures plus the full feature set, the role model's answer,
                     and the medians of the synthetic and real libraries for that role.
  multitrack         each stem measured on its own (level, band shares, role of its hits),
                     the kick-like and bass-like stems found, and the true sidechain between
                     them measured with no guessing about the grid.
Reports are plain JSON in the shape private/lab/lab.js renders: headline, rows, sections.
"""
import argparse, json, os, sys, tempfile, time, traceback, urllib.request, urllib.error
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

ROOT = Path(__file__).resolve().parent.parent
CORPUS = json.load(open(ROOT / "corpus2" / "summary.json"))["all"]
LIB = {}


def api(base, token, path, method="GET", data=None, headers=None, raw=False):
    h = {"Authorization": f"Bearer {token}", **(headers or {})}
    body = None
    if data is not None and not raw:
        body = json.dumps(data).encode(); h["Content-Type"] = "application/json"
    elif data is not None:
        body = data
    req = urllib.request.Request(base + "/lab/api" + path, data=body, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=600) as r:
        ct = r.headers.get("Content-Type", "")
        return json.load(r) if "json" in ct else r.read()


def download(base, token, item, f, dest):
    req = urllib.request.Request(f"{base}/lab/api/items/{item['id']}/files/{urllib.request.quote(f['name'])}", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as out:
        while True:
            b = r.read(1 << 20)
            if not b: break
            out.write(b)


def to_wav(src, dst, sr=44100):
    import subprocess
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "1", "-ar", str(sr), "-sample_fmt", "s16", str(dst)], check=True)


def longest_run(kick_on):
    best = cur = 0
    for k in kick_on:
        cur = cur + 1 if k else 0; best = max(best, cur)
    return best


def row(label, value, unit="", ref=None, note=""):
    return dict(label=label, value=None if value is None else (round(float(value), 3) if isinstance(value, (int, float, np.floating)) else value), unit=unit, ref=None if ref is None else round(float(ref), 3), note=note)


def library_medians():
    import csv
    if LIB: return LIB
    for name in ("library_synth", "library_real"):
        rows = list(csv.DictReader(open(ROOT / "out" / f"{name}.csv")))
        by = {}
        for r in rows:
            by.setdefault(r["sound"], []).append(r)
        LIB[name] = {k: {f: float(np.median([float(r[f]) for r in v if r[f] not in ("", "nan")])) for f in ("rise_10_90_ms", "decay40_ms", "sustain_share", "band_sub_share", "spectral_centroid_hz", "crest_factor_db")} for k, v in by.items()}
    return LIB


# ---------- reports ---------------------------------------------------------------

def report_track(paths, item, refs, work):
    from analysis import stems
    mix = paths[0]
    g = stems.grid_of(mix)
    parts = stems.separate(mix, work / "sep")
    bp = stems.bass_pump(parts["bass"], g)
    hits = stems.harvest_hits(parts["drums"])
    roles = stems.role_summary(hits, g["duration_s"])
    kp = stems.kick_pitch(parts["drums"], hits)
    levels = stems.stem_levels(parts)
    sc = stems.sidechain_between(parts["drums"], parts["bass"]); sc.pop("curve_db", None)
    db = g["downbeat"]
    ref = lambda k: (refs or {}).get(k)
    rows = [
        row("tempo", g["tempo"], "bpm", ref("tempo") or CORPUS["tempo_median"], "corpus median in the reference column when you have no references yet"),
        row("grid lock", g["lock"], "", None, "above 0.3 the beat grid is trustworthy"),
        row("bar one found with strength", db["beat_one_strength"], "", None, "1 = chance, 4 = every section change agrees"),
        row("pump on the mix", g["pump_mix"]["pump_depth_db"], "dB", ref("pump_depth_db") or CORPUS["pump_depth_median"]),
        row("pump on the bass stem", bp["pump_depth_db"], "dB", ref("bass_pump_depth_db"), "the rumble alone, folded on the beat"),
        row("pump return time", bp["pump_return_ms"], "ms", ref("pump_return_ms") or CORPUS["pump_return_median"]),
        row("true sidechain, drums to bass", sc.get("pump_depth_db"), "dB", None, f"bass low band folded on {sc.get('n_kicks', 0)} kick onsets from the drum stem"),
        row("bass energy below 60 Hz", bp.get("bass_sub_share"), "share", ref("bass_sub_share")),
        row("kick lands on", kp, "Hz", ref("kick_pitch_hz"), "pitch at about 100 ms into the loudest kicks"),
        row("bars with no kick", g["kick_off_share"], "share", ref("kick_off_share") or CORPUS["kick_off_share_median"]),
        row("longest kick run", longest_run(g["kick_on"]), "bars", None),
    ]
    sec_roles = dict(title="What the drum stem holds", text="Hits cut at onsets from the separated drums and named by the role model. Confidence is the model's own; below 0.5 treat the name as a guess.",
                     table=dict(columns=["job", "hits", "per minute", "confidence", "decay 40 dB (ms)", "sub share", "air share", "brightness (Hz)"],
                                rows=[[j, v["count"], v["per_minute"], v["mean_confidence"], v["decay40_ms"], v["band_sub_share"], v["band_air_share"], round(v["spectral_centroid_hz"])] for j, v in roles.items()]))
    sec_grid = dict(title="Where the attacks land in the bar", text="Six bands by sixteen steps, bar one at the left, averaged over the whole file.", grid=np.roll(np.array(g["profile_attack"]), -4 * db["beat_one"], axis=1).round(4).tolist())
    sec_stems = dict(title="Stem levels", text="Loudness of each separated stem below the loudest, in dB.", rows=[row(s, v, "dB") for s, v in levels.items()])
    offs = [r["length"] if isinstance(r, dict) else r for r in g.get("kick_off_runs", [])]
    sec_struct = dict(title="Structure", rows=[
        row("bars measured", g["n_bars"], "bars"), row("breakdowns (kick off 2+ bars)", len(offs), ""),
        row("longest breakdown", g.get("longest_off_bars", 0), "bars"), row("corpus: share of returns on the 8-bar line", CORPUS["return_on_8_line"], "share")])
    headline = f"{g['tempo']:.0f} bpm, pump {bp['pump_depth_db'] if bp['pump_depth_db'] is not None else '?'} dB on the bass, kick lands near {kp or '?'} Hz"
    report = dict(headline=headline, rows=rows, sections=[sec_roles, sec_grid, sec_stems, sec_struct],
                  raw=dict(tempo=g["tempo"], pump_depth_db=g["pump_mix"]["pump_depth_db"], bass_pump_depth_db=bp["pump_depth_db"], pump_return_ms=bp["pump_return_ms"],
                           bass_sub_share=bp.get("bass_sub_share"), kick_pitch_hz=kp, kick_off_share=g["kick_off_share"], roles=roles, levels=levels, sidechain=sc))
    return report


def report_sample(paths, item, refs, work):
    from analysis.signal_features import describe_file
    from analysis.hits_extra import env_timings
    from analysis import stems
    import soundfile as sf
    f = describe_file(str(paths[0]))
    y, sr = sf.read(str(paths[0])); y = y.mean(axis=1) if y.ndim > 1 else y
    f.update(env_timings(y, sr))
    role, probs = stems.predict(f)
    fine = None
    lib = library_medians()
    real_role = {"kick": "kick", "rumble": "rumble", "hat": "hat_closed", "clap": "clap", "hook": "perc", "space": "impact"}[role]
    rs, rr = lib["library_synth"].get(real_role, {}), lib["library_real"].get(real_role, {})
    rows = [row("reads as", role, "", None, " · ".join(f"{k} {v:.2f}" for k, v in sorted(probs.items(), key=lambda x: -x[1])[:3]))]
    for k, lab, unit in [("rise_10_90_ms", "rise time", "ms"), ("decay40_ms", "time to fall 40 dB", "ms"), ("sustain_share", "energy after 50 ms", "share"),
                         ("band_sub_share", "share below 60 Hz", "share"), ("spectral_centroid_hz", "brightness", "Hz"), ("crest_factor_db", "crest", "dB")]:
        rows.append(row(lab, f.get(k), unit, rr.get(k), f"real {real_role} median; synthetic median {rs.get(k, float('nan')):.3g}"))
    rows += [row("pitch (median f0)", f.get("f0_hz"), "Hz"), row("pitch at 100 ms", f.get("f0_hz_at_100ms"), "Hz"), row("duration to -60 dB", f.get("duration_s"), "s")]
    return dict(headline=f"This reads as a {role} ({probs[role]:.0%})", rows=rows, sections=[dict(title="All measures", table=dict(columns=["measure", "value"], rows=[[k, round(v, 4) if isinstance(v, float) else v] for k, v in sorted(f.items())]))],
                raw=dict(role=role, probs=probs, features=f))


def report_multitrack(paths, item, refs, work):
    from analysis import stems, grid
    import librosa
    per = []
    for p in paths:
        y, _ = librosa.load(str(p), sr=grid.SR, mono=True); dur = len(y) / grid.SR
        if not np.any(y):
            per.append(dict(name=p.name, silent=True)); continue
        env, atk = grid.envelopes(y); tot = env.sum(axis=1) + 1e-12; shares = (tot / tot.sum()).round(3)
        level = float(20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-12))
        sub_attacks = float(atk[0].sum()); air_attacks = float(atk[5].sum())
        hits = stems.harvest_hits(str(p), max_hits=300) if dur > 3 else []
        roles = stems.role_summary(hits, dur)
        top = max(roles, key=lambda k: roles[k]["count"]) if roles else None
        if dur <= 3:
            f = stems.fast_features(librosa.load(str(p), sr=44100, mono=True)[0])
            top = stems.predict(f)[0] if f else None
        per.append(dict(name=p.name, duration_s=round(dur, 1), level_db=round(level, 1), shares=shares.tolist(), sub_attacks=sub_attacks, air_attacks=air_attacks,
                        sustained_low=float(np.median(env[1]) / (np.max(env[1]) + 1e-12)), top_role=top, n_hits=len(hits), roles=roles))
    live = [s for s in per if not s.get("silent")]
    # the kick-like stem: most hits the role model calls kicks, sub attacks as the tie-break
    kick = max(live, key=lambda s: (s["roles"].get("kick", {}).get("count", 0), s["sub_attacks"])) if live else None
    bass = max([s for s in live if s is not kick], key=lambda s: s["shares"][0] + s["shares"][1] + s["sustained_low"], default=None)
    sc = stems.sidechain_between(str([p for p in paths if p.name == kick["name"]][0]), str([p for p in paths if p.name == bass["name"]][0])) if kick and bass else {}
    sc.pop("curve_db", None)
    rows = [row("stems", len(paths), ""), row("kick-like stem", kick["name"] if kick else None), row("bass-like stem", bass["name"] if bass else None),
            row("sidechain depth, kick into bass", sc.get("pump_depth_db"), "dB", CORPUS["pump_depth_median"], "corpus pump median for scale; on real stems this is the true ducking"),
            row("sidechain return", sc.get("pump_return_ms"), "ms", CORPUS["pump_return_median"]), row("kick interval", sc.get("kick_interval_ms"), "ms")]
    table = dict(columns=["stem", "length (s)", "level (dB)", "sub", "low", "mid", "high", "air", "reads as", "hits"],
                 rows=[[s["name"], s.get("duration_s"), s.get("level_db"), *(s["shares"][i] for i in (0, 1, 3, 4, 5)), s.get("top_role"), s.get("n_hits")] if not s.get("silent") else [s["name"], 0, None, None, None, None, None, None, "silent", 0] for s in per])
    return dict(headline=f"{len(paths)} stems; sidechain from {kick['name'] if kick else '?'} into {bass['name'] if bass else '?'} is {sc.get('pump_depth_db', '?')} dB",
                rows=rows, sections=[dict(title="Each stem", text="Band shares are of that stem's own energy. 'Reads as' is the role model's most common answer for hits in the stem, or its answer for the whole file when it is a single hit.", table=table)],
                raw=dict(stems=per, sidechain=sc))


def reference_medians(base, token):
    """Medians of the owner's own reference items' raw numbers, for the reference column."""
    items = api(base, token, "/items?status=done")["items"]
    vals = {}
    for it in items:
        if it["kind"] != "reference": continue
        full = api(base, token, f"/items/{it['id']}")
        raw = (full.get("report") or {}).get("raw") or {}
        for k in ("tempo", "pump_depth_db", "bass_pump_depth_db", "pump_return_ms", "bass_sub_share", "kick_pitch_hz", "kick_off_share"):
            if raw.get(k) is not None: vals.setdefault(k, []).append(raw[k])
    return {k: float(np.median(v)) for k, v in vals.items()}


def run_item(base, token, item):
    api(base, token, f"/items/{item['id']}", "PATCH", {"status": "running", "error": None})
    with tempfile.TemporaryDirectory() as td:
        work = Path(td); paths = []
        (work / "raw").mkdir(); (work / "wav").mkdir()
        for f in item["files"]:
            raw = work / "raw" / f["name"]; download(base, token, item, f, raw)
            wav = work / "wav" / (Path(f["name"]).stem + ".wav")   # mono 44.1k, whatever came in
            to_wav(raw, wav); paths.append(wav)
        refs = reference_medians(base, token) if item["kind"] == "track" else {}
        fn = {"track": report_track, "reference": report_track, "sample": report_sample, "multitrack": report_multitrack}[item["kind"]]
        t0 = time.time(); report = fn(paths, item, refs, work); report["runner"] = dict(seconds=round(time.time() - t0, 1), when=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        api(base, token, f"/items/{item['id']}/results", "PUT", report)
    return report


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--base", default="https://anthonybecker.me"); ap.add_argument("--once", action="store_true")
    ap.add_argument("--item"); ap.add_argument("--poll", type=int, default=120); a = ap.parse_args()
    token = os.environ.get("LAB_TOKEN")
    if not token: sys.exit("LAB_TOKEN is not set")
    while True:
        items = api(a.base, token, "/items?status=pending")["items"]
        if a.item: items = [i for i in items if i["id"] == a.item] or [api(a.base, token, f"/items/{a.item}")]
        for it in items:
            print(f"running {it['id']} ({it['kind']}, {len(it['files'])} files)", file=sys.stderr, flush=True)
            try:
                rep = run_item(a.base, token, it); print(f"  done: {rep['headline']}", file=sys.stderr, flush=True)
            except Exception as e:
                traceback.print_exc()
                try: api(a.base, token, f"/items/{it['id']}", "PATCH", {"status": "failed", "error": f"{type(e).__name__}: {e}"})
                except Exception: pass
        if a.once or a.item: break
        time.sleep(a.poll)


if __name__ == "__main__":
    main()
