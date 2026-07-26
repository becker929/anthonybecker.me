// D1 CRUD for cards. The card is stored as one opaque JSON column,
// deliberately not normalized: atomic writes and ORDER BY updated_at are
// the entire query surface a flat pile needs. Filtering to battle-ready
// cards happens in JS after the same flat read, not via a WHERE clause,
// so that stays true.
import { migrateCard, CURRENT_SCHEMA_VERSION, RARITIES } from "../private/c33f3ea406426b41/cards/migrate.js";

export async function listCards(db) {
  const { results } = await db
    .prepare("SELECT id, json, updated_at FROM cards ORDER BY updated_at DESC")
    .all();
  return results.map((row) => {
    const card = JSON.parse(row.json);
    return { id: row.id, title: card.title, updated_at: row.updated_at };
  });
}

// The public, unauthenticated read path for the card-battler demos: only
// cards an operator has explicitly published (see publishCard below),
// projected down to the fields a battler needs. No prompts, lineage, or
// interaction ids — those stay behind the studio's password gate.
export async function listBattleReadyCards(db) {
  const { results } = await db
    .prepare("SELECT id, json, updated_at FROM cards ORDER BY updated_at DESC")
    .all();
  return results
    .map((row) => migrateCard(JSON.parse(row.json)))
    .filter((card) => card.battle_ready === true)
    .map((card) => ({ id: card.id, name: card.title, power: card.power, rarity: card.rarity }));
}

// Returns null if not found. Applies schema migration on read so
// callers always see a current-version card regardless of what's stored.
export async function loadCard(db, id) {
  const row = await db.prepare("SELECT json FROM cards WHERE id = ?").bind(id).first();
  if (!row) return null;
  return migrateCard(JSON.parse(row.json));
}

// Shared by saveCard and publishCard so "battle_ready implies a real power
// and rarity" holds no matter which path set it, not just at the moment
// publishCard flips it.
function hasValidBattleStats(card) {
  return (
    typeof card.power === "number" &&
    Number.isFinite(card.power) &&
    card.power > 0 &&
    RARITIES.includes(card.rarity)
  );
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
  // A save can never smuggle a card into the battle-ready pool without
  // valid stats — if an edit invalidated power/rarity after publishing,
  // this silently drops battle_ready back to false rather than rejecting
  // the whole save (the operator is mid-edit, not asking to publish).
  const battle_ready = card.battle_ready === true && hasValidBattleStats(card);
  const stored = { ...card, battle_ready, updated_at };
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

// The one-way gate into the public battler pool, mirroring how gems start
// unapproved and only POST .../approve lets them into the shared pool.
// Deliberately not folded into saveCard: a card is built incrementally
// (title, then portrait, then flavor, ...) and shouldn't be blocked from
// saving mid-edit just because power/rarity aren't set yet.
export async function publishCard(db, id) {
  const card = await loadCard(db, id);
  if (!card) return { notFound: true };
  if (typeof card.power !== "number" || !Number.isFinite(card.power) || card.power <= 0) {
    return { error: "Card needs a positive numeric power stat before it can be published." };
  }
  if (!RARITIES.includes(card.rarity)) {
    return { error: `Card needs a rarity (one of: ${RARITIES.join(", ")}) before it can be published.` };
  }
  const saved = await saveCard(db, id, { ...card, battle_ready: true });
  return { card: saved };
}

// Durable audit log for portrait revision turns (the `interactions`
// table). Written alongside the card's embedded lineage, not instead of
// it — this is what still lets you reconstruct history if a card write
// were ever lost, since it's a plain append-only insert.
export async function recordInteraction(db, { cardId, seq, instruction, assetHash }) {
  const created_at = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO interactions (id, card_id, seq, instruction, asset_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), cardId, seq, instruction, assetHash, created_at)
    .run();
}
