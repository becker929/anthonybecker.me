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
  `demos/manifest.json`. Each demo directory is self-contained on
  purpose, down to its own copy of shared-looking code and assets:
  `demos/3/cards` is a fork of `demos/2/card-battler`'s engine, and the
  duplicated `sounds/` are duplicated deliberately. A demo, once
  published, is frozen work — decoupling them by directory is what keeps
  a later one free to diverge without breaking an earlier one. Do not
  propose extracting a shared engine or deduplicating across demos.
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
  time, and never caches the resolved text anywhere.
