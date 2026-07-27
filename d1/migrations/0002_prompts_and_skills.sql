-- System prompts (per generator) and the reusable "skill" snippet pool
-- referenced from prompt/instruction text via /name.
--
-- prompts is append-only, same discipline as the card schema: never
-- UPDATE a row, INSERT the next version instead, so a stored version
-- number always resolves to the exact text that produced whatever used
-- it (a card's style_version/prompt_version, in particular).
--
-- skills is the opposite on purpose: a small, live, editable pool with no
-- version history. /name resolves against whatever a skill currently
-- says, every time something is generated — editing a skill immediately
-- changes every prompt that references it.

CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  generator TEXT NOT NULL,
  version INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(generator, version)
);

CREATE INDEX idx_prompts_generator ON prompts (generator, version);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
