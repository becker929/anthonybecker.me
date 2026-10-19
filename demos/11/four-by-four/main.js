// Four by Four: solo chess puzzles on a 4x4 board, in 3D.
// The rules live in rules.js; this file is the toy box around them:
// building the pieces, the hop-and-launch capture, the confetti, the HUD.
import * as THREE from "../../engine/three.js";
import { N, MAX_CAPTURES, targets, move, solve, parse, at } from "./rules.js";

const LEVELS = await fetch("./levels.json").then((r) => r.json());

// ---------- persistence (a convenience; the page works without it) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("4x4:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("4x4:" + k, JSON.stringify(v)); } catch {} },
};
let solved = new Set(store.get("solved", []));

// ---------- scene ----------
const stage = document.getElementById("stage");
const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1a1530");
scene.fog = new THREE.Fog("#1a1530", 14, 30);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
const CAM_BASE = new THREE.Vector3(0, 5.8, 5.1);

scene.add(new THREE.HemisphereLight("#ffe8f4", "#2a2050", 1.4));
const sun = new THREE.DirectionalLight("#fff3dd", 2.4);
sun.position.set(-3, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
sun.shadow.bias = -0.002;
scene.add(sun);
const rim = new THREE.DirectionalLight("#7fd8ff", 1.2);
rim.position.set(4, 3, -5);
scene.add(rim);

// Square (x, y) sits at world (x - 1.5, 0, 1.5 - y): rank 0 is nearest you,
// so pawns capture away from you, up the board.
const world = (x, y) => new THREE.Vector3(x - 1.5, 0, 1.5 - y);

const board = new THREE.Group();
scene.add(board);
const tileGeo = new THREE.BoxGeometry(0.96, 0.4, 0.96);
const tiles = [];
for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
  const light = (x + y) % 2 === 1;
  const m = new THREE.MeshStandardMaterial({ color: light ? "#f7e6c4" : "#7a5cc4", roughness: 0.55 });
  const t = new THREE.Mesh(tileGeo, m);
  t.position.copy(world(x, y)).setY(-0.2);
  t.receiveShadow = true;
  t.userData = { sq: [x, y], base: m.color.clone(), y0: -0.2 };
  board.add(t);
  tiles.push(t);
  // Target marker: a glowing ring that sits on the tile when it can be taken.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.05, 10, 40),
    new THREE.MeshBasicMaterial({ color: "#ff3d6e", transparent: true }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(world(x, y)).setY(0.03);
  ring.visible = false;
  scene.add(ring);
  t.userData.ring = ring;
}
const plinth = new THREE.Mesh(
  new THREE.BoxGeometry(4.4, 0.5, 4.4),
  new THREE.MeshStandardMaterial({ color: "#3b2a6b", roughness: 0.8 }),
);
plinth.position.y = -0.55;
plinth.receiveShadow = true;
board.add(plinth);

// Drifting background motes, for depth.
{
  const g = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 300; i++) pts.push((Math.random() - 0.5) * 30, Math.random() * 12 - 4, -Math.random() * 18 - 3);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const motes = new THREE.Points(g, new THREE.PointsMaterial({ color: "#b9a8ff", size: 0.06, transparent: true, opacity: 0.7 }));
  motes.name = "motes";
  scene.add(motes);
}

// ---------- pieces ----------
const COLORS = { P: "#ffcf3a", N: "#ff6b8b", B: "#4fd6a4", R: "#4fb0ff", Q: "#c27bff", K: "#ff9a3c" };
const NAMES = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };

function lathe(pts, mat) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), 28), mat);
  m.castShadow = true;
  return m;
}
function part(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildPiece(t) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS[t], roughness: 0.28, metalness: 0.05 });
  const body = new THREE.Group();
  g.add(body);
  body.add(lathe([[0, 0], [0.34, 0], [0.34, 0.08], [0.27, 0.13], [0.2, 0.16]], mat));
  const tall = { P: 0.34, N: 0.4, B: 0.5, R: 0.42, Q: 0.6, K: 0.62 }[t];
  body.add(lathe([[0.2, 0.15], [0.14, tall * 0.55], [0.11, tall], [0.17, tall + 0.03], [0, tall + 0.05]], mat));
  const top = tall + 0.04;
  if (t === "P") body.add(part(new THREE.SphereGeometry(0.15, 24, 16), mat, 0, top + 0.1, 0));
  if (t === "B") {
    const h = part(new THREE.SphereGeometry(0.14, 24, 16), mat, 0, top + 0.13, 0);
    h.scale.y = 1.45;
    body.add(h, part(new THREE.SphereGeometry(0.05, 12, 8), mat, 0, top + 0.36, 0));
  }
  if (t === "R") {
    body.add(lathe([[0, top], [0.2, top], [0.2, top + 0.14], [0, top + 0.14]], mat));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      body.add(part(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat, Math.cos(a) * 0.15, top + 0.19, Math.sin(a) * 0.15));
    }
  }
  if (t === "Q") {
    body.add(part(new THREE.SphereGeometry(0.15, 24, 16), mat, 0, top + 0.08, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      body.add(part(new THREE.SphereGeometry(0.05, 12, 8), mat, Math.cos(a) * 0.17, top + 0.2, Math.sin(a) * 0.17));
    }
    body.add(part(new THREE.SphereGeometry(0.06, 12, 8), mat, 0, top + 0.28, 0));
  }
  if (t === "K") {
    body.add(part(new THREE.CylinderGeometry(0.16, 0.12, 0.16, 20), mat, 0, top + 0.08, 0));
    body.add(part(new THREE.BoxGeometry(0.07, 0.26, 0.07), mat, 0, top + 0.3, 0));
    body.add(part(new THREE.BoxGeometry(0.2, 0.07, 0.07), mat, 0, top + 0.33, 0));
  }
  if (t === "N") {
    const head = new THREE.Group();
    head.position.set(0, top + 0.06, 0);
    head.add(part(new THREE.BoxGeometry(0.2, 0.34, 0.24), mat, 0, 0.12, 0));
    const snout = part(new THREE.BoxGeometry(0.18, 0.15, 0.24), mat, 0, 0.2, 0.17);
    snout.rotation.x = 0.35;
    head.add(snout);
    head.add(part(new THREE.ConeGeometry(0.05, 0.12, 8), mat, -0.06, 0.33, -0.05));
    head.add(part(new THREE.ConeGeometry(0.05, 0.12, 8), mat, 0.06, 0.33, -0.05));
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#1a1530" });
    head.add(part(new THREE.SphereGeometry(0.025, 8, 6), eyeMat, -0.1, 0.22, 0.1));
    head.add(part(new THREE.SphereGeometry(0.025, 8, 6), eyeMat, 0.1, 0.22, 0.1));
    body.add(head);
  }
  // Face the knight's snout toward the far side, the way you'd set one up.
  if (t === "N") body.rotation.y = Math.PI;

  // Capture pips: one bead per capture left, orbiting the base.
  const pips = [];
  const pipMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6c8", emissiveIntensity: 0.9 });
  for (let i = 0; i < MAX_CAPTURES; i++) {
    const p = part(new THREE.SphereGeometry(0.055, 12, 8), pipMat, 0, 0.06, 0);
    g.add(p);
    pips.push(p);
  }
  g.userData = { t, mat, body, pips, spin: Math.random() * 6 };
  return g;
}

// ---------- game state ----------
let level = Math.min(store.get("level", 0), LEVELS.length - 1);
let pos = [];          // rules positions
let meshes = new Map(); // piece object -> group
let history = [];
let selected = null;
let busy = false;
let combo = 0;
let won = false;

const flying = [];   // knocked-off pieces
const sparks = [];   // particle bursts
const tweens = [];   // { t0, dur, fn(k), done }
let shake = 0;

function tween(dur, fn, done) { tweens.push({ t0: now, dur, fn, done }); }
const ease = (k) => 1 - Math.pow(1 - k, 3);

function clearPieces() {
  for (const g of meshes.values()) scene.remove(g);
  meshes = new Map();
}

function load(i) {
  level = i;
  store.set("level", level);
  pos = parse(LEVELS[level].p);
  history = [];
  selected = null;
  won = false;
  combo = 0;
  clearPieces();
  pos.forEach((p, k) => {
    const g = buildPiece(p.t);
    g.position.copy(world(p.x, p.y)).setY(6 + k * 0.6);
    scene.add(g);
    meshes.set(p, g);
    // Drop in with a bounce, staggered.
    busy = true;
    tween(0.55 + k * 0.07, (e) => {
      const b = e < 0.7 ? ease(e / 0.7) : 1 - Math.sin(((e - 0.7) / 0.3) * Math.PI) * 0.08;
      g.position.y = 6 + k * 0.6 - (6 + k * 0.6) * Math.min(1, b);
      g.scale.setScalar(e > 0.7 ? 1 + Math.sin(((e - 0.7) / 0.3) * Math.PI) * 0.12 : 1);
    }, () => { g.position.y = 0; g.scale.setScalar(1); if (k === pos.length - 1) busy = false; });
  });
  refreshPips();
  paintTiles();
  hud();
  hideCard();
}

// Pieces in the new position are new objects; carry each mesh across by square.
function remap(oldPos, newPos, mover, to) {
  const next = new Map();
  for (const p of newPos) {
    const src = p.x === to[0] && p.y === to[1] ? mover : oldPos.find((o) => o.x === p.x && o.y === p.y);
    next.set(p, meshes.get(src));
  }
  meshes = next;
}

function refreshPips() {
  for (const [p, g] of meshes) {
    const left = MAX_CAPTURES - p.c;
    g.userData.pips.forEach((pip, i) => { pip.visible = i < left; });
    const spent = left === 0;
    g.userData.mat.color.set(spent ? "#8d86a8" : COLORS[p.t]);
    g.userData.mat.roughness = spent ? 0.7 : 0.28;
  }
}

function paintTiles() {
  const tg = selected ? targets(pos, selected) : [];
  for (const t of tiles) {
    const [x, y] = t.userData.sq;
    const hit = tg.some(([a, b]) => a === x && b === y);
    const sel = selected && selected.x === x && selected.y === y;
    t.material.color.copy(t.userData.base);
    t.material.emissive.set(hit ? "#ff3d6e" : sel ? "#ffd84a" : "#000000");
    t.material.emissiveIntensity = hit ? 0.35 : sel ? 0.6 : 0;
    t.userData.hot = hit;
    t.userData.ring.visible = hit;
  }
}

function anyMoves() { return pos.some((p) => targets(pos, p).length); }

// ---------- capture ----------
function capture(from, to) {
  const victim = at(pos, to[0], to[1]);
  const gm = meshes.get(from), gv = meshes.get(victim);
  history.push(pos);
  const next = move(pos, from, to);
  busy = true;
  selected = null;
  paintTiles();

  const a = gm.position.clone(), b = world(to[0], to[1]);
  const dist = a.distanceTo(b);
  const knight = from.t === "N";
  const h = knight ? 1.6 : 0.6 + dist * 0.25;
  tween(0.28 + dist * 0.05, (e) => {
    const k = ease(e);
    gm.position.lerpVectors(a, b, k);
    gm.position.y = Math.sin(e * Math.PI) * h;
    gm.rotation.y = knight ? e * Math.PI * 2 : 0;
    gm.scale.set(1 - Math.sin(e * Math.PI) * 0.1, 1 + Math.sin(e * Math.PI) * 0.15, 1 - Math.sin(e * Math.PI) * 0.1);
  }, () => {
    gm.position.copy(b);
    gm.rotation.y = 0;
    // Landing squash.
    tween(0.22, (e) => { const s = Math.sin(e * Math.PI); gm.scale.set(1 + s * 0.25, 1 - s * 0.3, 1 + s * 0.25); }, () => gm.scale.setScalar(1));
    launch(gv, a, b);
    combo++;
    shake = Math.min(0.35, 0.12 + combo * 0.04);
    burst(b, COLORS[victim.t], 26 + combo * 6);
    pop(b, combo > 1 ? `x${combo}!` : "BONK", COLORS[victim.t]);
    const tile = tiles.find((t) => t.userData.sq[0] === to[0] && t.userData.sq[1] === to[1]);
    tween(0.3, (e) => { tile.position.y = tile.userData.y0 - Math.sin(e * Math.PI) * 0.15; }, () => { tile.position.y = tile.userData.y0; });

    remap(pos, next, from, to);
    pos = next;
    refreshPips();
    hud();
    busy = false;
    if (pos.length === 1) win();
    else if (!anyMoves()) stuck();
  });
}

function launch(g, from, at) {
  const dir = at.clone().sub(from).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  flying.push({
    g,
    v: new THREE.Vector3(dir.x * 5 + (Math.random() - 0.5) * 2, 6 + Math.random() * 2, dir.z * 5 + (Math.random() - 0.5) * 2),
    w: new THREE.Vector3(Math.random() * 14 - 7, Math.random() * 10 - 5, Math.random() * 14 - 7),
    life: 2.2,
  });
}

const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
function burst(at, color, n) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat);
    m.position.copy(at).setY(0.4);
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
    sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s), life: 0.8 + Math.random() * 0.5 });
    scene.add(m);
  }
}

function confetti() {
  const cols = Object.values(COLORS);
  for (let i = 0; i < 160; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true }));
    m.position.set((Math.random() - 0.5) * 6, 5 + Math.random() * 4, (Math.random() - 0.5) * 6);
    sparks.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2), life: 3 + Math.random() * 2, flutter: Math.random() * 6, drag: true });
    scene.add(m);
  }
}

// ---------- floating words ----------
const pops = document.getElementById("pops");
function pop(at, text, color) {
  const el = document.createElement("div");
  el.className = "pop";
  el.textContent = text;
  el.style.color = color;
  pops.appendChild(el);
  const p = at.clone().setY(1.2);
  tween(0.9, (e) => {
    const v = p.clone().setY(1.2 + e * 1.2).project(camera);
    el.style.left = ((v.x + 1) / 2) * 100 + "%";
    el.style.top = ((1 - v.y) / 2) * 100 + "%";
    el.style.opacity = String(1 - e * e);
    el.style.transform = `translate(-50%, -50%) scale(${0.6 + ease(Math.min(1, e * 3)) * 0.8})`;
  }, () => el.remove());
}

// ---------- outcome cards ----------
const card = document.getElementById("card");
function showCard(html) { card.innerHTML = html; card.hidden = false; }
function hideCard() { card.hidden = true; }

function win() {
  won = true;
  solved.add(level);
  store.set("solved", [...solved]);
  const g = [...meshes.values()][0];
  g.userData.mat.color.set(COLORS[pos[0].t]);
  g.userData.mat.roughness = 0.28;
  tween(1.2, (e) => {
    g.position.y = Math.abs(Math.sin(e * Math.PI * 3)) * 0.8 * (1 - e);
    g.rotation.y = ease(e) * Math.PI * 4;
  }, () => { g.position.y = 0; });
  confetti();
  shake = 0.25;
  const last = level === LEVELS.length - 1;
  setTimeout(() => {
    showCard(`<b>Solved!</b><span>The ${NAMES[pos[0].t]} stands alone. ${solved.size}/${LEVELS.length} cleared.</span>
      ${last ? `<button data-act="menu">All levels</button>` : `<button data-act="next" class="go">Next puzzle</button>`}`);
    hud();
  }, 900);
}

function stuck() {
  combo = 0;
  setTimeout(() => {
    showCard(`<b>Stuck</b><span>${pos.length} pieces left, and nobody can take anybody.</span>
      <div class="row"><button data-act="undo">Undo</button><button data-act="reset" class="go">Retry</button></div>`);
  }, 450);
}

card.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (act === "next") load(level + 1);
  if (act === "undo") undo();
  if (act === "reset") load(level);
  if (act === "menu") openMenu();
});

// ---------- controls ----------
function undo() {
  if (busy || !history.length) return;
  hideCard();
  won = false;
  combo = Math.max(0, combo - 1);
  pos = history.pop();
  clearPieces();
  for (const p of pos) {
    const g = buildPiece(p.t);
    g.position.copy(world(p.x, p.y));
    scene.add(g);
    meshes.set(p, g);
  }
  selected = null;
  refreshPips();
  paintTiles();
  hud();
}

function hint() {
  if (busy || won) return;
  const sols = solve(pos, 1);
  if (!sols.length) {
    pop(new THREE.Vector3(0, 0.6, 0), "dead end: undo", "#ff8aa5");
    return;
  }
  const [fx, fy, tx, ty] = sols[0][0];
  selected = at(pos, fx, fy);
  paintTiles();
  const t = tiles.find((q) => q.userData.sq[0] === tx && q.userData.sq[1] === ty);
  tween(1.2, (e) => { t.material.emissive.set("#5effc8"); t.material.emissiveIntensity = 0.4 + Math.sin(e * Math.PI * 6) * 0.4; }, () => paintTiles());
}

document.getElementById("undo").onclick = undo;
document.getElementById("reset").onclick = () => !busy && load(level);
document.getElementById("hint").onclick = hint;
document.getElementById("prev").onclick = () => !busy && level > 0 && load(level - 1);
document.getElementById("next").onclick = () => !busy && level < LEVELS.length - 1 && load(level + 1);
document.getElementById("levels").onclick = openMenu;

const menu = document.getElementById("menu");
function openMenu() {
  menu.innerHTML = LEVELS.map((l, i) =>
    `<button data-i="${i}" class="${solved.has(i) ? "done" : ""} ${i === level ? "cur" : ""}">${i + 1}<small>${l.p.split(" ").length}</small></button>`).join("");
  menu.hidden = false;
}
menu.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) load(+b.dataset.i);
  menu.hidden = true;
});

function hud() {
  document.getElementById("lvl").textContent = `Puzzle ${level + 1} / ${LEVELS.length}`;
  document.getElementById("left").textContent = `${pos.length} piece${pos.length === 1 ? "" : "s"} left`;
  document.getElementById("star").hidden = !solved.has(level);
}

// ---------- picking ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hoverSq = null;

function squareAt(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const objs = [...tiles, ...meshes.values()];
  for (const h of ray.intersectObjects(objs, true)) {
    let o = h.object;
    while (o && !o.userData.sq && !meshes.has(pieceOf(o))) o = o.parent;
    if (!o) continue;
    if (o.userData.sq) return o.userData.sq;
    const p = pieceOf(o);
    if (p) return [p.x, p.y];
  }
  return null;
}
function pieceOf(o) { for (const [p, g] of meshes) if (g === o) return p; return null; }

let downAt = null;
canvas.addEventListener("pointerdown", (ev) => { downAt = [ev.clientX, ev.clientY]; });
canvas.addEventListener("pointerup", (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 12) return;
  downAt = null;
  if (busy || won || !menu.hidden) return;
  const sq = squareAt(ev);
  if (!sq) { selected = null; paintTiles(); return; }
  const p = at(pos, sq[0], sq[1]);
  if (selected && targets(pos, selected).some(([x, y]) => x === sq[0] && y === sq[1])) {
    capture(selected, sq);
    return;
  }
  if (p && p !== selected) {
    selected = p;
    if (!targets(pos, p).length) pop(world(p.x, p.y), p.c >= MAX_CAPTURES ? "tired" : "no takes", "#b8b0d8");
  } else selected = null;
  paintTiles();
});
canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType !== "mouse") return;
  hoverSq = squareAt(ev);
  canvas.style.cursor = hoverSq && (at(pos, ...hoverSq) || tiles.find((t) => t.userData.hot && t.userData.sq[0] === hoverSq[0] && t.userData.sq[1] === hoverSq[1])) ? "pointer" : "default";
});

// ---------- loop ----------
let now = 0, last = performance.now();
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Pull back on tall, narrow screens so the whole board fits.
  camera.position.copy(CAM_BASE).multiplyScalar(Math.max(1, 1.05 / camera.aspect));
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  now += dt;

  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const e = Math.min(1, (now - tw.t0) / tw.dur);
    tw.fn(e);
    if (e >= 1) { tweens.splice(i, 1); tw.done?.(); }
  }

  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i];
    f.v.y -= 18 * dt;
    f.g.position.addScaledVector(f.v, dt);
    f.g.rotation.x += f.w.x * dt; f.g.rotation.y += f.w.y * dt; f.g.rotation.z += f.w.z * dt;
    f.life -= dt;
    if (f.life <= 0) { scene.remove(f.g); flying.splice(i, 1); }
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    if (s.drag) {
      s.m.position.addScaledVector(s.v, dt);
      s.m.position.x += Math.sin(now * 3 + s.flutter) * dt;
      s.m.rotation.x += dt * 4; s.m.rotation.y += dt * 3;
    } else {
      s.v.y -= 14 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += dt * 9;
      if (s.m.position.y < 0.04) { s.m.position.y = 0.04; s.v.multiplyScalar(0.4); s.v.y *= -1; }
    }
    s.life -= dt;
    s.m.material.opacity = Math.min(1, s.life * 2);
    if (s.life <= 0) { scene.remove(s.m); sparks.splice(i, 1); }
  }

  for (const t of tiles) if (t.userData.ring.visible) {
    const s = 1 + Math.sin(now * 8) * 0.08;
    t.userData.ring.scale.set(s, s, s);
  }

  // Idle life: pieces breathe, the selected one bobs high, pips orbit.
  for (const [p, g] of meshes) {
    const u = g.userData;
    u.spin += dt * 1.6;
    u.pips.forEach((pip, i) => {
      const a = u.spin + (i / MAX_CAPTURES) * Math.PI * 2;
      pip.position.set(Math.cos(a) * 0.4, 0.07, Math.sin(a) * 0.4);
    });
    if (!busy && !won) {
      const sel = p === selected;
      const target = sel ? 0.35 + Math.sin(now * 6) * 0.06 : 0;
      g.position.y += (target - g.position.y) * Math.min(1, dt * 12);
      u.body.rotation.z = sel ? Math.sin(now * 9) * 0.06 : 0;
    }
  }

  // Gentle sway plus shake.
  const base = CAM_BASE.clone().multiplyScalar(Math.max(1, 1.05 / camera.aspect));
  camera.position.set(base.x + Math.sin(now * 0.4) * 0.25, base.y, base.z);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.2);
  }
  camera.lookAt(0, -0.3, 0.2);
  scene.getObjectByName("motes").rotation.y = now * 0.02;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

load(level);
requestAnimationFrame(frame);

// For the e2e check: where a square lands on screen, in client pixels.
window.fourByFour = {
  screenOf(x, y) {
    const r = canvas.getBoundingClientRect();
    const v = world(x, y).project(camera);
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  },
  level: () => level,
  pieces: () => pos.length,
};
