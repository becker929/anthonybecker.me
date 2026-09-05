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
const GAP = 0.1;

// The character is modelled at roughly human proportions (1.75 units tall)
// and scaled down onto the board: a square is a panel you stand on, not a
// room you stand in, so the buster is a little over half a square tall.
const CHAR_SCALE = 0.36;

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
const HOP_HEIGHT = 0.34;
const REFACE_MS = 420;        // after this long idle, turn back to face the enemy half
// The rest facing: towards the enemy half, turned a little towards the
// camera so the visor and the core light show instead of a flat profile.
const REST_YAW = -0.32;

// Drag-as-stick: a finger has to leave this radius (CSS px) before the board
// reads a direction; a lift that never left it is a tap on a square.
const STICK_DEAD_PX = 26;

// ---------- palette (the game's) ----------

const PAL = {
  fog: 0x0e1420,
  tilePlayer: 0x18213a, tilePlayerRim: 0x4f8dff,
  tileEnemy: 0x2c1a26, tileEnemyRim: 0xff5470,
  armor: 0x4f8dff, armorDark: 0x2f5fc4, suit: 0x161c30, visor: 0xc9f6ff, barrel: 0xffd23f,
  ripple: 0x4f8dff, dust: 0x9fb0d0,
};

// ---------- easing ----------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
/** Overshoots past 1 then returns: the landing's spring. */
const easeOutBack = (t) => { const c = 1.7; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
/** Shortest signed angle from a to b. */
const angleDelta = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------- world <-> tile ----------

const tileX = (col) => (col - (COLS - 1) / 2) * TILE;
const tileZ = (row) => (row - (ROWS - 1) / 2) * TILE;
const onBoard = (col, row) => col >= 0 && col < COLS && row >= 0 && row < ROWS;

// ---------- clock ----------

// `?slow=4` runs the clock at a quarter speed: the same hop, stretched, for
// looking at the poses. Everything is timed off this one clock, so nothing
// else has to know.
const SLOW = Math.max(1, Number(new URLSearchParams(location.search).get("slow")) || 1);
const now = () => performance.now() / SLOW;

// ---------- textures drawn in code ----------
// No image files: a soft disc for glows, shadows and dust, and a gradient
// for the sky. Both are a few lines of Canvas 2D.

function softDisc(stops) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#090c13");
  grad.addColorStop(0.55, "#131b2c");
  grad.addColorStop(0.7, "#0f1522");
  grad.addColorStop(1, "#07090e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const discTex = softDisc([[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]);
const shadowTex = softDisc([[0, "rgba(0,0,0,1)"], [0.45, "rgba(0,0,0,0.55)"], [1, "rgba(0,0,0,0)"]]);

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog(PAL.fog, 9, 22);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
const CAM_POS = new THREE.Vector3(0, 3.3, 4.9);
const LOOK_AT = new THREE.Vector3(0, 0.05, 0.1);
const camTarget = LOOK_AT.clone();
camera.position.copy(CAM_POS);
camera.lookAt(camTarget);

// Image-based lighting from a room built out of a few glowing panels: a big
// cool light overhead, the game's red off one side, its blue off the other.
// It is what makes the armour read as a surface instead of flat paint.
function makeEnvironment() {
  const room = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const walls = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0c1018, side: THREE.BackSide }));
  walls.scale.setScalar(30);
  room.add(walls);
  const panel = (hex, intensity, pos, size) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) }));
    m.position.set(...pos); m.scale.set(...size);
    room.add(m);
  };
  panel(0xdfe9ff, 9, [-3, 9, 5], [6, 0.2, 6]);      // key: a wide soft light above and behind the camera
  panel(0xff5470, 4, [10, 3, -6], [0.2, 4, 6]);     // rim: the enemy half's red
  panel(0x4f8dff, 3, [-10, 2, -4], [0.2, 4, 6]);    // fill: the player's blue
  panel(0x3a4a7a, 1.5, [0, -6, 0], [14, 0.2, 14]);  // a faint bounce from the floor
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = makeEnvironment();
scene.environmentIntensity = 0.7;

scene.add(new THREE.HemisphereLight(0x9fbfff, 0x1a1420, 0.35));
const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
key.position.set(-3, 7, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 2; key.shadow.camera.far = 18;
key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
key.shadow.camera.top = 3.5; key.shadow.camera.bottom = -3;
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.02;
key.shadow.radius = 3;
scene.add(key);
const rim = new THREE.DirectionalLight(0xff5470, 0.8);
rim.position.set(6, 2.5, -4);
scene.add(rim);
const fill = new THREE.DirectionalLight(0x4f8dff, 0.5);
fill.position.set(-6, 1.5, -3);
scene.add(fill);

// Ground: a dark plane that takes the shadow and fades into the fog, with a
// pool of light under the arena so it does not float in the void.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

const pool = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 9),
  new THREE.MeshBasicMaterial({ map: discTex, color: 0x22304f, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
);
pool.rotation.x = -Math.PI / 2;
pool.position.y = -0.19;
scene.add(pool);

// The arena base: one slab the tiles sit in, with the divider between the
// halves lit the way the 2D board draws it.
const baseW = COLS * TILE + 0.3, baseD = ROWS * TILE + 0.3;
const base = new THREE.Mesh(
  new THREE.BoxGeometry(baseW, 0.16, baseD),
  new THREE.MeshStandardMaterial({ color: 0x0f1320, roughness: 0.6, metalness: 0.3 }),
);
base.position.y = -0.12;
base.receiveShadow = true;
scene.add(base);

const divider = new THREE.Mesh(
  new THREE.BoxGeometry(0.04, 0.02, baseD - 0.1),
  new THREE.MeshBasicMaterial({ color: 0xc9f6ff, transparent: true, opacity: 0.9 }),
);
divider.position.set((tileX(PCOLS - 1) + tileX(PCOLS)) / 2, -0.03, 0);
scene.add(divider);

// Tiles: a bevelled slab with a lit rim inset from its edge. Each remembers a
// dip so a landing can press it down and let it spring back.
const tiles = [];
function tileSlabGeometry() {
  const s = (TILE - GAP) / 2, r = 0.07;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r); shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s); shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);      // extrude along +y
  g.translate(0, -0.08, 0);     // top face at y = 0.025 (the bevel)
  return g;
}
function tileRimGeometry() {
  const s = (TILE - GAP) / 2 - 0.09, w = 0.022;
  const outer = new THREE.Shape();
  outer.moveTo(-s, -s); outer.lineTo(s, -s); outer.lineTo(s, s); outer.lineTo(-s, s); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-s + w, -s + w); hole.lineTo(s - w, -s + w); hole.lineTo(s - w, s - w); hole.lineTo(-s + w, s - w); hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ShapeGeometry(outer);
  g.rotateX(-Math.PI / 2);
  return g;
}
const slabGeo = tileSlabGeometry();
const rimGeo = tileRimGeometry();
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const mine = col < PCOLS;
    const g = new THREE.Group();
    g.position.set(tileX(col), 0, tileZ(row));
    const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({
      color: mine ? PAL.tilePlayer : PAL.tileEnemy, roughness: 0.42, metalness: 0.35,
    }));
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);
    const rimMat = new THREE.MeshBasicMaterial({ color: mine ? PAL.tilePlayerRim : PAL.tileEnemyRim, transparent: true, opacity: 0.75 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.031;
    g.add(rimMesh);
    scene.add(g);
    tiles.push({ g, rimMat, col, row, dip: 0, dipV: 0, glow: 0 });
  }
}
const tileAt = (col, row) => tiles[row * COLS + col];

// Motes: a slow drift of dust in the light, so the air has depth.
const MOTES = 220;
const motePos = new Float32Array(MOTES * 3);
const moteSeed = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) {
  motePos[i * 3] = (Math.random() - 0.5) * 12;
  motePos[i * 3 + 1] = Math.random() * 3.2 - 0.1;
  motePos[i * 3 + 2] = (Math.random() - 0.5) * 8;
  moteSeed[i] = Math.random() * 1000;
}
const moteGeo = new THREE.BufferGeometry();
moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
  map: discTex, color: 0x8fb0ff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(motes);
function updateMotes(t) {
  const a = moteGeo.attributes.position.array;
  for (let i = 0; i < MOTES; i++) {
    const s = moteSeed[i];
    a[i * 3 + 1] += 0.00008 * frameDt * (0.6 + Math.sin(s) * 0.4);
    a[i * 3] += Math.sin(t / 2600 + s) * 0.0002 * frameDt;
    if (a[i * 3 + 1] > 3.2) a[i * 3 + 1] = -0.1;
  }
  moteGeo.attributes.position.needsUpdate = true;
}

// ---------- the character ----------
// Built from capsules, spheres and boxes, rigged as nested groups so a pose
// is a set of rotations. The model faces +x at rest: the barrel out to the
// right, towards the enemy half, the way the 2D buster stands.

const matArmor = new THREE.MeshStandardMaterial({ color: PAL.armor, roughness: 0.32, metalness: 0.45 });
const matArmorDark = new THREE.MeshStandardMaterial({ color: PAL.armorDark, roughness: 0.4, metalness: 0.5 });
const matSuit = new THREE.MeshStandardMaterial({ color: PAL.suit, roughness: 0.85, metalness: 0.1 });
const matVisor = new THREE.MeshStandardMaterial({ color: PAL.visor, emissive: PAL.visor, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, side: THREE.DoubleSide });
const matCore = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: PAL.visor, emissiveIntensity: 2.2, roughness: 0.2 });
const matBarrel = new THREE.MeshStandardMaterial({ color: PAL.barrel, roughness: 0.3, metalness: 0.7 });
const matMuzzle = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffb84a, emissiveIntensity: 1.4, roughness: 0.3 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const ball = (r, mat, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, seg), mat, x, y, z);

/** A limb segment hangs from its pivot: a capsule whose top sits at the joint. */
function segment(r, len, mat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 12), mat, 0, -len / 2, 0));
  return g;
}

function buildCharacter() {
  const root = new THREE.Group();          // at the tile centre, y = ground
  root.scale.setScalar(CHAR_SCALE);
  const squash = new THREE.Group();        // non-uniform scale for the landing
  root.add(squash);

  const HIP_Y = 0.9;
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  squash.add(hips);
  hips.add(box(0.36, 0.2, 0.3, matSuit, 0, -0.02, 0));                 // pelvis
  hips.add(box(0.4, 0.07, 0.34, matArmorDark, 0, 0.06, 0));             // belt
  const buckle = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), matCore, 0.19, 0.06, 0);
  buckle.rotation.z = Math.PI / 2;
  hips.add(buckle);

  // torso hangs UP from the hips (pivot at the waist so a lean bends there)
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  torso.add(box(0.34, 0.18, 0.26, matSuit, 0, 0.1, 0));                 // abdomen
  torso.add(box(0.46, 0.42, 0.36, matArmor, 0, 0.4, 0));               // chest plate
  torso.add(box(0.5, 0.1, 0.4, matArmorDark, 0, 0.58, 0));             // collar
  const core = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6), matCore, 0.235, 0.44, 0);  // the core light, on the +x face
  core.rotation.z = Math.PI / 2;
  core.castShadow = false;
  torso.add(core);
  torso.add(box(0.14, 0.3, 0.3, matArmorDark, -0.26, 0.38, 0));        // backpack
  torso.add(box(0.06, 0.2, 0.08, matSuit, -0.34, 0.4, -0.1));          // vents
  torso.add(box(0.06, 0.2, 0.08, matSuit, -0.34, 0.4, 0.1));

  // neck and helmet: a dome, a wraparound visor over the front, a crest
  torso.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), matSuit, 0, 0.66, 0));
  const head = new THREE.Group();
  head.position.y = 0.7;
  torso.add(head);
  head.add(ball(0.22, matArmor, 0, 0.2, 0, 18));
  head.add(mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.16, 20, 1, true), matArmorDark, 0, 0.17, 0)); // helmet band
  // the visor: an open strip of a cylinder. Three's cylinder starts its
  // sweep at +z, so a strip centred on +x is rotated a quarter turn.
  const visor = mesh(new THREE.CylinderGeometry(0.234, 0.234, 0.085, 20, 1, true, -1.15, 2.3), matVisor, 0, 0.19, 0);
  visor.rotation.y = Math.PI / 2;
  visor.castShadow = false;
  head.add(visor);
  head.add(box(0.26, 0.06, 0.05, matArmorDark, -0.02, 0.41, 0));       // crest
  const podL = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 10), matArmorDark, 0, 0.19, -0.23);
  podL.rotation.x = Math.PI / 2;
  const podR = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 10), matArmorDark, 0, 0.19, 0.23);
  podR.rotation.x = Math.PI / 2;
  head.add(podL); head.add(podR);

  // arms: pauldron, upper arm, elbow, forearm; the right forearm is the buster
  const shoulderY = 0.6;
  function arm(side) {              // side: -1 (left, -z) or +1 (right, +z)
    const g = segment(0.075, 0.32, matArmor);
    g.position.set(0, shoulderY, side * 0.31);
    g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), matArmorDark, 0, 0.02, side * 0.02)); // pauldron
    g.add(ball(0.07, matSuit, 0, -0.32, 0));                             // elbow
    const fore = segment(0.065, 0.3, matSuit);
    fore.position.y = -0.32;
    g.add(fore);
    return { g, fore };
  }
  const L = arm(-1), R = arm(1);
  L.fore.add(box(0.12, 0.12, 0.13, matArmorDark, 0.01, -0.3, 0));       // left glove
  // the buster: a barrel over the right forearm, a dark muzzle ring and a lit bore
  R.fore.add(mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.4, 14), matBarrel, 0, -0.22, 0));
  R.fore.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), matArmorDark, 0, -0.4, 0));
  const bore = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), matMuzzle, 0, -0.425, 0);
  bore.castShadow = false;
  R.fore.add(bore);
  torso.add(L.g); torso.add(R.g);

  // legs hang DOWN from the hips: thigh, knee, shin, boot
  function leg(side) {
    const g = segment(0.085, 0.42, matArmor);
    g.position.set(0, -0.06, side * 0.13);
    g.add(ball(0.08, matSuit, 0, -0.42, 0));                             // knee
    const shin = segment(0.07, 0.4, matSuit);
    shin.position.y = -0.42;
    shin.add(box(0.16, 0.18, 0.15, matArmorDark, 0.01, -0.3, 0));        // greave
    shin.add(box(0.28, 0.09, 0.16, matArmorDark, 0.06, -0.41, 0));       // boot, toes towards +x
    shin.add(box(0.3, 0.03, 0.17, matSuit, 0.06, -0.465, 0));            // sole
    g.add(shin);
    return { g, shin };
  }
  const legL = leg(-1), legR = leg(1);
  hips.add(legL.g); hips.add(legR.g);

  return {
    root, squash, hips, HIP_Y, torso, head,
    armL: L.g, foreL: L.fore, armR: R.g, foreR: R.fore,
    legL: legL.g, shinL: legL.shin, legR: legR.g, shinR: legR.shin,
  };
}

const rig = buildCharacter();
scene.add(rig.root);

// A contact shadow under the buster: a soft blob that shrinks and fades as
// the hop gains height, so the arc reads even where the key light's shadow
// falls off the board.
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(0.62, 0.62),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.6, depthWrite: false }),
);
contact.rotation.x = -Math.PI / 2;
contact.position.y = 0.034;
scene.add(contact);

// ---------- effects ----------

// Landing rings: a flat ring that grows and fades where the feet come down.
const ripples = [];
const rippleGeo = new THREE.RingGeometry(0.2, 0.25, 32);
function ripple(x, z, color, scaleTo = 1.6, ms = 380) {
  const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.036, z);
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

// Dust: a few soft puffs kicked out sideways on take-off and on landing.
const puffs = [];
const puffMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.dust, transparent: true, opacity: 0.5, depthWrite: false });
function dust(x, z, count, speed) {
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(puffMat.clone());
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.5 + Math.random() * 0.5);
    s.position.set(x, 0.05, z);
    s.scale.setScalar(0.08);
    scene.add(s);
    puffs.push({ s, vx: Math.cos(a) * v, vz: Math.sin(a) * v, t0: now(), ms: 320 + Math.random() * 160 });
  }
}
function updatePuffs(t) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    const u = clamp01((t - p.t0) / p.ms);
    const k = frameDt / 1000;
    p.s.position.x += p.vx * k * (1 - u);
    p.s.position.z += p.vz * k * (1 - u);
    p.s.position.y += 0.12 * k;
    p.s.scale.setScalar(lerp(0.08, 0.26, easeOutQuad(u)));
    p.s.material.opacity = 0.5 * (1 - u);
    if (u >= 1) { scene.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); }
  }
}

/** Press a tile down and light its rim; it springs back on its own. */
function pressTile(col, row, amount) {
  const tl = tileAt(col, row);
  if (!tl) return;
  tl.dipV -= amount;
  tl.glow = 1;
}
function updateTiles() {
  const k = frameDt / 1000;
  for (const tl of tiles) {
    if (tl.dip === 0 && tl.dipV === 0 && tl.glow === 0) continue;
    // a stiff spring towards rest
    tl.dipV += (-tl.dip * 260 - tl.dipV * 18) * k;
    tl.dip += tl.dipV * k;
    if (Math.abs(tl.dip) < 0.0005 && Math.abs(tl.dipV) < 0.002) { tl.dip = 0; tl.dipV = 0; }
    tl.g.position.y = tl.dip;
    tl.glow = Math.max(0, tl.glow - k * 2.6);
    tl.rimMat.opacity = 0.75 + 0.25 * tl.glow;
  }
}

// ---------- state ----------

const state = {
  col: 1, row: 1,             // the square counted as stood on
  hop: null,                  // { fromCol, fromRow, toCol, toRow, t0, committed, left, landed }
  lastMoveAt: -1e9,
  lastIdleAt: 0,              // when the last hop finished
  path: null,                 // { col, row } a tap to walk towards
  queued: null,               // a step asked for inside the ration
  facing: -0.32,              // yaw, radians; 0 faces +x (REST_YAW to start)
  facingTarget: -0.32,
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
  tileAt(col, row).glow = 1;
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
  state.hop = { fromCol: state.col, fromRow: state.row, toCol: col, toRow: row, t0: t, committed: false, left: false, landed: false };
  const dx = col - state.col, dz = row - state.row;
  state.facingTarget = Math.atan2(-dz, dx);
}

function updateHop(t) {
  const h = state.hop;
  if (!h) { state.phase = "idle"; return; }
  const dt = t - h.t0;
  if (!h.left && dt >= HOP_WINDUP_MS) {
    h.left = true;
    pressTile(h.fromCol, h.fromRow, 0.5);
    dust(tileX(h.fromCol), tileZ(h.fromRow), 3, 0.7);
  }
  if (!h.committed && dt >= HOP_COMMIT_MS) { h.committed = true; state.col = h.toCol; state.row = h.toRow; }
  if (!h.landed && dt >= HOP_WINDUP_MS + HOP_AIR_MS) {
    h.landed = true;
    ripple(tileX(h.toCol), tileZ(h.toRow), 0xffffff, 1.5, 300);
    pressTile(h.toCol, h.toRow, 0.9);
    dust(tileX(h.toCol), tileZ(h.toRow), 6, 1.1);
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
  let sway = 0;       // hips shifting side to side at rest

  const breath = Math.sin(t / 380);   // ~2.4 s cycle

  if (!h) {
    // idle: breath, a slow look around, weight shifting foot to foot
    hipDrop = 0.012 * (1 - breath) * 0.5;
    lean = 0.03 + 0.02 * breath;
    armSwing = 0.05 * Math.sin(t / 620);
    elbow = -0.35 + 0.05 * breath;
    headYaw = 0.25 * Math.sin(t / 1400);
    headPitch = 0.05 * Math.sin(t / 900);
    knee = 0.1 + 0.02 * breath;
    sway = 0.03 * Math.sin(t / 1900);
  } else {
    const dt = t - h.t0;
    if (dt < HOP_WINDUP_MS) {
      // crouch: hips sink, knees fold, torso leans in, arms pull back
      const u = easeOutQuad(clamp01(dt / HOP_WINDUP_MS));
      hipDrop = 0.22 * u; knee = 0.08 + 1.1 * u; thigh = 0.5 * u;
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
      hipDrop = 0.18 * spring; knee = 0.08 + 1.0 * spring; thigh = 0.45 * spring;
      lean = 0.22 * spring; armSwing = lerp(0.9, 0, easeOutQuad(u)) - 0.3 * spring; elbow = -0.25 - 0.4 * spring;
      headPitch = 0.15 * spring;
      sy = 1 - 0.12 * spring; sx = 1 + 0.08 * spring;
    }
  }

  // Signs: the torso and head point up, so a forward lean (towards +x) is a
  // negative z rotation. Limbs hang down from their pivots, so for them
  // forward is positive. A knee folds the shin back, so it is negative again.
  r.hips.position.y = r.HIP_Y - hipDrop;
  r.hips.position.z = sway;
  r.hips.rotation.x = sway * 1.5;
  r.squash.scale.set(sx, sy, sx);
  r.torso.rotation.z = -lean;
  r.torso.rotation.x = -sway * 1.5;
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
    if (t - state.lastIdleAt > REFACE_MS) state.facingTarget = REST_YAW;
  }
  // standing on a tile that is still springing back, ride it
  const dip = h ? 0 : tileAt(state.col, state.row).dip;
  rig.root.position.set(x, y + dip, z);

  // the contact shadow tracks the ground point, thinning with height
  contact.position.x = x; contact.position.z = z;
  const hf = clamp01(y / HOP_HEIGHT);
  contact.scale.setScalar(1 - 0.35 * hf);
  contact.material.opacity = 0.6 * (1 - 0.6 * hf);

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

window.addEventListener("keydown", (e) => {
  const d = MOVE_KEYS[e.code];
  if (!d) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  e.preventDefault();
  if (!held.has(e.code)) {
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
const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let stick = null;             // { id, x0, y0, dir }

function squareAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // intersect the board plane, then snap: taps just off a tile's edge still count
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(boardPlane, hit)) return null;
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
  stick.dir = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
});
function stickEnd(e) {
  if (!stick || e.pointerId !== stick.id) return;
  const wasTap = !stick.dir && Math.hypot(e.clientX - stick.x0, e.clientY - stick.y0) < STICK_DEAD_PX;
  stick = null;
  if (wasTap && e.type === "pointerup") {
    const sq = squareAt(e.clientX, e.clientY);
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
  // aspect implies. Landscape never needs more than the 30 it was framed at.
  const dist = CAM_POS.distanceTo(LOOK_AT);
  const halfW = (COLS * TILE) / 2 + 0.5;
  const vfov = 2 * Math.atan(halfW / dist / camera.aspect) * (180 / Math.PI);
  camera.fov = Math.max(30, Math.min(95, vfov));
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
  updateTiles();
  place(t);
  pose(t);
  updateRipples(t);
  updatePuffs(t);
  updateMotes(t);

  hud.phase.textContent = state.phase;
  hud.tile.textContent = `${state.col},${state.row}`;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// A small hook for tests and for poking at it from the console.
window.__bw3d = { state, move: (dc, dr) => move(dc, dr, now()), moveTo: (c, r) => moveTo(c, r, now()), rig, camera, renderer };
