/*!
 * The engine, in one import.
 *
 * This directory is a game engine with no game in it: a clock that can be
 * frozen, a stage, a tile grid, a rigged humanoid, effects, a camera rig,
 * two-stick input, HUD chips, hop movement and a loop a test can drive.
 * Nothing here knows what a rotter or a moon rock is — everything a demo
 * has an opinion about (its palette, its rules, its enemies, its HUD copy)
 * lives in the demo.
 *
 * It was factored out of demo 5, Buster Whack 3D, which is why the shipped
 * defaults look the way they do; demo 6, Moon Rangers, is the second thing
 * built on it and is what settled which parts were engine and which were
 * that game's content.
 *
 * Import the pieces you need directly (`./engine/stage.js`) or everything
 * through here. Three itself comes from `./engine/three.js` — use that one
 * path everywhere so there is a single module instance.
 */
export * as THREE from "./three.js";
export * from "./math.js";
export { Clock, watchReducedMotion } from "./clock.js";
export * from "./textures.js";
export { Stage } from "./stage.js";
export { TileGrid } from "./grid.js";
export * from "./character.js";
export { Effects } from "./effects.js";
export { CameraRig, STANDARD_MODES, STANDARD_FRAMES } from "./camera.js";
export { Input, WASD, ARROWS, FIRE_KEYS, releasePadKeys } from "./input.js";
export { Chips } from "./chips.js";
export { Hopper, DEFAULT_TIMING, timingTotal, timingCommit } from "./hopper.js";
export { Loop } from "./loop.js";
