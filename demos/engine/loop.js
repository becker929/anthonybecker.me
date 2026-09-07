/*!
 * The render loop, and the way a test drives the sim instead.
 *
 * `update(t, frameDt)` is everything a frame does but the render. Splitting
 * it out is what lets `simulate()` drive it in fixed virtual steps with no
 * rendering at all, so a test can run a whole arc in milliseconds of wall
 * time instead of minutes.
 *
 * The first `simulate()` call hands the sim over for good: real frames stop
 * calling `update()` — and stop rendering. Three's own rAF loop keeps
 * ticking regardless of `simulate()`, so without that the sim would advance
 * twice, once for real and again through whatever the test asked for; and
 * continuing to render at 60fps under a headless software rasterizer while
 * a test also hammers `simulate()` thousands of times is exactly the
 * background load that eventually stalls the CDP pipe. `simulate()` renders
 * once per call instead.
 */

export class Loop {
  constructor({ clock, stage, update, maxFrameMs = 50 }) {
    this.clock = clock;
    this.stage = stage;
    this.updateFrame = update;
    this.maxFrameMs = maxFrameMs;
    this.last = clock.now();
    this.frameDt = 16;
  }

  start() {
    this.stage.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    if (this.clock.simDriven) return;
    const t = this.clock.now();
    this.frameDt = Math.min(this.maxFrameMs, t - this.last);
    this.last = t;
    // Pause freezes literally everything — no update call runs, so nothing
    // (a tile's spring, a popup's fade, the camera's shake) so much as
    // ticks. The render loop still repaints the same frame.
    if (this.clock.paused) { this.stage.render(); return; }
    this.updateFrame(t, this.frameDt);
    this.stage.render();
  }

  renderOnce() { this.stage.render(); }

  /**
   * Fast-forward `ms` of virtual time in fixed `step`-ms increments. A
   * software-rendered frame costs far more than a whole step, so a bot
   * playing a long run passes `render: false` and asks for a frame when it
   * wants one.
   */
  simulate(ms, step = 16, render = true) {
    this.clock.takeOver();
    const steps = Math.max(1, Math.round(ms / step));
    for (let i = 0; i < steps; i++) {
      this.clock.advance(step);
      const t = this.clock.now();
      this.frameDt = step;
      if (!this.clock.paused) this.updateFrame(t, step);
      this.last = t;
    }
    if (render) this.renderOnce();
  }
}
