#!/usr/bin/env python3
"""Round two: the next N licensed tracks, in batches that fit the disk.

    python3 corpus2/round2.py [--n 300] [--batch 50]

For each batch: fetch and decode to corpus2/wav (mono 22050), run the grid/pump/downbeat
pipeline on them (corpus2/analyse_all.py, which skips what is done), separate a 64-second
excerpt into stems (as corpus2/separate_excerpts.py does), then delete the batch's wavs.
Selection: rows of corpus2/tracks.csv not yet in the manifest, same title/name filters as
round one, at most 12 tracks per artist counting round one, round-robin by artist.
"""
import argparse, csv, json, re, subprocess, sys, shutil, os
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from select_fetch import BAD, slug, sha256, fetch, ROOT, WAV, RAW
STEMS_OUT = ROOT / "stems"; TMP = ROOT / "_sep"; EXCERPT_S = 64; SEP_BATCH = 12
PER_ARTIST = 12


def choose(rows, manifest, n):
    have = {m["download_url"] for m in manifest}
    per = defaultdict(int)
    for m in manifest: per[m["artist"].strip()] += 1
    pilot = {(m["page_url"].rsplit("/", 1)[-1], m["title"].lower()) for m in json.load(open(ROOT.parent / "corpus" / "manifest.json"))}
    by_artist = defaultdict(list); seen = set()
    for r in rows:
        if r["download_url"] in have: continue
        if BAD.search(r["title"]) or BAD.search(r["item"].replace("-", " ")): continue
        if (r["item"], r["title"].lower()) in pilot: continue
        a = r["artist"].strip(); key = (a.lower(), re.sub(r"\W+", "", r["title"].lower()))
        if key in seen or not a: continue
        seen.add(key); by_artist[a].append(r)
    for a in by_artist: by_artist[a].sort(key=lambda r: (r["download_url"].lower().endswith(".mp3"), r["title"]))
    out = []; k = 0
    while len(out) < n and k < PER_ARTIST:
        added = False
        for a in sorted(by_artist, key=lambda a: -len(by_artist[a])):
            if per[a] + 1 <= PER_ARTIST and len(by_artist[a]) > k and len(out) < n:
                out.append(by_artist[a][k]); per[a] += 1; added = True
        if not added: break
        k += 1
    return out


def separate(ids, manifest_by_id):
    todo = [t for t in ids if not (STEMS_OUT / t / "bass.wav").exists() and (ROOT / manifest_by_id[t]["wav"]).exists()]
    for i in range(0, len(todo), SEP_BATCH):
        batch = todo[i:i + SEP_BATCH]; TMP.mkdir(exist_ok=True); cuts = []
        for tid in batch:
            m = manifest_by_id[tid]; start = max(0.0, m["duration_s"] * 0.35); cut = TMP / f"{tid}.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", str(EXCERPT_S), "-i", str(ROOT / m["wav"]), "-ar", "44100", str(cut)], check=True); cuts.append(cut)
        subprocess.run([sys.executable, "-m", "demucs", "-n", "htdemucs", "-d", "cpu", "--shifts", "0", "-o", str(TMP)] + [str(c) for c in cuts], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for tid in batch:
            src = TMP / "htdemucs" / tid; dst = STEMS_OUT / tid; dst.mkdir(parents=True, exist_ok=True)
            for s in ("drums", "bass", "other", "vocals"):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src / f"{s}.wav"), "-ac", "1", "-ar", "22050", "-sample_fmt", "s16", str(dst / f"{s}.wav")], check=True)
        shutil.rmtree(TMP)
        print(f"   separated {min(i + SEP_BATCH, len(todo))}/{len(todo)}", file=sys.stderr, flush=True)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--n", type=int, default=300); ap.add_argument("--batch", type=int, default=50); a = ap.parse_args()
    rows = list(csv.DictReader(open(ROOT / "tracks.csv", encoding="utf-8")))
    mpath = ROOT / "manifest.json"; manifest = json.load(open(mpath))
    chosen = choose(rows, manifest, a.n); start_no = len(manifest) + 1
    print(f"round two: {len(chosen)} tracks chosen from {len({r['artist'] for r in chosen})} artists (manifest has {len(manifest)})", file=sys.stderr, flush=True)
    WAV.mkdir(exist_ok=True); RAW.mkdir(exist_ok=True)
    for b in range(0, len(chosen), a.batch):
        batch = chosen[b:b + a.batch]; ids = []
        for j, r in enumerate(batch):
            i = start_no + b + j; name = f"{i:03d}-{slug(r['artist'])}-{slug(r['title'])}"
            ext = os.path.splitext(r["download_url"].split("?")[0])[1].lower() or ".bin"; raw = RAW / (name + ext); wav = WAV / (name + ".wav")
            try:
                fetch(r["download_url"], raw)
                if raw.stat().st_size < 300_000: raise RuntimeError(f"only {raw.stat().st_size} bytes")
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-ac", "1", "-ar", "22050", "-sample_fmt", "s16", str(wav)], check=True)
                dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)], capture_output=True, text=True).stdout.strip() or 0)
                manifest.append(dict(id=name, artist=r["artist"], title=r["title"], year=r["year"], label=r["label"], item=r["item"], page_url=f"https://archive.org/details/{r['item']}",
                                     download_url=r["download_url"], licence=r["licence"], sha256=sha256(raw), duration_s=round(dur, 1), wav=f"wav/{name}.wav", round=2))
                ids.append(name); raw.unlink(); json.dump(manifest, open(mpath, "w"), indent=1)
            except Exception as e:
                print(f"   FAILED {name}: {e}", file=sys.stderr, flush=True)
                if raw.exists(): raw.unlink()
        print(f"batch {b // a.batch + 1}: {len(ids)} fetched; analysing", file=sys.stderr, flush=True)
        subprocess.run([sys.executable, str(ROOT / "analyse_all.py")], stdout=subprocess.DEVNULL, stderr=open(ROOT.parent / "scratch" / "round2_analyse.log", "a"))
        print(f"   analysed; separating", file=sys.stderr, flush=True)
        separate(ids, {m["id"]: m for m in manifest})
        for t in ids:
            p = WAV / f"{t}.wav"
            if p.exists(): p.unlink()
        print(f"batch {b // a.batch + 1} done ({len(manifest)} in manifest)", file=sys.stderr, flush=True)
    print("round two finished", file=sys.stderr)


if __name__ == "__main__":
    main()
