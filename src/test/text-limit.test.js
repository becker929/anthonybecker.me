import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateAtWordBoundary } from "../text-limit.js";

test("text within the limit is returned unchanged", () => {
  assert.equal(truncateAtWordBoundary("short text", 50), "short text");
});

test("text over the limit truncates at the last word boundary", () => {
  const text = "Where it walks, the ash remembers the shape of the fire.";
  const result = truncateAtWordBoundary(text, 20);
  assert.ok(result.length <= 20);
  assert.equal(text.startsWith(result), true);
  assert.notEqual(result[result.length - 1], " ");
});

test("a single word longer than the limit hard-cuts (no space to break on)", () => {
  const text = "supercalifragilisticexpialidocious";
  const result = truncateAtWordBoundary(text, 10);
  assert.equal(result, "supercalif");
});

test("exact-length text is returned unchanged, not truncated", () => {
  const text = "exactly ten";
  assert.equal(truncateAtWordBoundary(text, text.length), text);
});
