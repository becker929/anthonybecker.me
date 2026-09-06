# sound-function

What decides a sound's job in modern hard techno? Preliminary research, the
tools that produced it, and a programme for going ten times further.

The write-up, in plain language, is at
<https://anthonybecker.me/research/sound-function/>. This directory holds
everything behind it so the numbers can be re-run.

```
research/literature.md   the literature sweep: 25 sources, 14 candidate parameters, the gaps
research/stems-request.md  stage 5: what we searched, who to ask, the request text
synth/                   a numpy synthesiser for hard-techno test sounds and parameter sweeps
synth/library.py         stage 1: 400 synthetic hits with randomised settings, 40 per role
library/real/            stage 1: manifest and credits for 318 real CC0 / CC BY samples
analysis/                feature extraction, classifier, pump, downbeat finder, figures
corpus/                  the 26-track pilot corpus (part one)
corpus2/                 stage 4: discovery, selection, fetch, pipeline and summary for the big corpus
listen/                  stage 2: the pair builder for the listening test
meter/                   stage 6: verification of the browser role meter against the Python features
tools/plainlint.py       the plain-language linter both pages must pass
out/                     measurements, models and plots
```

## Part two: running the programme

The write-up is at <https://anthonybecker.me/research/sound-function/part-two/>.

```
python3 -m synth.library                                  # library/synth/wav, 400 hits
python3 -m analysis.run hits library/synth/wav -o out/library_synth.csv && python3 analysis/hits_extra.py out/library_synth.csv
python3 -m analysis.run hits library/real/wav  -o out/library_real.csv  && python3 analysis/hits_extra.py out/library_real.csv
python3 analysis/classify.py out/library_all.csv --portable --max-k 7 -o out/classifier_union.json   # the meter's model
python3 -m analysis.pump --synth                          # pump measure on loops with known ducking
python3 -m analysis.downbeat --synth                      # bar-one finder on an arrangement with known bars
python3 corpus2/discover.py scratch/ia_candidates.json > corpus2/tracks.csv
python3 corpus2/select_fetch.py corpus2/tracks.csv 300    # corpus2/wav (not committed), corpus2/manifest.json
python3 corpus2/analyse_all.py --follow                   # grid + pump + downbeat per track, four at a time
python3 corpus2/summarise.py                              # corpus2/summary.json: the phrase questions answered
python3 analysis/figures_programme.py                     # out/plots/stage*-*.png
```

The real sample library's audio is not committed (19 MB, and each pack keeps
its own licence); `library/real/manifest.csv` names every file's source and
licence and `library/real/sources.md` gives the credit lines. The big corpus is
handled like the pilot: manifest with page URL, licence and SHA-256, audio
never redistributed. `corpus2/exclude.json` lists the tracks dropped before
any statistic was computed and why.

## Reproduce

```
pip install numpy scipy soundfile librosa matplotlib
python3 -m synth.sweeps                       # out/sweeps/*.wav, out/loops/*.wav
python3 corpus/resolve_archive.py > corpus/tracks.csv
python3 corpus/fetch.py corpus/tracks.csv     # corpus/wav/*.wav (not committed)
python3 -m analysis.run hits out/sweeps -o out/hits.csv
python3 -m analysis.run tracks corpus/wav -o out/tracks.json
python3 analysis/plots.py                     # out/plots/*.png|svg
```

## The corpus

Twenty-six tracks, 2018–2026, all released under Creative Commons
BY-NC-ND (25 at 4.0, one at 3.0), mirrored by their labels on the Internet
Archive. Every licence in `corpus/manifest.json` was re-read from the
archive's own metadata for that item, not copied from a listing. The audio
itself is not redistributed here; the manifest records the page URL and the
SHA-256 of each original file so any measurement can be traced back.

The corpus is not a sample of famous hard techno. It is what exists under a
free licence: an underground netlabel scene (Fresscode Records, Dancefloor
Socialism, Psychocandies, BlackVogue, Physical Techno Recordings,
InquietoMusik). One producer, Inquieto, accounts for eleven of the
twenty-six tracks. The page says so.

## The plain-language rule

Every paragraph on the page has at most six sentences. Every sentence has at
most eleven words. Every technical term is in the glossary. `tools/plainlint.py`
checks all three and the page is not published unless it passes.

## Licence

Code: MIT. The literature sweep and write-up: CC BY 4.0. The corpus tracks
keep their own licences, credited in the manifest and on the page.
