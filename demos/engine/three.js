/*!
 * The engine's single Three.js import path.
 *
 * Three r185 (`three@0.185.1`, MIT) is vendored under `vendor/` so demos ship
 * with no runtime CDN, the way the rest of this site's demos do. Since r170
 * the module build is a thin wrapper that imports `./three.core.min.js`, so
 * the two files travel together — copy both from `node_modules/three/build/`
 * to update.
 *
 * Every engine module and every demo imports Three from here rather than from
 * `vendor/` directly: one copy on the wire for every demo on the page, one
 * place to bump the version, and one module instance so `instanceof` holds
 * across the engine/content seam.
 */
export * from "./vendor/three.module.min.js";
