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
render ever posted. To add one:

```
npx wrangler r2 object put anthonybecker-audio/audio/skrng/<date>-<slug>.mp3 \
  --file <render>.mp3 --content-type audio/mpeg --remote
```

The Worker's `/audio/*` route serves that key at
`/audio/skrng/<date>-<slug>.mp3` with byte-range support. Then add a manifest
entry with `id`, `title`, `date`, `file` (that URL), and optionally
`duration_s`, `bpm`, `lufs`, `true_peak_dbtp`, `notes`. The page is `noindex`
and not linked from `/`.

### Voice review

"Review by voice" runs a batch hands-free. For each track it says where you
are and what differs, plays the track, asks "What did you think?", and
listens until you say **next** (or tap Done, or click an earbud). Also:
**again** replays, **go back** returns a track, **stop** ends. The words
come from `skrng/voice.js` (tested in `src/test/skrng-voice.test.js`); the
browser side is `skrng/review.js`.

Write a batch for the ear. A track is announced as its number, the text
after the colon in its title, then its length, so titles in a group should
read `<group>: <what differs>, <n> s`. Name each group in `batches.json`
with `"groups": [{ "from": 1, "to": 3, "label": "...", "say": "..." }]`
(1-based, inclusive) when the title prefix would be confusing aloud, and
give a track `"say"` to replace its derived description.

Answers are text only (the recogniser's transcript plus any typed note),
kept on the phone and posted to `/api/skrng/feedback`. Both reading and
writing need the `SKRNG_TOKEN` secret; without it the routes return 503
and answers stay on the phone.

```
npx wrangler secret put SKRNG_TOKEN       # once
# on the phone, once: https://anthonybecker.me/skrng/#key=<token>
curl -H "Authorization: Bearer $SKRNG_TOKEN" \
  "https://anthonybecker.me/api/skrng/feedback?batch=4.1"   # what was said
```

`node e2e/skrng.mjs` (with `node e2e/server.mjs` running) drives a review in
Chromium with scripted speech in and out.

Redirects (old/short paths → canonical `/demos/<n>/<slug>/`) live in
`_redirects`, read natively by Cloudflare.
