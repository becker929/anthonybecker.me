#!/usr/bin/env python3
"""Fetch the Creative Commons corpus and record where every file came from.

    python3 corpus/fetch.py corpus/tracks.csv

tracks.csv columns: artist,title,year,page_url,download_url,licence,bpm,source
Every row's download_url is fetched into corpus/audio/<NN>-<slug>.<ext>, then
decoded once with ffmpeg to corpus/wav/<NN>-<slug>.wav (mono, 44.1 kHz) for
analysis. corpus/manifest.json records artist, title, licence, page URL and
the sha256 of the original download, so every measurement on the page can be
traced back to a licensed file. Nothing here is redistributed: the audio
directories are git-ignored; only the manifest and the measurements are kept.
"""
import csv, hashlib, json, os, re, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIO = ROOT / "audio"
WAV = ROOT / "wav"
UA = "sound-function-research/0.1 (+https://anthonybecker.me/research/sound-function/)"


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:48] or "track"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        ctype = r.headers.get("Content-Type", "")
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    return ctype


def main(csv_path):
    AUDIO.mkdir(exist_ok=True)
    WAV.mkdir(exist_ok=True)
    rows = list(csv.DictReader(open(csv_path, newline="", encoding="utf-8")))
    manifest = []
    for i, row in enumerate(rows, 1):
        name = f"{i:02d}-{slug(row['artist'] + '-' + row['title'])}"
        url = row["download_url"].strip()
        if not url:
            print(f"skip {name}: no download url", file=sys.stderr)
            continue
        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".bin"
        raw = AUDIO / (name + ext)
        try:
            if not raw.exists():
                print(f"fetch {name} <- {url}", file=sys.stderr)
                ctype = fetch(url, raw)
                if raw.stat().st_size < 200_000:
                    print(f"  WARNING: {name} is only {raw.stat().st_size} bytes ({ctype}); probably not audio", file=sys.stderr)
            wav = WAV / (name + ".wav")
            if not wav.exists():
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-ac", "1", "-ar", "44100", str(wav)], check=True)
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                                       capture_output=True, text=True).stdout.strip() or 0)
            manifest.append({
                "id": name, "artist": row["artist"], "title": row["title"], "year": row.get("year", ""),
                "page_url": row["page_url"], "download_url": url, "licence": row["licence"],
                "bpm_stated": row.get("bpm", ""), "source": row.get("source", ""),
                "sha256": sha256(raw), "duration_s": round(dur, 2), "wav": str(wav.relative_to(ROOT)),
            })
        except Exception as e:  # one bad link must not stop the corpus
            print(f"  FAILED {name}: {e}", file=sys.stderr)
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{len(manifest)} of {len(rows)} tracks ready; manifest at corpus/manifest.json", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "tracks.csv"))
