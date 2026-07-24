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
