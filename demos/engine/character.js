/*!
 * The rider: a low-poly humanoid built from capsules, spheres and boxes,
 * rigged as nested groups so a pose is a set of rotations and nothing else.
 * The model faces +x at rest, with the barrel out to the right.
 *
 * A pose comes in two halves, deliberately:
 *
 *   a *base* — hips, lean, knees, arms, head, and the squash scale — which
 *   is whatever the game's own motion says (a hop's crouch/arc/land, a
 *   ride's forward crouch); and
 *
 *   a set of *modifiers* — the barrel arm held level, a charge bracing, a
 *   recoil kick, a flinch, the strafe twist — which are the same wherever a
 *   humanoid holds a gun, and so live here.
 *
 * `idlePose()` and `hopPose()` are two bases the engine happens to ship
 * because a board game wants them; a game with different motion writes its
 * own base and still gets the modifiers.
 */
import * as THREE from "./three.js";
import { clamp, clamp01, lerp, angleTo, angleDelta, easeOutQuad, easeOutBack, easeInOutSine } from "./math.js";

/** The material set the rig is built from. Pass a palette of hex colours. */
export function characterMaterials(pal) {
  return {
    armor: new THREE.MeshStandardMaterial({ color: pal.armor, roughness: 0.32, metalness: 0.45 }),
    armorDark: new THREE.MeshStandardMaterial({ color: pal.armorDark, roughness: 0.4, metalness: 0.5 }),
    suit: new THREE.MeshStandardMaterial({ color: pal.suit, roughness: 0.85, metalness: 0.1 }),
    visor: new THREE.MeshStandardMaterial({ color: pal.visor, emissive: pal.visor, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, side: THREE.DoubleSide }),
    core: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: pal.visor, emissiveIntensity: 2.2, roughness: 0.2 }),
    barrel: new THREE.MeshStandardMaterial({ color: pal.barrel, roughness: 0.3, metalness: 0.7 }),
    muzzle: new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffb84a, emissiveIntensity: 1.4, roughness: 0.3 }),
  };
}

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
export const ball = (r, mat, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, seg), mat, x, y, z);

/** A limb segment hangs from its pivot: a capsule whose top sits at the joint. */
export function segment(r, len, mat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 12), mat, 0, -len / 2, 0));
  return g;
}

/**
 * Build the rig. `scale` shrinks a roughly human-proportioned model
 * (1.75 units tall) onto whatever the game's ground unit is.
 */
export function buildCharacter(mats, { scale = 0.36 } = {}) {
  const { armor: matArmor, armorDark: matArmorDark, suit: matSuit, visor: matVisor, core: matCore, barrel: matBarrel, muzzle: matMuzzle } = mats;

  const root = new THREE.Group();          // at the ground point
  root.scale.setScalar(scale);
  const squash = new THREE.Group();        // non-uniform scale for the landing
  root.add(squash);

  const HIP_Y = 0.9;
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  squash.add(hips);
  hips.add(box(0.36, 0.2, 0.3, matSuit, 0, -0.02, 0));                 // pelvis
  hips.add(box(0.4, 0.07, 0.34, matArmorDark, 0, 0.06, 0));            // belt
  const buckle = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), matCore, 0.19, 0.06, 0);
  buckle.rotation.z = Math.PI / 2;
  hips.add(buckle);

  // torso hangs UP from the hips (pivot at the waist so a lean bends there)
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  torso.add(box(0.34, 0.18, 0.26, matSuit, 0, 0.1, 0));                // abdomen
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
    g.add(ball(0.07, matSuit, 0, -0.32, 0));                            // elbow
    const fore = segment(0.065, 0.3, matSuit);
    fore.position.y = -0.32;
    g.add(fore);
    return { g, fore };
  }
  const L = arm(-1), R = arm(1);
  L.fore.add(box(0.12, 0.12, 0.13, matArmorDark, 0.01, -0.3, 0));      // left glove
  // the buster: a barrel over the right forearm, a dark muzzle ring and a lit bore
  R.fore.add(mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.4, 14), matBarrel, 0, -0.22, 0));
  R.fore.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), matArmorDark, 0, -0.4, 0));
  const bore = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), matMuzzle, 0, -0.425, 0);
  bore.castShadow = false;
  R.fore.add(bore);
  // an empty just past the bore: where shots leave and the flash sits
  const muzzle = new THREE.Object3D();
  muzzle.position.y = -0.5;
  R.fore.add(muzzle);
  torso.add(L.g); torso.add(R.g);

  // legs hang DOWN from the hips: thigh, knee, shin, boot
  function leg(side) {
    const g = segment(0.085, 0.42, matArmor);
    g.position.set(0, -0.06, side * 0.13);
    g.add(ball(0.08, matSuit, 0, -0.42, 0));                            // knee
    const shin = segment(0.07, 0.4, matSuit);
    shin.position.y = -0.42;
    shin.add(box(0.16, 0.18, 0.15, matArmorDark, 0.01, -0.3, 0));       // greave
    shin.add(box(0.28, 0.09, 0.16, matArmorDark, 0.06, -0.41, 0));      // boot, toes towards +x
    shin.add(box(0.3, 0.03, 0.17, matSuit, 0.06, -0.465, 0));           // sole
    g.add(shin);
    return { g, shin };
  }
  const legL = leg(-1), legR = leg(1);
  hips.add(legL.g); hips.add(legR.g);

  return {
    root, squash, hips, HIP_Y, torso, head, muzzle, mats, scale,
    armL: L.g, foreL: L.fore, armR: R.g, foreR: R.fore,
    legL: legL.g, shinL: legL.shin, legR: legR.g, shinR: legR.shin,
  };
}

/** The neutral pose every base starts from, so a game only writes the joints it cares about. */
export const restPose = () => ({
  hipDrop: 0, lean: 0, knee: 0.08, thigh: 0, armSwing: 0, elbow: -0.25,
  headPitch: 0, headYaw: 0, sx: 1, sy: 1, legSplit: 0, sway: 0,
});

/** Standing about: breath, a slow look around, weight shifting foot to foot. */
export function idlePose(t) {
  const breath = Math.sin(t / 380);   // ~2.4 s cycle
  return {
    ...restPose(),
    hipDrop: 0.012 * (1 - breath) * 0.5,
    lean: 0.03 + 0.02 * breath,
    armSwing: 0.05 * Math.sin(t / 620),
    elbow: -0.35 + 0.05 * breath,
    headYaw: 0.25 * Math.sin(t / 1400),
    headPitch: 0.05 * Math.sin(t / 900),
    knee: 0.1 + 0.02 * breath,
    sway: 0.03 * Math.sin(t / 1900),
  };
}

/**
 * One hop, in three phases whose curves join where the last ended so the
 * pose is continuous: a crouch, an arc with the legs tucking then reaching,
 * and a landing squash that springs back.
 */
export function hopPose(dt, timing) {
  const { windup, air, settle } = timing;
  const p = restPose();
  if (dt < windup) {
    const u = easeOutQuad(clamp01(dt / windup));
    p.hipDrop = 0.22 * u; p.knee = 0.08 + 1.1 * u; p.thigh = 0.5 * u;
    p.lean = 0.3 * u; p.armSwing = -0.7 * u; p.elbow = -0.3 - 0.5 * u; p.headPitch = 0.2 * u;
    p.sy = 1 - 0.04 * u; p.sx = 1 + 0.03 * u;
  } else if (dt < windup + air) {
    const u = clamp01((dt - windup) / air);
    const up = Math.sin(Math.PI * u);           // 0 → 1 → 0
    p.hipDrop = -0.02 * up;
    p.knee = 1.2 * up + 0.2 * (1 - u); p.thigh = lerp(0.5, -0.35, u) + 0.4 * up;
    p.legSplit = 0.55 * up;
    p.lean = lerp(0.3, -0.05, u); p.armSwing = lerp(-0.7, 0.9, easeOutQuad(u)); p.elbow = -0.9 + 0.3 * u;
    p.headPitch = lerp(0.2, -0.15, u);
    p.sy = 1 + 0.06 * up; p.sx = 1 - 0.04 * up;  // a stretch at the top
  } else {
    const u = clamp01((dt - windup - air) / settle);
    const spring = 1 - easeOutBack(u);           // 1 → 0 with a small dip past 0
    p.hipDrop = 0.18 * spring; p.knee = 0.08 + 1.0 * spring; p.thigh = 0.45 * spring;
    p.lean = 0.22 * spring; p.armSwing = lerp(0.9, 0, easeOutQuad(u)) - 0.3 * spring; p.elbow = -0.25 - 0.4 * spring;
    p.headPitch = 0.15 * spring;
    p.sy = 1 - 0.12 * spring; p.sx = 1 + 0.08 * spring;
  }
  return p;
}

/** The arc height of a hop at `dt`, as a 0→1→0 bump; multiply by the hop's height. */
export const hopHeightAt = (dt, timing) => {
  const u = clamp01((dt - timing.windup) / timing.air);
  return 4 * u * (1 - u);
};
/** Where along a hop's ground path we are at `dt`, eased. */
export const hopEaseAt = (dt, timing) => easeInOutSine(clamp01((dt - timing.windup) / timing.air));

/**
 * Write a base pose onto the rig, with the shooting modifiers on top.
 *
 * `mods`:
 *   holding  0..1 — the barrel arm held level whatever the legs do. In the
 *                   air the arms would swing, but a shooter's do not.
 *   chargeU  0..1 — the left hand comes across to brace the barrel
 *   kick     0..1 — recoil: the barrel arm kicks up, the torso rocks back
 *   flinch   0..1 — a hit: the whole body cringes
 *   twist    rad  — the legs turned off the barrel, in a strafe
 *   hurtColor     — the colour the armour lights up for the flinch
 *
 * Signs, since they trip everyone once: the torso and head point up, so a
 * forward lean (towards +x) is a negative z rotation; limbs hang down from
 * their pivots, so for them forward is positive; a knee folds the shin
 * back, so it is negative again.
 */
export function applyPose(rig, p, mods = {}) {
  const { holding = 0, chargeU = 0, kick = 0, flinch = 0, twist = 0, hurtColor = null } = mods;
  const r = rig;

  const armRSwing = lerp(p.armSwing, 0.05, holding);

  r.hips.position.y = r.HIP_Y - p.hipDrop - 0.08 * flinch;
  r.hips.position.z = p.sway;
  r.hips.rotation.x = p.sway * 1.5;
  r.squash.scale.set(p.sx, p.sy, p.sx);
  r.torso.rotation.z = -p.lean + kick * 0.25 + 0.2 * flinch;
  r.torso.rotation.x = -p.sway * 1.5;
  r.head.rotation.z = -p.headPitch * 0.6 + 0.25 * flinch;
  r.head.rotation.y = holding > 0.5 ? p.headYaw * 0.2 : p.headYaw;

  r.hips.rotation.y = twist;
  r.torso.rotation.y = -twist;

  r.legL.rotation.z = p.thigh + p.legSplit;
  r.legR.rotation.z = p.thigh - p.legSplit;
  r.shinL.rotation.z = -p.knee;
  r.shinR.rotation.z = -p.knee;

  r.armL.rotation.z = lerp(p.armSwing, 0.9, chargeU * 0.8) - 0.4 * flinch;
  r.armL.rotation.y = lerp(0, 0.7, chargeU);
  r.armR.rotation.z = armRSwing + 0.25 + kick * 0.6;
  r.foreL.rotation.z = -lerp(p.elbow, -1.1, chargeU);
  r.foreR.rotation.z = -lerp(p.elbow, -0.25, holding) + 1.0 - kick * 0.4;

  if (hurtColor !== null) {
    r.mats.armor.emissive.set(hurtColor);
    r.mats.armor.emissiveIntensity = 0.9 * flinch;
    r.mats.armorDark.emissive.set(hurtColor);
    r.mats.armorDark.emissiveIntensity = 0.6 * flinch;
  }
}

/**
 * The strafe, eased: the legs turn towards where the body is going and the
 * torso turns back by the same amount, so the barrel stays on the aim.
 * Returns the new twist — keep it on your own state and pass it back in.
 */
export function easeTwist(twist, facing, moveYaw, frameDt, { max = 0.85, tau = 60 } = {}) {
  const want = moveYaw === null ? 0 : clamp(angleDelta(facing, moveYaw), -max, max);
  return twist + (want - twist) * Math.min(1, frameDt / tau);
}

/** The direction a step (dc, dr) faces, in the engine's board-angle convention. */
export const stepYaw = (dc, dr) => angleTo(0, 0, dc, dr);
