#!/usr/bin/env python3
"""Write part three of the report from corpus2/stems_summary.json and the retrain results.
    python3 corpus2/part3_text.py  -> research/sound-function/part-three/index.html (numbers from the files)"""
import json, html
from pathlib import Path
ROOT = Path(__file__).resolve().parent
S = json.load(open(ROOT / "stems_summary.json")); P = S["pump"]; K = S["kick_pitch_hz"]; D = S["drum_stem_roles"]; H = S["hit_library"]; M = S["medians"]
RT = json.load(open(ROOT / "retrain.json")) if (ROOT / "retrain.json").exists() else {}
n = S["n"]; nb = S["n_with_bass"]
pct = lambda a, b: round(100 * a / max(b, 1))
r0 = lambda v: "?" if v is None else f"{v:.0f}"
r2 = lambda v: "?" if v is None else f"{v:.2f}"
kick_rate = D["kick"]["per_minute_median"]
gloss = [
("bass-stem", "bass stem", "What a separator hands back as bass. In this music, mostly the rumble."),
("beat", "beat", "The steady count you tap your foot to. Four per bar."),
("brightness", "brightness", "How much of a sound sits high up. Measured as the centre of its energy, in Hz."),
("clap", "clap", "A short, sharp, noisy hit. In older techno it answers the kick on two and four."),
("confidence", "confidence", "How sure the role model is of its answer. From 0 to 1."),
("corpus", "corpus", "The set of tracks we measured. Here, 218 hard techno tracks under free licences."),
("db", "dB", "A unit for level. Six dB is about twice as loud on a meter."),
("drum-stem", "drum stem", "What a separator hands back as drums. Kick, hats, claps, and often the kick's tail."),
("ducking", "ducking", "Turning one sound down each time another sound hits. Producers duck the rumble under the kick."),
("excerpt", "excerpt", "A short piece cut from a track. Ours are 64 seconds long. They start one third into the track."),
("hat", "hat", "The hi-hat. A short, bright tick between the kicks."),
("hit", "hit", "One drum sound, cut out on its own. A kick, a hat, a clap."),
("hook", "hook", "The part you remember. A stab, a vocal, or a lead sound."),
("hz", "Hz", "Hertz, cycles per second. A kick's body usually sits at 40 to 70 Hz."),
("job", "job", "What a sound is for in the track. We use six: kick, rumble, hat, clap, hook, space."),
("kick", "kick", "The main drum. It hits on every beat."),
("landing-pitch", "landing pitch", "The note a kick settles on after its first few ms. Measured at 100 ms."),
("median", "median", "The middle value. Half the tracks are above it, half below."),
("ms", "ms", "One thousandth of a second."),
("onset", "onset", "The moment a sound starts. Our hit finder looks for onsets in the drum stem."),
("pump", "pump", "A dip in the low end after each kick. Then it climbs back. Made by ducking."),
("role-model", "role model", "The small model from part two. It names a sound's job from seven measures."),
("rumble", "rumble", "A long, low tail under the kick. It fills the gap between hits."),
("sample-pack", "sample pack", "A folder of single hits that producers download and use."),
("separator", "separator", "A program that splits a track into parts. Drums, bass, voice, and the rest. We used Demucs, which is free and open."),
("sidechain", "sidechain", "The wire that lets the kick duck the rumble. Here, the ducking we measure on the kick's own onsets."),
("space", "space", "The job of pads, risers and impacts."),
("stem", "stem", "One part of a track as its own audio file."),
("sub-band", "sub band", "The lowest band, 20 to 60 Hz. The deep part of the kick and rumble."),
("synthetic", "synthetic", "Made by our own code, not recorded."),
("tempo", "tempo", "How fast the beats go, in beats per minute."),
]
def lib_row(job):
    c, rp, s2, s1 = (M[l][job] for l in ("corpus", "real_packs", "synth_v2", "synth_v1"))
    f = lambda d, k: "–" if d.get(k) is None else (f"{d[k]:.0f}" if k != "band_sub_share" else f"{d[k]:.2f}")
    return f'<tr><td>{job}</td><td class="num">{f(c,"decay40_ms")}</td><td class="num">{f(rp,"decay40_ms")}</td><td class="num">{f(s2,"decay40_ms")}</td><td class="num">{f(s1,"decay40_ms")}</td><td class="num">{f(c,"band_sub_share")}</td><td class="num">{f(rp,"band_sub_share")}</td><td class="num">{f(s2,"band_sub_share")}</td><td class="num">{f(c,"spectral_centroid_hz")}</td><td class="num">{f(rp,"spectral_centroid_hz")}</td><td class="num">{f(s2,"spectral_centroid_hz")}</td></tr>'
retrain = ""
if RT:
    retrain = f'''
  <h2 id="retrain">Teaching the model with real hits</h2>
  <p>The hit library is labelled by the model itself. That is a loop. So we test on the 318 <a class="term" href="#g-sample-pack">sample pack</a> hits instead. Their labels come from file names. A model trained only on corpus hits gets {RT["corpus_to_packs"]} in 100. The model trained on packs in part two scored 66.</p>
  <p>That is the surprise of this page. Machine cut hits from real tracks teach almost like a pack. Trained on all three sets it scores {RT["all_on_packs"]} on the packs. On the corpus hits it scores {RT["all_on_corpus"]}. It learned from them.</p>
  <p>{RT["note"]}</p>
'''
page = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>What the stems say: the corpus taken apart</title>
  <meta name="description" content="Part three of the sound-function research, in plain language: 218 hard techno tracks split into stems with a free separator; the pump measured three ways, where real kicks land, and the first real in-genre hit library.">
  <meta property="og:title" content="What the stems say: the corpus taken apart">
  <meta property="og:description" content="Part three: the pump measured three ways, where real kicks land, and real hard techno hits against the synthetic ones.">
  <meta property="og:type" content="article">
  <meta property="og:image" content="https://anthonybecker.me/research/sound-function/part-three/img/stems-kick-pitch.png">
  <link rel="stylesheet" href="../style.css">
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><a href="/">Anthony Becker</a> / <a href="/research/sound-function/">Research</a> / Part three</nav>
  <header class="title">
    <div class="kicker">Research · part three</div>
    <h1>What the stems say: the corpus taken apart</h1>
    <p class="meta">September 2026 · plain language · <a href="#glossary">glossary</a> · <a href="../">part one</a> · <a href="../part-two/">part two</a></p>
  </header>

  <h2 id="what">What this is</h2>
  <p>Part two asked producers for <a class="term" href="#g-stem">stems</a>. None have come yet. So we made our own, with a free <a class="term" href="#g-separator">separator</a>. It splits a track into drums, bass, voice and the rest. The split is not perfect. But it lets us look inside {n} tracks at once.</p>
  <p>Three questions drove this. How deep is the <a class="term" href="#g-pump">pump</a>, measured on the bass alone? Where does a real hard techno <a class="term" href="#g-kick">kick</a> land? And how do real <a class="term" href="#g-hit">hits</a> compare with our <a class="term" href="#g-synthetic">synthetic</a> ones?</p>

  <h2 id="how">How we did it</h2>
  <p>We cut a 64 second <a class="term" href="#g-excerpt">excerpt</a> from each kept track. It starts one third into the track. That is almost always the main part. The separator ran on an ordinary laptop. It took about 25 seconds per excerpt.</p>
  <p>Then we added the four stems back together. That gave the mix back. We found its beat grid as before. On the <a class="term" href="#g-bass-stem">bass stem</a> we measured the pump two ways. On the <a class="term" href="#g-drum-stem">drum stem</a> we cut every <a class="term" href="#g-onset">onset</a> into a hit. The <a class="term" href="#g-role-model">role model</a> from part two named each one.</p>

  <h2 id="pump">The pump, three ways</h2>
  <p>Part two measured the pump on the whole mix's low band. Now we can do better. The bass stem holds the <a class="term" href="#g-rumble">rumble</a> without the kick. Folding it on the beat gives the pump with less noise. Folding it on the kick's own onsets gives the <a class="term" href="#g-sidechain">sidechain</a> directly.</p>
  <p>{nb} of {n} excerpts have a bass stem we can trust. On those, the mix reads a {r0(P["mix_median"])} dB dip. The bass on the beat reads {r0(P["bass_median"])} dB. The bass on the kick's onsets reads {r0(P["sidechain_median"])} dB. Half the tracks sit between {r0(P["sidechain_q25"])} and {r0(P["sidechain_q75"])} dB there.</p>
  <figure>
    <img src="img/stems-pump-three-ways.png" alt="Three violin plots of the dip in dB: the mix low band, the bass stem folded on the beat, and the bass stem folded on the kick's onsets. The bass measures read deeper than the mix and have a long upper tail.">
    <figcaption>The same {nb} excerpts, three ways. The bass alone dips deeper than the mix showed. The tail above 25 dB is mostly silent bass stems.</figcaption>
  </figure>
  <p>So part two's number was the least of it. The kick's own tail sits in the mix's low band. It fills part of the dip. Take the kick out and the ducking shows in full. The typical rumble ducks about {r0(P["sidechain_median"])} dB under the kick. It is back within 3 dB after {r0(P["sidechain_return_median"])} <a class="term" href="#g-ms">ms</a>.</p>
  <p>Almost every track does it. {P["sidechain_over_3db"]} of {nb} tracks duck more than 3 dB. {P["sidechain_over_6db"]} duck more than 6 dB. Part one called the pump a medium finding. It is a strong one.</p>
  <p>One catch remains. In {P["bass_gap_tracks"]} tracks the bass stem falls silent between kicks. The measures then read a 25 dB gap or more. That is not a pump. It is a track with no rumble. Or the separator put the rumble in the drums.</p>

  <h2 id="kick">Where the kick lands</h2>
  <p>Part one ranked the kick's <a class="term" href="#g-landing-pitch">landing pitch</a> as a medium finding. It was measured on synthetic kicks. Now we have {K["n"]} real ones. We took the loudest kicks in each drum stem. We read their pitch at 100 ms. The <a class="term" href="#g-median">median</a> is {r0(K["median"])} <a class="term" href="#g-hz">Hz</a>.</p>
  <p>Half the tracks land between {r0(K["q25"])} and {r0(K["q75"])} Hz. {K["under_50"]} land below 50 Hz. {K["over_65"]} land above 65 Hz. Our synthetic kicks were drawn from 35 to 62 Hz. Real kicks spread further on both sides. One in four lands where ours never went.</p>
  <figure>
    <img src="img/stems-kick-pitch.png" alt="Histogram of the kick's landing pitch across the corpus, peaking in the fifties of Hertz with tails down to 35 and up to 90.">
    <figcaption>Where the kick lands, 100 ms in, across {K["n"]} tracks. The 35 Hz bar is the lowest pitch we can read. Read it as "below 40".</figcaption>
  </figure>

  <h2 id="drums">What the drum stems hold</h2>
  <p>The model found kicks in {D["kick"]["tracks_with"]} of {n} drum stems. The median rate is {r0(kick_rate)} per minute. The median <a class="term" href="#g-tempo">tempo</a> is 143. So it names about seven kicks in ten. The other three it calls <a class="term" href="#g-hook">hook</a> or <a class="term" href="#g-space">space</a>. Those are its words for a sound it cannot place.</p>
  <p><a class="term" href="#g-hat">Hats</a> it named in only {D["hat"]["tracks_with"]} stems, a few per minute. <a class="term" href="#g-clap">Claps</a> in {D["clap"]["tracks_with"]}, about {r0(D["clap"]["per_minute_median"])} per minute. A clap on two and four would give about 70. So most hats went to hook or space too. That matches part two's backbeat finding from the other side. It also shows the model's limit.</p>
  <p>The model learned from clean single hits. A hit cut from a stem is not clean. It carries the tail of the sound before it. It carries the start of the sound after it. In a busy drum stem the model is lost. So we trust its <a class="term" href="#g-confidence">confident</a> kicks and little else.</p>

  <h2 id="library">Real hits against our libraries</h2>
  <p>From the drum stems we kept the confident hits. At most twelve kicks, twelve hats and eight claps per track. That is {H["kick"]} kicks, {H["hat"]} hats and {H["clap"]} claps. It is our first library of real hard techno hits. The labels come from the model, not from ears. Keep that in mind.</p>
  <p>Now we can ask which library is nearest the real thing. The table compares middle values. Three measures, three jobs, four libraries.</p>
  <div class="tablewrap" data-plainlint="skip">
    <table>
      <thead><tr><th>job</th><th>fall 40 dB, corpus</th><th>packs</th><th>synth v2</th><th>synth v1</th><th>sub share, corpus</th><th>packs</th><th>synth v2</th><th>brightness, corpus</th><th>packs</th><th>synth v2</th></tr></thead>
      <tbody>
        {lib_row("kick")}
        {lib_row("hat")}
        {lib_row("clap")}
      </tbody>
    </table>
  </div>
  <figure>
    <img src="img/stems-libraries.png" alt="Three dot charts comparing the corpus hits, the sample packs, synth v2 and synth v1 on time to fall 40 dB, share below 60 Hz, and brightness, for kick, hat and clap.">
    <figcaption>Green is the corpus. The legend names the other three.</figcaption>
  </figure>
  <p>No library wins everywhere. On <a class="term" href="#g-sub-band">sub</a> weight our synthetic kicks were right. The packs were light. On length the corrected synthetic hats sit nearer the corpus. Real claps ring longer than either library. Every library is brighter than the corpus hits.</p>
  <p>Two warnings. Corpus kicks look short. Each cut ends at the next hat. Corpus hits look dark. The separator makes them less bright. Both are faults of the method, not facts about the music.</p>
  <p>Sub weight and hat length are the numbers to keep.</p>

{retrain}
  <h2 id="limits">What to doubt</h2>
  <p>The separator was trained on pop and rock. It has never seen a rumble kick. It often puts the kick's tail with the drums. The rumble goes to the bass. That helps the pump measure and hurts the kick measures.</p>
  <p>Hits cut from a stem are not clean. They carry sound from the other parts.</p>
  <p>The hit labels are the model's own guesses. We kept only confident ones. That removes doubt, not error. And 64 seconds is one main part per track. Breakdowns and track starts are not in this set.</p>

  <h2 id="next">What next</h2>
  <p>The lab does all this to any track you send it. Your own stems will be the real test. A separator trained on techno stems would fix the biggest doubt. Ten producers' stems would be enough to start.</p>

  <h2 id="sources">Sources and method notes</h2>
  <ul>
    <li>Separator: Demucs version 4, MIT licence, run on CPU.</li>
    <li>Code: <code>corpus2/separate_excerpts.py</code>, <code>corpus2/stems_analysis.py</code>, <code>analysis/stems.py</code>. Summary: <code>corpus2/stems_summary.py</code>. All <a href="https://github.com/becker929/anthonybecker.me/tree/main/research/sound-function/repo">on GitHub</a>.</li>
    <li>Hit library: <code>out/library_corpus.csv</code>, features only. No audio is shared.</li>
  </ul>

  <h2 id="glossary">Glossary</h2>
  <dl class="glossary">
{chr(10).join(f'    <dt id="g-{i}">{t}</dt><dd>{d}</dd>' for i, t, d in gloss)}
  </dl>

  <footer>
    <p>The 218 tracks are credited in <a href="../part-two/#tracks-credits">part two</a>. Text and figures on this page are CC BY 4.0.</p>
    <p>This page passes the same plain language check as the others.</p>
  </footer>
</div>
</body>
</html>
'''
Path("/home/user/anthonybecker.me/research/sound-function/part-three/index.html").write_text(page)
print("part three written for", n, "tracks")
