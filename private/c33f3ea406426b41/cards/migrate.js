// Schema migration, applied on read (§5: "migration is a function per
// version bump, applied on read. Keep it boring."). runMigrations is the
// generic dispatcher; migrateCard wires it to the real registry. Kept
// separate so the dispatch mechanism is unit-testable without a real
// multi-version history to exercise it against.

export const CURRENT_SCHEMA_VERSION = 1;

// Keyed by the version a card is migrating FROM. migrations[N] takes a
// schema_version-N card and returns a schema_version-(N+1) card.
const MIGRATIONS = {
  // No migrations yet — schema_version 1 is the only version that has
  // ever existed.
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
