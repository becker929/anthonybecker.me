// Routes for the shared gem pool. Candidate art is generated against
// a key color chosen deterministically from the declared palette *before*
// the prompt is built — the model has to be told the exact background to
// paint, so the color can't be picked after the fact. New gems always
// start unapproved; POST .../approve is the only way into the pool.
import { generateGemArt as defaultGenerateGemArt, generateText as defaultGenerateText } from "./gemini.js";
import { gemSystemPrompt, gemFieldFillSystemPrompt } from "./prompts.js";
import { resolveSkills } from "./skills.js";
import { selectKeyColor } from "./key-color.js";
import { putBlob } from "./blobs.js";
import { listGems, insertGem, updateGemMaskParams, approveGem } from "./gems.js";
import { jsonError, jsonOk } from "./http.js";
import { DEFAULT_MASK_PARAMS } from "../private/c33f3ea406426b41/cards/chroma-key.js";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Builds the fill-in prompt from whichever of name/instruction/palette the
// operator already gave, listing exactly what's missing so the model fills
// in only that and nothing else.
export function buildGemFieldFillInput({ name, instruction, palette }) {
  const known = [];
  if (name) known.push(`Name: ${name}`);
  if (instruction) known.push(`Instruction: ${instruction}`);
  if (palette.length > 0) known.push(`Palette: ${palette.join(", ")}`);

  const missing = [];
  if (!name) missing.push("name");
  if (!instruction) missing.push("instruction");
  if (palette.length === 0) missing.push("palette");

  return [
    known.length > 0 ? `Already supplied:\n${known.join("\n")}` : "Nothing has been supplied yet.",
    `Fill in only these missing fields: ${missing.join(", ")}.`,
  ].join("\n\n");
}

// Parses the model's fill-in response defensively — it's free-form text
// generation, not a structured API, so a malformed or partial reply must
// surface as a normal generation failure rather than throwing deep inside
// JSON.parse.
export function parseGemFieldFill(text, missingKeys) {
  let parsed;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("Could not parse the generated fields as JSON.");
  }
  const filled = {};
  for (const key of missingKeys) {
    if (key === "palette") {
      if (!Array.isArray(parsed.palette) || parsed.palette.length === 0) {
        throw new Error("Generated palette was missing or empty.");
      }
      filled.palette = parsed.palette;
    } else {
      if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
        throw new Error(`Generated ${key} was missing or empty.`);
      }
      filled[key] = parsed[key].trim();
    }
  }
  return filled;
}

export async function handleListGems(request, env) {
  const url = new URL(request.url);
  const approvedOnly = url.searchParams.get("approved") === "1";
  const gems = await listGems(env.CARD_DB, { approvedOnly });
  return jsonOk(gems);
}

export async function handleCreateGem(request, env, deps = {}) {
  const generateGemArt = deps.generateGemArt || defaultGenerateGemArt;
  const generateText = deps.generateText || defaultGenerateText;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  let name = typeof body.name === "string" ? body.name.trim() : "";
  let instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  let palette = Array.isArray(body.palette) ? body.palette : [];

  if (!name && !instruction && palette.length === 0) {
    return jsonError(400, "At least one of name, instruction, or palette is required.");
  }
  if (palette.length > 0 && !palette.every((hex) => typeof hex === "string" && HEX_COLOR_RE.test(hex))) {
    return jsonError(400, "Every palette entry must be a #rrggbb hex color.");
  }

  const missing = [];
  if (!name) missing.push("name");
  if (!instruction) missing.push("instruction");
  if (palette.length === 0) missing.push("palette");

  if (missing.length > 0) {
    let filled;
    try {
      const result = await generateText(env, {
        instruction: buildGemFieldFillInput({ name, instruction, palette }),
        systemInstruction: await gemFieldFillSystemPrompt(env.CARD_DB),
        previousInteractionId: null,
      });
      filled = parseGemFieldFill(result.text, missing);
    } catch (err) {
      return jsonError(502, `Failed to fill in missing gem fields: ${err.message}`);
    }
    if (filled.name) name = filled.name;
    if (filled.instruction) instruction = filled.instruction;
    if (filled.palette) palette = filled.palette;

    if (!palette.every((hex) => typeof hex === "string" && HEX_COLOR_RE.test(hex))) {
      return jsonError(502, "Generated palette contained an invalid hex color.");
    }
  }

  const keyColor = selectKeyColor(palette);
  const systemInstruction = await gemSystemPrompt(env.CARD_DB, keyColor.hex);

  let result;
  try {
    result = await generateGemArt(env, { instruction: await resolveSkills(env.CARD_DB, instruction), systemInstruction });
  } catch (err) {
    return jsonError(502, err.message);
  }

  const rawHash = await putBlob(env.CARD_BUCKET, { mimeType: result.mimeType, data: result.data });
  const id = `gem_${crypto.randomUUID()}`;

  const gem = await insertGem(env.CARD_DB, {
    id,
    name,
    palette,
    keyColor: keyColor.hex,
    rawHash,
    maskParams: DEFAULT_MASK_PARAMS,
  });

  return jsonOk({ gem });
}

export async function handleUpdateGemMask(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const params = body.mask_params;
  const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
  if (!params || !isFiniteNumber(params.threshold) || !isFiniteNumber(params.edgeSoftness) || !isFiniteNumber(params.despill)) {
    return jsonError(400, "mask_params must include numeric threshold, edgeSoftness, and despill.");
  }

  const gem = await updateGemMaskParams(env.CARD_DB, id, {
    threshold: params.threshold,
    edgeSoftness: params.edgeSoftness,
    despill: params.despill,
  });
  if (!gem) return jsonError(404, "Gem not found.");
  return jsonOk({ gem });
}

export async function handleApproveGem(env, id) {
  const gem = await approveGem(env.CARD_DB, id);
  if (!gem) return jsonError(404, "Gem not found.");
  return jsonOk({ gem });
}
