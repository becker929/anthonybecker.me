// System prompts per generator, stored in D1 (table `prompts`) instead of
// hardcoded in source — an operator edits them from the studio's Prompts
// tab with no deploy. Still append-only under the hood, the same
// discipline the card schema migrations use: saving never overwrites a
// row, it inserts the next version number for that generator. A card's
// stored style_version/prompt_version always resolves to the exact text
// that produced it, no matter how many later edits happen.
//
// /name references inside a prompt's authored text are NOT expanded at
// save time — see resolveSkills in skills.js. They resolve against the
// live skill pool fresh every time a prompt is actually used for
// generation (resolvedPrompt below), never cached or stored. The raw
// getters (getPromptVersion, getCurrentPrompt, listPromptVersions) return
// the authored text as-is, slash references intact — that's what the
// studio's editor and version history read from.
import { resolveSkills } from "./skills.js";

export const GENERATORS = ["portrait", "flavor", "gem", "gem_field_fill"];

// Substituted into the gem prompt per generation (see gemSystemPrompt) and
// required to be present when saving one (see createPromptVersion).
export const KEY_COLOR_PLACEHOLDER = "{{key_color}}";

// Seed text: exactly what this file hardcoded before prompts moved to D1.
// Used only to populate a generator's very first version, the one time
// its row count is zero. Not a second source of truth to keep in sync —
// once seeded, the database is authoritative and this is never read again
// for that generator.
const SEED_PROMPTS = {
  portrait: {
    1: `You are generating a single character portrait for a trading card game.

Output only the character illustration itself, filling the entire frame
edge to edge. Do not include a card frame, border, mat, vignette, drop
shadow suggesting a frame, text, numbers, logos, watermarks, or any other
card furniture — those are composited on afterward by separate artwork
and would conflict with it if present here.

Style: painterly digital illustration, confident brushwork, dramatic
directional lighting with a clear light source, a restrained and
cohesive color palette (2-3 dominant hues plus accents, not a rainbow).
Frame the subject as a three-quarter or waist-up portrait, facing
slightly off-camera, filling most of the vertical space with a small
amount of environmental background visible behind them — the background
should read as atmosphere, not a busy separate scene.`,

    // v2 exists because the template's aperture became landscape: v1's "filling
    // most of the vertical space" framing composes for a tall crop and reads
    // badly wide. The edge-margin note matters because the renderer cover-fits,
    // trimming a little off the left and right of a 4:3 image.
    2: `You are generating a single character portrait for a trading card game.

Output only the character illustration itself, filling the entire frame
edge to edge. Do not include a card frame, border, mat, vignette, drop
shadow suggesting a frame, text, numbers, logos, watermarks, or any other
card furniture — those are composited on afterward by separate artwork
and would conflict with it if present here.

Style: painterly digital illustration, confident brushwork, dramatic
directional lighting with a clear light source, a restrained and
cohesive color palette (2-3 dominant hues plus accents, not a rainbow).

Composition: this is a wide, landscape frame. Frame the subject as a
three-quarter or chest-up portrait, facing slightly off-camera, centred
horizontally and filling most of the frame's height. Use the width to
either side for environmental background that reads as atmosphere, not a
busy separate scene. Keep the subject's head and any critical detail well
inside the middle of the frame and away from the left and right edges —
a narrow strip along each vertical edge may be cropped.`,
  },

  flavor: {
    1: `You write short flavor text for a trading card game.

Output only the flavor text itself: no quotation marks around it, no
title, no preamble like "Here's the flavor text:", no explanation
afterward. One or two sentences, evocative and specific rather than
generic, matching the mood and concept described in the instruction. Stay
within the character budget given in the instruction — noticeably
shorter than the budget is fine, going over it is not.`,
  },

  // Not versioned/stored per-gem before this moved to D1 either — the gems
  // table has no prompt-version column, and only portraits need style
  // provenance. {{key_color}} is substituted after skill resolution (see
  // gemSystemPrompt) since it's chosen per-generation and can't live in
  // the stored template text.
  gem: {
    1: `You are generating a single small icon-style game asset: an
energy gem or crystal, centered and filling most of the frame, viewed as a
clean game-UI icon rather than a scene.

The background MUST be a single flat, solid, unbroken fill of exactly
{{key_color}} — no gradient, no texture, no shadow, no other objects, and
none of that color anywhere on the gem itself. This flat background is
required for post-processing (chroma-key removal), and its exact,
uniform color matters more than how natural it looks.

Style: simple, readable, slightly stylized digital illustration with
clear specular highlights suggesting a faceted or polished surface.`,
  },

  gem_field_fill: {
    1: `You help complete a trading-card energy gem's fields for an
internal card-creation tool. The operator has supplied some of: name (a
short evocative 2-4 word title), instruction (one or two sentences
describing the gem's appearance, for an image-generation prompt), and
palette (1-3 "#rrggbb" hex colors capturing the gem's color scheme).

You will be told which fields are already known and which are missing.
Infer ONLY the missing fields, staying consistent with whatever was
supplied. Respond with a single minified JSON object containing exactly
the missing field names as keys — no markdown fences, no commentary, no
extra keys. "palette" values must be lowercase "#rrggbb" hex strings.`,
  },
};

function assertGenerator(generator) {
  if (!GENERATORS.includes(generator)) {
    throw new Error(`Unknown generator "${generator}".`);
  }
}

async function ensureSeeded(db, generator) {
  const { count } = await db
    .prepare("SELECT COUNT(*) as count FROM prompts WHERE generator = ?")
    .bind(generator)
    .first();
  if (count > 0) return;
  const versions = SEED_PROMPTS[generator];
  for (const version of Object.keys(versions).map(Number).sort((a, b) => a - b)) {
    await db
      .prepare("INSERT INTO prompts (id, generator, version, text, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(`prompt_${crypto.randomUUID()}`, generator, version, versions[version], new Date().toISOString())
      .run();
  }
}

// Raw text as authored (may contain /name references) — for the studio's
// editor and version history. Never for sending to a model directly.
export async function getPromptVersion(db, generator, version) {
  assertGenerator(generator);
  await ensureSeeded(db, generator);
  const row = await db
    .prepare("SELECT version, text, created_at FROM prompts WHERE generator = ? AND version = ?")
    .bind(generator, version)
    .first();
  if (!row) throw new Error(`Unknown ${generator} prompt version ${version}.`);
  return row;
}

export async function getCurrentPrompt(db, generator) {
  assertGenerator(generator);
  await ensureSeeded(db, generator);
  // ensureSeeded guarantees at least one row exists for this generator.
  return db
    .prepare("SELECT version, text, created_at FROM prompts WHERE generator = ? ORDER BY version DESC LIMIT 1")
    .bind(generator)
    .first();
}

export async function listPromptVersions(db, generator) {
  assertGenerator(generator);
  await ensureSeeded(db, generator);
  const { results } = await db
    .prepare("SELECT version, text, created_at FROM prompts WHERE generator = ? ORDER BY version DESC")
    .bind(generator)
    .all();
  return results;
}

export async function listCurrentPrompts(db) {
  const rows = [];
  for (const generator of GENERATORS) {
    rows.push({ generator, ...(await getCurrentPrompt(db, generator)) });
  }
  return rows;
}

// Always creates a new version — there is no in-place edit. Saving
// identical text still creates a new row; it's the studio UI's job to
// disable Save when nothing changed, not this function's.
export async function createPromptVersion(db, generator, text) {
  assertGenerator(generator);
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Prompt text is required.");
  }
  // The gem prompt is the one place a placeholder is load-bearing rather
  // than cosmetic: gemSystemPrompt substitutes the per-generation key
  // color into it, and chroma-key removal depends on the model having
  // been told that exact flat background to paint. Drop the placeholder
  // and generation still "succeeds" — it just returns art nothing can key
  // out, with no error anywhere until someone looks at the gem.
  if (generator === "gem" && !text.includes(KEY_COLOR_PLACEHOLDER)) {
    throw new Error(
      `The gem prompt must contain ${KEY_COLOR_PLACEHOLDER} — it is replaced with the chosen key color, ` +
        "and without it the generated art cannot be chroma-keyed.",
    );
  }
  const current = await getCurrentPrompt(db, generator);
  const version = current.version + 1;
  const created_at = new Date().toISOString();
  await db
    .prepare("INSERT INTO prompts (id, generator, version, text, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(`prompt_${crypto.randomUUID()}`, generator, version, text, created_at)
    .run();
  return { generator, version, text, created_at };
}

// Resolved text — /name expanded against the live skill pool — for a
// generator to actually send. version === null/undefined means "current".
async function resolvedPrompt(db, generator, version) {
  const row = version == null ? await getCurrentPrompt(db, generator) : await getPromptVersion(db, generator, version);
  return { version: row.version, text: await resolveSkills(db, row.text) };
}

export async function portraitSystemPrompt(db, styleVersion) {
  return (await resolvedPrompt(db, "portrait", styleVersion)).text;
}

export async function currentStyleVersion(db) {
  return (await getCurrentPrompt(db, "portrait")).version;
}

export async function flavorSystemPrompt(db, promptVersion) {
  return (await resolvedPrompt(db, "flavor", promptVersion)).text;
}

export async function currentFlavorPromptVersion(db) {
  return (await getCurrentPrompt(db, "flavor")).version;
}

export async function gemFieldFillSystemPrompt(db) {
  return (await resolvedPrompt(db, "gem_field_fill")).text;
}

// keyColorHex must be injected after skill resolution, since it's chosen
// ahead of generation and can't be a skill itself (it changes every call).
export async function gemSystemPrompt(db, keyColorHex) {
  const { text } = await resolvedPrompt(db, "gem");
  return text.replaceAll(KEY_COLOR_PLACEHOLDER, keyColorHex);
}
