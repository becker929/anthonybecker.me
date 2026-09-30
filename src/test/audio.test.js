import test from "node:test";
import assert from "node:assert/strict";
import { handleAudioFile } from "../audio.js";

// Stand-in for the R2 bucket's get(). Like production R2, it reports a range
// covering the whole object even when none was requested.
function fakeBucket(bytes) {
  return {
    async get(key, opts = {}) {
      if (key !== "audio/skrng/a.mp3") return null;
      const offset = opts.range?.offset ?? 0;
      const length = opts.range?.length ?? bytes.length - offset;
      return {
        size: bytes.length,
        range: { offset, length },
        httpEtag: '"etag"',
        body: bytes.slice(offset, offset + length),
        writeHttpMetadata(h) { h.set("Content-Type", "audio/mpeg"); },
      };
    },
  };
}

const env = { AUDIO_BUCKET: fakeBucket(new Uint8Array(100)) };
const req = (headers = {}) => new Request("https://x/audio/skrng/a.mp3", { headers });

test("plain GET is a 200 with the full length", async () => {
  const res = await handleAudioFile(req(), env, "skrng/a.mp3");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Length"), "100");
  assert.equal(res.headers.get("Content-Range"), null);
  assert.equal(res.headers.get("Accept-Ranges"), "bytes");
});

test("range GET is a 206 with Content-Range", async () => {
  const res = await handleAudioFile(req({ Range: "bytes=10-19" }), env, "skrng/a.mp3");
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("Content-Length"), "10");
  assert.equal(res.headers.get("Content-Range"), "bytes 10-19/100");
});

test("open-ended range runs to the end", async () => {
  const res = await handleAudioFile(req({ Range: "bytes=90-" }), env, "skrng/a.mp3");
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("Content-Range"), "bytes 90-99/100");
});

test("missing key is a 404", async () => {
  const res = await handleAudioFile(req(), env, "skrng/nope.mp3");
  assert.equal(res.status, 404);
});
