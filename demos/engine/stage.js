/*!
 * The stage: renderer, scene, camera, lights, the ground plane and the air.
 *
 * Everything here is the look of a scene rather than the rules of a game —
 * so every colour and intensity is an option, and the defaults are only
 * defaults. The one piece worth reading before changing it is
 * `makeEnvironment()`: the image-based lighting is a room built out of a
 * few glowing panels, and it is what makes low-poly armour and rock read as
 * surfaces instead of flat paint. Drop it and everything goes matte.
 */
import * as THREE from "./three.js";
import { softDisc, verticalGradient, GLOW_STOPS, SHADOW_STOPS } from "./textures.js";

const DEFAULT_SKY = [[0, "#090c13"], [0.55, "#131b2c"], [0.7, "#0f1522"], [1, "#07090e"]];

export class Stage {
  /**
   * `container`: the element the canvas fills. Options are all cosmetic:
   * `sky` (gradient stops or a THREE.Color), `fog` ({ color, near, far }),
   * `ground` ({ color, size, y } or null for none), `lights`, `env`, and
   * `motes` ({ count, color, ... } or null).
   */
  constructor(container, opts = {}) {
    const {
      sky = DEFAULT_SKY,
      fog = { color: 0x0e1420, near: 9, far: 22 },
      ground = { color: 0x0a0d14, size: 80, y: -0.2 },
      camera = { fov: 30, near: 0.1, far: 60 },
      lights = {},
      env = {},
      motes = { count: 220, color: 0x8fb0ff },
      pixelRatioCap = 2,
      onResize = null,   // called after every successful resize, for anything that reframes (a fitted fov)
    } = opts;

    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = Array.isArray(sky) ? verticalGradient(sky) : new THREE.Color(sky);
    if (fog) this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);

    this.camera = new THREE.PerspectiveCamera(camera.fov, 1, camera.near, camera.far);

    // The two textures every glow and shadow in a demo is built from, made
    // once here so nothing downstream builds a second copy.
    this.discTex = softDisc(GLOW_STOPS);
    this.shadowTex = softDisc(SHADOW_STOPS);

    this.scene.environment = this.makeEnvironment(env);
    this.scene.environmentIntensity = env.intensity ?? 0.7;
    this.addLights(lights);
    if (ground) this.addGround(ground);
    this.motes = motes ? this.addMotes(motes) : null;

    this.onResize = onResize;
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
  }

  /**
   * Image-based lighting from a room built out of a few glowing panels: a
   * big cool light overhead, a warm/red one off one side, a cool/blue one
   * off the other, and a faint bounce from the floor.
   */
  makeEnvironment({ panels, wall = 0x0c1018 } = {}) {
    const room = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const walls = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: wall, side: THREE.BackSide }));
    walls.scale.setScalar(30);
    room.add(walls);
    const list = panels ?? [
      [0xdfe9ff, 9, [-3, 9, 5], [6, 0.2, 6]],       // key: wide and soft, above and behind the camera
      [0xff5470, 4, [10, 3, -6], [0.2, 4, 6]],      // rim, off one side
      [0x4f8dff, 3, [-10, 2, -4], [0.2, 4, 6]],     // fill, off the other
      [0x3a4a7a, 1.5, [0, -6, 0], [14, 0.2, 14]],   // a faint bounce from the floor
    ];
    for (const [hex, intensity, pos, size] of list) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) }));
      m.position.set(...pos); m.scale.set(...size);
      room.add(m);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const tex = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    return tex;
  }

  addLights({ hemi = [0x9fbfff, 0x1a1420, 0.35], key: keyOpt = {}, rim: rimOpt = {}, fill: fillOpt = {} } = {}) {
    this.scene.add(new THREE.HemisphereLight(...hemi));

    const key = new THREE.DirectionalLight(keyOpt.color ?? 0xfff4e6, keyOpt.intensity ?? 2.2);
    key.position.set(...(keyOpt.position ?? [-3, 7, 4.5]));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const b = keyOpt.shadowBox ?? { near: 2, far: 18, left: -4.5, right: 4.5, top: 3.5, bottom: -3 };
    key.shadow.camera.near = b.near; key.shadow.camera.far = b.far;
    key.shadow.camera.left = b.left; key.shadow.camera.right = b.right;
    key.shadow.camera.top = b.top; key.shadow.camera.bottom = b.bottom;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.scene.add(key);
    // A DirectionalLight aims at its `target`, which is an Object3D that is
    // NOT in the scene by default and so never gets a world matrix. Adding
    // it is what lets a game move the shadow frustum along with a world
    // that scrolls; leave it where it is and the shadows simply stop once
    // the player rides out of the box set above.
    this.scene.add(key.target);
    this.key = key;

    const rim = new THREE.DirectionalLight(rimOpt.color ?? 0xff5470, rimOpt.intensity ?? 0.8);
    rim.position.set(...(rimOpt.position ?? [6, 2.5, -4]));
    this.scene.add(rim);
    this.rim = rim;

    const fill = new THREE.DirectionalLight(fillOpt.color ?? 0x4f8dff, fillOpt.intensity ?? 0.5);
    fill.position.set(...(fillOpt.position ?? [-6, 1.5, -3]));
    this.scene.add(fill);
    this.fill = fill;
  }

  /** A dark plane that takes the shadow and fades into the fog, so nothing floats in the void. */
  addGround({ color = 0x0a0d14, size = 80, y = -0.2, roughness = 0.95 }) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = y;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
    return ground;
  }

  /** A slow drift of dust in the light, so the air has depth. Call `motes.update()` each frame. */
  addMotes({ count = 220, color = 0x8fb0ff, size = 0.06, opacity = 0.45, spread = [12, 8], ceiling = 3.2, floor = -0.1 }) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread[0];
      pos[i * 3 + 1] = floor + Math.random() * (ceiling - floor);
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread[1];
      seed[i] = Math.random() * 1000;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: this.discTex, color, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(points);
    return {
      points, geo,
      /** `originX` recentres the drift on a world that scrolls (a ride), so the air never runs out behind. */
      update(t, frameDt, originX = null) {
        const a = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          const s = seed[i];
          a[i * 3 + 1] += 0.00008 * frameDt * (0.6 + Math.sin(s) * 0.4);
          a[i * 3] += Math.sin(t / 2600 + s) * 0.0002 * frameDt;
          if (a[i * 3 + 1] > ceiling) a[i * 3 + 1] = floor;
          if (originX !== null) {
            const half = spread[0] / 2;
            if (a[i * 3] < originX - half) a[i * 3] += spread[0];
            else if (a[i * 3] > originX + half) a[i * 3] -= spread[0];
          }
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return false;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize?.(w, h);
    return true;
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
