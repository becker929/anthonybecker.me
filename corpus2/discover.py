#!/usr/bin/env python3
"""Stage 4 corpus discovery: every licensed hard-techno track on archive.org.

    python3 corpus2/discover.py scratch/ia_candidates.json > corpus2/tracks.csv

For each candidate item (from an advancedsearch over the hard techno,
hardtechno, industrial techno and schranz subjects, 2018+), fetch the item
metadata, keep it only if the item itself declares a Creative Commons or
public-domain licence, and list its audio files with the length archive.org
records. Podcasts and DJ mixes are dropped by length (over 12 minutes) and by
collection. One row per track: item, artist, title, year, label, licence,
download URL, length. Nothing is downloaded here.
"""
import csv, json, re, sys, time, urllib.request

UA = "sound-function-research/0.2 (+https://anthonybecker.me/research/sound-function/)"
AUDIO = {".flac": 0, ".wav": 1, ".mp3": 2, ".ogg": 3, ".m4a": 4}
MIX_COLLECTIONS = {"podcasts", "podcasts_mirror", "podcasts_mirror_bobarchives", "podcasts_miscellaneous"}
MIN_S, MAX_S = 150, 12 * 60


def metadata(item, tries=3):
    for t in range(tries):
        try:
            req = urllib.request.Request(f"https://archive.org/metadata/{item}", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if t == tries - 1:
                print(f"# {item}: {e}", file=sys.stderr)
                return None
            time.sleep(2 * (t + 1))


def length_s(f):
    v = f.get("length")
    if not v: return None
    v = str(v)
    if ":" in v:
        parts = [float(p) for p in v.split(":")]
        return sum(p * 60 ** i for i, p in enumerate(reversed(parts)))
    try: return float(v)
    except ValueError: return None


def main(cand_path):
    cands = json.load(open(cand_path))
    w = csv.writer(sys.stdout)
    w.writerow(["item", "artist", "title", "year", "label", "licence", "download_url", "length_s", "collection", "subject"])
    kept_items = kept_tracks = 0
    for i, c in enumerate(cands):
        cols = c.get("collection") or []
        cols = cols if isinstance(cols, list) else [cols]
        if MIX_COLLECTIONS & set(cols):
            continue
        item = c["identifier"]
        md = metadata(item)
        if not md: continue
        m = md.get("metadata", {})
        lic = m.get("licenseurl") or ""
        if not re.search(r"creativecommons\.org", lic):
            continue
        year = str(m.get("date") or m.get("year") or c.get("date") or "")[:4]
        label = m.get("publisher") or (cols[0] if cols else "")
        creator = m.get("creator") or c.get("creator") or ""
        creator = creator if isinstance(creator, str) else " / ".join(creator)
        subj = m.get("subject") or ""
        subj = subj if isinstance(subj, str) else "; ".join(subj)
        # originals only; archive derives mp3 from flac and we want one file per track
        files = [f for f in md.get("files", []) if f.get("source") == "original"]
        best = {}
        for f in files:
            name = f.get("name", "")
            ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
            if ext not in AUDIO: continue
            key = re.sub(r"\.[^.]+$", "", name).lower()
            if key not in best or AUDIO[ext] < AUDIO[best[key][1]]:
                best[key] = (f, ext)
        n = 0
        for key, (f, ext) in sorted(best.items()):
            L = length_s(f)
            if L is None or L < MIN_S or L > MAX_S: continue
            title = f.get("title") or re.sub(r"^\d+[\s._-]*", "", key.rsplit("/", 1)[-1])
            artist = f.get("artist") or f.get("creator") or creator
            url = f"https://archive.org/download/{item}/" + urllib.request.quote(f["name"])
            w.writerow([item, artist, title, year, label, lic, url, round(L, 1), cols[0] if cols else "", subj[:120]])
            n += 1
        if n:
            kept_items += 1; kept_tracks += n
        print(f"{i+1}/{len(cands)} {item[:50]:50s} {n:3d} tracks  ({kept_tracks} total)", file=sys.stderr, flush=True)
    print(f"# {kept_items} licensed items, {kept_tracks} tracks", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
