# Card Studio (browser side)

Served at `/studio-c33f3ea406426b41/` behind a password cookie — never
directly, see the routing note in the repo root `CLAUDE.md`. Server logic
lives in `src/`; this directory is the operator UI, the card renderer, and
the frame assets.

- `app.js` — operator UI. Calls the API with relative `../api/...` paths.
- `renderer.js` — pure, synchronous card renderer.
- `fit-text.js`, `chroma-key.js`, `migrate.js` — pure logic, unit-tested
  under Node with no browser.
- `fixtures/` — the frame artwork and its derived masks, plus sample cards.
- `renderer.test.html` + `test/render.spec.mjs` — renderer integration test.

## The renderer contract

`renderCard(ctx, template, card, assets)` walks `template.layers` top to
bottom and draws each. It is deterministic and synchronous: it never
fetches, never calls a model, and every asset it touches must already be a
decoded, drawable image in the `assets` map.

**Callers must `await document.fonts.ready` first.** Canvas text metrics
are wrong until the webfonts load, and the fit/shrink logic measures text —
render too early and titles size themselves against a fallback font.

Layer types: `image` (full-canvas `src`), `portrait` (`rect` + `mask`),
`gem` (`rect`), `text` (`slot` + `rect` + type settings). Text slots are
`title`, `flavor`, `stats`; `fit` is `shrink` (one line, shrink to fit) or
`wrap-shrink` (wrap, then shrink until the block fits). `valign: "middle"`
centres the block in its rect — bars want it, so a shrunk title doesn't
ride the top edge.

The layer order in `template.json` is load-bearing: `frame_bg` → portrait →
`frame_over` → gem → text. `frame_over` is what can paint *over* the
portrait, and the gem draws after it, so the gem sits on top of everything.

## The frame is derived artwork, not vector shapes

`fixtures/frame_source.png` is the original frame render — a card sitting
on a dark backdrop. `test/generate-fixtures.mjs` (`npm run fixtures`)
derives every other asset from it:

1. crops the card off the backdrop (`CARD_CROP`, measured off the
   luminance step between backdrop and the card's lit rim),
2. rectifies it to the 750×1050 canvas with a Lanczos-3 resample
   (`drawImage` upscaling is bilinear and visibly softens the bezels),
3. flood-fills the portrait aperture out of the art, smooths the
   pixel-ragged boundary, and emits `aperture.png` and `frame_over.png`.

Do not hand-edit the generated PNGs — `frame_bg.png`, `frame_over.png`,
`aperture.png`, and the placeholders are all outputs. Change the source art
or the constants at the top of the script, then re-run it.

The aperture is **not a rectangle**: it steps up beside the stats bar and
curves around the gem socket. That is why it is segmented from the art
rather than drawn — the mask reproduces the real shape, including the
chamfered corners.

## Invariants that will bite you

- **`template.json` rects must match what `generate-fixtures.mjs` prints.**
  The script reports the measured aperture rect on every run; it is not
  written into the template automatically. If you change the source art or
  the crop, re-run and reconcile.
- **`aperture.png`'s pixel dimensions must equal the portrait layer's
  `rect` width/height.** The mask is drawn 1:1 into the offscreen canvas.
- **The aperture's aspect ratio and `PORTRAIT_ASPECT_RATIO` in
  `src/gemini.js` are coupled.** The renderer cover-fits (preserves
  aspect, centre-crops the overflow), so a mismatch is not fatal — but the
  bigger the gap, the more of every portrait gets cropped away. If you
  reshape the aperture, move the generation ratio to the nearest one the
  API offers, and add a new portrait `style_version` whose composition
  guidance matches the new shape.
- **Bumping `template.json`'s `version` is not a card migration.** Card
  schema migrations live in `migrate.js`, keyed off `schema_version`.
  `template_version` on a card is provenance only.
- **Gem art: store the raw bytes plus `mask_params`, never only the masked
  output.** `chroma-key.js` re-derives the mask every time it is needed.

## Publishing to the battler

The card-battler demos (`demos/3/cards`) are public and unauthenticated;
this studio is not. Rather than exposing any gated route to them, `app.js`
renders `#preview-canvas` to a PNG and uploads it through the ordinary
`api/blobs` route at the moment a card is published (`uploadRenderedCardImage`
in `app.js`) — this page is the one place that's guaranteed to have the
frame, portrait, and gem assets already decoded and drawn. `publishCard`
(`src/cards.js` at the repo root) requires that upload's hash — along with a
positive `power` and a known `rarity` — before flipping `battle_ready`, and
stores the hash as `battler_image` on the card.

The one public image route, `GET /api/battler-cards/image/:hash`, only ever
serves a hash that is *currently* some `battle_ready` card's `battler_image`
(`isPublishedImageHash`). Every other blob — raw portraits, gem art, an
image a card has since replaced or unpublished — stays reachable only
through this studio's own gated blob route.

## Tests

`npm run test:cards` covers the pure logic under Node. `npm run test:render`
drives a real browser (Playwright setup in the root `CLAUDE.md`) and checks
compositing: the rounded silhouette, art visible through the aperture, the
mask not overrunning the bezel, gem on top, text in each slot, and
determinism.

It also renders the portrait layer *in isolation* onto hidden canvases and
measures a marker circle baked into the placeholder art — a circle stays
circular only if aspect is preserved, so that check fails if anyone
replaces cover-fit with a plain stretch. The two sample cards deliberately
carry different art ratios (`card-1` the current 4:3, `card-2` legacy 3:4)
so both cover-fit paths are exercised.
