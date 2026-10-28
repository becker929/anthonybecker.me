// Catoid Sweep: one knob, swept down a corridor of rooms, from Hot-dog Kitty to Jimothy.
// A catoid sculpted from signed distance fields (round cones, capsules, smooth unions) on a black
// plinth in a dark gallery, walking in place. param(0).x is where this room sits on the sweep (0 long
// and thin, 1 round), param(1) its coat, param(2) its rim light. Catoid week, the simcluster, Oct 2026.

const S: f32 = 1.35;                  // sculpture scale: catoid units to metres
const CAT_Z: f32 = -2.4;              // the plinth runs along the north side, the walk along the middle
const PLINTH_H: f32 = 0.3;

var<private> cL: f32;      // half body length
var<private> cR: f32;      // body radius
var<private> cLeg: f32;    // leg length
var<private> cHead: f32;   // head radius
var<private> cTail: f32;   // tail length
var<private> cH: f32;      // body height
var<private> cPh: f32;     // gait phase
var<private> mat: f32;     // 0 coat, 1 eye, 2 nose, 3 inner ear

fn sweep() -> f32 { return clamp(param(0u).x, 0.0, 1.0); }

fn set_cat() {
    let t = sweep();
    cL = mix(1.3, 0.3, t);
    cR = mix(0.19, 0.62, t);
    cLeg = mix(0.62, 0.24, t);
    cHead = mix(0.23, 0.33, t);
    cTail = mix(1.05, 0.5, t);
    cH = max(cLeg + cR * 0.5, cR + 0.1);
    cPh = time() * mix(4.2, 2.6, t);
}

// Inigo Quilez's ellipsoid bound.
fn sd_ellipsoid(p: vec3f, r: vec3f) -> f32 {
    let k0 = length(p / r);
    let k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / k1;
}

fn sd_capsule(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// Inigo Quilez's round cone between two points.
fn sd_round_cone(p: vec3f, a: vec3f, b: vec3f, r1: f32, r2: f32) -> f32 {
    let ba = b - a;
    let l2 = dot(ba, ba);
    let rr = r1 - r2;
    let a2 = l2 - rr * rr;
    let il2 = 1.0 / l2;
    let pa = p - a;
    let y = dot(pa, ba);
    let z = y - l2;
    let xv = pa * l2 - ba * y;
    let x2 = dot(xv, xv);
    let y2 = y * y * l2;
    let z2 = z * z * l2;
    let k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - r2; }
    if (sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - r1; }
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

fn head_c() -> vec3f { return vec3f(cL + cR * 0.45 + cHead * 0.75, cH + cR * 0.55 + cHead * 0.45, 0.0); }

// The catoid in its own units: x from tail to head, y up from the plinth, z across.
fn cat(p: vec3f) -> f32 {
    let t = sweep();
    // body: a round cone, chest a little higher, with a belly that sags as it gets round
    var d = sd_round_cone(p, vec3f(-cL, cH, 0.0), vec3f(cL, cH + 0.05, 0.0), cR, cR * 0.9);
    d = smin(d, sd_ellipsoid(p - vec3f(0.0, cH - cR * 0.2, 0.0), vec3f(cL * 0.85 + cR * 0.5, cR * 0.92, cR * 1.02)), 0.12);
    // legs walk in place: front and back pairs in counter-phase
    for (var i = 0; i < 4; i = i + 1) {
        let fx = select(-1.0, 1.0, i < 2);
        let side = select(-1.0, 1.0, (i & 1) == 0);
        let ph = cPh + select(0.0, PI, (i == 1) || (i == 2));
        let hip = vec3f(fx * cL * 0.82, cH - cR * 0.2, side * max(cR * 0.55, 0.11));
        let swing = sin(ph) * cLeg * 0.32;
        let lift = max(cos(ph), 0.0) * cLeg * 0.14;
        let paw = vec3f(hip.x + swing, 0.075 + lift, hip.z);
        d = smin(d, sd_round_cone(p, paw, hip, 0.07, mix(0.1, 0.17, t)), 0.08);
        d = smin(d, sd_ellipsoid(p - paw - vec3f(0.035, -0.015, 0.0), vec3f(0.1, 0.06, 0.08)), 0.04);
    }
    // tail: six segments curling up and back, swishing
    var a = vec3f(-cL - cR * 0.6, cH + cR * 0.3, 0.0);
    var ang = 2.35;
    let seg = cTail / 6.0;
    for (var i = 0; i < 6; i = i + 1) {
        let fi = f32(i);
        ang = ang - 0.32 + sin(time() * 1.7 - fi * 0.7) * 0.12;
        let b = a + vec3f(cos(ang), sin(ang), sin(time() * 1.1 - fi * 0.5) * 0.06) * seg;
        d = smin(d, sd_capsule(p, a, b, mix(0.075, 0.035, fi / 5.0) * (1.0 + t * 0.6)), 0.05);
        a = b;
    }
    // head, cheeks, muzzle
    let hc = head_c() + vec3f(0.0, sin(cPh * 2.0) * 0.012, 0.0);
    var h = length(p - hc) - cHead;
    h = smin(h, sd_ellipsoid(p - hc - vec3f(0.02, -cHead * 0.28, 0.0), cHead * vec3f(0.8, 0.62, 1.08)), 0.06);
    let mz = hc + vec3f(cHead * 0.82, -cHead * 0.3, 0.0);
    h = smin(h, sd_ellipsoid(p - mz, cHead * vec3f(0.3, 0.26, 0.38)), 0.06);
    d = smin(d, h, 0.16);
    // ears: flattened round cones
    var ear = 1e5;
    for (var s = -1.0; s < 2.0; s = s + 2.0) {
        let base = hc + vec3f(-cHead * 0.1, cHead * 0.62, s * cHead * 0.52);
        let tip = base + vec3f(-0.04, cHead * 0.72, s * cHead * 0.26);
        var q = p - base;
        q.x = q.x * 1.7;
        ear = min(ear, sd_round_cone(q, vec3f(0.0), (tip - base) * vec3f(1.7, 1.0, 1.0), cHead * 0.42, 0.02) / 1.7);
    }
    d = smin(d, ear, 0.03);
    // materials, by the nearest feature
    mat = 0.0;
    let eyeL = length(p - (hc + vec3f(cHead * 0.72, cHead * 0.18, cHead * 0.4))) - cHead * 0.16;
    let eyeR = length(p - (hc + vec3f(cHead * 0.72, cHead * 0.18, -cHead * 0.4))) - cHead * 0.16;
    if (min(eyeL, eyeR) < 0.012) { mat = 1.0; }
    if (length(p - (mz + vec3f(cHead * 0.24, cHead * 0.12, 0.0))) < cHead * 0.13) { mat = 2.0; }
    return d;
}

fn to_cat(p: vec3f) -> vec3f { return (p - vec3f(0.0, PLINTH_H, CAT_Z)) / S; }
fn cat_w(p: vec3f) -> f32 { return cat(to_cat(p)) * S; }

fn cat_n(p: vec3f) -> vec3f {
    let e = vec2f(0.004, 0.0);
    return normalize(vec3f(cat_w(p + e.xyy) - cat_w(p - e.xyy), cat_w(p + e.yxy) - cat_w(p - e.yxy), cat_w(p + e.yyx) - cat_w(p - e.yyx)));
}

fn cat_box_min() -> vec3f { return vec3f(-cL - cR - cTail - 0.15, 0.0, -cR - 0.45) * S + vec3f(0.0, PLINTH_H, CAT_Z); }
fn cat_box_max() -> vec3f { return vec3f(cL + cR + cHead * 2.6 + 0.1, cH + cR + cHead * 2.4 + max(cTail * 0.7, 0.4), cR + 0.45) * S + vec3f(0.0, PLINTH_H, CAT_Z); }

const LIGHT: vec3f = vec3f(0.35, 0.85, 0.4);

fn soft_shadow(p: vec3f) -> f32 {
    let l = normalize(LIGHT);
    let b = box_span(p, l, cat_box_min(), cat_box_max());
    if (b.x > b.y || b.y < 0.0) { return 1.0; }
    var t = max(b.x, 0.02);
    var res = 1.0;
    for (var i = 0; i < 20; i = i + 1) {
        if (t > b.y) { break; }
        let h = cat_w(p + l * t);
        res = min(res, 10.0 * h / t);
        if (res < 0.02) { break; }
        t += clamp(h, 0.03, 0.4);
    }
    return clamp(res, 0.0, 1.0);
}

fn rim_col() -> vec3f { return param(2u).rgb; }

fn shade_cat(p: vec3f, rd: vec3f) -> vec3f {
    let n = cat_n(p);
    let m = mat;
    let cp = to_cat(p);
    let t = sweep();
    // coat: tabby stripes across the back, a pale belly and muzzle
    var base = param(1u).rgb;
    let stripe = smoothstep(0.35, 0.6, sin(cp.x * mix(13.0, 7.0, t) + fbm3(cp * 3.0) * 2.4)) * smoothstep(-0.2, 0.4, n.y);
    base = mix(base, base * 0.35, stripe * 0.75);
    base = mix(base, vec3f(0.92, 0.88, 0.8), smoothstep(-0.25, -0.7, n.y) * 0.8);
    if (m == 1.0) { base = vec3f(0.05, 0.25, 0.12); }
    if (m == 2.0) { base = vec3f(0.85, 0.45, 0.5); }
    let l = normalize(LIGHT);
    let diff = max(dot(n, l), 0.0) * (0.35 + 0.65 * soft_shadow(p + n * 0.01));
    let ao = clamp(0.5 + 0.5 * cat_w(p + n * 0.12) / 0.12, 0.0, 1.0);
    let rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    let back = max(dot(n, normalize(vec3f(-0.6, 0.3, -0.8))), 0.0);
    let spec = pow(max(dot(reflect(rd, n), l), 0.0), select(24.0, 90.0, m == 1.0)) * select(0.25, 1.2, m == 1.0);
    var col = base * (0.08 + diff * 1.1) * ao + rim_col() * (rim * 0.6 + back * 0.25) + vec3f(spec);
    return col;
}

fn led_wall(p: vec3f) -> vec3f {
    // the north wall: a dark field, faint grid, and the sweep as a bar of LEDs above the catoid
    var col = vec3f(0.018, 0.016, 0.03);
    let g = abs(fract(p.xy * 2.0) - 0.5);
    col += vec3f(0.02, 0.03, 0.05) * smoothstep(0.47, 0.5, max(g.x, g.y));
    if (abs(p.y - 3.75) < 0.12 && abs(p.x) < 4.0) {
        let cell = floor((p.x + 4.0) / 8.0 * 24.0);
        let lit = cell < floor(sweep() * 23.0 + 0.5) + 1.0;
        let f = fract((p.x + 4.0) / 8.0 * 24.0);
        let inside = step(0.12, f) * step(f, 0.88) * step(abs(p.y - 3.75), 0.085);
        let here = abs(cell - floor(sweep() * 23.0 + 0.5)) < 0.5;
        col = mix(col, select(rim_col() * 0.12, select(rim_col(), vec3f(1.0), here), lit), inside);
    }
    return col;
}

fn shade(ro: vec3f, rd: vec3f, tmin: f32, tmax: f32) -> Hit {
    set_cat();
    var best = tmax;
    var kind = 0; // 0 wall/ceiling, 1 floor, 2 plinth, 3 catoid
    // the catoid
    let cb = box_span(ro, rd, cat_box_min(), cat_box_max());
    if (cb.x < cb.y && cb.y > tmin) {
        var t = max(cb.x, tmin);
        let steps = select(60, 90, quality() > 0.6);
        for (var i = 0; i < 90; i = i + 1) {
            if (i >= steps || t > cb.y) { break; }
            let d = cat_w(ro + rd * t);
            if (d < 0.002 * t + 0.002) { best = t; kind = 3; break; }
            t += d * 0.9;
        }
    }
    // the plinth: black glass with a neon edge
    let pmin = vec3f(-4.4, 0.0, CAT_Z - 1.1);
    let pmax = vec3f(4.4, PLINTH_H, CAT_Z + 1.1);
    let pb = box_span(ro, rd, pmin, pmax);
    if (pb.x < pb.y && pb.x > tmin && pb.x < best) { best = pb.x; kind = 2; }
    let tf = plane_y(ro, rd, 0.0);
    if (tf > 0.0 && tf < best) { best = tf; kind = 1; }

    let p = ro + rd * best;
    if (kind == 3) {
        let c = shade_cat(p, rd);
        return Hit(tone(c * 1.3), best);
    }
    if (kind == 2) {
        var c = vec3f(0.012, 0.012, 0.018);
        let edge = min(min(abs(p.x - pmin.x), abs(p.x - pmax.x)), min(abs(p.z - pmin.z), abs(p.z - pmax.z)));
        let top = p.y > PLINTH_H - 0.002;
        if (top) {
            c += vec3f(0.05) * pow(max(dot(reflect(rd, vec3f(0.0, 1.0, 0.0)), normalize(LIGHT)), 0.0), 40.0);
            c *= 0.4 + 0.6 * soft_shadow(p);
            c += rim_col() * smoothstep(0.035, 0.0, edge) * 1.6;
        } else {
            c += rim_col() * smoothstep(0.02, 0.0, abs(p.y - PLINTH_H + 0.02)) * 1.2;
        }
        return Hit(tone(c), best);
    }
    if (kind == 1) {
        // polished dark floor, a lit pool by the plinth, a faint grid, the rim colour bleeding
        var c = vec3f(0.02, 0.02, 0.028);
        let g = abs(fract(p.xz * 1.0) - 0.5);
        c += vec3f(0.035, 0.04, 0.06) * smoothstep(0.485, 0.5, max(g.x, g.y));
        let pool = exp(-pow(max(abs(p.x) - 3.5, 0.0), 2.0) * 0.6 - pow(p.z - CAT_Z - 1.6, 2.0) * 0.9);
        c += rim_col() * pool * 0.12;
        c += vec3f(0.06) * pow(max(dot(reflect(rd, vec3f(0.0, 1.0, 0.0)), normalize(vec3f(0.0, 1.0, -0.4))), 0.0), 30.0);
        return Hit(tone(c), best);
    }
    // walls and ceiling: painted dark; the north wall carries the sweep
    let w = ro + rd * horizon_t(tmax);
    var c = vec3f(0.016, 0.015, 0.024);
    if (w.z < -ROOM_HALF + 0.05) { c = led_wall(w); }
    else if (w.y > ROOM_HEIGHT - 0.05) {
        // ceiling: a strip of light over the plinth
        c = vec3f(0.01) + vec3f(0.5) * smoothstep(0.25, 0.0, abs(w.z - CAT_Z)) * step(abs(w.x), 4.2);
    } else {
        // a neon line where the walls meet the floor
        c += rim_col() * smoothstep(0.04, 0.0, abs(w.y - 0.06)) * 0.8;
    }
    return Hit(tone(c), horizon_t(tmax));
}
