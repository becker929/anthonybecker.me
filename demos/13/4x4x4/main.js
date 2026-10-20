// 4x4x4: solo chess puzzles in a tower of 4x4 floors, in 3D.
// The rules live in rules.js; this file is the toy around them: the glass
// floors, the orbit camera, the hop-and-launch capture, falls and changes of
// type, the light, the HUD and the act/puzzle numerals.
import * as THREE from "../../engine/three.js";
import { N, MAX_CAPTURES, rulesFor, parse, at } from "./rules.js";

const LEVELS = await fetch("./levels.json").then((r) => r.json());

// Acts carry large numerals, puzzles small ones that restart in each act.
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const actOf = (i) => LEVELS[i].act;
const inAct = (i) => LEVELS.slice(0, i + 1).filter((l) => l.act === LEVELS[i].act).length;
const label = (i) => `${ROMAN[actOf(i)]} · ${ROMAN[inAct(i)].toLowerCase()}`;

// ---------- persistence (a convenience; the page works without it) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("4x4x4:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("4x4x4:" + k, JSON.stringify(v)); } catch {} },
};
let solved = new Set(store.get("solved", []));

// ---------- sound ----------
// Every sound is a file rendered in Ableton Live from wooden-toy foley and
// acoustic samples (zpkt hands/scripts/juice_box), kept in R2 under
// /audio/demos/ and named in sounds.json. The page only starts them: decoded
// once, each play a fresh buffer source straight to the output.
const audio = { ctx: null, buf: {}, on: store.get("sound", true), last: {}, n: {} };
async function loadSounds() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  let files;
  try { files = await (await fetch("./sounds.json")).json(); } catch { return; }
  await Promise.all(Object.entries(files).map(async ([name, file]) => {
    try {
      const data = await (await fetch("/audio/demos/" + file)).arrayBuffer();
      audio.buf[name] = await new Promise((ok, no) => audio.ctx.decodeAudioData(data, ok, no));
    } catch {}
  }));
}
function unlockAudio() { if (audio.ctx && audio.ctx.state !== "running") audio.ctx.resume().catch(() => {}); }
for (const ev of ["pointerdown", "touchend", "click"]) document.addEventListener(ev, unlockAudio, { passive: true });
function play(name) {
  if (!audio.on || !audio.ctx || !audio.buf[name]) return;
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.buf[name];
  src.connect(audio.ctx.destination);
  src.start();
  audio.n[name] = (audio.n[name] || 0) + 1;   // read by the e2e check
}
// Walk a numbered set (drop-1..3, fall-1..3), at most one per 50 ms.
function roundRobin(set, count) {
  const t = performance.now();
  if (t - (audio.last[set] || 0) < 50) return;
  audio.last[set] = t;
  audio[set] = ((audio[set] || 0) % count) + 1;
  play(`${set}-${audio[set]}`);
}
loadSounds();

// ---------- themes: one per group ----------
const THEMES = [
  { bg: "#1a1530", light: "#f7e6c4", dark: "#7a5cc4", sun: 2.4, sky: 1.4 },  // Upstairs: the old board, lamp-lit
  { bg: "#17213d", light: "#e8f0ff", dark: "#5b7bd6", sun: 2.8, sky: 1.2 },  // Slants: raking light
  { bg: "#2a1838", light: "#ffd9b8", dark: "#c0607a", sun: 2.0, sky: 1.3 },  // Footsoldiers: dusk
  { bg: "#14223a", light: "#eef3ff", dark: "#8a9be0", sun: 2.4, sky: 1.5 },  // Unicorn: pearl
  { bg: "#2a1420", light: "#ffe0c8", dark: "#d0583e", sun: 2.2, sky: 1.3 },  // Leap: hot floors
  { bg: "#0d1d2c", light: "#d8f4ff", dark: "#3f8fb0", sun: 2.6, sky: 1.1 },  // Spire: cold and high
  { bg: "#1f1b1b", light: "#d8d0c4", dark: "#7a6e64", sun: 2.4, sky: 1.2 },  // Fall: stone
  { bg: "#231912", light: "#e0c8a8", dark: "#8a5a3a", sun: 2.2, sky: 1.2 },  // Rubble: after the quake
  { bg: "#0b0a16", light: "#6a6390", dark: "#3c365c", sun: 1.0, sky: 0.8 },  // Beacon: dark but one cell
  { bg: "#1d0f2e", light: "#f2d6ff", dark: "#8a3fc4", sun: 2.2, sky: 1.3 },  // Turncoat: masks
  { bg: "#280f2d", light: "#ffd0e8", dark: "#b03f7a", sun: 2.0, sky: 1.2 },  // Masquerade
  { bg: "#08070f", light: "#5c5678", dark: "#35304c", sun: 0.9, sky: 0.7 },  // Last Light
];

// Rule marks for the HUD: drawn, not written.
const ICONS = {
  leap: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>Every take changes floor</title><path d="M2 13h5M9 4h5"/><path d="M4 10.5 11.5 5.5M8.5 5.5h3v3"/></svg>`,
  grav: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>Pieces fall</title><path d="M8 1.5v9M4.5 7 8 10.5 11.5 7M3 14h10"/></svg>`,
  turn: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>You become what you take</title><path d="M3 6a5 5 0 0 1 9-1.5M13 10a5 5 0 0 1-9 1.5"/><path d="M12.5 1.5v3h-3M3.5 14.5v-3h3"/></svg>`,
  goal: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><title>End on the light</title><circle cx="8" cy="8" r="2.6" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>`,
};
const STAR = `<svg viewBox="0 0 16 16" fill="#ffb800"><path d="m8 1 2.1 4.4 4.9.6-3.6 3.4.9 4.8L8 11.9 3.7 14.2l.9-4.8L1 6l4.9-.6z"/></svg>`;
const ARROW = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>`;
const GRID = document.getElementById("levels").innerHTML;
const UNDO = document.getElementById("undo").innerHTML;
const RETRY = document.getElementById("reset").innerHTML;

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
scene.fog = new THREE.Fog("#1a1530", 18, 36);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
const sky = new THREE.HemisphereLight("#ffe8f4", "#2a2050", 1.4);
scene.add(sky);
const sun = new THREE.DirectionalLight("#fff3dd", 2.4);
sun.position.set(-3, 14, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
sun.shadow.bias = -0.002;
scene.add(sun);
const rim = new THREE.DirectionalLight("#7fd8ff", 1.2);
rim.position.set(4, 3, -5);
scene.add(rim);

// Cell (x, y, z) sits at world (x - 1.5, z * H, 1.5 - y): rank 0 is nearest
// you, so pawns take away from you; floors stack upward, H apart.
const H = 1.5;
const world = (x, y, z) => new THREE.Vector3(x - 1.5, z * H, 1.5 - y);

// Drifting background motes, for depth.
{
  const g = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 300; i++) pts.push((Math.random() - 0.5) * 34, Math.random() * 16 - 4, -Math.random() * 18 - 4);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const motes = new THREE.Points(g, new THREE.PointsMaterial({ color: "#b9a8ff", size: 0.06, transparent: true, opacity: 0.7 }));
  motes.name = "motes";
  scene.add(motes);
}

// ---------- the tower (rebuilt per puzzle) ----------
let tower = null;
let tiles = [];
let beacon = null;
const tileGeo = new THREE.BoxGeometry(0.96, 0.3, 0.96);
const glassGeo = new THREE.BoxGeometry(0.94, 0.05, 0.94);
const ringGeo = new THREE.TorusGeometry(0.36, 0.05, 10, 40);

function buildTower(lv, theme) {
  if (tower) scene.remove(tower);
  tower = new THREE.Group();
  scene.add(tower);
  tiles = [];
  for (let z = 0; z < lv.f; z++) {
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      const light = (x + y + z) % 2 === 1;
      const glass = z > 0;
      const m = new THREE.MeshStandardMaterial({
        color: light ? theme.light : theme.dark, roughness: glass ? 0.15 : 0.55, metalness: 0,
        transparent: glass, opacity: glass ? 0.3 : 1, depthWrite: !glass,
      });
      const t = new THREE.Mesh(glass ? glassGeo : tileGeo, m);
      t.position.copy(world(x, y, z)).setY(z * H - (glass ? 0.025 : 0.15));
      t.receiveShadow = !glass;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: "#ff3d6e", transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(world(x, y, z)).setY(z * H + 0.03);
      ring.visible = false;
      tower.add(t, ring);
      t.userData = { cell: [x, y, z], base: m.color.clone(), y0: t.position.y, glass, op: m.opacity, ring };
      tiles.push(t);
    }
    if (z > 0) {
      // A faint rim around each glass floor so it reads as a floor.
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 0.05, 4)),
        new THREE.LineBasicMaterial({ color: theme.light, transparent: true, opacity: 0.45 }));
      edge.position.set(0, z * H - 0.025, 0);
      edge.userData.floor = z;
      tower.add(edge);
    }
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 4.4), new THREE.MeshStandardMaterial({ color: "#3b2a6b", roughness: 0.8 }));
  plinth.position.y = -0.55;
  plinth.receiveShadow = true;
  tower.add(plinth);
  // Under gravity, faint threads mark the columns pieces fall down.
  if (lv.rules.includes("grav") && lv.f > 1) {
    const mat = new THREE.LineBasicMaterial({ color: theme.light, transparent: true, opacity: 0.18 });
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      const a = world(x, y, 0), b = world(x, y, lv.f - 1);
      tower.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.setY(0.02), b.setY((lv.f - 1) * H + 0.6)]), mat));
    }
  }
  // The light: a warm disc and a beam on the goal cell.
  beacon = null;
  if (lv.goal) {
    const [gx, gy, gz] = lv.goal;
    const g = new THREE.Group();
    g.position.copy(world(gx, gy, gz));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 0.85, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: "#ffcf6a", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 0.6;
    const lamp = new THREE.PointLight("#ffb347", 6, 4, 1.6);
    lamp.position.y = 0.5;
    g.add(disc, beam, lamp);
    tower.add(g);
    beacon = { g, disc, beam, lamp };
  }
}

// ---------- pieces ----------
const COLORS = { P: "#ffcf3a", N: "#ff6b8b", B: "#4fd6a4", R: "#4fb0ff", Q: "#c27bff", K: "#ff9a3c", U: "#f1e8ff" };
const SPENT = "#8d86a8";

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
  const mat = new THREE.MeshStandardMaterial({ color: COLORS[t], roughness: 0.28, metalness: 0.05, transparent: true });
  const body = new THREE.Group();
  g.add(body);
  body.add(lathe([[0, 0], [0.34, 0], [0.34, 0.08], [0.27, 0.13], [0.2, 0.16]], mat));
  const tall = { P: 0.34, N: 0.4, B: 0.5, R: 0.42, Q: 0.6, K: 0.62, U: 0.46 }[t];
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
  if (t === "U") {
    // A pearl orb with a spiral horn: it only ever moves through corners.
    body.add(part(new THREE.SphereGeometry(0.16, 24, 16), mat, 0, top + 0.12, 0));
    const hornMat = new THREE.MeshStandardMaterial({ color: "#ffd84a", roughness: 0.25, metalness: 0.3, emissive: "#ffb000", emissiveIntensity: 0.25, transparent: true });
    const horn = part(new THREE.ConeGeometry(0.075, 0.46, 16), hornMat, 0, top + 0.42, 0.06);
    horn.rotation.x = 0.4;
    body.add(horn);
    g.userData.extra = hornMat;
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
    body.rotation.y = Math.PI;
  }
  // A footprint in the piece's colour on its own floor, so a piece standing
  // on glass reads as standing there and not floating between floors.
  const footMat = new THREE.MeshBasicMaterial({ color: COLORS[t], transparent: true, opacity: 0.45, depthWrite: false });
  const foot = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 32), footMat);
  foot.rotation.x = -Math.PI / 2;
  foot.position.y = 0.006;
  g.add(foot);
  g.userData.foot = footMat;
  // Capture pips: one bead per capture left, orbiting the base.
  const pips = [];
  const pipMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6c8", emissiveIntensity: 0.9, transparent: true });
  for (let i = 0; i < MAX_CAPTURES; i++) {
    const p = part(new THREE.SphereGeometry(0.055, 12, 8), pipMat, 0, 0.06, 0);
    g.add(p);
    pips.push(p);
  }
  Object.assign(g.userData, { t, mat, pipMat, body, pips, spin: Math.random() * 6 });
  return g;
}

// ---------- game state ----------
let level = Math.min(store.get("level", 0), LEVELS.length - 1);
let lv = LEVELS[level];
let R = rulesFor(lv);
let pos = [];
let meshes = new Map();   // piece id -> group
let history = [];
let selected = null;
let busy = false;
let combo = 0;
let won = false;
let solo = null;          // floor shown alone, or null
let shownAct = 0;

const flying = [];
const sparks = [];
const tweens = [];
let shake = 0;
let now = 0;

function tween(dur, fn, done) { tweens.push({ t0: now, dur, fn, done }); }
const ease = (k) => 1 - Math.pow(1 - k, 3);
const pieceAt = (x, y, z) => at(pos, x, y, z);

function clearPieces() {
  for (const g of meshes.values()) scene.remove(g);
  meshes = new Map();
}
function placePieces() {
  clearPieces();
  for (const p of pos) {
    const g = buildPiece(p.t);
    g.position.copy(world(p.x, p.y, p.z));
    scene.add(g);
    meshes.set(p.i, g);
  }
}

// ---------- camera: drag to orbit ----------
const cam = { yaw: 0.42, pitch: 0.62, f: 0 };
function frameFor(f) {
  if (cam.f === f) return;
  cam.f = f;
  cam.yaw = 0.42;
  cam.pitch = f <= 1 ? 0.85 : f === 2 ? 0.7 : 0.6;
}
function camPos() {
  const f = lv.f;
  const centre = new THREE.Vector3(0, ((f - 1) * H) / 2 + 0.25, 0);
  const dist = (8.6 + f * 1.3) * Math.max(1, 1.02 / camera.aspect);
  const c = Math.cos(cam.pitch);
  return { centre, eye: new THREE.Vector3(Math.sin(cam.yaw) * c * dist, Math.sin(cam.pitch) * dist, Math.cos(cam.yaw) * c * dist).add(centre) };
}

const actEl = document.getElementById("act");
let gen = 0;   // bumped per load, so late timers from the last puzzle do nothing
function load(i) {
  gen++;
  tweens.length = 0;
  actEl.style.opacity = "0";
  pops.innerHTML = "";
  for (const s of sparks) scene.remove(s.m);
  sparks.length = 0;
  for (const f of flying) scene.remove(f.g);
  flying.length = 0;
  level = i;
  lv = LEVELS[level];
  R = rulesFor(lv);
  store.set("level", level);
  pos = parse(lv.p);
  history = [];
  selected = null;
  won = false;
  combo = 0;
  solo = null;
  const theme = THEMES[lv.group % THEMES.length];
  scene.background.set(theme.bg);
  scene.fog.color.set(theme.bg);
  stage.style.background = theme.bg;
  sky.intensity = theme.sky;
  sun.intensity = theme.sun;
  frameFor(lv.f);
  buildTower(lv, theme);
  buildFloorPips();
  clearPieces();
  busy = true;
  pos.forEach((p, k) => {
    const g = buildPiece(p.t);
    const home = world(p.x, p.y, p.z);
    const lift = 7 + k * 0.6;
    g.position.copy(home).setY(home.y + lift);
    scene.add(g);
    meshes.set(p.i, g);
    tween(0.55 + k * 0.07, (e) => {
      const b = e < 0.7 ? ease(e / 0.7) : 1 - Math.sin(((e - 0.7) / 0.3) * Math.PI) * 0.08;
      g.position.y = home.y + lift - lift * Math.min(1, b);
      g.scale.setScalar(e > 0.7 ? 1 + Math.sin(((e - 0.7) / 0.3) * Math.PI) * 0.12 : 1);
    }, () => { g.position.y = home.y; g.scale.setScalar(1); roundRobin("drop", 3); if (k === pos.length - 1) busy = false; });
  });
  refreshPieces();
  paint();
  hud();
  hideCard();
  if (lv.act !== shownAct) { shownAct = lv.act; showAct(lv.act); }
}

// The act's numeral, large, for a moment.
function showAct(a) {
  actEl.textContent = ROMAN[a];
  tween(1.8, (e) => {
    actEl.style.opacity = String(e < 0.25 ? e / 0.25 : e > 0.7 ? 1 - (e - 0.7) / 0.3 : 1);
    actEl.style.transform = `scale(${0.85 + ease(Math.min(1, e * 2)) * 0.15})`;
  }, () => { actEl.style.opacity = "0"; });
}

function refreshPieces() {
  for (const p of pos) {
    const g = meshes.get(p.i);
    if (!g) continue;
    const left = MAX_CAPTURES - p.c;
    g.userData.pips.forEach((pip, i) => { pip.visible = i < left; });
    const spent = left === 0;
    g.userData.mat.color.set(spent ? SPENT : COLORS[p.t]);
    g.userData.mat.roughness = spent ? 0.7 : 0.28;
    g.userData.foot.color.set(spent ? SPENT : COLORS[p.t]);
  }
  applySolo();
}

// One floor alone: the others fade and stop taking taps.
function applySolo() {
  const dim = (z) => solo !== null && z !== solo;
  for (const t of tiles) {
    const z = t.userData.cell[2];
    t.material.opacity = dim(z) ? 0.06 : t.userData.op;
    t.material.transparent = t.userData.glass || dim(z);
    t.material.depthWrite = !t.material.transparent;
  }
  tower?.children.forEach((o) => { if (o.userData.floor != null) o.material.opacity = dim(o.userData.floor) ? 0.08 : 0.45; });
  const tg = selected ? R.targets(pos, selected) : [];
  for (const p of pos) {
    const g = meshes.get(p.i);
    if (!g) continue;
    const target = tg.some((t) => t[0] === p.x && t[1] === p.y && t[2] === p.z);
    const o = dim(p.z) ? (target ? 0.55 : 0.12) : 1;
    g.userData.mat.opacity = o;
    g.userData.pipMat.opacity = o;
    g.userData.foot.opacity = 0.45 * o;
    if (g.userData.extra) g.userData.extra.opacity = o;
    g.userData.mat.depthWrite = o === 1;
  }
}

const floorsEl = document.getElementById("floors");
function buildFloorPips() {
  floorsEl.innerHTML = "";
  if (lv.f < 2) return;
  for (let z = 0; z < lv.f; z++) {
    const b = document.createElement("button");
    b.setAttribute("aria-label", `Floor ${z + 1} alone`);
    b.setAttribute("aria-pressed", "false");
    b.onclick = () => {
      play("click");
      solo = solo === z ? null : z;
      [...floorsEl.children].forEach((c, k) => c.setAttribute("aria-pressed", String(solo === k)));
      if (selected && solo !== null && selected.z !== solo) selected = null;
      applySolo();
      paint();
    };
    floorsEl.appendChild(b);
  }
}

// Targets glow; rays run from the piece to each; under Leap, the takes that
// the floor forbids show as grey rings, and the mover's own floor warms.
const rays = new THREE.Group();
scene.add(rays);
function paint() {
  applySolo();
  rays.clear();
  const tg = selected ? R.targets(pos, selected) : [];
  const bar = selected ? R.barred(pos, selected) : [];
  const has = (list, [x, y, z]) => list.some((c) => c[0] === x && c[1] === y && c[2] === z);
  for (const t of tiles) {
    const c = t.userData.cell;
    const hit = has(tg, c), barred = has(bar, c);
    const sel = selected && selected.x === c[0] && selected.y === c[1] && selected.z === c[2];
    const hot = R.leap && selected && c[2] === selected.z && !sel;
    t.material.color.copy(t.userData.base);
    t.material.emissive.set(hit ? "#ff3d6e" : sel ? "#ffd84a" : hot ? "#ff5a1e" : "#000000");
    t.material.emissiveIntensity = hit ? 0.45 : sel ? 0.6 : hot ? 0.22 : 0;
    t.userData.hot = hit;
    t.userData.ring.visible = hit || barred;
    t.userData.ring.material.color.set(hit ? "#ff3d6e" : "#6d6688");
    t.userData.ring.material.opacity = hit ? 1 : 0.7;
  }
  if (selected) {
    const a = world(selected.x, selected.y, selected.z).add(new THREE.Vector3(0, 0.3, 0));
    const leaper = MOVES_LEAP.has(selected.t);
    for (const c of tg) {
      const b = world(...c).add(new THREE.Vector3(0, 0.3, 0));
      const mat = leaper
        ? new THREE.LineDashedMaterial({ color: "#ff7a9a", dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.8 })
        : new THREE.LineBasicMaterial({ color: "#ff7a9a", transparent: true, opacity: 0.7 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(leaper ? arc(a, b) : [a, b]), mat);
      if (leaper) line.computeLineDistances();
      rays.add(line);
    }
  }
}
const MOVES_LEAP = new Set(["N", "K", "P"]);
function arc(a, b) {
  const pts = [];
  for (let k = 0; k <= 16; k++) { const e = k / 16; pts.push(a.clone().lerp(b, e).setY(a.y + (b.y - a.y) * e + Math.sin(e * Math.PI) * 0.7)); }
  return pts;
}

function anyMoves() { return pos.some((p) => R.targets(pos, p).length); }

// ---------- capture ----------
function capture(from, to) {
  const victim = pieceAt(...to);
  const gm = meshes.get(from.i), gv = meshes.get(victim.i);
  history.push(pos);
  const next = R.move(pos, from, to);
  busy = true;
  selected = null;
  paint();

  const a = gm.position.clone(), b = world(...to);
  const dist = a.distanceTo(b);
  const knight = from.t === "N";
  play(knight ? "hop-knight" : "hop");
  const h = knight ? 1.6 : 0.6 + dist * 0.22;
  tween(0.28 + dist * 0.05, (e) => {
    const k = ease(e);
    gm.position.lerpVectors(a, b, k);
    gm.position.y = a.y + (b.y - a.y) * k + Math.sin(e * Math.PI) * h;
    gm.rotation.y = knight ? e * Math.PI * 2 : 0;
    gm.scale.set(1 - Math.sin(e * Math.PI) * 0.1, 1 + Math.sin(e * Math.PI) * 0.15, 1 - Math.sin(e * Math.PI) * 0.1);
  }, () => {
    gm.position.copy(b);
    gm.rotation.y = 0;
    launch(gv, a, b);
    meshes.delete(victim.i);
    combo++;
    play(`capture-${Math.min(combo, 6)}`);
    shake = Math.min(0.35, 0.12 + combo * 0.04);
    burst(b, COLORS[victim.t], 26 + combo * 6);
    pop(b, combo > 1 ? `x${combo}!` : "BONK", COLORS[victim.t]);
    const tile = tiles.find((t) => t.userData.cell[0] === to[0] && t.userData.cell[1] === to[1] && t.userData.cell[2] === to[2]);
    tween(0.3, (e) => { tile.position.y = tile.userData.y0 - Math.sin(e * Math.PI) * 0.12; }, () => { tile.position.y = tile.userData.y0; });

    // Turncoat: the mover becomes what it took.
    let mover = gm;
    if (R.turn && victim.t !== from.t) {
      scene.remove(gm);
      mover = buildPiece(victim.t);
      mover.position.copy(b);
      scene.add(mover);
      meshes.set(from.i, mover);
      play("morph");
      burst(b, COLORS[victim.t], 18);
      tween(0.35, (e) => { const s = e < 0.5 ? 0.4 + e * 1.8 : 1.3 - (e - 0.5) * 0.6; mover.scale.setScalar(s); }, () => mover.scale.setScalar(1));
    } else {
      tween(0.22, (e) => { const s = Math.sin(e * Math.PI); mover.scale.set(1 + s * 0.25, 1 - s * 0.3, 1 + s * 0.25); }, () => mover.scale.setScalar(1));
    }

    const before = new Map(pos.map((p) => [p.i, p.i === from.i ? { ...p, x: to[0], y: to[1], z: to[2] } : p]));
    pos = next;
    refreshPieces();
    hud();
    // Gravity: anything left hanging drops to its new floor.
    const falls = pos.filter((p) => before.get(p.i).z !== p.z);
    const settle = () => {
      busy = false;
      if (R.done(pos)) win();
      else if (pos.length === 1) missed();
      else if (!anyMoves()) stuck();
    };
    if (!falls.length) return settle();
    let left = falls.length;
    falls.forEach((p, k) => {
      const g = meshes.get(p.i);
      const y0 = before.get(p.i).z * H, y1 = p.z * H;
      const drop = y0 - y1;
      const g0 = gen;
      setTimeout(() => {
        if (g0 !== gen) return;
        tween(0.22 + Math.sqrt(drop) * 0.14, (e) => { g.position.y = y0 - drop * e * e; }, () => {
          g.position.y = y1;
          roundRobin("fall", 3);
          shake = Math.max(shake, 0.18);
          dust(world(p.x, p.y, p.z));
          tween(0.2, (e) => { const s = Math.sin(e * Math.PI); g.scale.set(1 + s * 0.2, 1 - s * 0.25, 1 + s * 0.2); }, () => g.scale.setScalar(1));
          if (--left === 0) settle();
        });
      }, 120 + k * 60);
    });
  });
}

function launch(g, from, to) {
  const dir = to.clone().sub(from).setY(0);
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
    m.position.copy(at).setY(at.y + 0.4);
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
    sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s), life: 0.8 + Math.random() * 0.5, floor: at.y });
    scene.add(m);
  }
}
function dust(at) {
  const mat = new THREE.MeshBasicMaterial({ color: "#d8cfc0", transparent: true });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(sparkGeo, mat);
    m.position.copy(at).setY(at.y + 0.05);
    const a = (i / 14) * Math.PI * 2;
    sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.6, 0.6 + Math.random() * 0.8, Math.sin(a) * 1.6), life: 0.5 + Math.random() * 0.3, floor: at.y, puff: true });
    scene.add(m);
  }
}
function confetti() {
  const cols = Object.values(COLORS);
  const top = (lv.f - 1) * H;
  for (let i = 0; i < 160; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true }));
    m.position.set((Math.random() - 0.5) * 6, top + 5 + Math.random() * 4, (Math.random() - 0.5) * 6);
    sparks.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2), life: 3.5 + Math.random() * 2, flutter: Math.random() * 6, drag: true });
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
  const p = at.clone();
  tween(0.9, (e) => {
    const v = p.clone().setY(p.y + 1.2 + e * 1.2).project(camera);
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
  const p = pos[0];
  const g = meshes.get(p.i);
  const y = p.z * H;
  tween(1.2, (e) => {
    g.position.y = y + Math.abs(Math.sin(e * Math.PI * 3)) * 0.8 * (1 - e);
    g.rotation.y = ease(e) * Math.PI * 4;
  }, () => { g.position.y = y; });
  confetti();
  play("solved");
  shake = 0.25;
  const last = level === LEVELS.length - 1;
  const g0 = gen;
  setTimeout(() => {
    if (g0 !== gen) return;
    showCard(`${STAR}${last ? `<button data-act="menu" aria-label="All puzzles">${GRID}</button>` : `<button data-act="next" class="go" aria-label="Next puzzle">${ARROW}</button>`}`);
    hud();
  }, 900);
}
function failCard() {
  showCard(`<button data-act="undo" aria-label="Undo">${UNDO}</button><button data-act="reset" class="go" aria-label="Retry">${RETRY}</button>`);
}
function stuck() {
  combo = 0;
  const g0 = gen;
  setTimeout(() => { if (g0 === gen) { play("stuck"); failCard(); } }, 450);
}
// One piece left, but not on the light.
function missed() {
  combo = 0;
  const g0 = gen;
  setTimeout(() => {
    if (g0 !== gen) return;
    play("stuck");
    if (beacon) tween(0.8, (e) => { beacon.disc.material.opacity = 0.85 * (0.5 + 0.5 * Math.cos(e * Math.PI * 6)); });
    failCard();
  }, 450);
}

card.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (act) play("click");
  if (act === "next") load(level + 1);
  if (act === "undo") undo();
  if (act === "reset") load(level);
  if (act === "menu") openMenu();
});

// ---------- controls ----------
function undo() {
  if (busy || !history.length) return;
  play("undo");
  hideCard();
  won = false;
  combo = Math.max(0, combo - 1);
  pos = history.pop();
  placePieces();
  selected = null;
  refreshPieces();
  paint();
  hud();
}

function hint() {
  if (busy || won) return;
  const sols = R.solve(pos, 1);
  if (!sols.length) {
    play("nope");
    pop(new THREE.Vector3(0, ((lv.f - 1) * H) / 2, 0), "undo", "#ff8aa5");
    return;
  }
  play("hint");
  const [fx, fy, fz, tx, ty, tz] = sols[0][0];
  if (solo !== null && (fz !== solo || tz !== solo)) { solo = null; [...floorsEl.children].forEach((c) => c.setAttribute("aria-pressed", "false")); applySolo(); }
  selected = pieceAt(fx, fy, fz);
  paint();
  const t = tiles.find((q) => q.userData.cell[0] === tx && q.userData.cell[1] === ty && q.userData.cell[2] === tz);
  tween(1.2, (e) => { t.material.emissive.set("#5effc8"); t.material.emissiveIntensity = 0.5 + Math.sin(e * Math.PI * 6) * 0.4; }, () => paint());
}

document.getElementById("undo").onclick = undo;
document.getElementById("reset").onclick = () => !busy && (play("click"), load(level));
document.getElementById("hint").onclick = hint;
document.getElementById("prev").onclick = () => !busy && level > 0 && (play("click"), load(level - 1));
document.getElementById("next").onclick = () => !busy && level < LEVELS.length - 1 && (play("click"), load(level + 1));
document.getElementById("levels").onclick = () => { play("click"); menu.hidden ? openMenu() : (menu.hidden = true); };
const soundBtn = document.getElementById("sound");
function paintSound() {
  soundBtn.setAttribute("aria-pressed", String(audio.on));
  soundBtn.querySelector(".waves").style.display = audio.on ? "" : "none";
  soundBtn.querySelector(".mute").style.display = audio.on ? "none" : "";
}
soundBtn.onclick = () => { audio.on = !audio.on; store.set("sound", audio.on); paintSound(); play("click"); };
paintSound();

// The menu: one act per page, its numeral large, one row per group.
const menu = document.getElementById("menu");
let menuAct = 1;
const ACTS = [...new Set(LEVELS.map((l) => l.act))];
function openMenu(a = lv.act) {
  menuAct = a;
  const rows = [];
  const groups = [...new Set(LEVELS.filter((l) => l.act === a).map((l) => l.group))];
  for (const g of groups) {
    const items = LEVELS.map((l, i) => [l, i]).filter(([l]) => l.group === g);
    rows.push(`<div class="row" role="group" aria-label="${items[0][0].name}" title="${items[0][0].name}">${items.map(([, i]) =>
      `<button data-i="${i}" class="${solved.has(i) ? "done" : ""} ${i === level ? "cur" : ""}" aria-label="${label(i)}">${ROMAN[inAct(i)].toLowerCase()}</button>`).join("")}</div>`);
  }
  menu.innerHTML = `<div class="head"><button class="flip" data-flip="-1" aria-label="Previous act" ${a === ACTS[0] ? "disabled" : ""}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg></button>
    <div class="big">${ROMAN[a]}</div>
    <button class="flip" data-flip="1" aria-label="Next act" ${a === ACTS.at(-1) ? "disabled" : ""}>${ARROW}</button></div>${rows.join("")}`;
  menu.hidden = false;
}
menu.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b?.dataset.flip) { play("click"); openMenu(menuAct + +b.dataset.flip); return; }
  if (b?.dataset.i) { play("click"); load(+b.dataset.i); }
  menu.hidden = true;
});

function hud() {
  const icons = [...lv.rules.filter((r) => ICONS[r]).map((r) => ICONS[r]), lv.goal ? ICONS.goal : ""].join("");
  document.getElementById("lvl").innerHTML = `<span>${ROMAN[lv.act]}</span><span class="dot">·</span><span class="lo">${ROMAN[inAct(level)].toLowerCase()}</span><span id="icons">${icons}</span>`;
  document.getElementById("left").textContent = String(pos.length);
  document.getElementById("star").hidden = !solved.has(level);
}

// ---------- picking ----------
// Taps pass through empty glass: the first piece, glowing target or solid
// tile along the ray wins, and floors faded by a solo don't count.
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pieceIdOf(o) {
  while (o) { for (const [id, g] of meshes) if (g === o) return id; o = o.parent; }
  return null;
}
function cellAt(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...tiles, ...meshes.values()], true);
  const cellOf = (h) => {
    if (h.object.userData.cell) return h.object.userData.cell;
    const id = pieceIdOf(h.object);
    const p = id == null ? null : pos.find((q) => q.i === id);
    return p ? [p.x, p.y, p.z] : null;
  };
  // With a piece in hand, a target anywhere along the ray wins, even behind
  // another piece or on a faded floor.
  if (selected) {
    const tg = R.targets(pos, selected);
    for (const h of hits) {
      const c = cellOf(h);
      if (c && tg.some((t) => t[0] === c[0] && t[1] === c[1] && t[2] === c[2])) return c;
    }
  }
  for (const h of hits) {
    if (h.object.userData.cell) {
      const [x, y, z] = h.object.userData.cell;
      if (solo !== null && z !== solo) continue;
      if (h.object.userData.hot || pieceAt(x, y, z) || !h.object.userData.glass) return [x, y, z];
      continue;
    }
    const id = pieceIdOf(h.object);
    const p = id == null ? null : pos.find((q) => q.i === id);
    if (!p || (solo !== null && p.z !== solo)) continue;
    return [p.x, p.y, p.z];
  }
  return null;
}

function tap(ev) {
  if (busy || won || !menu.hidden) return;
  const c = cellAt(ev);
  if (!c) { selected = null; paint(); return; }
  const p = pieceAt(...c);
  if (selected && R.targets(pos, selected).some(([x, y, z]) => x === c[0] && y === c[1] && z === c[2])) {
    capture(selected, c);
    return;
  }
  if (p && p !== selected) {
    selected = p;
    const n = R.targets(pos, p).length;
    play(n ? "pick" : "nope");
    if (!n) pop(world(p.x, p.y, p.z), p.c >= MAX_CAPTURES ? "tired" : "no takes", "#b8b0d8");
  } else selected = null;
  paint();
}

// A short press is a tap; a drag turns the tower.
let drag = null;
canvas.addEventListener("pointerdown", (ev) => {
  drag = { x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId };
  canvas.setPointerCapture?.(ev.pointerId);
});
canvas.addEventListener("pointermove", (ev) => {
  if (drag && drag.id === ev.pointerId) {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 10) drag.moved = true;
    if (drag.moved) {
      cam.yaw = Math.max(-1.25, Math.min(1.25, cam.yaw - dx * 0.008));
      cam.pitch = Math.max(0.22, Math.min(1.35, cam.pitch + dy * 0.006));
      drag.x = ev.clientX; drag.y = ev.clientY;
    }
    return;
  }
  if (ev.pointerType === "mouse") {
    const c = cellAt(ev);
    canvas.style.cursor = c && (pieceAt(...c) || tiles.some((t) => t.userData.hot && t.userData.cell.join() === c.join())) ? "pointer" : "grab";
  }
});
canvas.addEventListener("pointerup", (ev) => {
  if (!drag || drag.id !== ev.pointerId) return;
  const wasDrag = drag.moved;
  drag = null;
  if (!wasDrag) tap(ev);
});
canvas.addEventListener("pointercancel", () => { drag = null; });

// ---------- loop ----------
let last = performance.now();
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
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
      s.v.y -= (s.puff ? 4 : 14) * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += dt * 9;
      if (s.m.position.y < s.floor + 0.04) { s.m.position.y = s.floor + 0.04; s.v.multiplyScalar(0.4); s.v.y *= -1; }
    }
    s.life -= dt;
    s.m.material.opacity = Math.min(1, s.life * 2);
    if (s.life <= 0) { scene.remove(s.m); sparks.splice(i, 1); }
  }

  for (const tl of tiles) if (tl.userData.ring.visible) {
    const s = 1 + Math.sin(now * 8) * 0.08;
    tl.userData.ring.scale.set(s, s, s);
  }
  if (beacon) {
    beacon.beam.material.opacity = 0.14 + Math.sin(now * 2.2) * 0.06;
    beacon.lamp.intensity = 5 + Math.sin(now * 2.2) * 1.5;
    beacon.beam.rotation.y = now * 0.3;
  }

  // Idle life: pieces breathe, the selected one bobs high, pips orbit.
  for (const p of pos) {
    const g = meshes.get(p.i);
    if (!g) continue;
    const u = g.userData;
    u.spin += dt * 1.6;
    u.pips.forEach((pip, i) => {
      const a = u.spin + (i / MAX_CAPTURES) * Math.PI * 2;
      pip.position.set(Math.cos(a) * 0.4, 0.07, Math.sin(a) * 0.4);
    });
    if (!busy && !won) {
      const sel = p === selected;
      const target = p.z * H + (sel ? 0.35 + Math.sin(now * 6) * 0.06 : 0);
      g.position.y += (target - g.position.y) * Math.min(1, dt * 12);
      g.children.find((c) => c.geometry?.type === "RingGeometry").position.y = p.z * H - g.position.y + 0.006;
      u.body.rotation.z = sel ? Math.sin(now * 9) * 0.06 : 0;
    }
  }

  const { centre, eye } = camPos();
  camera.position.copy(eye);
  if (!drag?.moved) camera.position.x += Math.sin(now * 0.4) * 0.2;
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.2);
  }
  camera.lookAt(centre);
  scene.getObjectByName("motes").rotation.y = now * 0.02;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

load(level);
requestAnimationFrame(frame);

// For the e2e check: where a cell is on screen, the position, and a solution.
window.__4x4x4 = {
  audio,
  levels: LEVELS.length,
  state: () => ({ level, left: pos.length, busy, won, label: label(level), solo, menu: !menu.hidden, sel: selected && [selected.x, selected.y, selected.z] }),
  solution: () => R.solve(pos, 1)[0] || null,
  load: (i) => load(i),
  screenOf(x, y, z) {
    const v = world(x, y, z).add(new THREE.Vector3(0, 0.25, 0)).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  },
};
