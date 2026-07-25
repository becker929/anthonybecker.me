// Pure text-fitting math. No canvas dependency: callers inject `measure(text,
// size) => widthPx` (browser callers wrap ctx.measureText; tests inject a
// synthetic measurer), which is what keeps this testable under plain Node.

// "\n" in the source text is a forced break (e.g. one stat per line) —
// each paragraph it delimits is word-wrapped independently, in order.
function wrapLines(text, size, maxWidth, measure) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const candidate = `${line} ${word}`;
      if (measure(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Single line, shrink font size until it fits maxWidth or minSize is hit.
export function fitShrink({ text, measure, maxWidth, startSize, minSize }) {
  if (minSize > startSize) {
    throw new Error(`minSize (${minSize}) must be <= startSize (${startSize})`);
  }
  for (let size = startSize; size >= minSize; size--) {
    if (measure(text, size) <= maxWidth) {
      return { size, lines: [text] };
    }
  }
  return { size: minSize, lines: [text] };
}

// Wrap into multiple lines, shrinking font size until the wrapped block
// fits maxHeight (and every line fits maxWidth), or minSize is hit.
export function fitWrapShrink({
  text,
  measure,
  maxWidth,
  maxHeight,
  startSize,
  minSize,
  lineHeightFactor = 1.2,
}) {
  if (minSize > startSize) {
    throw new Error(`minSize (${minSize}) must be <= startSize (${startSize})`);
  }
  let best = null;
  for (let size = startSize; size >= minSize; size--) {
    const lines = wrapLines(text, size, maxWidth, measure);
    const blockHeight = lines.length * size * lineHeightFactor;
    const linesFitWidth = lines.every((l) => measure(l, size) <= maxWidth);
    best = { size, lines, fits: blockHeight <= maxHeight && linesFitWidth };
    if (best.fits) return { size, lines };
  }
  // Ran out of sizes: return the minSize attempt as a best-effort result —
  // the renderer clips visually rather than losing text entirely.
  return { size: best.size, lines: best.lines };
}
