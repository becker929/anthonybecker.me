/*!
 * Buster Whack 3D — movement + animation prototype.
 *
 * The 2D game moves the buster one square per hop: a crouch, an arc, a
 * landing squash, then the rest of the ration as cooldown, and the square
 * you count as standing on changes at the top of the arc. This prototype
 * keeps that model exactly and asks one question: what does that hop look
 * like on a body with knees?
 *
 * Nothing here is a game yet. No enemies, no fire, no clock. A board, a
 * humanoid, three ways to ask it to step, and the pose curves that sell
 * each phase of the step.
 */

import * as THREE from "./three.module.min.js";

// ---------- board ----------

const COLS = 6;
const ROWS = 3;
const PCOLS = 3;              // the player's half, as in the game
const TILE = 1;               // world units per square
const GAP = 0.08;

// ---------- the hop ----------
// The 2D game runs 30 / 80 / 55 ms with a 195 ms ration. A body with limbs
// needs a beat longer for the crouch and the landing to read, so these are
// roughly doubled. The ration is the sum, so a held direction chains hops
// with no dead frame between them.
const HOP_WINDUP_MS = 60;     // the crouch before leaving the ground
const HOP_AIR_MS = 170;       // the arc
const HOP_SETTLE_MS = 110;    // the landing squash and recovery
const HOP_TOTAL_MS = HOP_WINDUP_MS + HOP_AIR_MS + HOP_SETTLE_MS;
const HOP_COMMIT_MS = HOP_WINDUP_MS + HOP_AIR_MS / 2;   // the square changes here
const MOVE_MS = HOP_TOTAL_MS; // the step ration
const HOP_HEIGHT = 0.5;
const REFACE_MS = 420;        // after this long idle, turn back to face the enemy half

// Drag-as-stick: a finger has to leave this radius (CSS px) before the board
// reads a direction; a lift that never left it is a tap on a square.
const STICK_DEAD_PX = 26;

// ---------- palette (the game's) ----------

const PAL = {
  bg: 0x0d1117,
  tilePlayer: 0x1b2a4a, tilePlayerEdge: 0x4f8dff,
  tileEnemy: 0x3a1d2b, tileEnemyEdge: 0xff5470,
  body: 0x4f8dff, bodyDark: 0x2f5fc4, visor: 0xc9f6ff, barrel: 0xffd23f,
  ripple: 0x4f8dff,
};

// ---------- easing ----------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeInQuad = (t) => t * t;
const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
/** Overshoots past 1 then returns: the landing's spring. */
const easeOutBack = (t) => { const c = 1.7; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
/** Shortest signed angle from a to b. */
const angleDelta = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------- world <-> tile ----------

const tileX = (col) => (col - (COLS - 1) / 2) * TILE;
const tileZ = (row) => (row - (ROWS - 1) / 2) * TILE;
const onBoard = (col, row) => col >= 0 && col < COLS && row >= 0 && row < ROWS;

// ---------- scene ----------

const container = document.getElementById("stage");
const hud = {
  phase: document.getElementById("hud-phase"),
  tile: document.getElementById("hud-tile"),
};

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
scene.fog = new THREE.Fog(PAL.bg, 14, 26);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
const CAM_POS = new THREE.Vector3(0, 5.6, 7.4);
const camTarget = new THREE.Vector3(0, 0.2, 0.2);
camera.position.copy(CAM_POS);
camera.lookAt(camTarget);

// Lights: a cool sky over a warm-dark ground, plus one key light with shadows
// so the hop's height reads on the tile it left.
scene.add(new THREE.HemisphereLight(0x9fbfff, 0x1a1420, 0.85));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-3.5, 7, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 1; key.shadow.camera.far = 20;
key.shadow.camera.left = -5; key.shadow.camera.right = 5;
key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
key.shadow.bias = -0.0015;
scene.add(key);
const rim = new THREE.DirectionalLight(0xff5470, 0.35);
rim.position.set(5, 3, -4);
scene.add(rim);

// Ground: a dark plane under the tiles catches the shadow and the fog.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x0a0e15, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.12;
ground.receiveShadow = true;
scene.add(ground);

// Tiles. The player's half is blue, the far half red, as in the game.
const tiles = [];
const tileGeo = new THREE.BoxGeometry(TILE - GAP, 0.12, TILE - GAP);
const edgeGeo = new THREE.EdgesGeometry(tileGeo);
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const mine = col < PCOLS;
    const mesh = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({
      color: mine ? PAL.tilePlayer : PAL.tileEnemy, roughness: 0.85, metalness: 0.05,
    }));
    mesh.position.set(tileX(col), -0.06, tileZ(row));
    mesh.receiveShadow = true;
    mesh.userData = { col, row };
    const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
      color: mine ? PAL.tilePlayerEdge : PAL.tileEnemyEdge, transparent: true, opacity: 0.55,
    }));
    mesh.add(edges);
    scene.add(mesh);
    tiles.push(mesh);
  }
}

// ---------- the character ----------
// Built from boxes, rigged as nested groups so a pose is a set of rotations.
// The model faces +x at rest: the barrel out to the right, towards the enemy
// half, the way the 2D buster stands.

const matBody = new THREE.MeshStandardMaterial({ color: PAL.body, roughness: 0.55, metalness: 0.1, flatShading: true });
const matDark = new THREE.MeshStandardMaterial({ color: PAL.bodyDark, roughness: 0.6, metalness: 0.15, flatShading: true });
const matVisor = new THREE.MeshStandardMaterial({ color: PAL.visor, emissive: PAL.visor, emissiveIntensity: 0.9, roughness: 0.2 });
const matBarrel = new THREE.MeshStandardMaterial({ color: PAL.barrel, emissive: PAL.barrel, emissiveIntensity: 0.35, roughness: 0.4 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A limb segment hangs from its pivot: the mesh is offset down by half its length. */
function segment(w, len, d, mat) {
  const g = new THREE.Group();
  g.add(box(w, len, d, mat, 0, -len / 2, 0));
  return g;
}

function buildCharacter() {
  const root = new THREE.Group();          // at the tile centre, y = ground
  const squash = new THREE.Group();        // non-uniform scale for the landing
  root.add(squash);

  const HIP_Y = 0.78;
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  squash.add(hips);

  // torso hangs UP from the hips (pivot at the waist so a lean bends there)
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(box(0.46, 0.5, 0.3, matBody, 0, 0.27, 0));
  torso.add(box(0.5, 0.14, 0.34, matDark, 0, 0.56, 0));   // the dark band across the shoulders
  torso.add(box(0.18, 0.1, 0.12, matDark, 0, 0.06, 0.17)); // belt buckle, so the front reads

  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  head.add(box(0.36, 0.34, 0.36, matDark, 0, 0.17, 0));
  const visor = box(0.06, 0.09, 0.3, matVisor, 0.17, 0.19, 0);   // on the +x face: the model looks along +x
  visor.castShadow = false;
  head.add(visor);

  const shoulderY = 0.56;
  const armL = segment(0.13, 0.36, 0.13, matBody);     // upper arm, pivot at the shoulder
  armL.position.set(0, shoulderY, -0.32);
  const foreL = segment(0.11, 0.32, 0.11, matDark);
  foreL.position.y = -0.36;
  armL.add(foreL);
  torso.add(armL);

  const armR = segment(0.13, 0.36, 0.13, matBody);
  armR.position.set(0, shoulderY, 0.32);
  const foreR = segment(0.11, 0.32, 0.11, matDark);
  foreR.position.y = -0.36;
  armR.add(foreR);
  // the buster barrel: along the right forearm, poking past the hand
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.42, 10), matBarrel);
  barrel.position.set(0, -0.34, 0);
  barrel.castShadow = true;
  foreR.add(barrel);
  torso.add(armR);

  // legs hang DOWN from the hips
  const legL = segment(0.16, 0.38, 0.16, matDark);
  legL.position.set(0, 0, -0.14);
  const shinL = segment(0.14, 0.36, 0.14, matBody);
  shinL.position.y = -0.38;
  shinL.add(box(0.26, 0.1, 0.15, matDark, 0.06, -0.36, 0));  // foot, toes towards +x
  legL.add(shinL);
  hips.add(legL);

  const legR = segment(0.16, 0.38, 0.16, matDark);
  legR.position.set(0, 0, 0.14);
  const shinR = segment(0.14, 0.36, 0.14, matBody);
  shinR.position.y = -0.38;
  shinR.add(box(0.26, 0.1, 0.15, matDark, 0.06, -0.36, 0));
  legR.add(shinR);
  hips.add(legR);

  return { root, squash, hips, HIP_Y, torso, head, armL, foreL, armR, foreR, legL, shinL, legR, shinR };
}

const rig = buildCharacter();
scene.add(rig.root);

// Landing rings: a flat ring that grows and fades where a foot comes down.
const ripples = [];
const rippleGeo = new THREE.RingGeometry(0.28, 0.36, 32);
function ripple(x, z, color, scaleTo = 1.6, ms = 380) {
  const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.005, z);
  scene.add(m);
  ripples.push({ m, t0: now(), ms, scaleTo });
}
function updateRipples(t) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const u = clamp01((t - r.t0) / r.ms);
    const s = lerp(0.6, r.scaleTo, easeOutQuad(u));
    r.m.scale.set(s, s, s);
    r.m.material.opacity = 0.9 * (1 - u);
    if (u >= 1) { scene.remove(r.m); r.m.material.dispose(); ripples.splice(i, 1); }
  }
}

// ---------- state ----------

// `?slow=4` runs the clock at a quarter speed: the same hop, stretched, for
// looking at the poses. Everything is timed off this one clock, so nothing
// else has to know.
const SLOW = Math.max(1, Number(new URLSearchParams(location.search).get("slow")) || 1);
const now = () => performance.now() / SLOW;

const state = {
  col: 1, row: 1,             // the square counted as stood on
  hop: null,                  // { fromCol, fromRow, toCol, toRow, t0, committed }
  lastMoveAt: -1e9,
  lastIdleAt: 0,              // when the last hop finished
  path: null,                 // { col, row } a tap to walk towards
  queued: null,               // a step asked for inside the ration
  facing: 0,                  // yaw, radians; 0 faces +x
  facingTarget: 0,
  phase: "idle",
};

const moveReady = (t) => t - state.lastMoveAt >= MOVE_MS;

/**
 * Take a step by (dc, dr). One axis at a time: a hop is never diagonal. When
 * both axes are asked for, the preferred one goes first, but if it is
 * blocked by the edge the other still moves: the game's ring presses both
 * axes on a diagonal, and a wall should not cancel the half that was fine.
 */
function move(dc, dr, t, preferRow = false) {
  if (!(dc || dr)) return;
  state.path = null;
  if (!moveReady(t)) { state.queued = { kind: "by", dc, dr, preferRow }; return; }
  if (dc && dr) {
    const first = preferRow ? [0, dr] : [dc, 0];
    const second = preferRow ? [dc, 0] : [0, dr];
    const ok = (d) => onBoard(state.col + Math.sign(d[0]), state.row + Math.sign(d[1]));
    [dc, dr] = ok(first) ? first : second;
  }
  const col = state.col + Math.sign(dc), row = state.row + Math.sign(dr);
  if (!onBoard(col, row)) return;
  go(col, row, t);
}

/** Walk to a square: beside you it is one hop; further away, a path. */
function moveTo(col, row, t) {
  if (!onBoard(col, row)) return;
  if (col === state.col && row === state.row) { state.path = null; return; }
  ripple(tileX(col), tileZ(row), PAL.ripple, 1.25, 320);
  state.path = { col, row };
  runPath(t);
}

/** The next step of the path, when the ration allows. Larger axis first. */
function runPath(t) {
  const p = state.path;
  if (!p) return;
  if (p.col === state.col && p.row === state.row) { state.path = null; return; }
  if (!moveReady(t)) return;
  const dc = p.col - state.col, dr = p.row - state.row;
  if (Math.abs(dc) >= Math.abs(dr)) go(state.col + Math.sign(dc), state.row, t);
  else go(state.col, state.row + Math.sign(dr), t);
}

/** Spend the ration on a hop to (col, row). */
function go(col, row, t) {
  state.lastMoveAt = t;
  // a hop still in the air when the next begins lands first: no square is skipped
  const prev = state.hop;
  if (prev && !prev.committed) { prev.committed = true; state.col = prev.toCol; state.row = prev.toRow; }
  if (col === state.col && row === state.row) { state.hop = null; return; }
  state.hop = { fromCol: state.col, fromRow: state.row, toCol: col, toRow: row, t0: t, committed: false, landed: false };
  const dx = col - state.col, dz = row - state.row;
  state.facingTarget = Math.atan2(-dz, dx);
}

function updateHop(t) {
  const h = state.hop;
  if (!h) { state.phase = "idle"; return; }
  const dt = t - h.t0;
  if (!h.committed && dt >= HOP_COMMIT_MS) { h.committed = true; state.col = h.toCol; state.row = h.toRow; }
  if (!h.landed && dt >= HOP_WINDUP_MS + HOP_AIR_MS) {
    h.landed = true;
    ripple(tileX(h.toCol), tileZ(h.toRow), 0xffffff, 1.5, 300);
  }
  if (dt >= HOP_TOTAL_MS) { state.hop = null; state.phase = "idle"; state.lastIdleAt = t; return; }
  state.phase = dt < HOP_WINDUP_MS ? "windup" : dt < HOP_WINDUP_MS + HOP_AIR_MS ? "air" : "settle";
}

function flushQueued(t) {
  const q = state.queued;
  if (!q || !moveReady(t)) return;
  state.queued = null;
  if (q.kind === "to") moveTo(q.col, q.row, t);
  else move(q.dc, q.dr, t, q.preferRow);
}

// ---------- pose ----------
// Every phase is a set of joint angles and offsets; between phases the
// pose is continuous because each phase's curve starts where the last ended.

function pose(t) {
  const r = rig;
  const h = state.hop;

  // defaults: standing
  let hipDrop = 0, lean = 0, knee = 0.08, thigh = 0, armSwing = 0, elbow = -0.25, headPitch = 0, headYaw = 0;
  let sx = 1, sy = 1;
  let legSplit = 0;   // opposite thigh angles in the air, for a running shape

  const breath = Math.sin(t / 380);   // ~2.4 s cycle

  if (!h) {
    // idle: breath, a slow look around, arms a touch loose
    hipDrop = 0.012 * (1 - breath) * 0.5;
    lean = 0.03 + 0.02 * breath;
    armSwing = 0.05 * Math.sin(t / 620);
    elbow = -0.35 + 0.05 * breath;
    headYaw = 0.25 * Math.sin(t / 1400);
    headPitch = 0.05 * Math.sin(t / 900);
    knee = 0.1 + 0.02 * breath;
  } else {
    const dt = t - h.t0;
    if (dt < HOP_WINDUP_MS) {
      // crouch: hips sink, knees fold, torso leans in, arms pull back
      const u = easeOutQuad(clamp01(dt / HOP_WINDUP_MS));
      hipDrop = 0.2 * u; knee = 0.08 + 1.1 * u; thigh = 0.5 * u;
      lean = 0.3 * u; armSwing = -0.7 * u; elbow = -0.3 - 0.5 * u; headPitch = 0.2 * u;
      sy = 1 - 0.04 * u; sx = 1 + 0.03 * u;
    } else if (dt < HOP_WINDUP_MS + HOP_AIR_MS) {
      // the arc: legs tuck then reach, arms come up and forward
      const u = clamp01((dt - HOP_WINDUP_MS) / HOP_AIR_MS);
      const up = Math.sin(Math.PI * u);           // 0 → 1 → 0
      hipDrop = -0.02 * up;
      knee = 1.2 * up + 0.2 * (1 - u); thigh = lerp(0.5, -0.35, u) + 0.4 * up;
      legSplit = 0.55 * up;
      lean = lerp(0.3, -0.05, u); armSwing = lerp(-0.7, 0.9, easeOutQuad(u)); elbow = -0.9 + 0.3 * u;
      headPitch = lerp(0.2, -0.15, u);
      sy = 1 + 0.06 * up; sx = 1 - 0.04 * up;    // a stretch at the top
    } else {
      // landing: a squash that springs back, knees absorb then straighten, arms fall
      const u = clamp01((dt - HOP_WINDUP_MS - HOP_AIR_MS) / HOP_SETTLE_MS);
      const spring = 1 - easeOutBack(u);          // 1 → 0 with a small dip past 0
      hipDrop = 0.16 * spring; knee = 0.08 + 1.0 * spring; thigh = 0.45 * spring;
      lean = 0.22 * spring; armSwing = lerp(0.9, 0, easeOutQuad(u)) - 0.3 * spring; elbow = -0.25 - 0.4 * spring;
      headPitch = 0.15 * spring;
      sy = 1 - 0.12 * spring; sx = 1 + 0.08 * spring;
    }
  }

  // Signs: the torso and head point up, so a forward lean (towards +x) is a
  // negative z rotation. Limbs hang down from their pivots, so for them
  // forward is positive. A knee folds the shin back, so it is negative again.
  r.hips.position.y = r.HIP_Y - hipDrop;
  r.squash.scale.set(sx, sy, sx);
  r.torso.rotation.z = -lean;
  r.head.rotation.z = -headPitch * 0.6;
  r.head.rotation.y = headYaw;

  // legs: thigh forward is positive; the knee folds the shin back
  r.legL.rotation.z = thigh + legSplit;
  r.legR.rotation.z = thigh - legSplit;
  r.shinL.rotation.z = -knee;
  r.shinR.rotation.z = -knee;

  // arms: swing forward is positive; the elbow bends the forearm forward. The
  // barrel arm is carried raised so the gun points along +x, at the enemy half.
  r.armL.rotation.z = armSwing;
  r.armR.rotation.z = armSwing + 0.25;
  r.foreL.rotation.z = -elbow;
  r.foreR.rotation.z = -elbow + 1.0;
}

// ---------- placement ----------

function place(t) {
  const h = state.hop;
  let x, z, y = 0;
  if (h) {
    const dt = t - h.t0;
    const u = clamp01((dt - HOP_WINDUP_MS) / HOP_AIR_MS);
    const e = easeInOutSine(u);
    x = lerp(tileX(h.fromCol), tileX(h.toCol), e);
    z = lerp(tileZ(h.fromRow), tileZ(h.toRow), e);
    y = HOP_HEIGHT * 4 * u * (1 - u);
  } else {
    x = tileX(state.col); z = tileZ(state.row);
    // at rest for a beat, turn back to face the enemy half
    if (t - state.lastIdleAt > REFACE_MS) state.facingTarget = 0;
  }
  rig.root.position.set(x, y, z);

  // facing: a quick turn, but never a snap
  const d = angleDelta(state.facing, state.facingTarget);
  state.facing += d * Math.min(1, frameDt / 70);
  rig.root.rotation.y = state.facing;

  // the camera leans a little towards where the buster is
  camTarget.x += (x * 0.18 - camTarget.x) * Math.min(1, frameDt / 400);
  camera.position.x = CAM_POS.x + camTarget.x * 0.6;
  camera.lookAt(camTarget);
}

// ---------- input ----------

const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};
const held = new Set();       // codes, in press order
let holdT0 = 0;

window.addEventListener("keydown", (e) => {
  const d = MOVE_KEYS[e.code];
  if (!d) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  e.preventDefault();
  if (!held.has(e.code)) {
    if (!held.size) holdT0 = now();
    held.delete(e.code); held.add(e.code);
    // a fresh press steps now (or queues inside the ration); a repeat is handled by the hold
    move(d[0], d[1], now(), d[1] !== 0);
  }
});
window.addEventListener("keyup", (e) => { held.delete(e.code); });
window.addEventListener("blur", () => held.clear());

/**
 * Everything held on the keyboard, summed to one ask per axis, plus which
 * axis the most recent press was on so that one goes first.
 */
function heldDir() {
  if (!held.size) return null;
  let dc = 0, dr = 0, lastRow = false;
  for (const code of held) { const d = MOVE_KEYS[code]; dc += d[0]; dr += d[1]; lastRow = d[1] !== 0; }
  dc = Math.sign(dc); dr = Math.sign(dr);
  return dc || dr ? [dc, dr, lastRow] : null;
}

// Pointer: a tap on a square is "go there"; a drag past the dead zone is a
// stick, held in one of four directions until it comes back or lifts.
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let stick = null;             // { id, x0, y0, dir }

function tileAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // intersect the board plane, then snap: taps just off a tile's edge still count
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  const col = Math.round(hit.x / TILE + (COLS - 1) / 2);
  const row = Math.round(hit.z / TILE + (ROWS - 1) / 2);
  return onBoard(col, row) ? { col, row } : null;
}

const canvas = renderer.domElement;
canvas.style.touchAction = "none";
canvas.addEventListener("pointerdown", (e) => {
  if (stick) return;
  stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dir: null };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!stick || e.pointerId !== stick.id) return;
  const dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
  if (Math.hypot(dx, dy) < STICK_DEAD_PX) { stick.dir = null; return; }
  // screen up is board "up" (row -1), screen right is col +1: one axis at a time
  const dir = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  if (!stick.dir) holdT0 = now();
  stick.dir = dir;
});
function stickEnd(e) {
  if (!stick || e.pointerId !== stick.id) return;
  const wasTap = !stick.dir && Math.hypot(e.clientX - stick.x0, e.clientY - stick.y0) < STICK_DEAD_PX;
  stick = null;
  if (wasTap && e.type === "pointerup") {
    const sq = tileAt(e.clientX, e.clientY);
    if (!sq) return;
    if (!moveReady(now())) state.queued = { kind: "to", col: sq.col, row: sq.row };
    else moveTo(sq.col, sq.row, now());
  }
}
canvas.addEventListener("pointerup", stickEnd);
canvas.addEventListener("pointercancel", stickEnd);

/** A held direction (keys or stick) re-asks every frame; the ration paces it. */
function pollHold(t) {
  const d = (stick && stick.dir) || heldDir();
  if (!d) return;
  if (!moveReady(t)) return;
  move(d[0], d[1], t, !!d[2]);
}

// ---------- loop ----------

let last = now();
let frameDt = 16;

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Widen the view until all six columns fit: the horizontal half-angle the
  // board needs at the camera's distance, turned into the vertical fov the
  // aspect implies. Landscape never needs more than the 38 it was framed at.
  const dist = CAM_POS.distanceTo(new THREE.Vector3(0, 0.2, 0.2));
  const halfW = (COLS * TILE) / 2 + 0.5;
  const vfov = 2 * Math.atan(halfW / dist / camera.aspect) * (180 / Math.PI);
  camera.fov = Math.max(38, Math.min(95, vfov));
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function frame() {
  const t = now();
  frameDt = Math.min(50, t - last);
  last = t;

  flushQueued(t);
  runPath(t);
  pollHold(t);
  updateHop(t);
  place(t);
  pose(t);
  updateRipples(t);

  hud.phase.textContent = state.phase;
  hud.tile.textContent = `${state.col},${state.row}`;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// A small hook for tests and for poking at it from the console.
window.__bw3d = { state, move: (dc, dr) => move(dc, dr, now()), moveTo: (c, r) => moveTo(c, r, now()), rig, camera, renderer };
