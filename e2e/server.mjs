// A local full stack for end-to-end tests: static files from the repo root, and
// every path the Worker owns (the lab, the listening API, the studio) routed
// through the real Worker fetch() with in-memory fakes for KV and R2. Nothing
// here touches Cloudflare; it is the same code the Worker runs, on a port.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import worker from "../src/index.js";
import { FakeKV, FakeR2, FakeD1 } from "../src/test/fakes.js";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const PORT = Number(process.env.PORT || 8790);
const PASSWORD = process.env.DEMO_PASSWORD || "e2e-password";
const TOKEN = process.env.LAB_TOKEN || "e2e-token";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ico": "image/x-icon" };

const assets = {
  async fetch(req) {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const dirIndex = path.join(ROOT, p, "index.html");
      if (fs.existsSync(dirIndex)) return new Response(fs.readFileSync(dirIndex), { headers: { "Content-Type": TYPES[".html"] } });
      return new Response("Not found", { status: 404 });
    }
    return new Response(fs.readFileSync(file), { headers: { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" } });
  },
};
const env = { DEMO_PASSWORD: PASSWORD, LAB_TOKEN: TOKEN, AUDIO_KV: new FakeKV(), AUDIO_BUCKET: new FakeR2(), CARD_DB: new FakeD1(), CARD_BUCKET: new FakeR2(), ASSETS: assets };

http.createServer(async (req, res) => {
  try {
    const url = `http://localhost:${PORT}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const request = new Request(url, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: "half" });
    const response = await worker.fetch(request, env);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  } catch (err) {
    res.statusCode = 500; res.end(String(err && err.stack || err));
  }
}).listen(PORT, () => console.log(`e2e stack on http://localhost:${PORT} (password ${PASSWORD}, token ${TOKEN})`));
