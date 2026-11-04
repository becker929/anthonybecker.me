// world3: the page round the Bevy trial client. It loads ./pkg/world3.js (wasm-bindgen, --target web), calls its
// start(canvas) and shows which backend the client drew with. Every URL is relative, so the page works from a subpath
// (https://anthonybecker.me/world3/). The client fetches snapshot/world.json relative to this page; ?snapshot=<name>
// hands it snapshot/<name>.json instead (start's second argument), and ?cell=x,y spawns there once it is ready
// (w3.spawn; default: the snapshot's `center`).
//
// The client's hooks are window.w3: ready (Promise), pose(x, y, px, py, pz, yaw, pitch, fov), set_time(t),
// set_capture(on), shoot({width, height}) -> Promise<PNG data URL>, frame_ms(), backend(), set_entities(on) (the game
// entity, on by default), entities() -> [{x, y, z}]. The tools in ../tools use them.
// window.w3page.error is set when the client failed to start (the tools read it).

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const params = new URLSearchParams(location.search);
const page = (window.w3page = { error: null, started: false });

// ?snapshot=<name> loads snapshot/<name>.json (e.g. extra, the parity check's single rooms); ?cell=x,y spawns there
const snapName = params.get('snapshot');
const snapshotUrl = snapName && /^[a-z0-9_-]{1,40}$/i.test(snapName) ? `snapshot/${snapName}.json` : null;
const cellArg = (params.get('cell') || '').split(',').map(Number);
const cell = cellArg.length === 2 && cellArg.every(Number.isInteger) ? cellArg : null;
// the link back to world2 opens the same room
$('world2').href = `https://world2.anthonybecker.me/?cell=${(cell || [5, 7]).join(',')}`;

function show(text, bad = false) {
  const b = $('backend');
  b.textContent = text;
  b.classList.toggle('bad', bad);
}

function failed(e) {
  console.error(e);
  page.error = String((e && e.message) || e);
  show(`could not start: ${page.error}`, true);
}

async function boot() {
  let mod;
  try { mod = await import('./pkg/world3.js'); } catch (e) { failed(new Error(`client not found (pkg/world3.js): ${e.message || e}`)); return; }
  try {
    if (typeof mod.default === 'function') await mod.default();
    // a Bevy app's start may run its loop and never resolve: don't wait on it, wait on window.w3.ready
    const run = snapshotUrl ? mod.start(canvas, snapshotUrl) : mod.start(canvas);
    page.started = true;
    if (run && typeof run.catch === 'function') run.catch((e) => { if (!isControlFlow(e)) failed(e); });
  } catch (e) {
    if (!isControlFlow(e)) { failed(e); return; }
  }
  const t0 = performance.now();
  while (!window.w3?.ready) {
    if (page.error) return;
    if (performance.now() - t0 > 60000) { failed(new Error('the client never exposed window.w3')); return; }
    await new Promise((r) => setTimeout(r, 50));
  }
  try {
    await window.w3.ready;
    if (cell && typeof window.w3.spawn === 'function') window.w3.spawn(cell[0], cell[1]);
    const be = String(window.w3.backend?.() ?? 'unknown');
    show(/webgpu/i.test(be) ? 'WebGPU' : /webgl/i.test(be) ? 'WebGL2' : be);
    canvas.focus({ preventScroll: true });
  } catch (e) { failed(e); }
}

// winit on the web ends its event loop by throwing "Using exceptions for control flow"; that is not a failure
function isControlFlow(e) { return /exceptions for control flow/i.test(String((e && e.message) || e)); }

addEventListener('error', (e) => { if (!page.started && !isControlFlow(e.error || e.message)) failed(e.error || e.message); });
boot();
