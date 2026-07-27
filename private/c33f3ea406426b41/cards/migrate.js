// Schema migration, applied on read: one function per version bump, kept
// deliberately boring. runMigrations is the
// generic dispatcher; migrateCard wires it to the real registry. Kept
// separate so the dispatch mechanism is unit-testable without a real
// multi-version history to exercise it against.

export const CURRENT_SCHEMA_VERSION = 3;

// Valid rarity tags. Order is significant elsewhere (deck-weighting in the
// battler demo) — rarer tiers come last.
export const RARITIES = ["common", "uncommon", "rare", "legendary"];

// Keyed by the version a card is migrating FROM. migrations[N] takes a
// schema_version-N card and returns a schema_version-(N+1) card.
const MIGRATIONS = {
  // v1 cards predate the battler integration: no power stat was ever
  // collected, so `power` defaults to null (not battle-ready) rather than
  // a guessed number. `battle_ready` is a one-way gate flipped by
  // publishCard() once an operator sets a real power and rarity and the
  // studio has rendered+uploaded a flattened PNG of the card as
  // `battler_image` (a blob hash, same scheme as portrait/gem art).
  1: (card) => ({
    ...card,
    schema_version: 2,
    power: null,
    rarity: "common",
    battle_ready: false,
    battler_image: null,
  }),
  // v2 cards predate archiving. `archived` defaults false so nothing already
  // published silently disappears from the pool the moment this migration
  // runs. Unlike the v1->v2 step, v2 shipped to production before this was
  // written, so this is a genuine new step rather than an amendment to it —
  // real cards exist at schema_version 2 and must migrate forward, not be
  // rewritten in place.
  2: (card) => ({
    ...card,
    schema_version: 3,
    archived: false,
  }),
};

export function runMigrations(card, migrations, currentVersion) {
  if (typeof card.schema_version !== "number") {
    throw new Error("Card is missing schema_version.");
  }
  if (card.schema_version > currentVersion) {
    throw new Error(
      `Card schema_version ${card.schema_version} is newer than this app understands (${currentVersion}).`,
    );
  }
  let result = card;
  while (result.schema_version < currentVersion) {
    const before = result.schema_version;
    const step = migrations[before];
    if (!step) {
      throw new Error(`No migration registered from schema_version ${before}.`);
    }
    result = step(result);
    if (!(result.schema_version > before)) {
      throw new Error("Migration step did not advance schema_version.");
    }
  }
  return result;
}

export function migrateCard(card) {
  return runMigrations(card, MIGRATIONS, CURRENT_SCHEMA_VERSION);
}
