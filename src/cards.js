// D1 CRUD for cards. The card is stored as one opaque JSON column,
// deliberately not normalized: atomic writes and ORDER BY updated_at are
// the entire query surface a flat pile needs. Filtering to battle-ready
// cards happens in JS after the same flat read, not via a WHERE clause,
// so that stays true.
import { migrateCard, CURRENT_SCHEMA_VERSION, RARITIES } from "../private/c33f3ea406426b41/cards/migrate.js";
import { isValidHash } from "./blobs.js";

// The studio's own sidebar list. Archived cards are excluded by default —
// that's the whole point of archiving, to stop taking up space here — but
// archivedOnly flips it to show *only* archived cards, for the one place
// that needs to see them again: unarchiving. Enriched with power/rarity/
// battle_ready/archived (not just title) so the sidebar can show status at
// a glance without opening every card.
export async function listCards(db, { archivedOnly = false } = {}) {
  const { results } = await db
    .prepare("SELECT id, json, updated_at FROM cards ORDER BY updated_at DESC")
    .all();
  return results
    .map((row) => ({ updated_at: row.updated_at, card: migrateCard(JSON.parse(row.json)) }))
    .filter(({ card }) => (archivedOnly ? card.archived === true : !card.archived))
    .map(({ updated_at, card }) => ({
      id: card.id,
      title: card.title,
      updated_at,
      power: card.power,
      rarity: card.rarity,
      battle_ready: card.battle_ready,
      archived: card.archived,
    }));
}

// Shared by every read that decides what's actually in the public pool.
// `battle_ready` alone isn't trusted: it's a flag written at some point in
// the past, and the rules for what counts as valid can tighten later (the
// image requirement was added after some cards had already been published
// under the older rules). Re-checking here means a stale flag can't leave a
// half-valid card — say, missing art — sitting in the public pool forever;
// it just needs a re-publish to satisfy the current rules again.
function isBattleReady(card) {
  return card.battle_ready === true && hasValidBattleStats(card);
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
    .filter(isBattleReady)
    .map((card) => ({
      id: card.id,
      name: card.title,
      power: card.power,
      rarity: card.rarity,
      imageHash: card.battler_image,
    }));
}

// Does `hash` belong to the currently published render of some battle-ready
// card? This is the check behind the public image route: it must stay true
// only for the one blob a battle_ready card currently points at, never for
// raw portrait/gem art or a hash a card has since moved away from.
export async function isPublishedImageHash(db, hash) {
  const { results } = await db.prepare("SELECT id, json, updated_at FROM cards").all();
  return results.some((row) => {
    const card = migrateCard(JSON.parse(row.json));
    return isBattleReady(card) && card.battler_image === hash;
  });
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
    !card.archived &&
    typeof card.power === "number" &&
    Number.isFinite(card.power) &&
    card.power > 0 &&
    RARITIES.includes(card.rarity) &&
    isValidHash(card.battler_image)
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
//
// imageHash is a blob hash the caller has *already uploaded* (via the
// existing api/blobs route) — a flattened PNG of the rendered card,
// captured client-side at publish time since that's the one moment the
// operator's browser definitely has the frame/portrait/gem assets loaded.
// publishCard only records the hash; it never renders or uploads anything
// itself, same division of labor as saveCard not touching portraits.
export async function publishCard(db, id, { imageHash } = {}) {
  const card = await loadCard(db, id);
  if (!card) return { notFound: true };
  if (card.archived) {
    return { error: "Card is archived — unarchive it before publishing." };
  }
  if (typeof card.power !== "number" || !Number.isFinite(card.power) || card.power <= 0) {
    return { error: "Card needs a positive numeric power stat before it can be published." };
  }
  if (!RARITIES.includes(card.rarity)) {
    return { error: `Card needs a rarity (one of: ${RARITIES.join(", ")}) before it can be published.` };
  }
  const battler_image = imageHash || card.battler_image;
  if (!isValidHash(battler_image)) {
    return { error: "A rendered card image is required to publish — re-render the preview and try again." };
  }
  const saved = await saveCard(db, id, { ...card, battler_image, battle_ready: true });
  return { card: saved };
}

// Archiving pulls a card out of the pool immediately (battle_ready: false,
// set explicitly rather than left to hasValidBattleStats to catch) and out
// of the studio's default card list (see listCards' archivedOnly filter).
// It's the soft kind: unarchiveCard reverses the flag, but never restores
// battle_ready on its own — getting back into the public pool is always a
// deliberate re-publish, the same as any other battle_ready transition.
export async function archiveCard(db, id) {
  const card = await loadCard(db, id);
  if (!card) return { notFound: true };
  const saved = await saveCard(db, id, { ...card, archived: true, battle_ready: false });
  return { card: saved };
}

export async function unarchiveCard(db, id) {
  const card = await loadCard(db, id);
  if (!card) return { notFound: true };
  const saved = await saveCard(db, id, { ...card, archived: false });
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
