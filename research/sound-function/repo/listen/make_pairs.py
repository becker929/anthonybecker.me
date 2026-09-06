#!/usr/bin/env python3
"""
Build the "Stage 2: ask producers" listening-test pairs.

Scans out/sweeps (each file named <sound>__<param>__<value>.wav; every
(sound, param) group is one sound with ONE setting changed) and builds a
set of A/B pairs for a listening test:

  - For every (sound, param) group: one pair of the LOWEST vs HIGHEST value.
  - If that leaves us under TARGET_PAIRS, add LOWEST-vs-MIDDLE pairs (the
    interior values of each group, closest-to-the-true-middle first,
    round-robined one-per-group per pass) until we reach TARGET_PAIRS pairs
    or run out of interior values to use.

For every wav actually used in a pair, encodes it to mp3 (ffmpeg, 128k,
mono) into research/sound-function/listen/audio/<same stem>.mp3 in the
sibling anthonybecker.me repo, and writes pairs.json there:

  [{id, sound, param, job, a: {file, value}, b: {file, value}}]

`job` is the six-way role used for the listening test's "which one is
more of a <job>?" question — see SOUND_TO_JOB below.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

SWEEPS_DIR = Path("/home/user/sound-function/out/sweeps")
SITE_LISTEN_DIR = Path("/home/user/anthonybecker.me/research/sound-function/listen")
AUDIO_OUT_DIR = SITE_LISTEN_DIR / "audio"
PAIRS_JSON = SITE_LISTEN_DIR / "pairs.json"

TARGET_PAIRS = 40

# Maps a sweep's <sound> name to one of the six jobs used on the research
# page. "stab"/"perc" are hook-ish (the memorable part) rather than a firm
# fit — see the report for that judgement call.
SOUND_TO_JOB = {
    "kick": "kick",
    "rumble": "rumble",
    "hat": "hat",
    "hat_closed": "hat",
    "hat_open": "hat",
    "clap": "clap",
    "stab": "hook",
    "perc": "hook",
    "pad": "space",
    "riser": "space",
    "impact": "space",
}


def parse_sweeps(sweeps_dir):
    """Group sweep files by (sound, param), sorted by numeric value."""
    groups = {}
    for wav in sorted(sweeps_dir.glob("*.wav")):
        stem = wav.stem
        parts = stem.split("__")
        if len(parts) != 3:
            print(f"skipping unexpected filename: {wav.name}", file=sys.stderr)
            continue
        sound, param, value_str = parts
        try:
            value = float(value_str)
        except ValueError:
            print(f"skipping non-numeric value in: {wav.name}", file=sys.stderr)
            continue
        # Keep whole numbers as ints in the output JSON (e.g. burst count
        # "4" should read as 4, not 4.0); only fractional values stay floats.
        display_value = int(value) if value.is_integer() and "." not in value_str else value
        groups.setdefault((sound, param), []).append((value, value_str, wav, display_value))

    for key in groups:
        groups[key].sort(key=lambda t: t[0])
    return groups


def build_pairs(groups, target_pairs):
    """Return a list of (sound, param, lo_entry, hi_entry) pair specs."""
    group_keys = sorted(groups.keys())
    pairs = []

    # Pass 1: lowest vs highest, one pair per group.
    for key in group_keys:
        values = groups[key]
        lo, hi = values[0], values[-1]
        pairs.append((key[0], key[1], lo, hi))

    # Pass 2: lowest vs middle, round-robined across groups, closest to
    # the true middle first, until we hit the target or run out.
    interior_queues = {}
    for key in group_keys:
        values = groups[key]
        n = len(values)
        mid_idx = n // 2
        interior_indices = list(range(1, n - 1))
        interior_indices.sort(key=lambda i: (abs(i - mid_idx), i))
        interior_queues[key] = [values[i] for i in interior_indices]

    while len(pairs) < target_pairs and any(interior_queues.values()):
        for key in group_keys:
            if len(pairs) >= target_pairs:
                break
            queue = interior_queues[key]
            if not queue:
                continue
            values = groups[key]
            lo = values[0]
            mid = queue.pop(0)
            pairs.append((key[0], key[1], lo, mid))

    return pairs


def job_for(sound):
    job = SOUND_TO_JOB.get(sound)
    if job is None:
        print(f"warning: no job mapping for sound '{sound}', defaulting to 'hook'", file=sys.stderr)
        job = "hook"
    return job


def fmt_value(value_str):
    """Filesystem-safe-ish tag for ids, e.g. '0.3' -> '0p3'."""
    return re.sub(r"[^a-zA-Z0-9]+", "p", value_str).strip("p")


def encode_to_mp3(wav_path, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    mp3_path = out_dir / f"{wav_path.stem}.mp3"
    if mp3_path.exists() and mp3_path.stat().st_mtime >= wav_path.stat().st_mtime:
        return mp3_path
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(wav_path),
            "-b:a", "128k", "-ac", "1",
            str(mp3_path),
        ],
        check=True,
    )
    return mp3_path


def main():
    groups = parse_sweeps(SWEEPS_DIR)
    if not groups:
        print(f"no sweep groups found in {SWEEPS_DIR}", file=sys.stderr)
        sys.exit(1)

    pair_specs = build_pairs(groups, TARGET_PAIRS)

    used_wavs = set()
    for _, _, lo, hi in pair_specs:
        used_wavs.add(lo[2])
        used_wavs.add(hi[2])

    for wav_path in sorted(used_wavs):
        encode_to_mp3(wav_path, AUDIO_OUT_DIR)

    records = []
    for i, (sound, param, lo, hi) in enumerate(pair_specs, start=1):
        lo_val, lo_str, lo_wav, lo_display = lo
        hi_val, hi_str, hi_wav, hi_display = hi
        pair_id = f"{i:03d}_{sound}_{param}_{fmt_value(lo_str)}v{fmt_value(hi_str)}"
        records.append({
            "id": pair_id,
            "sound": sound,
            "param": param,
            "job": job_for(sound),
            "a": {"file": f"audio/{lo_wav.stem}.mp3", "value": lo_display},
            "b": {"file": f"audio/{hi_wav.stem}.mp3", "value": hi_display},
        })

    SITE_LISTEN_DIR.mkdir(parents=True, exist_ok=True)
    PAIRS_JSON.write_text(json.dumps(records, indent=2) + "\n")

    # Report: coverage per (sound, param) group.
    coverage = {}
    for r in records:
        key = (r["sound"], r["param"])
        coverage.setdefault(key, 0)
        coverage[key] += 1

    print(f"Wrote {len(records)} pairs to {PAIRS_JSON}")
    print(f"Encoded {len(used_wavs)} mp3s to {AUDIO_OUT_DIR}")
    print(f"Covered {len(coverage)} (sound, param) groups:")
    for key in sorted(coverage):
        print(f"  {key[0]:<8} {key[1]:<16} {coverage[key]} pair(s) (group has {len(groups[key])} values)")


if __name__ == "__main__":
    main()
