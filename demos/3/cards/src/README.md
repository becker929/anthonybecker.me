# cards source

`CardPoolBattler.jsx` is a fork of `../../2/card-battler/src/TcgDisplayLayer.jsx` —
same board, rules engine, and animation architecture. The only real change is
where the two decks come from.

The original demo's decks were two fixed arrays, chosen so the game replayed
identically every time. This one fetches the published pool from
`GET /api/battler-cards` (the one unauthenticated read out of the gated Card
Studio — see `src/cards.js` and `src/index.js` in the repo root) and builds
two 8-card decks from it, weighted so rarer cards come up less often
(`RARITY_WEIGHT` in `CardPoolBattler.jsx`). The pick is reproducible for a
given day (seeded off the UTC date) and reshuffles the next day — the closest
equivalent to the original's fixed order now that the deck is live data
instead of a literal. If the pool has fewer than `MIN_POOL_SIZE` published
cards (nothing published yet, or the fetch fails), it falls back to the
original fixed decks so the demo still plays.

Nothing reads the deck arrays until the player clicks "Begin", so the fetch
happens after mount with no loading flash on the board itself — only the
gate button says "Loading…" until the pool request settles.

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
