// Counts a repository off the main thread, so the page keeps drawing while a
// large account is read.
import { sampleRepo } from "./sample.js";

self.onmessage = (e) => {
  const { buf, now } = e.data;
  try {
    const sample = sampleRepo(new Uint8Array(buf), now, (n) => self.postMessage({ progress: n }));
    self.postMessage({ sample });
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
