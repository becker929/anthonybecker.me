/*!
 * A board of tiles: bevelled slabs with a lit rim, keyed by (col, row) in a
 * map rather than an array, so a world may grow in any direction without
 * anything re-indexing.
 *
 * Each tile carries three animation channels the game pokes and the grid
 * settles on its own:
 *
 *   dip    — a spring: press it down (a landing) and it bounces back
 *   glow   — the rim brightening, decaying
 *   flash  — the rim taken to a colour for an instant (a telegraph)
 *
 * plus `stain`, a *held* tint (nothing decays it while something keeps
 * holding it) for the case of a thing standing on a panel and spoiling it.
 * A game that has no such thing simply never sets it.
 *
 * `kinds` maps a kind name to [slabColor, rimColor]. What the kinds *mean*
 * — which are walkable, which are enemy ground — is the game's business,
 * not the grid's; the grid only paints them.
 */
import * as THREE from "./three.js";

export class TileGrid {
  constructor(scene, {
    cols = 6, rows = 3, tile = 1, gap = 0.1,
    kinds,
    stain = null,          // { slab, rim, rate, decay } — the held tint, or null
  } = {}) {
    this.scene = scene;
    this.cols = cols; this.rows = rows; this.tile = tile; this.gap = gap;
    this.kinds = kinds;
    this.stain = stain && { rate: 1 / 1400, decay: 1 / 3000, ...stain };
    this._stainSlab = this.stain ? new THREE.Color(this.stain.slab) : null;
    this._stainRim = this.stain ? new THREE.Color(this.stain.rim) : null;

    this.slabGeo = this._slabGeometry();
    this.rimGeo = this._rimGeometry();
    this.tiles = new Map();
    this.colMin = Infinity;
    this.colMax = -Infinity;
    this._c = new THREE.Color();
  }

  // ---------- world <-> tile ----------
  // `cols`/`rows` only centre the board on the origin; a column index may
  // run far past `cols` on a world that grows sideways, and this stays the
  // right mapping for it.
  x(col) { return (col - (this.cols - 1) / 2) * this.tile; }
  z(row) { return (row - (this.rows - 1) / 2) * this.tile; }
  colAt(x) { return Math.round(x / this.tile + (this.cols - 1) / 2); }
  rowAt(z) { return Math.round(z / this.tile + (this.rows - 1) / 2); }

  key(col, row) { return col + "," + row; }
  at(col, row) { return this.tiles.get(this.key(col, row)); }
  has(col, row) { return this.tiles.has(this.key(col, row)); }

  /** Past the built board's edge by more than a tile: where a shot is spent, so nothing streams off into the sky. */
  offBoard(x, z, margin = 1.2) {
    if (Math.abs(z) > (this.rows * this.tile) / 2 + margin) return true;
    if (this.colMin > this.colMax) return true;
    return x < this.x(this.colMin) - this.tile / 2 - margin || x > this.x(this.colMax) + this.tile / 2 + margin;
  }

  // ---------- geometry ----------

  /** A bevelled slab whose top face sits at y ≈ 0.025. */
  _slabGeometry() {
    const s = (this.tile - this.gap) / 2, r = 0.07;
    const shape = new THREE.Shape();
    shape.moveTo(-s + r, -s);
    shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r);
    shape.lineTo(s, s - r); shape.quadraticCurveTo(s, s, s - r, s);
    shape.lineTo(-s + r, s); shape.quadraticCurveTo(-s, s, -s, s - r);
    shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);      // extrude along +y
    g.translate(0, -0.08, 0);
    return g;
  }
  /** The lit rim: a thin square outline inset from the slab's edge. */
  _rimGeometry() {
    const s = (this.tile - this.gap) / 2 - 0.09, w = 0.022;
    const outer = new THREE.Shape();
    outer.moveTo(-s, -s); outer.lineTo(s, -s); outer.lineTo(s, s); outer.lineTo(-s, s); outer.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-s + w, -s + w); hole.lineTo(s - w, -s + w); hole.lineTo(s - w, s - w); hole.lineTo(-s + w, s - w); hole.closePath();
    outer.holes.push(hole);
    const g = new THREE.ShapeGeometry(outer);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // ---------- building ----------

  /** Place a tile of a given kind, or return the one already there. */
  build(col, row, kind) {
    const k = this.key(col, row);
    const existing = this.tiles.get(k);
    if (existing) return existing;
    const [slabColor, rimColor] = this.kinds[kind];
    const g = new THREE.Group();
    g.position.set(this.x(col), 0, this.z(row));
    const slabMat = new THREE.MeshStandardMaterial({ color: slabColor, roughness: 0.42, metalness: 0.35 });
    const slab = new THREE.Mesh(this.slabGeo, slabMat);
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);
    const rimMat = new THREE.MeshBasicMaterial({ color: rimColor, transparent: true, opacity: 0.75 });
    const rimMesh = new THREE.Mesh(this.rimGeo, rimMat);
    rimMesh.position.y = 0.031;
    g.add(rimMesh);
    this.scene.add(g);
    const tl = {
      g, rimMat, slabMat, col, row, kind, isNpc: false, dip: 0, dipV: 0, glow: 0,
      stain: 0, stainHeld: false, baseSlab: slabMat.color.clone(), baseRim: rimMat.color.clone(),
      flash: 0, flashColor: new THREE.Color(0xffffff), dirty: false,
    };
    this.tiles.set(k, tl);
    if (col < this.colMin) this.colMin = col;
    if (col > this.colMax) this.colMax = col;
    return tl;
  }

  /** Recolour a tile to a new kind in place — how a cleared arena's enemy half becomes friendly ground. */
  retint(tl, kind) {
    tl.kind = kind;
    const [slabColor, rimColor] = this.kinds[kind];
    tl.baseSlab.set(slabColor); tl.baseRim.set(rimColor);
    tl.slabMat.color.set(slabColor); tl.rimMat.color.set(rimColor);
  }

  dispose(col, row) {
    const k = this.key(col, row);
    const tl = this.tiles.get(k);
    if (!tl) return;
    this.scene.remove(tl.g);
    tl.slabMat.dispose();
    tl.rimMat.dispose();
    this.tiles.delete(k);
  }

  /** Recompute the column bounds from what is left — call after disposing an edge segment. */
  recomputeBounds() {
    this.colMin = Infinity; this.colMax = -Infinity;
    for (const tl of this.tiles.values()) {
      if (tl.col < this.colMin) this.colMin = tl.col;
      if (tl.col > this.colMax) this.colMax = tl.col;
    }
  }

  // ---------- animation channels ----------

  /** Press a tile down and light its rim; it springs back on its own. */
  press(col, row, amount) {
    const tl = this.at(col, row);
    if (!tl) return;
    tl.dipV -= amount;
    tl.glow = 1;
  }
  /** Flash a tile's rim a colour: a telegraph. */
  flash(col, row, color) {
    const tl = this.at(col, row);
    if (!tl) return;
    tl.flash = 1;
    tl.flashColor.set(color);
  }

  update(frameDt) {
    const k = frameDt / 1000;
    const stainDecay = this.stain ? this.stain.decay : 0;
    for (const tl of this.tiles.values()) {
      // the stain is held at its level while something sits on it, healing once it leaves
      if (!tl.stainHeld && tl.stain > 0) tl.stain = Math.max(0, tl.stain - frameDt * stainDecay);
      tl.stainHeld = false;
      if (tl.flash > 0) tl.flash = Math.max(0, tl.flash - k * 3);
      if (tl.dip === 0 && tl.dipV === 0 && tl.glow === 0 && tl.stain === 0 && tl.flash === 0 && !tl.dirty) continue;
      // a stiff spring towards rest
      tl.dipV += (-tl.dip * 260 - tl.dipV * 18) * k;
      tl.dip += tl.dipV * k;
      if (Math.abs(tl.dip) < 0.0005 && Math.abs(tl.dipV) < 0.002) { tl.dip = 0; tl.dipV = 0; }
      tl.g.position.y = tl.dip;
      tl.glow = Math.max(0, tl.glow - k * 2.6);
      if (this._stainSlab) {
        tl.slabMat.color.lerpColors(tl.baseSlab, this._stainSlab, tl.stain);
        this._c.lerpColors(tl.baseRim, this._stainRim, tl.stain);
      } else {
        this._c.copy(tl.baseRim);
      }
      tl.rimMat.color.lerpColors(this._c, tl.flashColor, tl.flash);
      tl.rimMat.opacity = 0.75 + 0.25 * Math.max(tl.glow, tl.flash);
      // one more pass after the colours have faded, so they land exactly on base
      tl.dirty = tl.stain > 0 || tl.flash > 0;
    }
  }
}
