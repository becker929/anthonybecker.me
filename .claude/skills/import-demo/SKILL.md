---
name: import-demo
description: Use this skill whenever the user wants to add, import, publish, or deploy a project, prototype, artifact, HTML page, or component onto their personal website — anthonybecker.me, aka "my website" or "my site" (repo becker929/anthonybecker.me). This covers turning a standalone HTML artifact, a React/JSX component, or any other small build into a new demo hosted at /demos/<n>/<slug>/ on the site's Cloudflare Worker. Trigger on requests like "add this to my website", "put this on my site as a demo", "import this into anthonybecker.me", "make this a demo on my site", "can you deploy this to my website" — and more generally, trigger any time anthonybecker.me or "my website"/"my site" comes up alongside a project, artifact, or file the user wants shown off, even if they don't use the words "skill", "demo", or "import" explicitly. Do not use this for unrelated edits to the site (copy tweaks, styling, non-demo pages) — only for bringing a new project in as a demo.
---

# Importing a project as an anthonybecker.me demo

This skill encodes the working convention for `becker929/anthonybecker.me`, a
static site with no build step, deployed as a Cloudflare Worker (static
assets) via Workers Builds. Adding a "demo" means landing a project's output
at a predictable URL and wiring it into the two places that list demos —
without hand-editing either listing page, because they read from a shared
manifest.

Read this whole file before starting — the ordering matters (in particular,
figure out the number/slug *before* writing any files, and treat pushing/PRs
as a separate, explicitly-requested step at the end).

## The moving parts

- **`demos/<n>/<slug>/`** — one directory per demo. `<n>` is a sequential
  integer (1, 2, 3, …), `<slug>` is kebab-case. Example:
  `demos/2/card-battler/`.
- **`demos/manifest.json`** — a JSON array of
  `{number, slug, title, description, path}`. This is the *only* place demo
  metadata lives. `index.html` (site root) and `demos/index.html` both
  `fetch('/demos/manifest.json')` client-side and render the list from it —
  so adding an entry here is what makes a demo show up on both pages. You
  never need to touch either index page by hand.
- **`_redirects`** — plain-text Cloudflare redirects file, one rule per line:
  `<source> <destination> <code>`. Every demo gets short/alternate paths
  redirected to its canonical `/demos/<n>/<slug>/`.
- **`wrangler.toml`** — declares the site as a Workers static-assets deploy
  (`[assets] directory = "."`). Don't remove or "fix" this even though the
  repo has no server code — it's what makes Workers Builds serve the repo at
  all.
- **`.assetsignore`** — gitignore-syntax file excluding `.git`,
  `wrangler.toml`, and `README.md` from the deployed asset bundle. This one
  matters more than it looks: `wrangler` walks the *entire* assets directory
  including `.git` if nothing excludes it, which both bloats the deploy and
  publishes git internals as web-servable files. If you ever see the file
  count in a `wrangler deploy --dry-run` come back far higher than the
  number of real site files, this is almost always why — check
  `.assetsignore` first before anything else.

## Step 1 — Work out the number and slug

Read `demos/manifest.json`, take the max `number`, and use the next integer.
Derive a kebab-case `slug` from the project (ask the user if it's not
obvious — e.g. a generic uploaded file called `app.jsx` doesn't imply a good
slug on its own). Confirm the `title` and a one-sentence `description` too;
these are user-facing copy on both index pages, so it's worth getting them
right rather than guessing from a filename.

## Step 2 — Place the content at `demos/<n>/<slug>/`

What goes here depends on what's being imported:

- **Self-contained HTML artifact** (canvas/vanilla-JS pages, the kind Claude
  produces as a single-file artifact): this becomes `demos/<n>/<slug>/index.html`
  essentially unchanged. Don't rewrite working code just to match house
  style — the two existing demos (`disappearing-ink`, a canvas artifact used
  verbatim, and `card-battler`, see below) show both ends of this spectrum.
- **React/JSX component or anything needing a build step**: the site has no
  build pipeline, so bundle it *once* at import time and commit only the
  built output — a small `index.html` that mounts the app, plus a bundled
  `app.js` (e.g. via `esbuild`). Don't commit source JSX, `package.json`, or
  `node_modules` into the demo directory; the bundle is the deliverable. If
  `esbuild` isn't already available, install it as a one-off
  (`npm install -g esbuild` or `npx esbuild`) rather than adding it as a
  project dependency, since this repo has no `package.json` of its own.

Either way, keep the demo self-contained under its own directory — it
shouldn't need anything from outside `demos/<n>/<slug>/`.

## Step 3 — Add the manifest entry

Append to the array in `demos/manifest.json`:

```json
{
  "number": <n>,
  "slug": "<slug>",
  "title": "<Human Title>",
  "description": "<one sentence, user-facing>",
  "path": "/demos/<n>/<slug>/"
}
```

## Step 4 — Add redirects

Append six lines to `_redirects` (a short comment header per demo keeps the
file scannable):

```
# Canonical demo path: /demos/<n>/<slug>/
/demos/<n>                 /demos/<n>/<slug>/  301
/demos/<n>/                /demos/<n>/<slug>/  301
/demos/<slug>               /demos/<n>/<slug>/  301
/demos/<slug>/               /demos/<n>/<slug>/  301
/<slug>              /demos/<n>/<slug>/  301
/<slug>/              /demos/<n>/<slug>/  301
```

(Exact column alignment doesn't matter — match the surrounding style.)

## Step 5 — Verify before pushing anything

Do this locally, before touching git:

1. **Static serve check** — `python3 -m http.server 8000` from the repo
   root, then confirm `/`, `/demos/`, and `/demos/<n>/<slug>/` all resolve,
   and that the new demo shows up in both listing pages (this proves the
   manifest entry is well-formed JSON and the path is right).
2. **Real interaction for interactive demos** — a static screenshot doesn't
   catch much; drive the actual interaction with Playwright
   (`executable_path='/opt/pw-browsers/chromium'`,
   `PLAYWRIGHT_BROWSERS_PATH` is already set in this environment — don't run
   `playwright install`). Dispatch real pointer/mouse events and confirm the
   demo responds, rather than just loading the page and screenshotting a
   static state.
3. **Wrangler dry run** — `npx wrangler@latest deploy --dry-run` from the
   repo root. Sanity-check the reported file count and upload size look
   right for what you added — a count that jumps far more than the number of
   files you actually added is the signature of something (usually `.git`)
   leaking into the bundle via a gap in `.assetsignore`.

## Step 6 — Git and PR workflow

Only push or open a PR if the user has actually asked for it — landing the
files locally and reporting back is a complete, valid stopping point on its
own.

When you do push:

1. This environment works on a designated feature branch per task
   (e.g. `claude/<slug>-deploy-<id>`). Before adding new commits, check
   whether the last PR for that branch already merged (GitHub MCP tools,
   e.g. `pull_request_read` with `method: get`). If it merged, don't stack
   new work on top of already-merged history — rebase any unmerged commits
   you're carrying forward onto the latest default branch instead, keeping
   the same branch name.
2. Commit with a message describing what demo was added and why, not a
   mechanical file list.
3. `git push -u origin <branch>`.
4. Open the PR via the GitHub MCP `create_pull_request` tool. Check for a PR
   template first (`.github/pull_request_template.md` etc.) and mirror its
   structure if one exists.

## Step 7 — If CI (Workers Builds) fails

The repo's PR checks are **Workers Builds** (Cloudflare's deploy check) and
**GitGuardian** (secret scanning). If Workers Builds fails, check
`wrangler.toml` and `.assetsignore` first — in practice this check has only
ever failed here because of missing/broken wrangler config or an asset
bundle that leaked unwanted files, not because of anything demo-specific.
Reproduce with `npx wrangler@latest deploy --dry-run` locally before
guessing.
