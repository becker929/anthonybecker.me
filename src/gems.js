// D1 CRUD for the shared gem pool (§8/§9). Unlike cards, gems are stored
// in real columns rather than an opaque blob — the brief's schema for this
// table already names each field, and there's no free-form per-gem shape
// to preserve.
function rowToGem(row) {
  return {
    id: row.id,
    name: row.name,
    palette: JSON.parse(row.palette),
    key_color: row.key_color,
    raw_hash: row.raw_hash,
    mask_params: JSON.parse(row.mask_params),
    approved: !!row.approved,
    created_at: row.created_at,
  };
}

export async function listGems(db, { approvedOnly = false } = {}) {
  const sql = approvedOnly
    ? "SELECT * FROM gems WHERE approved = 1 ORDER BY created_at DESC"
    : "SELECT * FROM gems ORDER BY created_at DESC";
  const { results } = await db.prepare(sql).all();
  return results.map(rowToGem);
}

export async function loadGem(db, id) {
  const row = await db.prepare("SELECT * FROM gems WHERE id = ?").bind(id).first();
  return row ? rowToGem(row) : null;
}

// New gems always start unapproved (§8: "must be explicitly approved
// before entering the pool").
export async function insertGem(db, { id, name, palette, keyColor, rawHash, maskParams }) {
  const created_at = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO gems (id, name, palette, key_color, raw_hash, mask_params, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(id, name, JSON.stringify(palette), keyColor, rawHash, JSON.stringify(maskParams), created_at)
    .run();
  return loadGem(db, id);
}

// Raw art and key_color are immutable once generated (the model was
// already told to paint that background) — only the mask tuning
// parameters are meant to change as the operator dials them in.
export async function updateGemMaskParams(db, id, maskParams) {
  const existing = await loadGem(db, id);
  if (!existing) return null;
  await db.prepare("UPDATE gems SET mask_params = ? WHERE id = ?").bind(JSON.stringify(maskParams), id).run();
  return loadGem(db, id);
}

export async function approveGem(db, id) {
  const existing = await loadGem(db, id);
  if (!existing) return null;
  await db.prepare("UPDATE gems SET approved = 1 WHERE id = ?").bind(id).run();
  return loadGem(db, id);
}
