// Catoids of ATProto: a Bluesky account, read from its public profile, turned into a catoid.
// Chernoff's faces put each number of a record on one feature of a face; this puts each number of an
// account on one proportion of a cat. Everything is public (the profile and the last 100 posts, from
// the public AppView), nothing is stored, and the same account always makes the same cat.

import { createRenderer, frame } from './catoid.js';

const API = 'https://public.api.bsky.app/xrpc/';
const $ = (id) => document.getElementById(id);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a + (b - a) * t;
const lg = (v) => Math.log10(1 + Math.max(0, v));

// The simcluster on the first day of catoid week (27 October 2026): who was posting catoids.
const HERD = [
  'norvid-studies.bsky.social', 'all-paperclips.bsky.social', 'minormobius.bsky.social', 'codewright.bsky.social',
  'cee.wtf', 'antiali.as', 'oscillatory.net', 'croissanthology.com', 'gracekind.net', 'shimmermathlabs.com',
  'funferall.bsky.social', 'moultano.bsky.social', 'anthonybecker.bsky.social',
];

// Real cat coats (sRGB, converted to linear for the shader), each tabby or plain.
const COATS = [
  ['orange tabby', '#d0863a', 1], ['grey tabby', '#8a8f99', 1], ['black', '#26262b', 0], ['cream', '#d9c3a0', 0],
  ['brown tabby', '#7a5a3e', 1], ['white', '#ece7dc', 0], ['blue', '#6f7787', 0], ['silver tabby', '#b9bcc2', 1],
  ['tortie', '#5a3c2c', 1], ['ginger', '#c4652c', 0],
];
const RIMS = [['magenta', '#ff2bd6'], ['cyan', '#22e6ff'], ['acid', '#b6ff3b'], ['amber', '#ffb02e']];
const EYES = [['green', '#3fbf6a'], ['amber', '#e0a020'], ['blue', '#4aa3ff'], ['copper', '#c8642a']];
// How each catoid is cast, by the account's dice: after the sculptors whose work Room World's Catoid Forms follow.
export const FORMS = [['coat', 'a coat and stripes'], ['gyroid', 'a gyroid lattice, after Bathsheba Grossman'], ['wire', 'woven wire, after Ruth Asawa']];
const lin = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);

/** FNV-1a over the DID: the account's fixed dice. */
function dice(did) {
  let h = 2166136261;
  for (const ch of did) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

/** Accession number: four hex groups from the DID. */
const accession = (did) => { const r = dice(did + '#acc'); return Array.from({ length: 3 }, () => Math.floor(r() * 65536).toString(16).toUpperCase().padStart(4, '0')).join('-'); };

/** The account's numbers, then the catoid. Every mapping is listed in `legend`. */
export function catoidOf(p, weekPosts) {
  const ageDays = Math.max(1, (Date.now() - Date.parse(p.createdAt || p.indexedAt || Date.now())) / 86400000);
  const posts = p.postsCount ?? 0, followers = p.followersCount ?? 0, follows = p.followsCount ?? 0;
  const bio = (p.description || '').length;
  const perDay = posts / ageDays;
  const r = dice(p.did);
  const coat = COATS[Math.floor(r() * COATS.length)], rim = RIMS[Math.floor(r() * RIMS.length)], eye = EYES[Math.floor(r() * EYES.length)];
  const form = Math.floor(r() * FORMS.length);
  // body: posting a lot stretches you out into Hot-dog Kitty; posting little settles you into Jimothy
  const sweep = 1 - clamp01((lg(perDay) - lg(0.5)) / (lg(60) - lg(0.5))); // half a post a day: Jimothy; sixty: Hot-dog Kitty
  const legs = mix(0.7, 1.35, clamp01((lg(followers) - 2) / 3)); // 100 followers to 100,000
  const ears = mix(0.55, 1.7, clamp01(lg(follows) / 3.7));
  const tail = mix(0.45, 1.45, clamp01(ageDays / 1100));
  const head = mix(0.85, 1.25, clamp01(bio / 256));
  const gait = mix(0.5, 6.5, clamp01(lg(weekPosts) / 2));
  const c = {
    L: mix(1.3, 0.3, sweep), R: mix(0.19, 0.62, sweep), leg: mix(0.62, 0.24, sweep) * legs, head: mix(0.23, 0.33, sweep) * head,
    tail: mix(1.05, 0.5, sweep) * tail, ear: ears, gait, stripes: coat[2] ? mix(13, 7, sweep) : 0,
    coat: lin(coat[1]), rim: lin(rim[1]), eye: lin(eye[1]), sweep, form,
  };
  const legend = [
    ['body', `${perDay.toFixed(1)} posts a day`, sweep < 0.34 ? 'Hot-dog Kitty' : sweep > 0.66 ? 'Jimothy' : 'the sweet spot', 'posting stretches it long; quiet makes it round'],
    ['legs', `${followers.toLocaleString()} followers`, `${Math.round(legs * 100)}%`, 'followers stand it up'],
    ['ears', `follows ${follows.toLocaleString()}`, `${Math.round(ears * 100)}%`, 'who it listens to'],
    ['tail', `${Math.round(ageDays)} days on Bluesky`, `${Math.round(tail * 100)}%`, 'it grows with age'],
    ['head', `a ${bio}-character bio`, `${Math.round(head * 100)}%`, 'what it says about itself'],
    ['gait', `${weekPosts}${weekPosts >= 100 ? '+' : ''} posts this week`, `${gait.toFixed(1)} strides/s`, 'how busy it is now'],
    ['coat', 'its DID', `${coat[0]}, ${eye[0]} eyes, ${rim[0]} light`, 'the account\'s fixed dice'],
    ['cast', 'its DID', FORMS[form][0], FORMS[form][1]],
  ];
  return { c, legend, coat: coat[0] };
}

async function xrpc(method, params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of [].concat(v)) q.append(k, x); // arrays repeat the key
  const r = await fetch(`${API}${method}?${q}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `${method}: ${r.status}`);
  return r.json();
}

async function weekPostsOf(did) {
  try {
    const feed = await xrpc('app.bsky.feed.getAuthorFeed', { actor: did, limit: 100, filter: 'posts_no_replies' });
    const since = Date.now() - 7 * 86400000;
    return feed.feed.filter((f) => f.post.author.did === did && Date.parse(f.post.record.createdAt) > since).length;
  } catch { return 0; }
}

// ---- the big view ----
const view = $('view');
const R = createRenderer(view);
let current = null, spin = 0.9, dragging = null;
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = view.clientWidth, h = view.clientHeight;
  view.width = Math.round(w * dpr * 0.75); view.height = Math.round(h * dpr * 0.75);
}
addEventListener('resize', resize);
view.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, s: spin }; view.setPointerCapture(e.pointerId); });
view.addEventListener('pointermove', (e) => { if (dragging) spin = dragging.s - (e.clientX - dragging.x) * 0.008; });
view.addEventListener('pointerup', () => { dragging = null; });
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!dragging) spin += dt * 0.12;
  if (current && R) { const f = frame(current.c, spin); R.draw(current.c, now / 1000, f.cam, f.look, 1); }
  requestAnimationFrame(loop);
}

function showForms() {
  $('forms').innerHTML = FORMS.map(([k], i) => `<button type="button" class="${current?.c.form === i ? '' : 'ghost'}" data-f="${i}">${k}</button>`).join('');
  for (const b of $('forms').querySelectorAll('button')) b.onclick = () => { if (current) { current.c.form = Number(b.dataset.f); showForms(); } };
}
function showLegend(who, cat) {
  $('who').textContent = who.displayName ? `${who.displayName}` : who.handle;
  $('handle-line').textContent = `@${who.handle}`;
  $('acc').textContent = `CATOID ${accession(who.did)}`;
  $('legend').innerHTML = cat.legend.map(([k, src, val, why]) => `<tr><th>${k}</th><td>${esc(src)}</td><td class="val">${esc(val)}</td><td class="why">${esc(why)}</td></tr>`).join('');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function load(handle, push = true) {
  handle = handle.trim().replace(/^@/, '');
  if (!handle) return;
  $('status').textContent = `reading @${handle}…`;
  try {
    const p = await xrpc('app.bsky.actor.getProfile', { actor: handle });
    const week = await weekPostsOf(p.did);
    const cat = catoidOf(p, week);
    current = { ...cat, who: p };
    showLegend(p, cat);
    showForms();
    $('status').textContent = '';
    $('handle').value = p.handle;
    if (push) history.replaceState(null, '', `?h=${encodeURIComponent(p.handle)}`);
    document.title = `${p.handle} as a catoid — Catoids of ATProto`;
  } catch (e) {
    $('status').textContent = `Couldn't read @${handle}: ${e.message}`;
  }
}
window.__catoid = { load, catoidOf, get current() { return current; } };

$('form').addEventListener('submit', (e) => { e.preventDefault(); load($('handle').value); });

// ---- the herd, and its corpus map ----
const thumbCanvas = document.createElement('canvas');
thumbCanvas.width = 240; thumbCanvas.height = 180;
const T = createRenderer(thumbCanvas, { preserve: true });
async function herd() {
  const res = await xrpc('app.bsky.actor.getProfiles', { actors: HERD }).catch(() => ({ profiles: [] }));
  const weeks = await Promise.all(res.profiles.map((p) => weekPostsOf(p.did)));
  const cats = res.profiles.map((p, i) => ({ p, ...catoidOf(p, weeks[i]) }));
  const grid = $('herd');
  grid.innerHTML = '';
  const map = $('map'), ctx = map.getContext('2d');
  const W = map.width, H = map.height;
  ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1d2030'; ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo((W * i) / 10, 0); ctx.lineTo((W * i) / 10, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, (H * i) / 10); ctx.lineTo(W, (H * i) / 10); ctx.stroke(); }
  ctx.fillStyle = '#8a8fb0'; ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.fillText('← Hot-dog Kitty', 10, H - 10); ctx.textAlign = 'right'; ctx.fillText('Jimothy →', W - 10, H - 10);
  ctx.save(); ctx.translate(16, H / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('taller ↑', 0, 0); ctx.restore();
  ctx.textAlign = 'center';
  const spots = [];
  for (const k of cats) {
    const f = frame(k.c, 0.75, 0.82);
    T.draw(k.c, 1.3, f.cam, f.look, 0);
    const url = thumbCanvas.toDataURL('image/jpeg', 0.85);
    const b = document.createElement('button');
    b.className = 'cat';
    b.innerHTML = `<img alt="" src="${url}"><span>@${esc(k.p.handle)}</span>`;
    b.onclick = () => { load(k.p.handle); scrollTo({ top: 0, behavior: 'smooth' }); };
    grid.appendChild(b);
    // on the map: x is the body sweep, y the legs; small jitter so twins don't cover each other
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    const legs = k.c.leg / mix(0.62, 0.24, k.c.sweep);
    let x = 60 + k.c.sweep * (W - 120), y = H - 50 - clamp01((legs - 0.7) / 0.65) * (H - 110);
    for (let n = 0; n < 12 && spots.some((s) => Math.abs(s[0] - x) < 90 && Math.abs(s[1] - y) < 80); n++) y += y > H / 2 ? -84 : 84;
    spots.push([x, y]);
    ctx.drawImage(img, x - 48, y - 36, 96, 72);
    ctx.fillStyle = '#d7dbf0'; ctx.fillText(k.p.handle.replace('.bsky.social', ''), x, y + 48);
  }
  $('herd-status').textContent = `${cats.length} catoids`;
}

// ---- a card to post ----
$('save').addEventListener('click', () => {
  if (!current) return;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const r = createRenderer(c, { preserve: true });
  const f = frame(current.c, 0.62, 0.92);
  r.draw(current.c, 2.0, f.cam, f.look, 1);
  const out = document.createElement('canvas');
  out.width = 1200; out.height = 630;
  const g = out.getContext('2d');
  g.drawImage(c, 0, 0);
  g.fillStyle = 'rgba(5,5,10,0.72)'; g.fillRect(0, 0, 1200, 92);
  g.fillStyle = '#f2f3ff'; g.font = '600 40px ui-monospace, Menlo, monospace'; g.fillText(`@${current.who.handle}`, 36, 58);
  g.fillStyle = '#ff5ae0'; g.font = '22px ui-monospace, Menlo, monospace'; g.textAlign = 'right'; g.fillText(`CATOID ${accession(current.who.did)}`, 1164, 56);
  g.textAlign = 'left'; g.fillStyle = 'rgba(5,5,10,0.72)'; g.fillRect(0, 570, 1200, 60);
  g.fillStyle = '#a8adc8'; g.font = '20px ui-monospace, Menlo, monospace';
  g.fillText(`${current.legend[0][2]} · #catoidweek · anthonybecker.me/demos/14/catoids-of-atproto`, 36, 608);
  const a = document.createElement('a');
  a.download = `catoid-${current.who.handle}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
});

if (!R) {
  $('status').textContent = 'This browser has no WebGL2, so the catoids cannot be drawn.';
} else {
  resize();
  requestAnimationFrame(loop);
  load(new URLSearchParams(location.search).get('h') || 'norvid-studies.bsky.social', false);
  herd();
}
