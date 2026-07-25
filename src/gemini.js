// Thin client for Gemini's Interactions API (POST /v1beta/interactions),
// used for the portrait revision loop (§6). Multi-turn edits thread through
// previous_interaction_id; that id lives on Google's servers and can
// expire, which is why callers must persist every successful turn
// immediately rather than trusting the thread to stay alive (see
// portrait.js).
//
// Model id is pinned here deliberately (§10: "the image models are moving
// fast and preview ids get retired") — update this one constant when it
// rotates, nowhere else.
const DEFAULT_MODEL = "gemini-3.1-flash-image";

// The aperture is fixed 3:4 (§6) — every portrait is generated at exactly
// that ratio so fitting it into the template is a plain scale, never a crop.
const APERTURE_ASPECT_RATIO = "3:4";

export class GeminiThreadExpiredError extends Error {}

function apiBase(env) {
  return env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";
}

export async function callInteraction(env, body) {
  if (!env.GEMINI_API_KEY) throw new Error("Server is missing GEMINI_API_KEY.");

  const resp = await fetch(`${apiBase(env)}/v1beta/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => null);

  if (!resp.ok) {
    const message = data?.error?.message || data?.message || `Gemini API error (${resp.status})`;
    // A previous_interaction_id that no longer resolves (thread expired or
    // was never valid) is the one failure mode callers need to handle
    // specially — everything else is just "the call failed."
    if (body.previous_interaction_id && (resp.status === 404 || resp.status === 410)) {
      throw new GeminiThreadExpiredError(message);
    }
    throw new Error(message);
  }

  return data;
}

export function extractImage(interaction) {
  for (const step of interaction.steps || []) {
    for (const part of step.content || []) {
      if (part.type === "image") return { mimeType: part.mime_type, data: part.data };
    }
  }
  return null;
}

function extractText(interaction) {
  for (const step of interaction.steps || []) {
    for (const part of step.content || []) {
      if (part.type === "text") return part.text;
    }
  }
  return null;
}

// referenceImage: optional { mimeType, data(base64) } — only used to seed a
// brand-new thread from existing art (e.g. after the previous thread
// expired); a live continuation needs just the instruction text, since
// Gemini retains the prior image via previous_interaction_id.
export async function generatePortrait(
  env,
  { instruction, systemInstruction, previousInteractionId, referenceImage, imageSize },
) {
  const input = [];
  if (referenceImage) {
    input.push({ type: "image", data: referenceImage.data, mime_type: referenceImage.mimeType });
  }
  input.push({ type: "text", text: instruction });

  const body = {
    model: DEFAULT_MODEL,
    input,
    system_instruction: systemInstruction,
    response_format: {
      type: "image",
      mime_type: "image/png",
      aspect_ratio: APERTURE_ASPECT_RATIO,
      image_size: imageSize,
    },
  };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;

  const interaction = await callInteraction(env, body);
  const image = extractImage(interaction);
  if (!image) {
    const text = extractText(interaction);
    throw new Error(text ? `No image returned: ${text}` : "No image returned.");
  }
  return { interactionId: interaction.id, mimeType: image.mimeType, data: image.data };
}
