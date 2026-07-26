import { test } from "node:test";
import assert from "node:assert/strict";
import { selectKeyColor, hexToRgb, rgbToLab, labDistance } from "../key-color.js";

const CANDIDATES = { green: "#00ff00", magenta: "#ff00ff", cyan: "#00ffff", blue: "#0000ff" };

function minDistToPalette(candidateHex, paletteHex) {
  const candidateLab = rgbToLab(hexToRgb(candidateHex));
  const paletteLab = paletteHex.map((h) => rgbToLab(hexToRgb(h)));
  return Math.min(...paletteLab.map((p) => labDistance(candidateLab, p)));
}

test("throws on an empty palette", () => {
  assert.throws(() => selectKeyColor([]));
});

test("never selects a candidate that's already in the palette", () => {
  const result = selectKeyColor(["#00ff00"]);
  assert.notEqual(result.name, "green");
});

test("selects the candidate that truly maximizes the minimum distance (single-color palette)", () => {
  const palette = ["#8a2d1c"]; // a warm ember red/brown
  const result = selectKeyColor(palette);

  const scores = Object.fromEntries(
    Object.entries(CANDIDATES).map(([name, hex]) => [name, minDistToPalette(hex, palette)]),
  );
  const expectedBest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(result.name, expectedBest);
});

test("selects the candidate that maximizes the minimum distance (multi-color palette)", () => {
  const palette = ["#8a2d1c", "#f4b93f", "#2a3a52"];
  const result = selectKeyColor(palette);

  for (const [name, hex] of Object.entries(CANDIDATES)) {
    if (name === result.name) continue;
    const resultMin = minDistToPalette(result.hex, palette);
    const otherMin = minDistToPalette(hex, palette);
    assert.ok(resultMin >= otherMin, `${result.name} (${resultMin}) should beat ${name} (${otherMin})`);
  }
});

test("hexToRgb parses correctly", () => {
  assert.deepEqual(hexToRgb("#ff0080"), [255, 0, 128]);
});

test("labDistance is zero for identical colors and positive for different ones", () => {
  const a = rgbToLab(hexToRgb("#123456"));
  assert.equal(labDistance(a, a), 0);
  const b = rgbToLab(hexToRgb("#ffffff"));
  assert.ok(labDistance(a, b) > 0);
});
