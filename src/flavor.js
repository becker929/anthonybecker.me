// POST /api/flavor — generate a card's flavor text (§7). A separate model
// call from the portrait, with its own versioned system prompt. The
// character limit is enforced here in code, never trusted from the model:
// validate the returned length, retry once (threaded so the model knows
// what it wrote and can shorten it), then truncate at a word boundary.
import { generateText as defaultGenerateText } from "./gemini.js";
import { flavorSystemPrompt, CURRENT_FLAVOR_PROMPT_VERSION } from "./prompts.js";
import { loadCard, saveCard } from "./cards.js";
import { truncateAtWordBoundary } from "./text-limit.js";
import { jsonError, jsonOk } from "./http.js";

const DEFAULT_MAX_CHARS = 200;

export function buildFlavorInput({ title, theme, guidance, maxChars }) {
  const lines = [];
  if (title) lines.push(`Card title: ${title}`);
  if (theme) lines.push(`Card concept: ${theme}`);
  if (guidance) lines.push(`Operator guidance: ${guidance}`);
  lines.push(`Write flavor text under ${maxChars} characters.`);
  return lines.join("\n");
}

export async function handleFlavor(request, env, deps = {}) {
  const generateText = deps.generateText || defaultGenerateText;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const cardId = typeof body.card_id === "string" ? body.card_id : "";
  const guidance = typeof body.guidance === "string" ? body.guidance.trim() : "";
  const promptVersion =
    typeof body.prompt_version === "number" ? body.prompt_version : CURRENT_FLAVOR_PROMPT_VERSION;
  const maxChars =
    Number.isInteger(body.max_chars) && body.max_chars > 0 ? body.max_chars : DEFAULT_MAX_CHARS;

  if (!cardId) return jsonError(400, "card_id is required.");

  const card = await loadCard(env.CARD_DB, cardId);
  if (!card) {
    return jsonError(404, "Card not found. Create it with PUT /api/cards/:id first.");
  }

  let systemInstruction;
  try {
    systemInstruction = flavorSystemPrompt(promptVersion);
  } catch (err) {
    return jsonError(400, err.message);
  }

  const input = buildFlavorInput({
    title: card.title,
    theme: card.portrait?.user_prompt,
    guidance,
    maxChars,
  });

  let result;
  try {
    result = await generateText(env, { instruction: input, systemInstruction, previousInteractionId: null });
  } catch (err) {
    return jsonError(502, err.message);
  }

  let text = result.text.trim();
  let truncated = false;

  if (text.length > maxChars) {
    try {
      const retryInput = `That was ${text.length} characters, over the ${maxChars} character limit. Shorten it to fit while keeping the same idea.`;
      const retry = await generateText(env, {
        instruction: retryInput,
        systemInstruction,
        previousInteractionId: result.interactionId,
      });
      text = retry.text.trim();
    } catch {
      // Fall through and truncate whatever we already have — a failed
      // retry is not a reason to fail the whole request.
    }
  }

  if (text.length > maxChars) {
    text = truncateAtWordBoundary(text, maxChars);
    truncated = true;
  }

  card.flavor = { text, source: "generated", prompt_version: promptVersion };
  const saved = await saveCard(env.CARD_DB, card.id, card);

  return jsonOk({ card: saved, text, truncated });
}
