// Deterministic chroma-key color selection. No Gemini image model can
// output a transparent background, so transparency is manufactured via
// chroma key — and the key color must be chosen BEFORE generation, since
// the model has to be told to paint it. This runs server-side, ahead of
// the prompt, for exactly that reason.
//
// Candidates are a deliberately small fixed set; selection picks
// whichever maximizes the *minimum* distance to any declared palette
// color — the color least likely to be confused with anything actually
// painted on the gem, not just far on average.
const CANDIDATES = {
  green: "#00ff00",
  magenta: "#ff00ff",
  cyan: "#00ffff",
  blue: "#0000ff",
};

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// sRGB -> linear -> XYZ (D65) -> CIELAB. Standard formulas, no dependencies.
export function rgbToLab([r, g, b]) {
  const toLinear = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);

  const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;

  const [xn, yn, zn] = [0.95047, 1.0, 1.08883];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIE76 (Euclidean distance in Lab) — a simpler, still standard measure
// of perceptual distance. Not as refined as CIEDE2000, but correct in
// spirit and easy to verify, which matters more here than precision.
export function labDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function selectKeyColor(paletteHexArray) {
  if (!Array.isArray(paletteHexArray) || paletteHexArray.length === 0) {
    throw new Error("palette must be a non-empty array of hex colors.");
  }
  const paletteLab = paletteHexArray.map((hex) => rgbToLab(hexToRgb(hex)));

  let best = null;
  for (const [name, hex] of Object.entries(CANDIDATES)) {
    const candidateLab = rgbToLab(hexToRgb(hex));
    const minDist = Math.min(...paletteLab.map((p) => labDistance(candidateLab, p)));
    if (!best || minDist > best.minDist) {
      best = { name, hex, minDist };
    }
  }
  return { name: best.name, hex: best.hex };
}
