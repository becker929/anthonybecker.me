import { test } from "node:test";
import assert from "node:assert/strict";
import { fitShrink, fitWrapShrink } from "../fit-text.js";

// Synthetic, deterministic measurer — no canvas needed. Width scales
// linearly with character count and font size, which is all these tests
// need to exercise the shrink/wrap decision logic.
const measure = (text, size) => text.length * size * 0.6;

test("fitShrink: text that already fits keeps startSize", () => {
  const { size, lines } = fitShrink({
    text: "ATK",
    measure,
    maxWidth: 1000,
    startSize: 44,
    minSize: 28,
  });
  assert.equal(size, 44);
  assert.deepEqual(lines, ["ATK"]);
});

test("fitShrink: long text shrinks until it fits", () => {
  const text = "The Unnumbered Reliquary Warden of the Last Ember Vault";
  const maxWidth = 400;
  const { size } = fitShrink({ text, measure, maxWidth, startSize: 44, minSize: 10 });
  assert.ok(size < 44);
  assert.ok(size >= 10);
  assert.ok(measure(text, size) <= maxWidth);
});

test("fitShrink: text that never fits falls back to minSize without throwing", () => {
  const text = "a".repeat(500);
  const { size } = fitShrink({ text, measure, maxWidth: 50, startSize: 44, minSize: 28 });
  assert.equal(size, 28);
});

test("fitShrink: rejects minSize greater than startSize", () => {
  assert.throws(() => fitShrink({ text: "x", measure, maxWidth: 100, startSize: 10, minSize: 20 }));
});

test("fitWrapShrink: short text wraps at startSize within the box", () => {
  const { size, lines } = fitWrapShrink({
    text: "Where it walks, the ash remembers.",
    measure,
    maxWidth: 500,
    maxHeight: 200,
    startSize: 18,
    minSize: 12,
  });
  assert.equal(size, 18);
  assert.ok(lines.length >= 1);
  for (const line of lines) assert.ok(measure(line, size) <= 500);
});

test("fitWrapShrink: explicit newlines force separate lines/paragraphs", () => {
  const { lines } = fitWrapShrink({
    text: "ATK 7\nCOST 3",
    measure,
    maxWidth: 1000,
    maxHeight: 500,
    startSize: 20,
    minSize: 14,
  });
  assert.deepEqual(lines, ["ATK 7", "COST 3"]);
});

test("fitWrapShrink: tall text forces a smaller size to fit maxHeight", () => {
  const text = "It has stood at the vault door since before the vault had a name, counting embers that never stop falling.";
  const { size, lines } = fitWrapShrink({
    text,
    measure,
    maxWidth: 500,
    maxHeight: 40,
    startSize: 18,
    minSize: 10,
  });
  assert.ok(size < 18);
  const blockHeight = lines.length * size * 1.2;
  assert.ok(blockHeight <= 40 || size === 10);
});

test("fitWrapShrink: pathological text returns best-effort at minSize instead of throwing", () => {
  const text = "supercalifragilisticexpialidocious ".repeat(20);
  const { size } = fitWrapShrink({
    text,
    measure,
    maxWidth: 30,
    maxHeight: 10,
    startSize: 18,
    minSize: 10,
  });
  assert.equal(size, 10);
});

test("fitWrapShrink: rejects minSize greater than startSize", () => {
  assert.throws(() =>
    fitWrapShrink({ text: "x", measure, maxWidth: 100, maxHeight: 100, startSize: 10, minSize: 20 }),
  );
});
