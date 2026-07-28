// The reusable, named prompt-snippet pool ("skills") referenced by /name
// from anywhere prompt text is authored: system prompts, portrait
// instructions, flavor guidance. Deliberately NOT versioned like cards or
// prompts — a skill is live, mutable text, and resolveSkills expands it
// fresh every time against whatever it currently says. Editing a skill
// immediately changes every prompt that references it; there is no
// history and no "which version produced this" guarantee here, unlike
// everywhere else in this codebase.
//
// Two rules keep that live resolution from turning into silent breakage,
// since nothing records who references a skill:
//
//   1. A skill is never deleted, only archived. An archived skill still
//      resolves everywhere it is already referenced — it just stops being
//      offered for new use, and the prompt editors flag it as archived.
//   2. A name is immutable once created. Renaming would orphan every
//      existing /name reference exactly the way deleting would. Replacing
//      a skill means creating one under a new name.

const NAME_RE = /^[a-z][a-z0-9-]*$/;
// A slash command must start a token (start-of-string or after whitespace)
// so it doesn't fire inside things like "and/or" or a URL. Case-insensitive
// on the way in; names are normalized to lowercase at rest.
const SLASH_RE = /(?<=^|\s)\/([a-zA-Z][a-zA-Z0-9-]*)/g;

function rowToSkill(row) {
  return {
    id: row.id,
    name: row.name,
    text: row.text,
    archived: row.archived === 1,
    updated_at: row.updated_at,
  };
}

export function isValidSkillName(name) {
  return typeof name === "string" && NAME_RE.test(name);
}

// Returns archived skills too, flagged — the prompt editors need to show
// which references are archived, and resolveSkills needs them to keep
// expanding. Callers that shouldn't offer archived skills for *new* use
// (the autocomplete) filter on `archived` themselves.
export async function listSkills(db) {
  const { results } = await db
    .prepare("SELECT id, name, text, archived, updated_at FROM skills ORDER BY name ASC")
    .all();
  return results.map(rowToSkill);
}

export async function loadSkill(db, id) {
  const row = await db
    .prepare("SELECT id, name, text, archived, updated_at FROM skills WHERE id = ?")
    .bind(id)
    .first();
  return row ? rowToSkill(row) : null;
}

export async function findSkillByName(db, name) {
  const row = await db
    .prepare("SELECT id, name, text, archived, updated_at FROM skills WHERE name = ?")
    .bind(name.toLowerCase())
    .first();
  return row ? rowToSkill(row) : null;
}

export async function createSkill(db, { name, text }) {
  const normalized = typeof name === "string" ? name.toLowerCase() : name;
  if (!isValidSkillName(normalized)) {
    throw new Error("Skill name must start with a letter and contain only letters, digits, and hyphens.");
  }
  // Checks archived skills too — a retired name stays taken, so a new
  // skill can never quietly take over an old one's existing references.
  if (await findSkillByName(db, normalized)) {
    throw new Error(`A skill named "${normalized}" already exists.`);
  }
  const id = `skill_${crypto.randomUUID()}`;
  const updated_at = new Date().toISOString();
  await db
    .prepare("INSERT INTO skills (id, name, text, archived, updated_at) VALUES (?, ?, ?, 0, ?)")
    .bind(id, normalized, typeof text === "string" ? text : "", updated_at)
    .run();
  return loadSkill(db, id);
}

// Text only — see the name-immutability rule at the top of this file.
export async function updateSkill(db, id, { text }) {
  const existing = await loadSkill(db, id);
  if (!existing) return null;
  const updated_at = new Date().toISOString();
  await db
    .prepare("UPDATE skills SET text = ?, updated_at = ? WHERE id = ?")
    .bind(typeof text === "string" ? text : existing.text, updated_at, id)
    .run();
  return loadSkill(db, id);
}

async function setArchived(db, id, archived) {
  const existing = await loadSkill(db, id);
  if (!existing) return null;
  await db
    .prepare("UPDATE skills SET archived = ?, updated_at = ? WHERE id = ?")
    .bind(archived ? 1 : 0, new Date().toISOString(), id)
    .run();
  return loadSkill(db, id);
}

export async function archiveSkill(db, id) {
  return setArchived(db, id, true);
}

export async function unarchiveSkill(db, id) {
  return setArchived(db, id, false);
}

// Expands every /name occurrence in `text` against the current skill pool,
// archived skills included — archiving retires a skill from new use, it
// does not break the prompts already referencing it. An unrecognized slash
// command is left as literal text rather than silently eaten: a typo
// should read as obviously wrong, not vanish.
export async function resolveSkills(db, text) {
  if (!text || !text.includes("/")) return text;
  const skills = await listSkills(db);
  if (skills.length === 0) return text;
  const byName = new Map(skills.map((s) => [s.name, s.text]));
  return text.replace(SLASH_RE, (match, name) => byName.get(name.toLowerCase()) ?? match);
}

// Which archived skills does this text reference? Drives the "you're using
// an archived skill" notice in the prompt editors. Pure so the browser can
// call it against an already-fetched skill list without another round trip.
export function findArchivedReferences(text, skills) {
  if (!text) return [];
  const archived = new Set(skills.filter((s) => s.archived).map((s) => s.name));
  const found = new Set();
  for (const match of text.matchAll(SLASH_RE)) {
    const name = match[1].toLowerCase();
    if (archived.has(name)) found.add(name);
  }
  return [...found];
}
