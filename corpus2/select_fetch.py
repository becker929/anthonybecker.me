#!/usr/bin/env python3
"""Stage 4: choose the tracks and fetch them.

    python3 corpus2/select_fetch.py corpus2/tracks.csv [N]

Selection (so the corpus is broad, not one label's back catalogue):
  * drop rows already in the 26-track pilot corpus (same archive item + title)
  * drop obvious non-tracks by title: mix, set, podcast, live, radio, preview, snippet
  * at most 8 tracks per artist, filling round-robin by artist so every
    producer gets in before anyone gets a second slot
  * lossless preferred when the same track is offered twice
Fetch: download the original, decode with ffmpeg to mono 22050 Hz 16-bit
(what analysis/grid.py works at), delete the original, record sha256, licence,
page URL and length in corpus2/manifest.json. Audio is never committed.
"""
import csv, hashlib, json, os, re, subprocess, sys, time, urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WAV = ROOT / "wav"; RAW = ROOT / "_raw"
UA = "sound-function-research/0.2 (+https://anthonybecker.me/research/sound-function/)"
BAD = re.compile(r"\b(mix|set|podcast|live|radio|preview|snippet|teaser|megamix|session|episode|ep\.?\s*\d+)\b", re.I)
PER_ARTIST = 8


def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "x"


def choose(rows, n):
    pilot = {(m["page_url"].rsplit("/", 1)[-1], m["title"].lower()) for m in json.load(open(ROOT.parent / "corpus" / "manifest.json"))}
    by_artist = defaultdict(list); seen = set()
    for r in rows:
        if BAD.search(r["title"]) or BAD.search(r["item"].replace("-", " ")): continue
        if (r["item"], r["title"].lower()) in pilot: continue
        key = (r["artist"].strip().lower(), re.sub(r"\W+", "", r["title"].lower()))
        if key in seen or not r["artist"].strip(): continue
        seen.add(key); by_artist[r["artist"].strip()].append(r)
    for a in by_artist: by_artist[a].sort(key=lambda r: (r["download_url"].lower().endswith(".mp3"), r["title"]))
    out, k = [], 0
    while len(out) < n and k < PER_ARTIST:
        added = False
        for a in sorted(by_artist, key=lambda a: -len(by_artist[a])):
            if len(by_artist[a]) > k and len(out) < n:
                out.append(by_artist[a][k]); added = True
        if not added: break
        k += 1
    return out


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""): h.update(c)
    return h.hexdigest()


def fetch(url, dest, tries=3):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b: break
                    f.write(b)
            return
        except Exception as e:
            if t == tries - 1: raise
            time.sleep(3 * (t + 1))


def main(csv_path, n=300):
    rows = list(csv.DictReader(open(csv_path, encoding="utf-8")))
    chosen = choose(rows, n)
    print(f"{len(rows)} rows -> {len(chosen)} chosen from {len({r['artist'] for r in chosen})} artists", file=sys.stderr)
    WAV.mkdir(exist_ok=True); RAW.mkdir(exist_ok=True)
    mpath = ROOT / "manifest.json"
    manifest = json.load(open(mpath)) if mpath.exists() else []
    done = {m["download_url"] for m in manifest}
    for i, r in enumerate(chosen, 1):
        if r["download_url"] in done: continue
        name = f"{i:03d}-{slug(r['artist'])}-{slug(r['title'])}"
        ext = os.path.splitext(r["download_url"].split("?")[0])[1].lower() or ".bin"
        raw = RAW / (name + ext); wav = WAV / (name + ".wav")
        try:
            print(f"[{i}/{len(chosen)}] {name}", file=sys.stderr, flush=True)
            fetch(r["download_url"], raw)
            if raw.stat().st_size < 300_000: raise RuntimeError(f"only {raw.stat().st_size} bytes")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-ac", "1", "-ar", "22050", "-sample_fmt", "s16", str(wav)], check=True)
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)], capture_output=True, text=True).stdout.strip() or 0)
            manifest.append(dict(id=name, artist=r["artist"], title=r["title"], year=r["year"], label=r["label"], item=r["item"],
                                 page_url=f"https://archive.org/details/{r['item']}", download_url=r["download_url"], licence=r["licence"],
                                 sha256=sha256(raw), duration_s=round(dur, 1), wav=f"wav/{name}.wav"))
            raw.unlink()
            json.dump(manifest, open(mpath, "w"), indent=1)
        except Exception as e:
            print(f"   FAILED {name}: {e}", file=sys.stderr)
            if raw.exists(): raw.unlink()
    print(f"{len(manifest)} tracks ready", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 300)
