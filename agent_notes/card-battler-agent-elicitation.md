# Card battler agent — requirement elicitation

Questions to answer before designing the three items in `docs/TODO.md`
(republish to `demos/3/cards`, new `demos/4/battler`, card battler agent).
Grouped, and each one notes why it matters against the code as it stands
today. Nothing here is a decision yet.

## A. Scope and sequencing

1. Are the three TODO items one project or three independently shippable
   ones? The agent could subsume the republish work (a bulk republish is
   one of the things an agent would do), or the republish could be a
   throwaway one-off done by hand first.
2. Is `demos/4/battler` a prerequisite for the agent's "modify the whole
   game" ability, or does the agent target `demos/3/cards`? "Modify the
   game" is much cheaper to build if demo 4 is designed data-driven from
   the start rather than retrofitted onto the existing 2,400-line JSX.
3. Does demo 4 replace demo 3, or do both stay listed in
   `demos/manifest.json`? If both stay, they both consume
   `/api/battler-cards` and both constrain any change to that payload.
4. What is the demo-able definition of done for each item — what do you
   want to be able to show someone at the end?

## B. Republish all cards to `demos/3/cards`

5. What exactly is stale about the current pool? Cards published before
   `battler_image` was required, cards whose stored render predates a
   template/renderer change, or cards that were never published at all?
   The fix differs: the first two need a re-render, the third needs
   power/rarity decisions.
6. Does "all cards" mean every non-archived card in D1, or only cards that
   are already `battle_ready`? `publishCard` currently refuses anything
   without a positive `power` and a known `rarity` — if unpublished cards
   are in scope, someone or something has to assign those stats.
7. Should republishing re-run generation (new portrait art), or only
   re-composite existing assets through the renderer? The first costs a
   Gemini image call per card and changes how cards look; the second is
   free and pixel-stable except where the template changed.
8. Rendering today only happens in the operator's browser —
   `uploadRenderedCardImage` in the studio's `app.js` needs decoded fonts,
   frame, portrait, and gem assets on a canvas. Is a browser-driven bulk
   loop (open the studio, click once, watch it churn) acceptable, or do we
   need a headless/server-side render path? A headless path is a
   prerequisite for the agent ever publishing a card unattended.
9. Should a republish preserve provenance (`template_version`,
   `style_version`, `prompt_version` unchanged) or stamp cards with the
   current versions? Today those fields mean "this is what produced this
   card", and the repo has no bulk restyle by design.
10. What happens to the old R2 blobs when a card's `battler_image` hash
    changes — leave them (cheap, immutable, unreferenced) or add a
    sweep? Note the public image route stops serving them the moment they
    stop being some `battle_ready` card's current image.
11. What should a partial failure do? If 3 of 40 cards fail to render, do
    we publish the 37, roll back, or leave the run resumable? Is a
    per-card error report needed in the UI?
12. Is there a card count and a rough breakdown available (total /
    published / archived / missing image)? That decides whether this is a
    button, a script, or a background job.

## C. `demos/4/battler`

13. What is demo 4 in one sentence, and what does it do that demo 3
    doesn't? "Next battler" could mean richer rules, an agent-editable
    game, multiplayer, or just a nicer front end.
14. Demo 3 is already a fork of demo 2's `TcgDisplayLayer.jsx`
    (`CardPoolBattler.jsx`, same engine, different deck source). Is demo 4
    a third fork, or is this the moment to extract a shared engine module
    the demos import? A third copy makes "modify the game" three times as
    expensive.
15. Does demo 4 need card fields the pool doesn't expose today?
    `listBattleReadyCards` deliberately projects down to `id`, `name`,
    `power`, `rarity`, `image`. Abilities, cost, type, or text would need
    both a card schema bump (`migrate.js` is at v3) and a wider public
    payload.
16. If cards grow new fields, does the printed card need to show them —
    i.e. does `template.json` and the frame art need a new text slot? That
    pulls in the fixture-generation pipeline and the aperture invariants.
17. Should demo 4 keep demo 3's behaviours: daily-seeded reproducible
    decks, rarity weighting, and a fixed fallback deck when the pool is
    empty or the fetch fails?
18. Is the opponent still the scripted AI from demo 2, or does demo 4 want
    a real opponent model (better heuristics, or an LLM-driven one)? An
    LLM opponent makes a public unauthenticated demo cost money per play.
19. Build story: demo 3 is bundled with an ad-hoc `esbuild` invocation
    documented in its README, with no committed toolchain and no
    dependencies in `package.json`. Same approach for demo 4, or is it
    time for a committed build script?
20. Slug and numbering — `demos/4/battler` as written, or a more specific
    slug? It needs a title and description for `demos/manifest.json`, and
    the sounds directory is currently copied per demo.

## D. The agent — where it runs, and its guardrails

21. Where does the agent execute: (a) Claude Code against this repo,
    driven by a skill; (b) server-side in the Worker, calling a model API
    per request; or (c) in the studio browser page? Only (a) can change
    game code; only (b) can run unattended; (c) inherits the browser's
    render ability for free.
22. Which model and provider? Everything today goes through Gemini
    (`src/gemini.js`, `GEMINI_API_KEY`). An Anthropic-backed agent means a
    new secret, a new client module, and a second provider to keep working.
23. Interaction shape: a chat panel in the studio, or a fire-and-review
    batch run? Chat implies conversation state; batch implies a run record
    and a results screen.
24. Cloudflare Workers cap per-request CPU and wall time, so a long
    multi-call agent loop can't live in one `fetch`. Are we willing to add
    Queues, Durable Objects, or Cron Triggers to `wrangler.toml`, or must
    the agent be chunked into short client-driven steps?
25. Cost control: what is the ceiling on a single run (max cards, max
    model calls, max spend), and is there a kill switch mid-run? The
    studio is gated by one shared password, so anyone with it can spend.
26. Does agent output always land as unpublished drafts for a human to
    review and publish, or may the agent publish to the public pool
    itself? Every existing gate in this codebase (`publishCard`, gem
    `approve`) is a deliberate one-way human action.
27. What audit trail do we want? `interactions` records portrait revision
    turns today. Do agent runs need their own append-only table (prompt,
    model, cost, what it touched, outcome) so a bad run is explainable and
    reversible?
28. Testing: `src/test/` runs under `node --test` with no network and no
    dependencies, using `fakes.js` stand-ins. Does the agent need to be
    testable the same way — a fake model client and deterministic
    assertions — and is that a hard requirement or a nice-to-have?

## E. Agent: create cards wholesale, with feedback

29. What is the input to a wholesale run — a single theme prompt ("a
    12-card frost faction"), a structured brief (count, rarity mix, power
    curve), or a list of card concepts to flesh out?
30. How many cards is "wholesale" in practice: 5, 20, 100? Each card is at
    minimum one image call plus one text call, so this sets the whole
    cost and runtime shape.
31. Whose feedback is "with feedback"? Three different systems: the agent
    critiquing and revising its own output; a human approving/rejecting
    between passes; or feedback derived from simulated play (this card is
    never worth playing).
32. If it's self-critique, what is the rubric, and should the rubric be
    editable at runtime like prompts and skills — or hardcoded?
33. What does a revision pass actually change: the portrait, the title and
    flavor, the stats, or all three? The portrait path already supports
    threaded revision via `previousInteractionId`; text and stats don't
    have an equivalent loop.
34. Who decides `power` and `rarity` — the agent, or a human afterwards?
    If the agent, what are the balance constraints (a power range per
    rarity, a target curve across the set), and should they be enforced in
    code rather than trusted from the model, the way `flavor.js` enforces
    the character budget?
35. Should the agent avoid duplicating cards already in the pool (same
    name, same concept)? If so, does it read existing cards for context,
    including archived ones?
36. Does a card the agent produces need a gem? Reuse from the approved gem
    pool, or generate a new gem per card (another image call, plus the
    chroma-key mask step, plus an approval gate)?

## F. Agent: create prompts and skills for each generator

37. Prompts are append-only and there are four generators today
    (`portrait`, `flavor`, `gem`, `gem_field_fill`). May the agent commit
    new versions directly, or only propose them for a human to save? Every
    autonomous run otherwise inflates the version history the studio's
    Prompts tab shows.
38. Should agent-authored versions be distinguishable from human ones (an
    author column on `prompts`), and should the same apply to skills?
39. Skills are deliberately unversioned and live —
    `resolveSkills` expands `/name` fresh at generation time, so editing
    one instantly changes every prompt referencing it. May the agent
    *edit* existing skills, or only create new ones? Editing is the
    highest-blast-radius write in the whole system.
40. Skill names are globally unique and lowercase. Do agent-created skills
    need a naming convention or namespace to avoid colliding with
    hand-authored ones?
41. How does the agent know a new prompt version is *better*? Is an eval
    harness in scope (generate N sample cards under the old and new
    prompt, compare), or is this "the agent drafts, a human judges"?
42. Rollback: prompts have no delete, so reverting means appending a copy
    of an older version. Does the studio need an explicit "revert to
    version N" affordance before an agent starts writing versions?
43. Should `GENERATORS` become dynamic — can the agent introduce a new
    generator (say, a name generator or an ability-text generator)? Today
    it's a hardcoded array with hardcoded seed text.

## G. Agent: modify the whole game from a single prompt

44. Where is the line between "the framework" (fixed) and "the game"
    (agent-editable)? Concretely: may it change tuning constants
    (`START_LIFE`, `FIELD_SLOTS`, `DECK_SIZE`, `RARITY_WEIGHT`), the rules
    functions (`strike`, `attack`, `beginTurn`), the animation scripts,
    the visual theme — or all of it?
45. Does "modify" mean editing repo source and rebuilding (a code-writing
    agent that opens a PR), or editing a game-config record the demo
    fetches at runtime? The repo auto-deploys from Workers Builds, so a
    code-writing agent that pushes to `main` is a live deploy.
46. Give three or four example prompts that must work at v1 — e.g. "make
    it three lanes", "add a mana cost", "legendaries strike twice",
    "reskin it as ice". The gap between the first and the third is the
    difference between a config knob and an effects DSL.
47. If it's config-driven, how far does the config layer go: named
    constants only, or a full data-driven rules/effects schema? The
    current battler has rules, layout, and animation choreography all
    hardcoded in one JSX file; extracting any of it is a real refactor.
48. How is a change verified before it goes live? Options: nothing (trust
    it), unit tests over the rules engine, a headless simulation that
    plays N games and checks it terminates and isn't degenerate, or a
    human clicking through a preview.
49. What protects the public demo from a bad change — a preview/staging
    URL, versioned game configs with one-click rollback, or a human
    approval step before anything is visible at `/demos/4/battler/`?
50. Should game changes be versioned and attributable the way prompts are
    (who/what changed it, from what prompt, and the diff), so a bad change
    is both explainable and revertible?

## Assumptions worth confirming

- `package.json` stays dependency-free and there is still no build step
  for the site itself; anything the agent needs at runtime is either
  vanilla or bundled ad hoc like the demos are.
- The public `/api/battler-cards` payload stays minimal and
  unauthenticated, and no gated route gets exposed to the demos.
- The password gate on `/studio-c33f3ea406426b41/` remains the only
  authentication, including for anything the agent exposes.
