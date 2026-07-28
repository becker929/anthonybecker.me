# Card battler agent — decisions, and what they leave open

Round 1 questions are in `card-battler-agent-elicitation.md`. This records
the answers so far, what each settles, and what's still open.

(Decisions are numbered plainly — an earlier draft labelled them D1, D2,
… in a repo where D1 is the database. Sorry.)

## Decided

**1. Headless rendering is in scope.** The browser-only render path stops
being a constraint, which is what unlocks both the bulk republish and the
agent producing cards without an operator sitting in the studio. A new
headless renderer will be built rather than driving the existing one
through a browser — see open question 8, which is the one real
complication.

**2. Demo forks are intentional.** The site is a monolith of demos
decoupled by directory: each demo owns its engine, its assets, and its
copies, and a published demo is frozen work. `demos/3/cards` forking
`demos/2/card-battler` is the pattern, not debt. No shared engine module,
no cross-demo deduplication — recorded in `CLAUDE.md` so it stops coming
up.

**3. Config only, and no rule changes in v1.** What we are building now is
a *config authoring tool*: tuning, layout, and theme. Rules resolution
stays exactly as the engine implements it. A rule authoring tool comes
later, and it arrives with its own new demo — which, per decision 2, means
its own engine fork and its own agent, not a retrofit of this one.

**4. One agent owns one demo.** The engine is handed to the agent, fixed.

**5. The agent has a skills-management toolset**, including a tool that
finds which prompts reference a given skill. Skill editing is therefore
allowed rather than forbidden — reference discovery is the safety
mechanism. See open question 13: that tool cannot be complete until
question 11 is fixed.

**6. The config is pulled at runtime.** Stored server-side and fetched by
the demo, so changing the game needs no deploy — the same move prompts
made when they left source for the database.

**7. The agent runs in the Worker.**

**8. Publishing stays human, in bulk.** There is a "publish all" button.
The agent fills the draft pool; a person releases it. This is the same
one-way gate `publishCard` and gem approval already are, and it doubles as
the mechanism for the republish item in `docs/TODO.md`.

**9. Terminology: "user prompts of various purposes."** Instruction,
guidance, theme, and user_prompt collapse into one concept with a purpose
tag. See question 11 — today they are not even stored consistently.

## What decision 3 implies

The engine's config surface is a hard ceiling on what the agent can ever
express, so designing that surface *is* the `demos/4/battler` work; the
fork itself is mechanical. It also makes verification cheap: an agent that
can only emit config is checkable against a schema before anything is
stored.

## Open

### Config surface and storage

1. Which knobs at v1? From the current engine's constants: `START_LIFE`,
   `FIELD_SLOTS`, `OPENING_HAND`, `DECK_SIZE`, `RARITY_WEIGHT`, the `INK`
   palette, the `PACING`/timing values, and the `HAND`/`FIELD`/`CARD`
   layout geometry. What's missing, what would you cut?
2. Does the config also select *content* — which cards or rarities this
   demo draws from — or only mechanics and theme? `/api/battler-cards`
   returns everything published, to every demo.
3. Versioned append-only like `prompts`, so a config is reconstructable
   and revertible — or mutable with no history like `skills`? The agent
   writing configs unattended argues for the former.
4. Does a config save go live immediately, or is there a draft/preview
   step before the public demo picks it up? Note decision 8 puts a human
   gate on cards; configs currently have no equivalent.
5. Does the engine ship defaults and fall back to them when the config is
   missing, invalid, or unreachable — the way demo 3 falls back to fixed
   decks on an empty pool?
6. One config per demo, or a pool of named configs the demo picks from?
7. Public read endpoint shape and caching — the demo fetches it
   unauthenticated at load, like `/api/battler-cards`?

### The headless renderer

8. **How does text get rasterized?** This is the one hard part.
   Workers have no Canvas API, and the existing renderer is canvas-bound
   (`fit-text.js` measures with `ctx.measureText`, and the README's
   standing rule is to `await document.fonts.ready` before rendering
   because metrics are wrong until webfonts load). Three ways out:
   (a) Cloudflare's Browser Rendering binding, which runs the *existing*
   `renderer.js` headlessly — no reimplementation, but a paid binding;
   (b) a pure JS/WASM renderer in the Worker — needs font metrics and a
   glyph rasterizer plus PNG encoding, and sits awkwardly against the
   deliberate no-dependencies rule in `package.json`;
   (c) (b), then move the studio's own preview onto it too.
9. Under (b), the studio preview and the published image become two
   implementations of one layout, free to drift. Is that acceptable, or
   is single-renderer a requirement — making (a) or (c) the only options?
10. Is the card lifecycle now draft → render → publish, with render as its
    own re-runnable stage? That makes "republish all" a render pass over a
    selection, and pairs naturally with the publish-all button.

### User prompts (decision 9)

11. **Two of the three kinds are currently discarded.** As it stands:
    portrait instructions are stored *twice* (`card.portrait.user_prompt`
    plus every `lineage[].instruction`, and again as an `interactions`
    row); flavor `guidance` is used to build the model input and then
    dropped — only `{text, source, prompt_version}` survives; gem
    `instruction` is never stored at all, and the `gems` table has no
    column for it, even though `gem_field_fill` may have *written* that
    instruction itself when the operator left it blank. Confirm the target
    is: every user prompt is stored, once, uniformly.
12. Proposed shape — one append-only table, `user_prompts`: `id`,
    `purpose`, `subject_id`, `seq`, `text`, `created_at`. Purposes at v1:
    `portrait_instruction`, `flavor_guidance`, `gem_instruction`; later
    `card_brief` and `config_brief` for the agent's own inputs. Does that
    fit?
13. Text must be stored **unresolved**, with `/name` intact — that is
    already the portrait path's rule, and it's what makes the
    find-references tool possible at all. Note the consequence: until
    question 11 is fixed, a reverse lookup for a skill cannot see flavor
    or gem references, because that text no longer exists anywhere.
14. Does `interactions` fold into this table, or stay? It exists as a
    durable audit log written *alongside* the card's embedded lineage,
    deliberately, so history survives a lost card write. That rationale
    still holds and argues for keeping a table — the question is whether
    it becomes this one.
15. Does the card JSON keep its embedded `portrait.user_prompt` and
    `lineage` as the redundant copy, or become a reference into the new
    table? The former needs no card migration; the latter would be
    `schema_version` 4.
16. Scope of the find-references tool: current prompt versions only or all
    history, and does it cover the stored user prompts too? Can skills
    reference other skills?
17. What should renaming or deleting a referenced skill do — blocked,
    warned, or allowed? Today an unresolved `/name` is deliberately left
    as literal text rather than dropped, so a delete degrades visibly.

### Wholesale card creation

18. Batch size per run, and who sets `power` and `rarity` — the agent
    within enforced balance constraints, or a human before publish-all?
19. What "feedback" means: agent self-critique, a human gate between
    passes, or feedback from simulated play.
20. The ceiling on a single run — max cards, max model calls, or a spend
    cap — and whether there's a mid-run kill switch. The studio is behind
    one shared password, and the agent now runs server-side.
