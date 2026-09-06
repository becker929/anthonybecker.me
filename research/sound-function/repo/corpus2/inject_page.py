#!/usr/bin/env python3
"""Put the generated rows (from page_bits.py) into part two.  python3 corpus2/inject_page.py"""
import json, re
P = "/home/user/anthonybecker.me/research/sound-function/part-two/index.html"
bits = json.load(open("/tmp/claude-0/-home-user-hammerspoon-config/2850f728-0b5d-5105-9a5b-41403cdc3ac7/scratchpad/bits.json"))
s = open(P).read()
# replace either the marker or a previous injection (kept between the markers)
for key, tag in (("tenx", "TENX"), ("tracks", "TRACKS")):
    new = f"        <!-- {tag} -->\n{bits[key]}\n        <!-- /{tag} -->"
    if f"<!-- /{tag} -->" in s:
        s = re.sub(rf"        <!-- {tag} -->.*?<!-- /{tag} -->", lambda m: new, s, flags=re.S)
    else:
        s = s.replace(f"        <!-- {tag} -->", new)
open(P, "w").write(s)
print("injected", bits["n"], "track rows")
