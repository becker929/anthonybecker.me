// Routes for the shared gem pool (§8). Candidate art is generated against
// a key color chosen deterministically from the declared palette *before*
// the prompt is built — the model has to be told the exact background to
// paint, so the color can't be picked after the fact. New gems always
// start unapproved; POST .../approve is the only way into the pool.
import { generateGemArt as defaultGenerateGemArt } from "./gemini.js";
import { gemSystemPrompt } from "./prompts.js";
import { selectKeyColor } from "./key-color.js";
import { putBlob } from "./blobs.js";
import { listGems, insertGem, updateGemMaskParams, approveGem } from "./gems.js";
import { jsonError, jsonOk } from "./http.js";
import { DEFAULT_MASK_PARAMS } from "../private/c33f3ea406426b41/cards/chroma-key.js";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export async function handleListGems(request, env) {
  const url = new URL(request.url);
  const approvedOnly = url.searchParams.get("approved") === "1";
  const gems = await listGems(env.CARD_DB, { approvedOnly });
  return jsonOk(gems);
}

export async function handleCreateGem(request, env, deps = {}) {
  const generateGemArt = deps.generateGemArt || defaultGenerateGemArt;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const palette = Array.isArray(body.palette) ? body.palette : [];

  if (!name) return jsonError(400, "name is required.");
  if (!instruction) return jsonError(400, "instruction is required.");
  if (palette.length === 0) return jsonError(400, "palette must be a non-empty array of hex colors.");
  if (!palette.every((hex) => typeof hex === "string" && HEX_COLOR_RE.test(hex))) {
    return jsonError(400, "Every palette entry must be a #rrggbb hex color.");
  }

  const keyColor = selectKeyColor(palette);
  const systemInstruction = gemSystemPrompt(keyColor.hex);

  let result;
  try {
    result = await generateGemArt(env, { instruction, systemInstruction });
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
