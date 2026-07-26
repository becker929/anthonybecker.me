// Pure text-length enforcement for flavor text (§7): "the Worker validates
// the returned length, retries once on overflow, then truncates at a word
// boundary." A limit stated in a prompt is advisory; this is the actual
// enforcement, so it needs to be correct independent of what the model did.

export function truncateAtWordBoundary(text, maxChars) {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd();
}
