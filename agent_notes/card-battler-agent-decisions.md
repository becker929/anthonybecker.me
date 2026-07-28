# Card battler agent — decisions, and what they leave open

Round 1 questions are in `card-battler-agent-elicitation.md`. This records
the answers, what each one settles, and the follow-ups they create.

## Decided

**D1. Headless rendering is in scope.** The browser-only render path stops
being a constraint. This is the unlock for both the bulk republish and for
the agent producing cards that can reach the public pool without an
operator sitting in the studio with a canvas open.

**D2. Demo forks are intentional.** The site is a monolith of demos
decoupled by directory: each demo owns its engine, its assets, and its
copies, and a published demo is frozen work. `demos/3/cards` forking
`demos/2/card-battler` is the pattern, not debt. `demos/4/battler` forks
again. No shared engine module, no cross-demo deduplication — recorded in
`CLAUDE.md` so it stops coming up.

**D3. Config only.** The agent never writes engine code. "Modify the whole
game from a single prompt" means writing a game config that the engine
reads; the engine is a given, fixed per agent.

**D4. One agent owns one demo.** The agent is the owner of its demo, and
its engine is handed to it. Later demos get later agents.

**D5. The agent has a skills-management toolset**, including a tool that
finds which prompts reference a given skill. Skill editing is therefore
allowed rather than forbidden — reference discovery is the safety
mechanism, replacing the blast-radius worry raised in round 1 (Q39).

## What D3 implies

The engine's config surface is a hard ceiling on what the agent can ever
express. "Make it three lanes" is possible only if lane count is a config
key; if it isn't, no prompt reaches it. So designing that surface *is* the
`demos/4/battler` design work — the engine fork is comparatively
mechanical, and the config schema is the part worth getting right.

It also makes verification tractable: an agent that can only emit config
can be checked against a schema before anything is stored, rather than
needing the change reviewed as code.

## Open — round 2

### Config surface and storage

1. Which knobs must exist at v1? A starting list from the current engine's
   constants: `START_LIFE`, `FIELD_SLOTS`, `OPENING_HAND`, `DECK_SIZE`,
   `RARITY_WEIGHT`, the `INK` palette, and the `PACING`/timing values.
   What's missing from that, and what would you cut?
2. Does the config reach into rules resolution (how a strike works, turn
   structure), or is v1 limited to tuning, layout, and theme? This is the
   single biggest scoping question left.
3. Does the config also select *content* — which cards or rarities this
   demo's pool draws from — or only mechanics and theme? Today
   `/api/battler-cards` returns everything published.
4. Where does the config live: a D1 table the demo fetches at runtime (no
   deploy to change the game, matching how prompts moved to D1), or a JSON
   file in the demo directory (deploy per change, matching how demos are
   otherwise self-contained)?
5. Versioned append-only like `prompts`, so a config version is
   reconstructable and revertible — or mutable with no history like
   `skills`?
6. Does a config save go live immediately, or is there a draft/preview
   step before the public demo picks it up, mirroring the deliberate
   publish gate on cards and gems?
7. Should the engine ship defaults and fall back to them when a config is
   missing, invalid, or unreachable — the way demo 3 falls back to fixed
   decks on an empty pool?

### Headless rendering

8. Where does it run: a Playwright script (matching the existing
   `test:render` and `fixtures` pattern — ad-hoc install, runs outside the
   Worker), or Cloudflare's Browser Rendering binding so the Worker can do
   it inline? The first is free and already a repo idiom but can't be
   triggered by a server-side agent; the second costs money and adds a
   binding.
9. If it's a script: does it become a committed, routinely-run path (CI,
   cron, a documented command), and may the agent trigger it — or does a
   human run it and the agent's cards simply wait?
10. Is the card lifecycle now draft → render → publish as three distinct
    steps, with render as its own stage that can be re-run in bulk? That
    would make "republish all cards" just a render pass over a selection.

### Agent execution and tools

11. Still open from round 1 (Q21): where does the agent actually execute —
    Claude Code against this repo, server-side in the Worker, or in the
    studio page? D3 makes the Worker viable, since nothing needs to touch
    source. Which is it?
12. Beyond skills management, what's the full tool surface? Proposed:
    list/create/update/delete skill; find prompts referencing a skill;
    list prompts and create a prompt version; list/read/write cards;
    generate portrait, flavor, and gem; render and publish; read and write
    the game config. What's missing, and what should it *not* have?
13. Scope of the find-references tool: current prompt versions only, or
    all history? Does it also search per-card instruction and guidance
    text, where `/name` equally resolves? Do skills reference other skills?
14. What should renaming or deleting a referenced skill do — blocked,
    warned, or allowed? Today an unresolved `/name` is deliberately left as
    literal text rather than silently dropped, so a delete degrades
    visibly rather than dangerously.
15. Does an agent see only its own demo's config and pool, or everything?
    D4 says one agent owns one demo, which implies scoping, but the card
    pool is currently shared across all battler demos.

### Wholesale card creation (carried over from round 1)

16. Batch size per run, and who sets `power` and `rarity` — the agent
    within enforced balance constraints, or a human afterwards?
17. What "feedback" means: agent self-critique, a human gate between
    passes, or feedback derived from simulated play.
18. Do agent-made cards land as drafts for a human to publish, or may the
    agent publish to the public pool itself?
19. The ceiling on a single run — max cards, max model calls, or a spend
    cap — and whether there's a mid-run kill switch.
