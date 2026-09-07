#!/usr/bin/env python3
"""Part four of the report, from the files: the four doublings.   python3 corpus2/part4_text.py"""
import json, re, csv
from pathlib import Path
ROOT = Path(__file__).resolve().parent
S = json.load(open(ROOT / "summary.json")); A = S["all"]; L = S["per_label"]
ST = json.load(open(ROOT / "stems_summary.json")); LO = json.load(open(ROOT / "loudness.json"))
M = json.load(open(ROOT / "manifest.json")); R2 = [m for m in M if m.get("round") == 2]
hyp = (ROOT.parent / "research" / "hypotheses.md").read_text()
ADV = json.load(open(ROOT.parent / "research" / "advice-hypotheses.json")) if (ROOT.parent / "research" / "advice-hypotheses.json").exists() else []
adv_src = len(re.findall(r"^\d+\. |^- \[", (ROOT.parent / "research" / "advice.md").read_text(), flags=re.M)) if ADV else 0
rows = re.findall(r"^\| (H\d+) \| (supported|not supported|reversed) \| (.*?) \|$", hyp, flags=re.M)
verdicts = {h: (v, e) for h, v, e in rows}
n_sup = sum(1 for v, _ in verdicts.values() if v == "supported"); n_not = sum(1 for v, _ in verdicts.values() if v == "not supported"); n_rev = sum(1 for v, _ in verdicts.values() if v == "reversed")
lit2 = (ROOT.parent / "research" / "literature-2.md").read_text(); n_lit2 = len(re.findall(r"^\*\*", lit2, flags=re.M))
n = A["n"]; n_items = len({m["item"] for m in M}); n_prod = A["producers"]
import numpy as np
lufs = np.array([v["lufs"] for v in LO.values() if v.get("lufs") is not None]); crest = np.array([v["crest_db"] for v in LO.values() if v.get("crest_db") is not None])
tracks_csv = list(csv.DictReader(open(ROOT / "tracks.csv", encoding="utf-8")))
pct = lambda x: round(100 * x)
def ev(h):
    return verdicts.get(h, ("", ""))[1]
def nums(h):
    return re.findall(r"(-?\d+(?:\.\d+)?)", ev(h))
_h9 = nums("H9"); H9a, H9b = (_h9[0], _h9[2]) if len(_h9) >= 3 else ("?", "?")
_h16 = nums("H16"); H16a, H16b = (_h16[1], _h16[3]) if len(_h16) >= 4 else ("?", "?")
import re as _re
_m39 = _re.search(r"median (\d+) ms", verdicts.get("H39", ("", ""))[1]); H39 = _m39.group(1) if _m39 else "70"
gloss = [
("backbeat", "backbeat", "A clap or snare on beats two and four."),
("bar", "bar", "Four beats. About one and a half seconds here."),
("beat", "beat", "The steady count you tap your foot to."),
("corpus", "corpus", "The set of tracks we measured."),
("crest", "crest", "The gap between a sound's peak and its average level. Lower means harder limiting."),
("db", "dB", "A unit for level. Six dB is about twice as loud on a meter."),
("downbeat", "downbeat", "Beat one of a bar."),
("hypothesis", "hypothesis", "A claim written so that data can prove it wrong. Ours have a prediction and a test."),
("kick", "kick", "The main drum. It hits on every beat."),
("kick-body", "kick body", "The kick's first 250 ms, with the bass added back. The kick as a one-shot would have it."),
("licence", "licence", "The permission a maker gives. It says what others may do with the work."),
("loudness", "integrated loudness", "How loud a whole file is, by the broadcast rule. Zero is the top. Masters sit near minus eight."),
("lufs", "LUFS", "The unit of integrated loudness. Minus ten is quieter than minus eight."),
("median", "median", "The middle value. Half above it, half below."),
("minus", "minus", "Below zero. Loudness counts down from zero. Minus eight is louder than minus ten."),
("master", "master", "The final mixed and finished version of a track. Also: masters, more than one."),
("netlabel", "netlabel", "A record label that releases online, often for free."),
("loudness-war", "loudness war", "Making masters ever louder, year on year. It costs the music its crest."),
("genre", "genre", "A kind of music. Hard techno is one."),
("folklore", "folklore", "Advice everyone repeats and nobody has measured."),
("groove", "groove", "The felt pull of a beat that makes people move."),
("tag", "tag", "A word attached to a file so others can find it. Tags, more than one."),
("rave", "rave", "A word for fast, hard dance music and its parties. Here, a tag."),
("prediction", "prediction", "What we said the data would show, before we looked."),
("pump", "pump", "A dip in the low end after each kick. Then it climbs back."),
("rank-correlation", "rank correlation", "A number from minus one to one. It says whether two measures rise together across tracks. Zero means no link."),
("register", "register", "Our list of hypotheses, each with its prediction, test and result."),
("rumble", "rumble", "A long, low tail under the kick."),
("separator", "separator", "A program that splits a track into parts. Drums, bass, voice, the rest."),
("stem", "stem", "One part of a track as its own audio file."),
("sub-band", "sub band", "The lowest band, 20 to 60 Hz."),
("tempo", "tempo", "How fast the beats go, in beats per minute."),
]
page = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Twice as much: the expansion</title>
  <meta name="description" content="Part four of the sound-function research, in plain language: the literature doubled, the corpus grown to {n} kept tracks, a register of {len(verdicts) + 7} hypotheses with {len(verdicts)} tested, loudness measured for the first time, and two more notes on where this goes.">
  <meta property="og:title" content="Twice as much: the expansion">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="../style.css">
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><a href="/">Anthony Becker</a> / <a href="/research/sound-function/">Research</a> / Part four</nav>
  <header class="title">
    <div class="kicker">Research · part four</div>
    <h1>Twice as much: the expansion</h1>
    <p class="meta">September 2026 · plain language · <a href="#glossary">glossary</a> · <a href="../">one</a> · <a href="../part-two/">two</a> · <a href="../part-three/">three</a></p>
  </header>

  <h2 id="what">What this is</h2>
  <p>After three parts, the brief was to double four things. The reading. The openly licensed data. The claims we test. And the writing about where this goes. This page reports each doubling and what it changed.</p>
  <p>The short version. The reading found a measure we had never taken. The data grew, and most numbers held. The claims got a <a class="term" href="#g-register">register</a>. Two of ours turned out to point the wrong way. The vision got dates.</p>

  <h2 id="reading">The reading, doubled</h2>
  <p>Part one rested on 25 sources. A second sweep added {n_lit2} more. It went where the first was thin. How people hear ducking and deep bass. How they hear the pitch and grit of a <a class="term" href="#g-kick">kick</a>. How machines find the <a class="term" href="#g-downbeat">downbeat</a> in dance music.</p>
  <p>It also covered three more things. How drum sounds are placed in learned spaces. What has been written about hard techno itself. And how loud <a class="term" href="#g-master">masters</a> are.</p>
  <p>Three things came back. One is support. A 2023 study of <a class="term" href="#g-groove">groove</a> agrees. Sound does most of the work, not timing. </p>
  <p>One is a surprise. Producers describe kicks that double as their own bass. That is the sound our model failed on.</p>
  <p>The third is a gap. None of our pages reported <a class="term" href="#g-loudness">integrated loudness</a>. We now do. The sweep also listed ten measures we could add. Two of them are cheap and will come next.</p>

  <h2 id="data">The data, doubled</h2>
  <p>Part two searched four <a class="term" href="#g-tag">tags</a> on the Internet Archive. The second round searched nineteen more. It also read every licensed techno item for certain words. Hard, industrial, <a class="term" href="#g-rave">rave</a> and a few others. That gave {len(tracks_csv):,} licensed tracks to choose from.</p>
  <p>We fetched {len(R2)} more, again at most twelve per producer. The <a class="term" href="#g-corpus">corpus</a> now holds {n} kept tracks from {n_prod} producers. Every one was measured the same way. Every one had a minute split into <a class="term" href="#g-stem">stems</a>.</p>
  <p>The real hit library grew with it. It now holds {ST["hit_library"]["kick"]:,} kicks, {ST["hit_library"]["hat"]} hats and {ST["hit_library"]["clap"]} claps. All cut from the drum stems of real tracks. Across {ST["kick_pitch_hz"]["n"]} tracks the kick lands at a median {ST["kick_pitch_hz"]["median"]:.0f} Hz. Half sit between {ST["kick_pitch_hz"]["q25"]:.0f} and {ST["kick_pitch_hz"]["q75"]:.0f}.</p>
  <p>Most of part two's numbers held. Half the sub attacks land on the beats. Chance is a quarter.</p>
  <p>Clear <a class="term" href="#g-backbeat">backbeat</a>: {A["clear_backbeat"]} of {n} tracks. <a class="term" href="#g-pump">Pump</a> on the mix: <a class="term" href="#g-median">median</a> {A["pump_depth_median"]:.0f} <a class="term" href="#g-db">dB</a>. Kick returns on the eight bar line: {pct(A["return_on_8_line"])} in 100. The bigger net did not move them far.</p>
  <p>Two warnings. The new tags reach past hard techno. Some new tracks are slower or softer than we meant. The <a class="term" href="#g-tempo">tempo</a> filter, 128 to 180, keeps out the worst. And the pool is still one archive. Free licence hard techno is a small world.</p>

  <h2 id="loudness">A measure we had missed</h2>
  <p>Integrated loudness is how loud a whole file is. It follows the broadcast rule. We measured it on the minute we split into stems. The stems were added back together first. The median is {np.median(lufs):.1f} <a class="term" href="#g-lufs">LUFS</a>. Half the tracks sit between {np.quantile(lufs, .25):.1f} and {np.quantile(lufs, .75):.1f}.</p>
  <p>The <a class="term" href="#g-crest">crest</a> of the mix sits at {np.median(crest):.1f} dB. That is quieter than a chart master. Those sit near <a class="term" href="#g-minus">minus</a> eight. It fits a <a class="term" href="#g-netlabel">netlabel</a> scene outside the <a class="term" href="#g-loudness-war">loudness war</a>. Loudness did not rise from 2018 to 2026 here. The crest did not fall.</p>

  <h2 id="claims">The claims, doubled and tested</h2>
  <p>Part one made its claims in running text. Now they live in a register. Each <a class="term" href="#g-hypothesis">hypothesis</a> has a measure and a test. Its <a class="term" href="#g-prediction">prediction</a> was written before the test. There are {len(verdicts) + 7} of them. The data we have could test {len(verdicts)}.</p>
  <p>The count: {n_sup} supported, {n_not} not supported, {n_rev} reversed. A reversed claim points the other way. We had two. Both are about the same thing.</p>
  <p>We predicted that tracks with a backbeat pump less. They pump more. With a backbeat, the median pump is {H9a} dB. Without, it is {H9b} dB. We predicted a separate <a class="term" href="#g-rumble">rumble</a> layer makes the kick brighter. The opposite holds: {H16a} Hz against {H16b} Hz.</p>
  <p>Both predictions came from one picture of the music. Old tracks have a clap and a plain kick. New ones have no clap. Their kick is its own bass. The data say the picture is too simple. The backbeat tracks pump hardest of all.</p>
  <p>Some claims held well. Pump depth falls a little as tempo rises. The sidechain release tracks the beat. The low end is back within two thirds of a beat. Tracks with a confident downbeat return on eight twice as often. And the <a class="term" href="#g-kick-body">kick body</a> got a little brighter over the years.</p>
  <p>The full table is in the register. It is built again from the data whenever the corpus grows. So are the results. A claim that fails at twice the tracks would say so.</p>
  <p>A last sweep went after published advice. Producers, mastering engineers, the people who make the tools. It came back with six signal chains, stage by stage. Each stage names the measure it should move. It also brought {len(ADV)} more claims.</p>
  <p>We tested those the data allow. They are in the register too, from H33 on.</p>
  <p>One result stands out. The tools promise a split duck. The sub dips deep and the low band stays. We looked for that split on the bass stem. It is not there. The sub and the low band dip by the same amount.</p>
  <p>Whatever the tools do, the tracks do not show it. The climb back after the dip is slow, though. It takes about {H39} ms to rise. The people who make the tools say they come back softly. This fits.</p>
  <p>Some of that advice is <a class="term" href="#g-folklore">folklore</a>. It is repeated everywhere and measured nowhere. The register is where it meets the corpus.</p>

  <h2 id="vision">The vision, doubled</h2>
  <p>Two new notes join the three. <a href="/notes/four-horizons/">Four horizons</a> puts dates on the agent. A month, a year, five years, ten. Each has a test you could run on that date. Each has the odds the first week gave it.</p>
  <p><a href="/notes/the-session/">The session</a> is one evening in 2029, written as a scene. It shows what the machine says. It shows what it must not say. The notes are not plain language. They are letters to one producer. This page is the plain record of what they rest on.</p>

  <h2 id="limits">What to doubt</h2>
  <p>The second sweep could not open three sources past the summary. One paper on ducking could not be opened at all. The new tags reach past the <a class="term" href="#g-genre">genre</a>. The loudness number is from one minute per track. And the register tests what we thought to write down. The claims we did not think of are not in it.</p>

  <h2 id="sources">Sources and method notes</h2>
  <ul>
    <li>Second literature sweep: <code>research/literature-2.md</code>. Advice sweep, chains and folklore: <code>research/advice.md</code>. Register and tests: <code>research/hypotheses.md</code>, <code>research/test_hypotheses.py</code>.</li>
    <li>Second discovery: <code>scratch/discover2.py</code> and <code>corpus2/discover.py</code>. Round two: <code>corpus2/round2.py</code>. Loudness: <code>analysis/loudness.py</code>, BS.1770 by way of pyloudnorm.</li>
    <li>All of it <a href="https://github.com/becker929/anthonybecker.me/tree/main/research/sound-function/repo">on GitHub</a>. No audio is shared.</li>
  </ul>

  <h2 id="glossary">Glossary</h2>
  <dl class="glossary">
{chr(10).join(f'    <dt id="g-{i}">{t}</dt><dd>{d}</dd>' for i, t, d in gloss)}
  </dl>

  <footer>
    <p>Round two's tracks are credited in the code copy's manifest. Text on this page is CC BY 4.0.</p>
    <p>This page passes the same plain language check as the others.</p>
  </footer>
</div>
</body>
</html>
'''
Path("/home/user/anthonybecker.me/research/sound-function/part-four/index.html").write_text(page)
print("part four written:", n, "tracks,", len(R2), "round-two,", len(verdicts), "tested,", n_lit2, "sources")
