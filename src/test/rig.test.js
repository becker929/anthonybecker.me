import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.WebSocketRequestResponsePair ??= class { constructor(a, b) { this.a = a; this.b = b; } };

const { RigBroker, parseCall, bearerMatches, handleRpc, handleRigConnect } = await import("../rig.js");

class FakeSocket {
  constructor() { this.sent = []; this.closed = null; }
  send(m) { this.sent.push(JSON.parse(m)); }
  close(code, reason) { this.closed = { code, reason }; }
}

function fakeState(sockets = []) {
  return {
    setWebSocketAutoResponse() {},
    getWebSockets: () => sockets,
    acceptWebSocket: (ws) => sockets.push(ws),
  };
}

const req = (headers = {}, body) =>
  new Request("https://x/api/rpc", { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });

test("bearerMatches needs the exact key", () => {
  assert.equal(bearerMatches(req({ Authorization: "Bearer abc" }), "abc"), true);
  assert.equal(bearerMatches(req({ Authorization: "Bearer abd" }), "abc"), false);
  assert.equal(bearerMatches(req({}), "abc"), false);
  assert.equal(bearerMatches(req({ Authorization: "Bearer abc" }), undefined), false);
});

test("parseCall allows only the listed methods", () => {
  assert.ok(parseCall({ method: "ping" }).call);
  assert.match(parseCall({ method: "eval" }).error, /Unknown method/);
  assert.match(parseCall({ method: "ping", params: [] }).error, /params/);
  assert.equal(parseCall({ method: "ask" }).call.timeout, 120000);
  assert.equal(parseCall({ method: "ping", timeout_ms: 999999 }).call.timeout, 120000);
});

test("rpc and connect refuse the wrong key, and each other's key", async () => {
  const env = { SKRNG_TOKEN: "browser", RIG_TOKEN: "rig" };
  assert.equal((await handleRpc(req({ Authorization: "Bearer rig" }, { method: "ping" }), env)).status, 401);
  const ws = (k) => new Request("https://x/api/rig/connect", { headers: { Upgrade: "websocket", Authorization: `Bearer ${k}` } });
  assert.equal((await handleRigConnect(ws("browser"), env)).status, 401);
  assert.equal((await handleRpc(req({ Authorization: "Bearer browser" }, { method: "ping" }), {})).status, 503);
});

test("a call is sent down the socket and the reply returned", async () => {
  const sock = new FakeSocket();
  const broker = new RigBroker(fakeState([sock]));
  const pending = broker.rpc({ method: "ping", params: {}, timeout: 2000 });
  assert.equal(sock.sent.length, 1);
  const { id, method } = sock.sent[0];
  assert.equal(method, "ping");
  broker.webSocketMessage(sock, JSON.stringify({ id, result: { ok: true } }));
  const res = await pending;
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { result: { ok: true } });
});

test("errors, timeouts and an offline Mac", async () => {
  const sock = new FakeSocket();
  const broker = new RigBroker(fakeState([sock]));
  const p1 = broker.rpc({ method: "job_status", params: {}, timeout: 2000 });
  broker.webSocketMessage(sock, JSON.stringify({ id: sock.sent[0].id, error: "no such job" }));
  assert.equal((await p1).status, 502);

  const p2 = broker.rpc({ method: "ping", params: {}, timeout: 30 });
  assert.equal((await p2).status, 504);

  const p3 = broker.rpc({ method: "ping", params: {}, timeout: 2000 });
  broker.webSocketClose(sock);
  assert.equal((await p3).status, 503);

  const offline = new RigBroker(fakeState([]));
  assert.equal((await offline.rpc({ method: "ping", params: {}, timeout: 1000 })).status, 503);
});
