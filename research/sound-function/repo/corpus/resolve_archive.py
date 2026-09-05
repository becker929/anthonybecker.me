#!/usr/bin/env python3
"""Turn (archive.org item, track title) pairs into direct file URLs.

    python3 corpus/resolve_archive.py > corpus/tracks.csv

For each wanted track, asks https://archive.org/metadata/<item> for the file
list, picks the best-matching audio file (FLAC or WAV preferred, else MP3),
and re-reads the licence URL the item itself declares, so the CSV carries the
licence as archive.org states it and not as we remembered it.
"""
import csv, difflib, json, re, sys, urllib.request

UA = "sound-function-research/0.1 (+https://anthonybecker.me/research/sound-function/)"

# (item identifier, artist, title, year, source label) -- from the corpus survey
WANTED = [
    ("fressen004-combat-killer-kill-em-all-ep", "Combat Killer", "Global Function", 2018, "Fresscode Records"),
    ("fressen004-combat-killer-kill-em-all-ep", "Combat Killer", "Kalibrator", 2018, "Fresscode Records"),
    ("fressen012-sol-1-free-fall-ep", "Sol 1", "The Truth", 2022, "Fresscode Records"),
    ("fressen017-pakistan-techno-force-bugs-in-space-ep_202407", "Pakistan Techno Force", "Bugs In Space", 2024, "Fresscode Records"),
    ("dfs004-the-d3vi7-temple-ep", "THE D3VI7", "Temple (Hanzzo Remix)", 2020, "Dancefloor Socialism"),
    ("dfs021-various-netlabel-day-2023-techno-warriors", "THE D3VI7", "Technological Crime", 2023, "Dancefloor Socialism"),
    ("dfs033-various-netlabel-day-2025-techno-warriors", "Jerzz", "Aurora Borealis", 2025, "Dancefloor Socialism"),
    ("dfs033-various-netlabel-day-2025-techno-warriors", "AFFLICTED", "Natural Desaster", 2025, "Dancefloor Socialism"),
    ("dfs033-various-netlabel-day-2025-techno-warriors", "Stanley Hottek", "Hardwired", 2025, "Dancefloor Socialism"),
    ("p109-cement-tea-chip-withdrawal", "Cement Tea", "Chip Withdrawal (Bonus Sodium)", 2023, "Psychocandies"),
    ("p156-the-d3vi7-paint-it-acid-vol.-05", "THE D3VI7", "Paint It Acid (VIIII)", 2026, "Psychocandies"),
    ("p156-the-d3vi7-paint-it-acid-vol.-05", "THE D3VI7", "Paint It Acid (X)", 2026, "Psychocandies"),
    ("inquieto-eruption", "Inquieto", "Chaf Flares", 2025, "InquietoMusik"),
    ("inquieto-eruption", "Inquieto", "Eruption", 2025, "InquietoMusik"),
    ("inquieto-eruption", "Inquieto", "Zona de avistamientos", 2025, "InquietoMusik"),
    ("PTR473", "Inquieto", "Jajanken", 2025, "Physical Techno Recordings"),
    ("inquieto-spider-poison", "Inquieto", "Spider Poison", 2024, "Physical Techno Recordings"),
    ("inq005", "Inquieto", "Samurai", 2025, "InquietoMusik"),
    ("inquieto-el-pavo-de-navidad-bonus-cd-track", "Inquieto", "Vacaciones", 2023, "InquietoMusik"),
    ("SinretornoEP", "Inquieto", "Metalic Dog", 2024, "InquietoMusik"),
    ("alwayshorneyep", "Inquieto", "Always Horney (Original Mix)", 2024, "InquietoMusik"),
    ("BVR233", "Inquieto", "Es un hermoso dia", 2024, "BlackVogue Records"),
    ("BVR233", "Industeak", "Hit The Floor", 2024, "BlackVogue Records"),
    ("BVR233", "TKG", "Radical Rebellion", 2024, "BlackVogue Records"),
    ("spp_20241010", "Inquieto", "Solo para profesionales", 2023, "InquietoMusik"),
    ("jamendo-267327", "DJ Andre Darth", "dark hard techno demo", 2019, "Jamendo (archive mirror)"),
]

AUDIO_EXT = {".flac": 0, ".wav": 1, ".mp3": 2, ".ogg": 3, ".m4a": 4}
_cache = {}


def metadata(item):
    if item not in _cache:
        req = urllib.request.Request(f"https://archive.org/metadata/{item}", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            _cache[item] = json.load(r)
    return _cache[item]


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def pick(files, title):
    """Best audio file for a title: match on the normalised name, prefer lossless."""
    cands = []
    for f in files:
        name = f.get("name", "")
        ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in AUDIO_EXT:
            continue
        # archive.org derives mp3s from flac; the original is what we want
        base = norm(re.sub(r"\.[^.]+$", "", name.rsplit("/", 1)[-1]))
        base = re.sub(r"^\d+\s*[-.]?\s*", "", base)          # strip a leading track number
        score = difflib.SequenceMatcher(None, base, norm(title)).ratio()
        if norm(title) in base:
            score = max(score, 0.95)
        cands.append((score, -AUDIO_EXT[ext], f.get("source") == "original", name))
    if not cands:
        return None, 0
    cands.sort(reverse=True)
    return cands[0][3], cands[0][0]


def main():
    w = csv.writer(sys.stdout)
    w.writerow(["artist", "title", "year", "page_url", "download_url", "licence", "bpm", "source", "match_score", "item"])
    for item, artist, title, year, source in WANTED:
        try:
            md = metadata(item)
        except Exception as e:
            print(f"# {item}: metadata failed: {e}", file=sys.stderr)
            continue
        lic = md.get("metadata", {}).get("licenseurl", "") or md.get("metadata", {}).get("rights", "")
        name, score = pick(md.get("files", []), title)
        if not name or score < 0.5:
            print(f"# {item} / {title}: no confident file match (best {score:.2f}: {name})", file=sys.stderr)
            continue
        url = f"https://archive.org/download/{item}/" + urllib.request.quote(name)
        w.writerow([artist, title, year, f"https://archive.org/details/{item}", url, lic, "", source, f"{score:.2f}", item])
        print(f"ok  {artist} - {title}  <- {name}  ({score:.2f})  {lic}", file=sys.stderr)


if __name__ == "__main__":
    main()
