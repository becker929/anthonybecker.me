"""Speaks every narration line of a film once, with the Kokoro voice in zpkt's voice package.

    ~/Desktop/zpkt/contrib/voice/.venv/bin/python narrate.py <work> <style>

Reads <work>/subject.json, writes <work>/vox/<style>-NN.wav (24 kHz mono) and <work>/vox/<style>.json
with each line's text and length, which direct.mjs times the edit to. The model loads once.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from voice import engines

work, style = Path(sys.argv[1]), sys.argv[2]
subject = json.loads((work / "subject.json").read_text())
lines = subject.get("narration", {}).get(style, [])
out = work / "vox"
out.mkdir(exist_ok=True)
tts = engines.load("tts", "kokoro")
speed = {"calm": 0.94, "short": 1.08}.get(style, 1.0)
voice = subject.get("voice", "af_heart")
made = []
for i, line in enumerate(lines):
    parts, rate = [], 24_000
    for pcm, rate in tts.stream(line, voice, speed):
        parts.append(pcm)
    audio = np.concatenate(parts) if parts else np.zeros(0, np.int16)
    path = out / f"{style}-{i:02d}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(audio.astype("<i2").tobytes())
    made.append({"text": line, "file": path.name, "seconds": round(len(audio) / rate, 3)})
(out / f"{style}.json").write_text(json.dumps(made, indent=1))
print(f"{style}: {len(made)} lines, {sum(m['seconds'] for m in made):.1f} s", file=sys.stderr)
