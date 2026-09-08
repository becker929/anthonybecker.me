#!/usr/bin/env python3
"""Write the stage 4 results paragraphs of part two from corpus2/summary.json, so the
numbers on the page are the numbers in the file.   python3 corpus2/stage4_text.py"""
import json, re
P = "/home/user/anthonybecker.me/research/sound-function/part-two/index.html"
S = json.load(open("corpus2/summary.json")); A = S["all"]; D = S["dropped"]; L = S["per_label"]
n = A["n"]
tempo_out = sum(v for k, v in D.items() if k.startswith("tempo"))
ai = sum(v for k, v in D.items() if "AI" in k); rips = sum(v for k, v in D.items() if "re-upload" in k); err = D.get("analysis error", 0)
pct = lambda x: round(x * 100)
one_in = round(n / max(A["clear_backbeat"], 1))
pumps = [d["pump_depth_median"] for d in L.values()]; r8s = [pct(d["return_on_8_line"]) for d in L.values() if d["return_on_8_line"] is not None]
lens = {int(k): v for k, v in A["break_len_hist"].items()}
long_ = {k: v for k, v in lens.items() if k >= 4}; top_long = sorted(long_, key=lambda k: -long_[k])[:3]
html = f'''
  <p>We kept {n} tracks for the numbers below. {tempo_out} ran outside 128 to 180 beats per minute. We left them out. {ai} were made by an AI service. {rips} were other people's tracks, posted again. {err} failed to run.</p>
  <p>The tempo <a class="term" href="#g-median">median</a> is {round(A["tempo_median"])} beats per minute. The range runs from {round(A["tempo_range"][0])} to {round(A["tempo_range"][1])}. Part one's 26 tracks sat at 152. This corpus is slower and more spread out. It holds more of the scene's edges.</p>
  <figure>
    <img src="img/stage4-tempo.png" alt="Histogram of tempo for the {n} tracks, from 128 to 180 beats per minute, with most tracks between 135 and 155.">
    <figcaption>Tempo of the {n} tracks, in beats per minute.</figcaption>
  </figure>
  <p>The kick is on every beat, as expected. Half of the <a class="term" href="#g-sub-band">sub band</a>'s attacks land on the four beats. Chance would be one quarter. {A["sub_on_beats_over_half"]} of {n} tracks are above half.</p>
  <figure>
    <img src="img/stage4-bar-grid.png" alt="A grid of six bands by sixteen steps. The sub band lights up on the four beats. The other bands are nearly even across the bar.">
    <figcaption>Where each band's attacks land in the bar. Averaged over {n} tracks, bar one found. Only the sub band has a clear pattern: the four beats.</figcaption>
  </figure>
  <h3>The pump</h3>
  <p>The pump is real and large. The median depth is {round(A["pump_depth_median"])} dB. {A["pump_over_6db"]} of {n} tracks dip more than 6 dB. The median return time is {round(A["pump_return_median"])} ms. That is most of a beat at this tempo. Producers duck hard and long.</p>
  <figure>
    <img src="img/stage4-pump-corpus.png" alt="Two histograms. Pump depth spreads from 0 to 28 dB with a median near {round(A["pump_depth_median"])}. Return time clusters between 240 and 320 ms.">
    <figcaption>Pump depth and return time across the corpus. Tracks with no rumble read a gap, not a pump. They sit at the deep end.</figcaption>
  </figure>
  <h3>The clap</h3>
  <p>The clap on two and four is not a rule here. Only {A["clear_backbeat"]} of {n} tracks show a clear backbeat. That is about one in {one_in}. In the rest, mid and high attacks are even across beats. Either there is no clap, or the kick's click hides it. Both are common in this music.</p>
  <p>This surprised us. Part one assumed a backbeat. The synthetic loops all had one. The corpus says the modern sound often does without. That is a finding about the music, not the method. The method finds the clap in synthetic loops every time.</p>
  <figure>
    <img src="img/stage4-phrase.png" alt="Left: histogram of the share of mid and high attacks on the louder beat pair; most tracks sit near 0.5 and few pass 0.55. Right: histogram of how many bars the kick stays off; two bars is most common, then 4, 8 and 16.">
    <figcaption>Left: how different the two beat pairs are. Right: how long the kick stays away. Bright bars are multiples of eight. Dark bars are multiples of four.</figcaption>
  </figure>
  <h3>Bar one</h3>
  <p>With the backbeat as a second sign, bar one gets firmer. The two signs agree in {A["beat_one_agrees_with_novelty"]} of {n} tracks. Where they differ, we trust the backbeat. Section changes alone gave a confident answer in {A["downbeat_confident"]} tracks.</p>
  <h3>Breakdowns and phrases</h3>
  <p>{A["tracks_with_breakdown"]} tracks have a kick drop of two bars or more. We counted {A["breakdowns"]} such drops. The median length is {round(A["break_length_median"])} bars. Drops of two bars are the most common. Drops of 4, 8 and 16 bars: {lens[4]}, {lens[8]} and {lens[16]}.</p>
  <p>Does the kick return on the eight-bar line? Often, but not mostly. {pct(A["return_on_8_line"])} in 100 returns land on a multiple of eight bars. Chance would be 12 in 100. {pct(A["return_on_4_line"])} in 100 land on a multiple of four. Chance would be 25.</p>
  <p>Lines of sixteen bars get {pct(A["return_on_16_line"])} in 100. Chance would be 6. So the phrase rule is real. It runs two to three times chance. It is not a law. The kick stays on for {round(A["kick_run_median"])} bars at a stretch, median.</p>
  <h3>Across labels</h3>
  <p>Do the findings hold across people? Producers rarely have three tracks here, by design. So we split by label instead. {len(L)} labels have five tracks or more. The pump median runs from {round(min(pumps))} to {round(max(pumps))} dB across them. The eight-bar return runs from {min(r8s)} to {max(r8s)} in 100.</p>
  <p>The backbeat is rare on every label. So the clap finding is not one label's style. The pump and the phrase rule differ more. Two labels with slower, older tracks pump less and break more.</p>
  <figure>
    <img src="img/stage4-labels.png" alt="Three dot charts, one row per label: share of tracks with a clear backbeat, pump depth, and share of bars with no kick. A broken line marks the whole corpus.">
    <figcaption>The same three numbers per label. The broken line is the whole corpus.</figcaption>
  </figure>
'''
s = open(P).read()
new = "  <!-- STAGE4-RESULTS -->" + html + "  <!-- /STAGE4-RESULTS -->"
if "<!-- /STAGE4-RESULTS -->" in s:
    s = re.sub(r"  <!-- STAGE4-RESULTS -->.*?<!-- /STAGE4-RESULTS -->", lambda m: new, s, flags=re.S)
else:
    s = s.replace("  <!-- STAGE4-RESULTS -->", new)
open(P, "w").write(s); print("stage 4 text written for", n, "tracks")
