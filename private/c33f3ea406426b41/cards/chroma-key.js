// Pure, deterministic chroma-key masking. Operates on an ImageData-
// shaped object ({data: Uint8ClampedArray, width, height} — a real canvas
// ImageData satisfies this, and so does a plain object in tests), so it
// needs no canvas to unit test.
//
// Raw gem art and its mask_params are the stored source of truth; this
// function re-derives the masked bitmap every time it's needed and never
// itself gets persisted — never store only the masked output.
//
// This file is loaded directly by the browser (not bundled), so it must
// not import from src/ — see key-color.js for the (server-side) key-color
// selection this complements.

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function distance(r, g, b, kr, kg, kb) {
  const dr = r - kr;
  const dg = g - kg;
  const db = b - kb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Mutates and returns imageData.
export function applyChromaKey(imageData, { keyColor, threshold, edgeSoftness, despill }) {
  const [kr, kg, kb] = hexToRgb(keyColor);
  const dominant = kr >= kg && kr >= kb ? 0 : kg >= kr && kg >= kb ? 1 : 2;
  const others = [0, 1, 2].filter((i) => i !== dominant);
  const softness = Math.max(edgeSoftness, 1e-6);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const dist = distance(r, g, b, kr, kg, kb);

    let alpha;
    if (dist <= threshold) {
      alpha = 0;
    } else if (dist >= threshold + softness) {
      alpha = a;
    } else {
      alpha = Math.round(a * ((dist - threshold) / softness));
    }

    if (alpha > 0 && despill > 0) {
      const channels = [r, g, b];
      const domVal = channels[dominant];
      const othersMax = Math.max(channels[others[0]], channels[others[1]]);
      if (domVal > othersMax) {
        channels[dominant] = domVal - (domVal - othersMax) * despill;
      }
      data[i] = channels[0];
      data[i + 1] = channels[1];
      data[i + 2] = channels[2];
    }
    data[i + 3] = alpha;
  }

  return imageData;
}

export const DEFAULT_MASK_PARAMS = { threshold: 40, edgeSoftness: 24, despill: 0.6 };
