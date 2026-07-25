// D1 CRUD for cards (§9). The card is stored as one opaque JSON column —
// deliberately not normalized, per the design brief: atomic writes and
// ORDER BY updated_at are the entire query surface a flat pile needs.
import { migrateCard, CURRENT_SCHEMA_VERSION } from "../private/c33f3ea406426b41/cards/migrate.js";

export async function listCards(db) {
  const { results } = await db
    .prepare("SELECT id, json, updated_at FROM cards ORDER BY updated_at DESC")
    .all();
  return results.map((row) => {
    const card = JSON.parse(row.json);
    return { id: row.id, title: card.title, updated_at: row.updated_at };
  });
}

// Returns null if not found. Applies schema migration on read (§5) so
// callers always see a current-version card regardless of what's stored.
export async function loadCard(db, id) {
  const row = await db.prepare("SELECT json FROM cards WHERE id = ?").bind(id).first();
  if (!row) return null;
  return migrateCard(JSON.parse(row.json));
}

// Upsert. `id` is the URL-authoritative id (must match card.id). The server
// sets updated_at itself — no trusting a client-supplied clock.
export async function saveCard(db, id, card) {
  if (card.id !== id) {
    throw new Error("Card id in the body does not match the URL id.");
  }
  if (typeof card.schema_version !== "number") {
    throw new Error("Card is missing schema_version.");
  }
  if (card.schema_version !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Card schema_version ${card.schema_version} is not current (${CURRENT_SCHEMA_VERSION}); migrate before saving.`,
    );
  }
  const updated_at = new Date().toISOString();
  const stored = { ...card, updated_at };
  await db
    .prepare(
      `INSERT INTO cards (id, schema_version, json, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version,
         json = excluded.json, updated_at = excluded.updated_at`,
    )
    .bind(id, card.schema_version, JSON.stringify(stored), updated_at)
    .run();
  return stored;
}
