// POST /api/portrait — generate or continue a card's portrait. The
// governing rule: every successful turn (instruction,
// resulting bytes, interaction id) is mirrored into our own storage before
// this handler responds. previous_interaction_id is state on Google's
// servers and can expire; once it does, only what we mirrored here still
// exists.
import { generatePortrait as defaultGeneratePortrait, GeminiThreadExpiredError } from "./gemini.js";
import { portraitSystemPrompt, currentStyleVersion } from "./prompts.js";
import { resolveSkills } from "./skills.js";
import { putBlob, getBlobAsBase64 } from "./blobs.js";
import { loadCard, saveCard, recordInteraction } from "./cards.js";
import { jsonError, jsonOk } from "./http.js";

function stripHashPrefix(asset) {
  return asset.startsWith("sha256:") ? asset.slice("sha256:".length) : asset;
}

export async function handlePortrait(request, env, deps = {}) {
  const generatePortrait = deps.generatePortrait || defaultGeneratePortrait;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const cardId = typeof body.card_id === "string" ? body.card_id : "";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const previousInteractionId =
    typeof body.previous_interaction_id === "string" ? body.previous_interaction_id : null;
  const referenceAsset = typeof body.reference_asset === "string" ? body.reference_asset : null;
  const styleVersion =
    typeof body.style_version === "number" ? body.style_version : await currentStyleVersion(env.CARD_DB);
  const resolution = body.resolution === "2K" ? "2K" : "1K";

  if (!cardId) return jsonError(400, "card_id is required.");
  if (!instruction) return jsonError(400, "instruction is required.");
  if (previousInteractionId && referenceAsset) {
    return jsonError(400, "Pass previous_interaction_id or reference_asset, not both.");
  }

  const card = await loadCard(env.CARD_DB, cardId);
  if (!card) {
    return jsonError(404, "Card not found. Create it with PUT /api/cards/:id first.");
  }

  let systemInstruction;
  try {
    systemInstruction = await portraitSystemPrompt(env.CARD_DB, styleVersion);
  } catch (err) {
    return jsonError(400, err.message);
  }

  let referenceImage = null;
  if (referenceAsset) {
    referenceImage = await getBlobAsBase64(env.CARD_BUCKET, stripHashPrefix(referenceAsset));
    if (!referenceImage) return jsonError(400, "reference_asset not found.");
  }

  // The model sees /name expanded; the card's lineage and user_prompt keep
  // the raw text the operator actually typed, same as any other authored
  // provenance field in this app.
  const resolvedInstruction = await resolveSkills(env.CARD_DB, instruction);

  let result;
  try {
    result = await generatePortrait(env, {
      instruction: resolvedInstruction,
      systemInstruction,
      previousInteractionId,
      referenceImage,
      imageSize: resolution,
    });
  } catch (err) {
    if (err instanceof GeminiThreadExpiredError) {
      return jsonError(
        409,
        "The edit thread has expired on Google's side. Retry with reference_asset set to the " +
          "card's current portrait asset to start a new thread from the same image.",
      );
    }
    return jsonError(502, err.message);
  }

  const hash = await putBlob(env.CARD_BUCKET, { mimeType: result.mimeType, data: result.data });
  const assetRef = `sha256:${hash}`;

  const priorLineage = card.portrait?.lineage || [];
  const isFirstTurn = priorLineage.length === 0;
  const lineageEntry = { instruction, asset: assetRef, interaction_id: result.interactionId };

  card.portrait = {
    asset: assetRef,
    style_version: styleVersion,
    user_prompt: isFirstTurn ? instruction : card.portrait.user_prompt,
    interaction_id: result.interactionId,
    lineage: [...priorLineage, lineageEntry],
  };

  // Mirror before responding — this is the durability guarantee, not best
  // effort. If either write fails the client sees an error and can retry;
  // it never sees a "success" that wasn't actually persisted.
  const saved = await saveCard(env.CARD_DB, card.id, card);
  await recordInteraction(env.CARD_DB, {
    cardId: card.id,
    seq: priorLineage.length,
    instruction,
    assetHash: hash,
  });

  return jsonOk({ card: saved, asset: assetRef, interaction_id: result.interactionId });
}
