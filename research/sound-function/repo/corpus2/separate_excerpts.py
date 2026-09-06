#!/usr/bin/env python3
"""Separate a 64-second excerpt of every kept corpus track into stems with Demucs.

    python3 corpus2/separate_excerpts.py            -> corpus2/stems/<id>/{drums,bass,other,vocals}.wav (mono 22050)

The excerpt starts 35% of the way in, which in this music is almost always the
main groove. Demucs (htdemucs, MIT licence) runs on CPU in batches so the model
loads once per batch; its 44.1 kHz stereo output is folded to mono 22050 Hz to
keep the disk small. Already-done tracks are skipped, so the script can resume.
"""
import json, subprocess, sys, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "stems"; TMP = ROOT / "_sep"
EXCERPT_S = 64; BATCH = 12
STEMS = ["drums", "bass", "other", "vocals"]

def main():
    S = json.load(open(ROOT / "summary.json")); M = {m["id"]: m for m in json.load(open(ROOT / "manifest.json"))}
    todo = [t["id"] for t in S["tracks"] if not (OUT / t["id"] / "bass.wav").exists()]
    print(f"{len(todo)} tracks to separate", file=sys.stderr, flush=True)
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        TMP.mkdir(exist_ok=True)
        cuts = []
        for tid in batch:
            m = M[tid]; start = max(0.0, m["duration_s"] * 0.35)
            cut = TMP / f"{tid}.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", str(EXCERPT_S), "-i", str(ROOT / m["wav"]), "-ar", "44100", str(cut)], check=True)
            cuts.append(cut)
        subprocess.run([sys.executable, "-m", "demucs", "-n", "htdemucs", "-d", "cpu", "-o", str(TMP)] + [str(c) for c in cuts], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for tid in batch:
            src = TMP / "htdemucs" / tid; dst = OUT / tid; dst.mkdir(parents=True, exist_ok=True)
            for s in STEMS:
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src / f"{s}.wav"), "-ac", "1", "-ar", "22050", "-sample_fmt", "s16", str(dst / f"{s}.wav")], check=True)
        shutil.rmtree(TMP)
        print(f"{min(i + BATCH, len(todo))}/{len(todo)} done", file=sys.stderr, flush=True)

if __name__ == "__main__":
    main()
