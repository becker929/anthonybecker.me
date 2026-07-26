// Thin client for Gemini's Interactions API (POST /v1beta/interactions),
// used for portrait generation (§6), flavor text (§7), and gem art (§8).
// Multi-turn edits thread through previous_interaction_id; that id lives on
// Google's servers and can expire, which is why callers must persist every
// successful turn immediately rather than trusting the thread to stay
// alive (see portrait.js).
//
// Model ids are pinned here deliberately (§10: "the image models are
// moving fast and preview ids get retired") — update these two constants
// when they rotate, nowhere else.
const IMAGE_MODEL = "gemini-3.1-flash-image";
const TEXT_MODEL = "gemini-3.6-flash";

// The template's portrait aperture is landscape (631x523 ≈ 1.21:1 as measured
// off the frame art), so portraits are generated at the nearest ratio the API
// offers and the renderer cover-fits the small remainder. This is no longer
// the exact-ratio-so-never-a-crop arrangement the original 3:4 aperture had;
// cards generated before this change carry 3:4 art and get centre-cropped.
// Gems are small square icons.
const PORTRAIT_ASPECT_RATIO = "4:3";
const GEM_ASPECT_RATIO = "1:1";

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

export function extractText(interaction) {
  for (const step of interaction.steps || []) {
    for (const part of step.content || []) {
      if (part.type === "text") return part.text;
    }
  }
  return null;
}

// Shared by generatePortrait and generateGemArt — both are "ask for a
// single image, optionally with a reference image and/or a thread to
// continue" calls that differ only in aspect ratio and model input parts.
async function requestImage(env, { input, systemInstruction, previousInteractionId, aspectRatio, imageSize }) {
  const body = {
    model: IMAGE_MODEL,
    input,
    system_instruction: systemInstruction,
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: aspectRatio,
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
  return requestImage(env, {
    input,
    systemInstruction,
    previousInteractionId,
    aspectRatio: PORTRAIT_ASPECT_RATIO,
    imageSize,
  });
}

// Gems are single-shot, no revision loop or lineage — every generation is
// an independent candidate the operator either approves or discards.
export async function generateGemArt(env, { instruction, systemInstruction }) {
  return requestImage(env, {
    input: [{ type: "text", text: instruction }],
    systemInstruction,
    previousInteractionId: null,
    aspectRatio: GEM_ASPECT_RATIO,
    imageSize: "1K",
  });
}

// Plain text generation (flavor text, §7). No response_format needed —
// text is the default output.
export async function generateText(env, { instruction, systemInstruction, previousInteractionId }) {
  const body = {
    model: TEXT_MODEL,
    input: instruction,
    system_instruction: systemInstruction,
  };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;

  const interaction = await callInteraction(env, body);
  const text = extractText(interaction);
  if (!text) throw new Error("No text returned.");
  return { interactionId: interaction.id, text };
}
