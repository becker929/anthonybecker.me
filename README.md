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

Redirects (old/short paths → canonical `/demos/<n>/<slug>/`) live in
`_redirects`, read natively by Cloudflare.
