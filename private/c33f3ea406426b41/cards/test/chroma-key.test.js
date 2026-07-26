import { test } from "node:test";
import assert from "node:assert/strict";
import { applyChromaKey, DEFAULT_MASK_PARAMS } from "../chroma-key.js";

function imageDataOf(pixels) {
  return { data: new Uint8ClampedArray(pixels.flat()), width: pixels.length, height: 1 };
}

const GREEN_PARAMS = { keyColor: "#00ff00", threshold: 40, edgeSoftness: 24, despill: 0.6 };

test("a pixel far from the key color stays fully opaque and unchanged in color", () => {
  const img = imageDataOf([[255, 0, 0, 255]]); // pure red, far from green
  applyChromaKey(img, GREEN_PARAMS);
  assert.deepEqual([...img.data], [255, 0, 0, 255]);
});

test("a pixel matching the key color exactly becomes fully transparent", () => {
  const img = imageDataOf([[0, 255, 0, 255]]);
  applyChromaKey(img, GREEN_PARAMS);
  assert.equal(img.data[3], 0);
});

test("a pixel in the edge-softness band gets a partial alpha, monotonic with distance", () => {
  // dist from (0,255,0): threshold=40 at radius 40, threshold+softness=64.
  const nearThreshold = imageDataOf([[0, 255 - 45, 0, 255]]); // dist = 45
  const nearFull = imageDataOf([[0, 255 - 60, 0, 255]]); // dist = 60
  applyChromaKey(nearThreshold, GREEN_PARAMS);
  applyChromaKey(nearFull, GREEN_PARAMS);
  assert.ok(nearThreshold.data[3] > 0);
  assert.ok(nearThreshold.data[3] < 255);
  assert.ok(nearFull.data[3] > nearThreshold.data[3]);
  assert.ok(nearFull.data[3] < 255);
});

test("a pixel exactly at the threshold radius is fully keyed out (boundary is inclusive)", () => {
  const img = imageDataOf([[0, 255 - 40, 0, 255]]); // dist exactly 40
  applyChromaKey(img, GREEN_PARAMS);
  assert.equal(img.data[3], 0);
});

test("despill reduces the dominant key-channel on a retained pixel", () => {
  const img = imageDataOf([[50, 200, 50, 255]]); // dist ~89.6, beyond threshold+softness (64) -> fully retained
  applyChromaKey(img, GREEN_PARAMS);
  assert.equal(img.data[3], 255, "alpha untouched, pixel is fully retained");
  assert.equal(img.data[1], 110, "green channel pulled down toward the other channels' max");
  assert.equal(img.data[0], 50);
  assert.equal(img.data[2], 50);
});

test("despill=0 leaves color channels untouched even on a greenish retained pixel", () => {
  const img = imageDataOf([[50, 200, 50, 255]]);
  applyChromaKey(img, { ...GREEN_PARAMS, despill: 0 });
  assert.equal(img.data[1], 200);
});

test("DEFAULT_MASK_PARAMS has the expected shape", () => {
  assert.equal(typeof DEFAULT_MASK_PARAMS.threshold, "number");
  assert.equal(typeof DEFAULT_MASK_PARAMS.edgeSoftness, "number");
  assert.equal(typeof DEFAULT_MASK_PARAMS.despill, "number");
});
