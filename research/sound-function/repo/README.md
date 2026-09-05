# sound-function

What decides a sound's job in modern hard techno? Preliminary research, the
tools that produced it, and a programme for going ten times further.

The write-up, in plain language, is at
<https://anthonybecker.me/research/sound-function/>. This directory holds
everything behind it so the numbers can be re-run.

```
research/literature.md   the literature sweep: 25 sources, 14 candidate parameters, the gaps
synth/                   a numpy synthesiser for hard-techno test sounds and parameter sweeps
analysis/                feature extraction: signal features of a hit, context features of a track
corpus/                  how the Creative Commons corpus was found, resolved and fetched
tools/plainlint.py       the plain-language linter the page must pass
out/                     rendered sweeps, loops, measurements and plots
```

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
