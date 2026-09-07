# Working in this repo

Personal site, deployed as a Cloudflare Worker. Two very different things
live here: a static personal site (plain HTML/CSS, no build step) and a
gated trading-card design tool ("Card Studio") that talks to Gemini.

## Commands

```
npm test              # all Node tests (worker + card unit tests)
npm run test:worker   # src/test/*.test.js
npm run test:cards    # card unit tests (pure logic, no browser)
npm run test:render   # renderer integration test — needs Playwright, see below
npm run fixtures      # regenerate card frame assets — needs Playwright
npm run preview       # static preview on :8000
```

There is no build step and no bundler. `node --test` needs a file glob —
`node --test src/test/` fails with MODULE_NOT_FOUND, which is why the
scripts above spell out `*.test.js`.

`package.json` deliberately declares **no dependencies**. Workers Builds
deploys straight from the repo, so anything listed there would be
installed on every deploy for no reason.

## Playwright (render test + fixture generation)

`test:render` and `fixtures` drive a real browser and need Playwright
installed ad hoc (`node_modules/` is gitignored, and it is not a
dependency of the site):

```
cd private/c33f3ea406426b41/cards
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright@1.56.1 --no-save
```

**The version matters.** Pick the version matching the browsers already on
the machine — `npx playwright --version` reports it. Installing latest
gets a Playwright that looks for a Chromium build number that isn't
present and tells you to run `playwright install`; don't, just pin to the
matching version. Run with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`
when browsers live outside the default location.

## Layout

- `src/` — the Worker. `index.js` routes; everything else is Card Studio
  server logic (Gemini client, prompts, D1/R2 storage).
- `src/test/` — Node tests for the Worker. No network: `fakes.js` provides
  the stand-ins.
- `private/c33f3ea406426b41/cards/` — Card Studio's browser code and
  assets. See the README there before touching the renderer or template.
- `demos/` — static demos at `/demos/<n>/<slug>/`, listed from
  `demos/manifest.json`.
- `d1/migrations/` — D1 schema.

## Card Studio routing (non-obvious)

`wrangler.toml` serves the whole repo as static assets (`directory = "."`),
so two rules in `src/index.js` matter:

- `/private/c33f3ea406426b41/*` returns **404 unconditionally**. The
  directory is never served directly.
- The app is reached at `/studio-c33f3ea406426b41/`, behind a password
  cookie, which proxies to that directory via `env.ASSETS.fetch`.

That is why `cards/app.js` calls the API with relative `../api/...` and
`../blob/...` paths — the page's URL is under `/studio-<hash>/`, not under
`/private/`. Neither path is a secret in the cryptographic sense; both are
unguessable-by-obscurity plus the password gate.

Anything under `private/` that you would not want fetched by URL should not
go there — only the 404 rule keeps it back, and it is matched by prefix.

## Conventions

- Comments here carry real design rationale and are worth reading before
  changing behaviour. Keep them true: if you change what a comment
  describes, update it in the same commit.
- Do not write comments that cite an external document by section number.
  An earlier version of this codebase cited a design brief that was never
  committed, which left ~25 authoritative-looking claims nobody could
  verify — including one stale invariant that silently became wrong. State
  the constraint directly instead.
- System prompts (portrait/flavor/gem/gem_field_fill) live in D1 (table
  `prompts`), editable from the studio's Prompts tab — `src/prompts.js` is
  the D1-backed accessor, not the prompt text itself; it only seeds a
  generator's very first version from its old hardcoded text, once. They
  are still append-only: saving a prompt never edits a row, it inserts the
  next version number for that generator. A card's stored
  `style_version`/`prompt_version` always resolves to the exact text that
  produced it — there is no bulk restyle.
- Skills (table `skills`, `src/skills.js`) are a separate, deliberately
  *unversioned* pool of named reusable prompt snippets, referenced by
  `/name` from any prompt or per-card instruction/guidance text. Unlike
  prompts, editing a skill changes every reference to it immediately —
  `resolveSkills` expands `/name` fresh at generation time, never at save
  time, and never caches the resolved text anywhere. Nothing tracks who
  references a skill, so two rules stop that from becoming silent
  breakage: a skill is **never deleted, only archived** (an archived skill
  still resolves everywhere it is already used, it just stops being
  offered for new text and is flagged in the prompt editors), and a
  **name is immutable once created** — renaming would orphan existing
  references exactly the way deleting would. Replace a skill by making a
  new one under a new name; retired names stay taken.
- The gem system prompt must contain `{{key_color}}`, enforced when saving
  it. `gemSystemPrompt` substitutes the per-generation key color there,
  and chroma-key removal depends on the model having been told that exact
  flat background — drop the placeholder and generation still "succeeds",
  it just returns art nothing can key out, with no error anywhere.

## The lab (src/lab.js, private/lab/)

`/lab/` is the owner's private upload-and-analysis area. The browser signs in
with `DEMO_PASSWORD` (a lab-scoped cookie, separate from the studio's); the
analysis runner authenticates with `Authorization: Bearer $LAB_TOKEN`. Files go
to R2 (`AUDIO_BUCKET`, `lab/uploads/<item>/<name>`), item metadata to KV
(`AUDIO_KV`, `lab:item:<id>`), reports to `lab/results/<item>.json`. The UI is
served from `private/lab/` only through the Worker after auth; the directory is
blocked directly and listed in `run_worker_first`.

Secrets the lab needs on Cloudflare: `DEMO_PASSWORD` (already set for the
studio) and `LAB_TOKEN` (new: `wrangler secret put LAB_TOKEN`). The runner lives
in the research project (`research/sound-function/repo/lab/runner.py`) and needs
the same token in its environment.

## End-to-end tests (e2e/)

`npm run e2e:server` starts the real Worker `fetch()` on :8790 with in-memory
KV/R2 fakes and static files from the repo root; `npm run e2e` drives it with
Playwright (install per the section above): the listening test, the role meter
and the lab, in a real browser. `e2e/` is in `.assetsignore` so it never deploys.
