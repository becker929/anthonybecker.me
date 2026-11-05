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
//
// The game (web/game/FORMAT.md): the client runs the script game/<name>.star (?game=<name>, default orbs; ?game=none for
// none) and tells the page through window `w3game` events: hud (what the script's look_hud shows: a dot per orb, lit
// for each found), sound (a name: sounds/<name>.m4a, foley renders from the Juice Box demo, trimmed), say (a short
// line that fades), usable (the nearest thing in reach: the use button on touch, the E keycap on desktop) and error
// (the script didn't load, or a hook failed: shown in a panel naming the hook, its bound, the budget and the line).
// The reset control calls w3.reset_game() after a second tap.
// window.w3page.game records what the page showed and played, for tools/play.mjs.
// Rung 2 (docs/rung2.md): carrying (the inventory strip, one inline-SVG token per item) and, for a game with an id,
// the remote save in the player's Bluesky repo through world2 (save.js: the person icon, its panel, the Saved mark).

import { remoteSave } from './save.js';

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
    game.ready();
    canvas.focus({ preventScroll: true });
  } catch (e) { failed(e); }
}

// winit on the web ends its event loop by throwing "Using exceptions for control flow"; that is not a failure
function isControlFlow(e) { return /exceptions for control flow/i.test(String((e && e.message) || e)); }

addEventListener('error', (e) => { if (!page.started && !isControlFlow(e.error || e.message)) failed(e.error || e.message); });
// ---- the game's side of the page

const gameName = (() => {
  const g = params.get('game');
  if (g === 'none') return null;
  return g && /^[a-z0-9_-]{1,40}$/i.test(g) ? g : 'orbs';
})();

const game = (() => {
  const hud = $('hud'), dots = $('orbs'), key = $('key'), use = $('use'), reset = $('reset'), say = $('say'), inv = $('inv');
  // what the page showed and played, read by tools/play.mjs
  const rec = (page.game = { name: gameName, total: 0, count: 0, usable: null, said: [], played: {}, events: [], carrying: [], error: null });
  let total = 0, count = 0, usable = null, live = false, touch = matchMedia('(pointer: coarse)').matches, sayTimer = 0, armTimer = 0;

  if (!gameName) { document.body.classList.add('nogame'); return { ready() {} }; }
  const sync = remoteSave({ name: gameName, params, page });
  const showHud = () => hud.classList.toggle('hide', !live || (total === 0 && rec.carrying.length === 0));

  // the inventory: a token per item carried (a key's shape for keys, a coin otherwise)
  const KEY_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6.2" cy="10" r="3.4"/><path d="M9.6 10h8M15 10v3M17.6 10v2.2"/></svg>';
  const COIN_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2.6"/></svg>';
  function carry(items) {
    items = Array.isArray(items) ? items : [];
    const had = new Set(rec.carrying.map((i) => i.id));
    rec.carrying = items.map((i) => ({ id: String(i.id), name: String(i.name || i.id) }));
    inv.replaceChildren(...rec.carrying.map((i) => {
      const t = document.createElement('span');
      t.innerHTML = /key/i.test(`${i.id} ${i.name}`) ? KEY_SVG : COIN_SVG;
      t.title = i.name;
      if (had.has(i.id)) t.style.animation = 'none';
      return t;
    }));
    inv.setAttribute('aria-label', rec.carrying.length ? `carrying ${rec.carrying.map((i) => i.name).join(', ')}` : 'carrying nothing');
    showHud();
  }

  // the counter: as many dots as the script's look_hud says, lit for each found
  function build(n) {
    n = Math.max(0, Math.min(64, Math.round(Number(n) || 0)));
    if (n === total && dots.children.length === n) return;
    total = rec.total = n;
    dots.replaceChildren(...Array.from({ length: n }, () => document.createElement('i')));
    dots.classList.toggle('hide', n === 0);
    showHud();
    paint(false);
  }
  function paint(pop) {
    const all = [...dots.children];
    all.forEach((d, i) => {
      const was = d.classList.contains('on');
      d.classList.toggle('on', i < count);
      if (pop && !was && i < count) { d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }
    });
    dots.classList.toggle('all', total > 0 && count >= total);
    dots.setAttribute('aria-label', `orbs found: ${count} of ${total}`);
  }
  function setCount(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (n === count) return;
    const up = n > count;
    count = rec.count = n;
    paint(up);
  }
  function counter(h) {
    if (!h || typeof h !== 'object') return;
    if ('dots' in h) build(h.dots);
    if ('lit' in h) setCount(h.lit);
  }
  // the script's bytes, for the save record's sha256 (the client fetches its own copy to run)
  const scriptBytes = fetch(`game/${gameName}.star`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);

  // the script didn't load, or a hook failed: what, which hook, its bound and the budget, the line
  const errBox = $('gerr');
  function showError(e) {
    if (!e || typeof e !== 'object') return;
    rec.error = e;
    const file = `game/${e.game || gameName}.star`;
    const head = e.stage === 'load' ? `${file} didn't load` : e.stage === 'fetch' ? `${file} couldn't be fetched` : `${file}: ${e.hook || 'a hook'} failed`;
    const el = (tag, text, cls) => { const x = document.createElement(tag); if (text != null) x.textContent = text; if (cls) x.className = cls; return x; };
    const n = (v) => Number(v).toLocaleString('en-US');
    const rows = [];
    if (e.hook) rows.push(['Hook', e.hook + (e.tier != null ? ` (tier ${e.tier})` : '')]);
    if (e.bound != null) rows.push(['Bound', `${n(e.bound)} steps`]);
    if (e.budget != null) rows.push(['Budget', `${n(e.budget)} steps`]);
    if (e.line != null) rows.push(['Line', `${e.line}${e.column != null ? `:${e.column}` : ''}`]);
    const dl = el('dl');
    for (const [k, v] of rows) dl.append(el('dt', k), el('dd', v));
    const msg = String(e.message || '').replace(/^line \d+(:\d+)?: /, '');
    const close = el('button', 'Dismiss');
    close.type = 'button';
    close.addEventListener('click', () => errBox.classList.add('hide'));
    errBox.replaceChildren(el('h2', head), ...(rows.length ? [dl] : []), ...(e.text ? [el('pre', `${e.line}  ${e.text.trim()}`)] : []), el('p', msg), close);
    errBox.classList.remove('hide');
  }

  // the hint: the use button on touch, the E keycap on desktop, only while something is in reach
  function hint() {
    document.body.classList.toggle('touch', touch);
    use.classList.toggle('hide', !(touch && usable));
    key.classList.toggle('hide', touch || !usable);
  }
  addEventListener('touchstart', () => { if (!touch) { touch = true; hint(); } }, { capture: true, passive: true });
  use.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    sound.unlock();
    window.w3?.use?.();
  });
  use.addEventListener('click', (e) => e.preventDefault());

  // the say line: shown, then faded a few seconds later (longer lines stay longer)
  function sayLine(text) {
    text = String(text || '').trim();
    if (!text) return;
    rec.said.push(text);
    say.textContent = text;
    say.classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => say.classList.remove('show'), 2600 + 45 * text.length);
  }

  // reset: the first tap arms it (it turns and lights), a second within three seconds starts the game over
  reset.addEventListener('click', (e) => {
    e.preventDefault();
    sound.unlock();
    if (!reset.classList.contains('armed')) {
      reset.classList.add('armed');
      clearTimeout(armTimer);
      armTimer = setTimeout(() => reset.classList.remove('armed'), 3000);
      return;
    }
    clearTimeout(armTimer);
    reset.classList.remove('armed');
    window.w3?.reset_game?.();
    sound.play('reset');
    canvas.focus({ preventScroll: true });
  });

  addEventListener('w3game', (e) => {
    const d = e.detail || {};
    rec.events.push(d.type);
    if (d.type === 'hud') counter(d.hud);
    else if (d.type === 'error') showError(d.error);
    else if (d.type === 'sound') sound.play(d.name);
    else if (d.type === 'say') sayLine(d.text);
    else if (d.type === 'usable') { usable = rec.usable = d.id || null; hint(); }
    else if (d.type === 'carrying') carry(d.items);
  });

  return {
    ready() {
      const w3 = window.w3;
      if (typeof w3?.game !== 'function') return; // a client without the game: no controls
      live = true;
      // nothing to start over when the script didn't load
      if (!w3.game()?.error) reset.classList.remove('hide');
      try {
        const g = w3.game();
        counter(g?.hud);
        if (g?.carrying) carry(g.carrying);
        if (g?.error) showError(g.error);
        usable = rec.usable = g?.usable?.id ?? g?.usable ?? null;
      } catch {}
      showHud();
      hint();
      // the remote save starts once the client has its game (the script loaded and any local save restored): the
      // game's id and world come from the script's header, the sha256 from its bytes
      (async () => {
        const t0 = performance.now();
        let g = w3.game();
        while (!g?.loaded && !g?.error && performance.now() - t0 < 15000) { await new Promise((r) => setTimeout(r, 100)); g = w3.game(); }
        if (g?.error) showError(g.error);
        sync.file(g?.loaded ? { id: g.id, world: g.world } : null, await scriptBytes);
        sync.ready();
      })();
    },
  };
})();

// ---- sounds: sample files decoded once, each play a fresh buffer source straight to the output (no synthesis, no
// mixing: the files carry their own level). The context unlocks on the first gesture; a sound before then is skipped.
const sound = (() => {
  const NAMES = ['pickup', 'open', 'wake', 'reset'];
  const rec = (page.sound = { loaded: [], played: {}, skipped: {} });
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = Ctx && gameName ? new Ctx() : null;
  const buf = {};
  if (ctx) for (const n of NAMES) {
    fetch(`sounds/${n}.m4a`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((data) => new Promise((ok, no) => ctx.decodeAudioData(data, ok, no)))
      .then((b) => { buf[n] = b; rec.loaded.push(n); })
      .catch(() => {});
  }
  const unlock = () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });
  return {
    unlock,
    play(name) {
      if (!ctx || !buf[name] || ctx.state !== 'running') { rec.skipped[name] = (rec.skipped[name] || 0) + 1; return; }
      const src = ctx.createBufferSource();
      src.buffer = buf[name];
      src.connect(ctx.destination);
      src.start();
      rec.played[name] = (rec.played[name] || 0) + 1;
    },
  };
})();

boot();
