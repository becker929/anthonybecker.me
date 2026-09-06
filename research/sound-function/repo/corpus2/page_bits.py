#!/usr/bin/env python3
"""Emit the HTML bits of part two that come from data: the track credits rows
and the 'what ten times meant' rows.   python3 corpus2/page_bits.py > /tmp/bits.json"""
import json, html
from pathlib import Path
ROOT = Path(__file__).resolve().parent
S = json.load(open(ROOT / "summary.json")); M = {m["id"]: m for m in json.load(open(ROOT / "manifest.json"))}
keep = [M[t["id"]] for t in S["tracks"]]
LIC = {"by-nc-nd/4.0": "CC BY-NC-ND 4.0", "by-nc-nd/3.0": "CC BY-NC-ND 3.0", "by-nd/4.0": "CC BY-ND 4.0", "by-nc-sa/4.0": "CC BY-NC-SA 4.0",
       "by-nc-sa/3.0": "CC BY-NC-SA 3.0", "by-sa/4.0": "CC BY-SA 4.0", "by/4.0": "CC BY 4.0", "by/3.0": "CC BY 3.0", "by-nc/4.0": "CC BY-NC 4.0",
       "zero/1.0": "CC0 1.0", "mark/1.0": "Public Domain Mark 1.0"}
def lic(u):
    for k, v in LIC.items():
        if k in u: return v
    return u
rows = []
for m in sorted(keep, key=lambda m: (m["artist"].lower(), m["title"].lower())):
    rows.append(f'        <tr><td>{html.escape(m["artist"])}</td><td><a href="{html.escape(m["page_url"])}">{html.escape(m["title"])}</a></td>'
                f'<td class="num">{html.escape(str(m.get("year") or ""))}</td><td>{html.escape(str(m.get("label") or ""))}</td><td>{lic(m["licence"])}</td></tr>')
A = S["all"]
tenx = [("real tracks measured", "26", "250+", str(A["n"])), ("producers in the corpus", "12", "60+", str(A["producers"])),
        ("single sounds measured", "10 (synthetic)", "300 labelled, some real", "718 labelled, 318 real"),
        ("listener judgements", "0", "800", "0 (the test is live)"), ("the pump measured", "no", "yes", "yes"), ("bar one known", "no", "yes", "yes")]
trow = "\n".join(f'        <tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in tenx)
json.dump({"tracks": "\n".join(rows), "tenx": trow, "n": len(rows)}, open("/tmp/claude-0/-home-user-hammerspoon-config/2850f728-0b5d-5105-9a5b-41403cdc3ac7/scratchpad/bits.json", "w"))
print(len(rows), "track rows")
