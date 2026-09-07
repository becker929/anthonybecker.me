import csv, sys, re
INCLUDE = re.compile(r"hard ?techno|industrial techno|industrial|schranz|hard ?groove|raw techno|dark techno|peak ?time|acid techno|rave techno|warehouse|driving techno|hypnotic techno|berlin techno|techno dur|techno hard", re.I)
EXCLUDE = re.compile(r"hardcore|hard ?trance|gabber|frenchcore|uptempo|drum ?and ?bass|dnb|dubstep|house|psytrance|breakcore|ambient|downtempo|hip ?hop|speedcore|terror", re.I)
rows = list(csv.DictReader(open("corpus2/tracks.csv", encoding="utf-8"))); have = {r["download_url"] for r in rows}
cand = [r for r in csv.DictReader(open("corpus2/tracks-2.csv", encoding="utf-8")) if r["download_url"] not in have]
def ok(r):
    s = (r.get("subject") or "") + " " + (r.get("item") or "") + " " + (r.get("label") or "")
    return bool(INCLUDE.search(s)) and not (EXCLUDE.search(s) and not re.search(r"hard ?techno|schranz|industrial techno", s, re.I))
new = [r for r in cand if ok(r)]
print(f"{len(cand)} new rows, {len(new)} pass the genre filter ({len({r['artist'] for r in new})} artists, {len({r['item'] for r in new})} items)", file=sys.stderr)
if "--dry" in sys.argv: sys.exit()
with open("corpus2/tracks.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows + new)
print(f"merged {len(new)} rows -> {len(rows) + len(new)} tracks", file=sys.stderr)
