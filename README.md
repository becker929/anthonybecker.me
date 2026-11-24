# anthonybecker.me

Personal site. Static HTML/CSS, no build step — deployed as a Cloudflare
Worker (static assets) via Workers Builds.

## Deploy

Connected to Cloudflare Workers Builds via the GitHub integration, configured
by `wrangler.toml` (assets served straight from the repo root, no build
command needed). Pushing to `main` deploys to production.

## Local preview

```
python3 -m http.server 8000
```

## Demos

Demos live at `/demos/<n>/<slug>/`. Both `/` and `/demos/` list them by
reading `demos/manifest.json`, so adding a new demo means dropping its
files in `demos/<n>/<slug>/` and adding one entry to the manifest — no
other page needs to change.

## Renders (/skrng)

`/skrng/` ("scrounge") streams work-in-progress renders. It lists
`skrng/manifest.json`, newest first by `date`. Audio lives in R2, not in
git — every clone (including each Workers Build) would otherwise carry every
render ever posted. To add one, `skrng/_src/publish_render.sh` uploads it
and prints its manifest entry (see `skrng/_src/README.md`). By hand:

```
npx wrangler r2 object put anthonybecker-audio/audio/skrng/<date>-<slug>.mp3 \
  --file <render>.mp3 --content-type audio/mpeg --remote
```

The Worker's `/audio/*` route serves that key at
`/audio/skrng/<date>-<slug>.mp3` with byte-range support. Then add a manifest
entry with `id`, `title`, `date`, `file` (that URL), and optionally
`duration_s`, `bpm`, `lufs`, `true_peak_dbtp`, `notes`. The page is `noindex`
and not linked from `/`.

### Play batch

Play batch plays the batch, then carries on into every older one: each
batch's intro (`"announce"` in `batches.json`, the experiment said once),
then each track's announcement and the track. Everything goes through one
hidden `<audio>` element, so it keeps going on a locked phone. The car's or
lock screen's buttons (Media Session: play, pause, next, previous, stop;
Bluetooth AVRCP buttons arrive as these) drive it. The order comes from
`skrng/playlist.js` (tested in `src/test/skrng-playlist.test.js`).
`skrng/_src/batch_intro.py` makes a batch's intro and sets `announce`.

The page is for listening only. Its voice review (spoken feedback), talk
test and agent panel (Claude Code jobs on the Mac) were removed on
24 November 2026, with the Worker routes behind them: `/api/skrng/feedback`,
`/api/rpc` and `/api/rig/connect` (the `RigBroker` Durable Object). They now
404. The old feedback is still in the `AUDIO_KV` namespace under
`skrng:fb:*`, unread.

Redirects (old/short paths → canonical `/demos/<n>/<slug>/`) live in
`_redirects`, read natively by Cloudflare.
