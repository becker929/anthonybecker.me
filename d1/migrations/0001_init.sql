-- Trading card design system: cards, gems, interactions (§9 of the design brief).
-- Cards are stored as an opaque JSON blob deliberately — atomic writes and
-- ORDER BY updated_at are the entire query surface a flat pile needs.

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_cards_updated_at ON cards (updated_at);

CREATE TABLE gems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  palette TEXT NOT NULL,
  key_color TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  mask_params TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE interactions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  asset_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_interactions_card_id ON interactions (card_id, seq);
