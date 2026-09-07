/*!
 * Chips: a pad button that is its own readout — a dim label over the live
 * value, so the control doubles as the indicator and the HUD does not have
 * to repeat it six inches away. A phone has no room for a row of text
 * describing buttons already on screen.
 *
 * `announce()` is the one door every setter walks through: a ~450ms
 * scale/border ping so the eye finds the chip that changed, plus a small
 * badge naming *how* it changed (`key C`, `tap`, `shift`, `wheel`, `url`)
 * for ~900ms. It always pings; the badge only shows when a `via` is given.
 *
 * The markup each chip expects (see either demo's index.html):
 *   <button id="btn-cam" class="chip">
 *     <span class="chip-label">CAM</span>
 *     <span class="chip-value" id="chip-cam">fixed</span>
 *     <span class="via" id="via-cam" hidden></span>
 *   </button>
 */

const PING_MS = 460;
const VIA_MS = 900;

export class Chips {
  /** `ids` are the chip names; each resolves `btn-<id>`, `chip-<id>` and `via-<id>`. */
  constructor(ids, $ = (id) => document.getElementById(id)) {
    this.map = new Map();
    for (const id of ids) {
      const btn = $("btn-" + id);
      if (!btn) continue;
      this.map.set(id, { btn, value: $("chip-" + id), via: $("via-" + id) });
    }
  }

  announce(id, value, via) {
    const c = this.map.get(id);
    if (!c) return;
    if (c.value) c.value.textContent = value;
    if (via && c.via) {
      c.via.textContent = via;
      c.via.hidden = false;
      clearTimeout(c.viaTimer);
      c.viaTimer = setTimeout(() => { c.via.hidden = true; }, VIA_MS);
    }
    c.btn.classList.remove("ping");
    void c.btn.offsetWidth;   // restart the animation even on back-to-back changes
    c.btn.classList.add("ping");
    clearTimeout(c.pingTimer);
    c.pingTimer = setTimeout(() => c.btn.classList.remove("ping"), PING_MS);
  }

  /** The chip's "engaged" colour — a lock held, a mode on. */
  toggle(id, on) { this.map.get(id)?.btn.classList.toggle("on", on); }
  /** Set the value with no ping: a chip that tracks something changing every frame. */
  set(id, value) { const c = this.map.get(id); if (c?.value) c.value.textContent = value; }
  get(id) { return this.map.get(id); }
}
