# cards source

`CardPoolBattler.jsx` is a fork of `../../2/card-battler/src/TcgDisplayLayer.jsx` —
same board, rules engine, and animation architecture. The only real change is
where the two decks come from.

The original demo's decks were two fixed arrays, chosen so the game replayed
identically every time. This one fetches the published pool from
`GET /api/battler-cards` (the one unauthenticated read out of the gated Card
Studio — see `src/cards.js` and `src/index.js` in the repo root) and builds
two 8-card decks from it, weighted so rarer cards come up less often
(`RARITY_WEIGHT` in `CardPoolBattler.jsx`). There's no minimum pool size —
`weightedSample` samples without replacement until the pool runs out, then
switches to with-replacement, so even a single published card fills both
8-card decks (repeated). The pick is reproducible for a given day (seeded
off the UTC date) and reshuffles the next day — the closest equivalent to
the original's fixed order now that the deck is live data instead of a
literal. Only an empty pool (nothing published yet, or the fetch failed)
falls back to the original fixed decks, so the demo still plays before
anything's been published.

Nothing reads the deck arrays until the player clicks "Begin", so the fetch
happens after mount with no loading flash on the board itself — only the
gate button says "Loading…" until the pool request settles.

## Card art

Each pool card can carry `image`, a URL under `/api/battler-cards/image/...`
pointing at a flattened PNG of the whole card (portrait, frame, stats — the
same render Card Studio's own preview shows), captured in the operator's
browser at publish time and uploaded through the existing blob route. See
`publishCard`/`isPublishedImageHash` in `src/cards.js` at the repo root: that
route only ever serves a hash that is *currently* some battle_ready card's
image, never the raw gated portrait/gem/frame assets.

`S.face` in `CardPoolBattler.jsx` draws `card.image` as the card's
background with a bottom scrim (`RARITY_RING`-style, see the comment there)
so the name label stays legible over arbitrary art, and falls back to the
original flat parchment/ash gradient if a card has no image — either the
fixed fallback deck, or a card published before this field existed.

Rebuild after editing:

```
npm install react@18 react-dom@18 esbuild --no-save
npx esbuild entry.jsx --bundle --minify --format=iife --target=es2019 \
  --jsx=automatic --define:process.env.NODE_ENV='"production"' \
  --outfile=../app.js
```

where `entry.jsx` (already committed) is:

```jsx
import { createRoot } from "react-dom/client";
import CardPoolBattler from "./CardPoolBattler.jsx";

createRoot(document.getElementById("root")).render(<CardPoolBattler />);
```

`--jsx=automatic` matters: the source imports hooks by name and never imports
the `React` default, so the classic transform builds cleanly and then fails at
runtime with "React is not defined".
