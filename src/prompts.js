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
