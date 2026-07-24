# anthonybecker.me

Personal site. Static HTML/CSS, no build step — deployed via Cloudflare Pages.

## Deploy

Connected to Cloudflare Pages via the GitHub integration. Pushing to `main`
deploys to production; other branches get preview deployments. Build output
is the repo root (no build command needed).

## Local preview

```
python3 -m http.server 8000
```

## Demos

Demos live at `/demos/<n>/<slug>/`. Both `/` and `/demos/` list them by
reading `demos/manifest.json`, so adding a new demo means dropping its
files in `demos/<n>/<slug>/` and adding one entry to the manifest — no
other page needs to change.

Redirects (old/short paths → canonical `/demos/<n>/<slug>/`) live in
`_redirects`, read natively by Cloudflare.
