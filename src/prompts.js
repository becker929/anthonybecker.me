// Versioned system prompts for portrait generation (§6). style_version is
// recorded on the card for provenance — there is no bulk restyle feature,
// so old cards keep whatever prompt text produced them even after this
// registry moves on. Never edit an existing entry; add a new version.

export const CURRENT_STYLE_VERSION = 1;

const PORTRAIT_SYSTEM_PROMPTS = {
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
};

export function portraitSystemPrompt(styleVersion) {
  const prompt = PORTRAIT_SYSTEM_PROMPTS[styleVersion];
  if (!prompt) {
    throw new Error(`Unknown portrait style_version ${styleVersion}.`);
  }
  return prompt;
}

// Flavor text (§7): a separate model call with its own versioned prompt,
// never bundled with the image call. The character budget is stated here
// too so the model's first attempt is usually already in range, but it is
// never trusted — see text-limit.js and flavor.js for the actual
// enforcement.

export const CURRENT_FLAVOR_PROMPT_VERSION = 1;

const FLAVOR_SYSTEM_PROMPTS = {
  1: `You write short flavor text for a trading card game.

Output only the flavor text itself: no quotation marks around it, no
title, no preamble like "Here's the flavor text:", no explanation
afterward. One or two sentences, evocative and specific rather than
generic, matching the mood and concept described in the instruction. Stay
within the character budget given in the instruction — noticeably
shorter than the budget is fine, going over it is not.`,
};

export function flavorSystemPrompt(promptVersion) {
  const prompt = FLAVOR_SYSTEM_PROMPTS[promptVersion];
  if (!prompt) {
    throw new Error(`Unknown flavor prompt_version ${promptVersion}.`);
  }
  return prompt;
}

// Gem art (§8): not versioned/stored per-gem — the brief's gems table has
// no prompt-version column, only style-provenance for portraits matters.
// keyColorHex must be injected as the required background *before*
// generation, since it's chosen ahead of time and can't be changed after
// the fact (there's nothing to key out otherwise).
export function gemSystemPrompt(keyColorHex) {
  return `You are generating a single small icon-style game asset: an
energy gem or crystal, centered and filling most of the frame, viewed as a
clean game-UI icon rather than a scene.

The background MUST be a single flat, solid, unbroken fill of exactly
${keyColorHex} — no gradient, no texture, no shadow, no other objects, and
none of that color anywhere on the gem itself. This flat background is
required for post-processing (chroma-key removal), and its exact,
uniform color matters more than how natural it looks.

Style: simple, readable, slightly stylized digital illustration with
clear specular highlights suggesting a faceted or polished surface.`;
}
