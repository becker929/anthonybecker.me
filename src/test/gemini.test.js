import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePortrait, GeminiThreadExpiredError } from "../gemini.js";

// gemini.js calls the global fetch directly (it's the one place in this
// codebase where that's appropriate — everything that touches it from the
// route handler is dependency-injected instead, see portrait.test.js).
// Swap it out for the duration of each test.
function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

const env = { GEMINI_API_KEY: "test-key" };

test("generatePortrait sends the documented Interactions API request shape", async () => {
  let seenUrl, seenInit;
  await withFetch(
    async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return new Response(
        JSON.stringify({
          id: "interaction-abc",
          steps: [{ type: "model_output", content: [{ type: "image", data: "AAAA", mime_type: "image/png" }] }],
        }),
        { status: 200 },
      );
    },
    async () => {
      const result = await generatePortrait(env, {
        instruction: "a herald",
        systemInstruction: "no frames",
        previousInteractionId: null,
        referenceImage: null,
        imageSize: "1K",
      });
      assert.equal(result.interactionId, "interaction-abc");
      assert.equal(result.mimeType, "image/png");
      assert.equal(result.data, "AAAA");
    },
  );

  assert.equal(seenUrl, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(seenInit.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(seenInit.body);
  assert.equal(body.input.length, 1, "no reference image part when none is given");
  assert.equal(body.input[0].type, "text");
  assert.equal(body.input[0].text, "a herald");
  assert.equal(body.system_instruction, "no frames");
  assert.equal(body.response_format.type, "image");
  assert.equal(body.response_format.aspect_ratio, "3:4");
  assert.equal(body.response_format.image_size, "1K");
  assert.equal("previous_interaction_id" in body, false);
});

test("generatePortrait includes a reference image part and previous_interaction_id when given", async () => {
  let seenBody;
  await withFetch(
    async (_url, init) => {
      seenBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: "interaction-def",
          steps: [{ type: "model_output", content: [{ type: "image", data: "BBBB", mime_type: "image/png" }] }],
        }),
        { status: 200 },
      );
    },
    () =>
      generatePortrait(env, {
        instruction: "darker sky",
        systemInstruction: "no frames",
        previousInteractionId: "interaction-abc",
        referenceImage: { mimeType: "image/png", data: "REFDATA" },
        imageSize: "2K",
      }),
  );

  assert.equal(seenBody.previous_interaction_id, "interaction-abc");
  assert.equal(seenBody.input.length, 2);
  assert.equal(seenBody.input[0].type, "image");
  assert.equal(seenBody.input[0].data, "REFDATA");
  assert.equal(seenBody.input[1].type, "text");
  assert.equal(seenBody.response_format.image_size, "2K");
});

test("a 404 with previous_interaction_id set is classified as an expired thread", async () => {
  await withFetch(
    async () => new Response(JSON.stringify({ error: { message: "interaction not found" } }), { status: 404 }),
    async () => {
      await assert.rejects(
        () =>
          generatePortrait(env, {
            instruction: "x",
            systemInstruction: "y",
            previousInteractionId: "gone",
            referenceImage: null,
            imageSize: "1K",
          }),
        GeminiThreadExpiredError,
      );
    },
  );
});

test("a 404 with no previous_interaction_id is just a plain failure, not classified as expired", async () => {
  await withFetch(
    async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }),
    async () => {
      await assert.rejects(
        () =>
          generatePortrait(env, {
            instruction: "x",
            systemInstruction: "y",
            previousInteractionId: null,
            referenceImage: null,
            imageSize: "1K",
          }),
        (err) => err instanceof Error && !(err instanceof GeminiThreadExpiredError),
      );
    },
  );
});

test("a response with no image part surfaces the model's text explanation", async () => {
  await withFetch(
    async () =>
      new Response(
        JSON.stringify({
          id: "interaction-ghi",
          steps: [{ type: "model_output", content: [{ type: "text", text: "blocked by safety filters" }] }],
        }),
        { status: 200 },
      ),
    async () => {
      await assert.rejects(
        () =>
          generatePortrait(env, {
            instruction: "x",
            systemInstruction: "y",
            previousInteractionId: null,
            referenceImage: null,
            imageSize: "1K",
          }),
        /blocked by safety filters/,
      );
    },
  );
});
