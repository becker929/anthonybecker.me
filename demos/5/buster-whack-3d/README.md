# Buster Whack 3D (demo 5)

A movement-and-animation prototype: the buster from demo 4 rebuilt as a
low-poly 3D humanoid on the same 3x6 tile board, hopping one square at a
time with the game's crouch / arc / land-squash phases. No enemies, no
firing, no score — only the step and how the body sells it.

Files:

- `index.html` — the page; mounts `main.js` into a full-window canvas.
- `main.js` — the whole prototype: board, rigged character, pose curves,
  input (keys, tap-to-move, drag-as-stick), render loop.
- `three.module.min.js` + `three.core.min.js` — Three.js r185
  (`three@0.185.1`, MIT), copied from the npm build unchanged so the demo
  ships with no runtime CDN, the way this site's demos do. Since r170 the
  module build is a thin wrapper that imports `./three.core.min.js`, so the
  two travel together. To update, install the new version and copy both
  files from `node_modules/three/build/` over these.

The character is built from primitives in code, not loaded from a model
file, so the rig (hips → torso → head / arms, hips → legs) is plain
`THREE.Group` nesting and every pose is a handful of rotations and offsets
in `pose()`. Timings live at the top of `main.js` beside the ones the 2D
game uses, so the two can be compared.
