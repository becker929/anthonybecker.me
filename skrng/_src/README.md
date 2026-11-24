# skrng/_src

Tools for publishing renders to /skrng, the page where Anthony listens to
batches of renders. They are not part of the site (`.assetsignore`).

- `publish_render.sh` uploads an approved MP3 to R2 and prints its entry
  for `skrng/manifest.json`.
- `batch_intro.py` writes the spoken intro for a batch, uploads it to R2
  and sets `announce` on the batch in `skrng/batches.json`.

```
skrng/_src/publish_render.sh render.mp3 2026-10-01-hw002-kick-loop "HW002 — kick loop, night 1"
python3 skrng/_src/batch_intro.py 7.5                   # words from the batch title
python3 skrng/_src/batch_intro.py 8 "Kick distortion. ..."
python3 skrng/_src/batch_intro.py all                   # every batch without an intro
```

Both upload to the `anthonybecker-audio` bucket, so they need a wrangler
login with access to it. Publishing is public: run them only for renders
and batches Anthony has approved. `batch_intro.py` also needs macOS `say`
and `ffmpeg`. It edits `skrng/batches.json` in the checkout it lives in.
Commit that change on a branch and open a PR as usual.

They lived in zpkt as `contrib/skrng` until 24 November 2026.
