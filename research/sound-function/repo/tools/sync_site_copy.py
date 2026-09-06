#!/usr/bin/env python3
"""Copy this project into the site repo at research/sound-function/repo/, without audio
or scratch.   python3 tools/sync_site_copy.py"""
import shutil, os
from pathlib import Path
SRC = Path(__file__).resolve().parent.parent
DST = Path("/home/user/anthonybecker.me/research/sound-function/repo")
SKIP_DIRS = {"__pycache__", ".git", "scratch", "_raw", "wav", "audio", "results", "pump_synth", "sweeps", "loops", "roles", "node_modules"}
SKIP_EXT = {".wav", ".mp3", ".flac", ".npy", ".pyc"}
if DST.exists(): shutil.rmtree(DST)
n = 0
for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
    for f in files:
        p = Path(root) / f
        if p.suffix in SKIP_EXT or f.startswith("."): continue
        rel = p.relative_to(SRC); (DST / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, DST / rel); n += 1
# keep the ignore file so the copy documents what is left out
shutil.copy2(SRC / ".gitignore", DST / ".gitignore")
print(f"copied {n} files to {DST}")
