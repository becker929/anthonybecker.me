// Catoid Forms: the catoid in six schools of mathematical sculpture. param(0).x picks the form:
//   0 gyroid lattice (after Bathsheba Grossman)      1 umbilic torus, curled asleep (after Helaman Ferguson)
//   2 endless ribbon, a one-sided cat (after Max Bill) 3 linear construction in string (after Naum Gabo)
//   4 hanging looped-wire lobes (after Ruth Asawa)    5 a polished form in space (after Constantin Brancusi)
// param(1) is the material colour, param(2) the room's light. Catoid week, the simcluster, Oct 2026.

const PLINTH_H: f32 = 0.5;
const LIGHT: vec3f = vec3f(0.3, 0.9, 0.35);

fn form() -> i32 { return i32(param(0u).x + 0.5); }
fn mat_col() -> vec3f { return param(1u).rgb; }
fn rim_col() -> vec3f { return param(2u).rgb; }

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

// A cat's head with ears and muzzle, facing +x, centred at c (shared by several forms).
fn cat_head(p: vec3f, c: vec3f, r: f32) -> f32 {
    var h = length(p - c) - r;
    h = smin(h, sd_ellipsoid(p - c - vec3f(0.02, -r * 0.28, 0.0), r * vec3f(0.8, 0.62, 1.08)), r * 0.25);
    h = smin(h, sd_ellipsoid(p - c - vec3f(r * 0.82, -r * 0.3, 0.0), r * vec3f(0.3, 0.26, 0.38)), r * 0.25);
    for (var s = -1.0; s < 2.0; s = s + 2.0) {
        let base = c + vec3f(-r * 0.1, r * 0.62, s * r * 0.52);
        var q = p - base;
        q.x = q.x * 1.7;
        h = smin(h, sd_round_cone(q, vec3f(0.0), vec3f(-0.07, r * 0.72, s * r * 0.26), r * 0.42, r * 0.06) / 1.7, r * 0.12);
    }
    return h;
}

// ---- 0: the gyroid catoid. A standing cat, its volume replaced by a gyroid sheet that drifts through it.
fn cat_body(p: vec3f) -> f32 {
    // the sweet-spot proportions of the Catoid Sweep, standing on the plinth, 1.15 m to a catoid unit
    let q = (p - vec3f(0.0, PLINTH_H, 0.0)) / 1.15;
    let L = 0.75; let R = 0.38; let leg = 0.45; let H = leg + R * 0.5;
    var d = sd_round_cone(q, vec3f(-L, H, 0.0), vec3f(L, H + 0.05, 0.0), R, R * 0.9);
    for (var i = 0; i < 4; i = i + 1) {
        let fx = select(-1.0, 1.0, i < 2);
        let side = select(-1.0, 1.0, (i & 1) == 0);
        let hip = vec3f(fx * L * 0.8, H - R * 0.2, side * R * 0.55);
        d = smin(d, sd_round_cone(q, vec3f(hip.x + 0.04, 0.07, hip.z), hip, 0.07, 0.13), 0.08);
    }
    var a = vec3f(-L - R * 0.6, H + R * 0.3, 0.0);
    var ang = 2.35;
    for (var i = 0; i < 5; i = i + 1) {
        ang = ang - 0.36 + sin(time() * 0.9 - f32(i) * 0.7) * 0.1;
        let b = a + vec3f(cos(ang), sin(ang), 0.0) * 0.17;
        d = smin(d, sd_capsule(q, a, b, mix(0.07, 0.04, f32(i) / 4.0)), 0.05);
        a = b;
    }
    d = smin(d, cat_head(q, vec3f(L + R * 0.45 + 0.21, H + R * 0.55 + 0.13, 0.0), 0.28), 0.14);
    return d * 1.15;
}
fn gyroid_cat(p: vec3f) -> f32 {
    let k = 12.0;
    let q = p * k + vec3f(0.0, time() * 0.25, time() * 0.1);
    let g = abs(sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x)) / k * 0.55 - 0.014;
    return max(cat_body(p), g);
}

// ---- 1: the umbilic catoid. Curled asleep: a torus whose three-lobed section turns a third of a turn
// on the way round, so one edge runs round it three times, with the head tucked onto the coil.
fn umbilic(p: vec3f) -> f32 {
    let c = vec3f(0.0, PLINTH_H + 0.42, 0.0);
    let q = p - c;
    let th = atan2(q.z, q.x);
    let breathe = 1.0 + 0.012 * sin(time() * 1.3);
    let Rm = 0.78 * breathe;
    var s = vec2f(length(q.xz) - Rm, q.y);
    let tw = th / 3.0 + time() * 0.05;
    s = rot2(tw) * s;
    let ph = atan2(s.y, s.x);
    let r = 0.36 * breathe * (1.0 + 0.2 * cos(3.0 * ph));
    var d = (length(s) - r) * 0.8;
    // the head rests on the coil, nose towards the tail
    let hc = c + vec3f(cos(0.5) * Rm, 0.42, sin(0.5) * Rm);
    let hp = p - hc;
    let hr = vec3f(rot2(-0.5 - PI * 0.5) * hp.xz, hp.y);
    d = smin(d, cat_head(vec3f(hr.x, hr.z, hr.y), vec3f(0.0), 0.36), 0.1);
    return d;
}
fn umbilic_edge(p: vec3f) -> f32 {
    let q = p - vec3f(0.0, PLINTH_H + 0.42, 0.0);
    let th = atan2(q.z, q.x);
    var s = rot2(th / 3.0 + time() * 0.05) * vec2f(length(q.xz) - 0.78, q.y);
    return cos(3.0 * atan2(s.y, s.x));
}

// ---- 2: the endless-ribbon catoid. A cat whose body is a Möbius band: back, belly and back again, one side.
fn ribbon(p: vec3f) -> f32 {
    let c = vec3f(0.0, PLINTH_H + 1.05, 0.0);
    var q = p - c;
    q.x = q.x / 1.55;
    let th = atan2(q.y, q.x);
    var s = vec2f(length(q.xy) - 0.62, q.z);
    s = rot2(th * 0.5 + time() * 0.08) * s;
    let band = vec2f(0.3, 0.028);
    let e = abs(s) - band;
    var d = (length(max(e, vec2f(0.0))) + min(max(e.x, e.y), 0.0) - 0.01) * 0.62;
    // legs down to the plinth, head and tail out of the band
    for (var i = 0; i < 4; i = i + 1) {
        let fx = select(-0.55, 0.55, i < 2);
        let side = select(-0.14, 0.14, (i & 1) == 0);
        d = min(d, sd_round_cone(p, vec3f(fx + 0.03, PLINTH_H + 0.06, side), vec3f(fx, PLINTH_H + 0.62, side), 0.055, 0.08));
    }
    d = smin(d, cat_head(p, c + vec3f(1.12, 0.38, 0.0), 0.27), 0.1);
    d = smin(d, sd_capsule(p, c + vec3f(-0.98, 0.1, 0.0), c + vec3f(-1.35, 0.75 + 0.06 * sin(time()), 0.0), 0.045), 0.06);
    return d;
}

// ---- 3: the linear construction. Two perspex plates cut to a cat's outline, strung with taut threads
// from each point of one to a point further round the other: a ruled surface that twists as the shift drifts.
const NP: i32 = 24;
fn outline(i: i32) -> vec2f {
    // a standing cat in profile, clockwise from the tip of the tail, metres
    var pts = array<vec2f, 24>(
        vec2f(-1.45, 1.6), vec2f(-1.28, 1.08), vec2f(-1.05, 0.98), vec2f(-0.45, 1.02), vec2f(0.25, 1.04),
        vec2f(0.68, 1.12), vec2f(0.84, 1.38), vec2f(0.84, 1.66), vec2f(0.92, 1.9), vec2f(1.04, 1.7),
        vec2f(1.17, 1.88), vec2f(1.22, 1.62), vec2f(1.45, 1.43), vec2f(1.3, 1.28), vec2f(1.0, 1.18),
        vec2f(0.86, 0.9), vec2f(0.8, 0.0), vec2f(0.6, 0.0), vec2f(0.58, 0.68), vec2f(-0.6, 0.68),
        vec2f(-0.68, 0.0), vec2f(-0.9, 0.0), vec2f(-1.02, 0.82), vec2f(-1.3, 1.12));
    return pts[((i % NP) + NP) % NP] + vec2f(0.0, PLINTH_H + 0.06);
}
fn outline_at(s: f32) -> vec2f {
    let f = fract(s / f32(NP)) * f32(NP);
    let i = i32(floor(f));
    return mix(outline(i), outline(i + 1), fract(f));
}
// distance between the ray and segment a-b, and the ray distance there
fn ray_seg(ro: vec3f, rd: vec3f, a: vec3f, b: vec3f) -> vec2f {
    let ba = b - a;
    let oa = ro - a;
    let bb = dot(ba, ba);
    let rb = dot(rd, ba);
    let den = bb - rb * rb;
    var u = clamp((dot(oa, ba) - dot(oa, rd) * rb) / max(den, 1e-6), 0.0, 1.0);
    let t = max(dot(a + ba * u - ro, rd), 0.0);
    u = clamp(dot(ro + rd * t - a, ba) / bb, 0.0, 1.0);
    return vec2f(length(ro + rd * t - (a + ba * u)), t);
}

// ---- 4: looped wire. A sitting cat as lobes of woven brass, one inside another, hung from the ceiling.
fn lobe_r(y: f32) -> f32 {
    // the sitting cat's radius at height y: haunches, waist, chest, neck, head
    let base = PLINTH_H + 0.35;
    let h = y - base;
    var r = 0.52 * exp(-pow((h - 0.25) / 0.32, 2.0));
    r = max(r, 0.38 * exp(-pow((h - 0.85) / 0.28, 2.0)));
    r = max(r, 0.3 * exp(-pow((h - 1.45) / 0.2, 2.0)));
    return r;
}
fn wire_shell(p: vec3f, scale: f32) -> f32 {
    let c = vec3f(0.0, 0.0, 0.0);
    let r = lobe_r(p.y) * scale;
    let th = atan2(p.z, p.x);
    // ears: the head lobe rises into two points
    let ear = select(0.0, max(cos(th * 2.0), 0.0) * 0.18 * smoothstep(1.55, 1.75, p.y - PLINTH_H - 0.35 + 0.35), scale > 0.9);
    let shell = abs(length(p.xz - c.xz) - r) - 0.006;
    let top = PLINTH_H + 0.35 + 1.72 + ear;
    let bounded = max(shell, max(p.y - top, PLINTH_H + 0.36 - p.y));
    // a diamond weave: two helical families of wire
    let u = th * 8.0 / PI;
    let v = p.y * 9.0;
    let w1 = abs(fract(u + v) - 0.5);
    let w2 = abs(fract(u - v) - 0.5);
    let weave = (min(w1, w2) - 0.06) / 11.0 * max(r, 0.08) * 3.0;
    return max(bounded, weave);
}
fn asawa(p: vec3f) -> f32 {
    var d = wire_shell(p, 1.0);
    d = min(d, wire_shell(p, 0.55));
    d = min(d, sd_capsule(p, vec3f(0.0, PLINTH_H + 2.05, 0.0), vec3f(0.0, ROOM_HEIGHT, 0.0), 0.006));
    // ears: two triangles of the same wire on the head lobe
    let hy = PLINTH_H + 0.35 + 1.5;
    for (var s = -1.0; s < 2.0; s = s + 2.0) {
        let a = vec3f(0.0, hy + 0.12, s * 0.08);
        let b = vec3f(0.0, hy + 0.08, s * 0.26);
        let t = vec3f(0.03, hy + 0.42, s * 0.22);
        d = min(d, min(sd_capsule(p, a, t, 0.007), min(sd_capsule(p, b, t, 0.007), sd_capsule(p, a, b, 0.007))));
    }
    // a tail of wire wrapped round the haunches, its tip lifting
    var prev = vec3f(-0.5, PLINTH_H + 0.45, 0.0);
    for (var i = 1; i < 9; i = i + 1) {
        let a = PI + f32(i) * 0.38;
        let next = vec3f(cos(a) * 0.56, PLINTH_H + 0.45 + f32(i) * f32(i) * 0.006 + sin(time() * 1.2) * 0.01 * f32(i), -sin(a) * 0.56);
        d = min(d, sd_capsule(p, prev, next, 0.014));
        prev = next;
    }
    return d;
}

// ---- 5: a form in space. One bent, polished ovoid that is a cat only in its ears and the flick of a tail.
fn brancusi(p: vec3f) -> f32 {
    let c = vec3f(0.0, 1.55, 0.0);
    var q = p - c;
    // bend the long axis into a curve
    q = vec3f(q.x, q.y + 0.15 * q.x * q.x - 0.05, q.z);
    var d = sd_ellipsoid(q, vec3f(1.15, 0.32, 0.26));
    d = smin(d, sd_ellipsoid(q - vec3f(1.0, 0.18, 0.0), vec3f(0.3, 0.24, 0.22)), 0.18);
    // two ear ridges and a tail that lifts off the far end
    for (var s = -1.0; s < 2.0; s = s + 2.0) {
        d = smin(d, sd_round_cone(q, vec3f(1.0, 0.3, s * 0.1), vec3f(0.98, 0.52, s * 0.15), 0.08, 0.012), 0.05);
    }
    d = smin(d, sd_capsule(q, vec3f(-1.05, 0.05, 0.0), vec3f(-1.45, 0.45 + 0.04 * sin(time() * 0.7), 0.0), 0.04), 0.1);
    return d * 0.85;
}

// ---- the dispatcher, normals, light
fn sdf(p: vec3f) -> f32 {
    let f = form();
    if (f == 0) { return gyroid_cat(p); }
    if (f == 1) { return umbilic(p); }
    if (f == 2) { return ribbon(p); }
    if (f == 4) { return asawa(p); }
    return brancusi(p);
}
fn nrm(p: vec3f) -> vec3f {
    let e = vec2f(0.002, 0.0);
    return normalize(vec3f(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx)));
}
fn bmin() -> vec3f {
    let f = form();
    if (f == 4) { return vec3f(-0.62, PLINTH_H + 0.3, -0.62); }
    if (f == 5) { return vec3f(-1.6, 1.0, -0.4); }
    if (f == 1) { return vec3f(-1.3, PLINTH_H, -1.3); }
    return vec3f(-1.75, PLINTH_H, -0.55);
}
fn bmax() -> vec3f {
    let f = form();
    if (f == 4) { return vec3f(0.62, ROOM_HEIGHT, 0.62); }
    if (f == 5) { return vec3f(1.55, 2.25, 0.4); }
    if (f == 1) { return vec3f(1.3, PLINTH_H + 1.25, 1.3); }
    return vec3f(1.75, PLINTH_H + 2.05, 0.55);
}
fn soft_shadow(p: vec3f) -> f32 {
    let l = normalize(LIGHT);
    let b = box_span(p, l, bmin(), bmax());
    if (b.x > b.y || b.y < 0.0 || form() == 3) { return 1.0; }
    var t = max(b.x, 0.02);
    var res = 1.0;
    for (var i = 0; i < 24; i = i + 1) {
        if (t > b.y) { break; }
        let h = sdf(p + l * t);
        res = min(res, 12.0 * h / t);
        if (res < 0.02) { break; }
        t += clamp(h, 0.01, 0.25);
    }
    return clamp(res, 0.0, 1.0);
}
fn env(r: vec3f) -> vec3f {
    // what a polished surface sees: the dark room, its ceiling light, two strips of the room's colour
    var c = vec3f(0.01, 0.01, 0.016) + vec3f(0.6) * smoothstep(0.9, 0.97, r.y);
    c += rim_col() * (smoothstep(0.06, 0.0, abs(r.y - 0.05)) * 0.9 + smoothstep(0.05, 0.0, abs(r.x - 0.7)) * 0.5);
    return c;
}

fn shade_form(p: vec3f, rd: vec3f) -> vec3f {
    let f = form();
    let n = nrm(p);
    let l = normalize(LIGHT);
    let diff = max(dot(n, l), 0.0) * (0.3 + 0.7 * soft_shadow(p + n * 0.01));
    let ao = clamp(0.4 + 0.6 * sdf(p + n * 0.06) / 0.06, 0.0, 1.0);
    let fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    let r = reflect(rd, n);
    var base = mat_col();
    var col = vec3f(0.0);
    if (f == 0) {
        // patinated bronze: darker deep in the lattice
        col = base * (0.06 + diff * 1.2) * ao * ao + env(r) * base * 0.6 + rim_col() * fres * 0.5;
    } else if (f == 1) {
        // granite, the umbilic edge polished bright
        let grain = noise3(p * 40.0) * 0.5 + noise3(p * 9.0) * 0.5;
        let edge = smoothstep(0.92, 0.99, umbilic_edge(p));
        base = base * (0.7 + 0.5 * grain);
        col = base * (0.06 + diff) * ao + env(r) * (0.04 + edge * 0.5) + rim_col() * edge * 0.25 + rim_col() * fres * 0.3;
    } else if (f == 2) {
        // white marble with grey veins
        let vein = smoothstep(0.02, 0.0, abs(fbm3(p * 2.5) - 0.5));
        base = mix(base, base * 0.45, vein * 0.7);
        col = base * (0.1 + diff * 1.05) * ao + env(r) * 0.08 + rim_col() * fres * 0.4;
    } else if (f == 4) {
        // brass wire
        col = base * (0.1 + diff * 1.3) + env(r) * base * 0.8 + rim_col() * fres * 0.6;
    } else {
        // mirror-polished bronze
        col = env(r) * mix(base, vec3f(1.0), fres) * 1.2 + base * diff * 0.25;
    }
    return col;
}

// the room: dark floor with the form's shadow, a plinth, dark walls with a line of the room's light
fn background(ro: vec3f, rd: vec3f, tmax: f32) -> Hit {
    let f = form();
    let ph = select(PLINTH_H, 0.95, f == 5);
    let pw = select(vec2f(1.85, 0.75), vec2f(0.55, 0.55), f == 1 || f == 4 || f == 5);
    let pmin = vec3f(-pw.x, 0.0, -pw.y);
    let pmax = vec3f(pw.x, ph, pw.y);
    let pb = box_span(ro, rd, pmin, pmax);
    let tf = plane_y(ro, rd, 0.0);
    if (pb.x < pb.y && pb.x > 0.0 && (tf < 0.0 || pb.x < tf)) {
        let p = ro + rd * pb.x;
        var c = select(vec3f(0.012, 0.012, 0.018), vec3f(0.55, 0.52, 0.46) * (0.8 + 0.2 * noise3(p * 30.0)), f == 5);
        if (p.y > ph - 0.002) { c *= 0.35 + 0.65 * soft_shadow(p); }
        let top = p.y > ph - 0.002;
        // the edge line: round the top face, and along the top of each side
        let edge = select(ph - p.y, min(min(abs(p.x - pmin.x), abs(p.x - pmax.x)), min(abs(p.z - pmin.z), abs(p.z - pmax.z))), top);
        if (f != 5) { c += rim_col() * smoothstep(0.02, 0.0, edge) * 1.4; }
        return Hit(tone(c * (0.5 + 0.8 * max(dot(vec3f(0.0, 1.0, 0.0), normalize(LIGHT)), 0.0))), pb.x);
    }
    if (tf > 0.0 && tf <= tmax + 0.01) {
        let p = ro + rd * tf;
        var c = vec3f(0.02, 0.02, 0.028);
        let g = abs(fract(p.xz) - 0.5);
        c += vec3f(0.03, 0.035, 0.05) * smoothstep(0.485, 0.5, max(g.x, g.y));
        c += rim_col() * 0.1 * exp(-dot(p.xz, p.xz) * 0.25);
        c *= 0.35 + 0.65 * soft_shadow(p);
        return Hit(tone(c), tf);
    }
    let w = ro + rd * horizon_t(tmax);
    var c = vec3f(0.016, 0.015, 0.024);
    if (w.y > ROOM_HEIGHT - 0.05) {
        c = vec3f(0.01) + vec3f(0.6) * smoothstep(0.6, 0.0, length(w.xz)) ;
    } else {
        c += rim_col() * smoothstep(0.04, 0.0, abs(w.y - 0.06)) * 0.8;
    }
    return Hit(tone(c), horizon_t(tmax));
}

fn strings(ro: vec3f, rd: vec3f, bg: Hit) -> Hit {
    // threads between the plates, glowing so the thinnest still reads at a distance
    let shift = 5.0 + 4.0 * sin(time() * 0.12);
    var glow = vec3f(0.0);
    var near = bg.t;
    let px = 0.0016;
    for (var i = 0; i < 44; i = i + 1) {
        let s = f32(i) * f32(NP) / 44.0;
        let a2 = outline_at(s);
        let b2 = outline_at(s + shift);
        let h = ray_seg(ro, rd, vec3f(a2, 0.42), vec3f(b2, -0.42));
        if (h.y < bg.t) {
            let w = max(px * h.y, 0.004);
            let k = exp(-pow(h.x / w, 2.0));
            glow += mix(mat_col(), rim_col(), f32(i) / 44.0) * k;
            if (k > 0.5) { near = min(near, h.y); }
        }
    }
    // the plates' edges
    for (var i = 0; i < NP; i = i + 1) {
        for (var z = -1.0; z < 2.0; z = z + 2.0) {
            let h = ray_seg(ro, rd, vec3f(outline(i), z * 0.42), vec3f(outline(i + 1), z * 0.42));
            if (h.y < bg.t) {
                let w = max(px * h.y, 0.006);
                let k = exp(-pow(h.x / w, 2.0));
                glow += vec3f(0.7, 0.85, 1.0) * k * 0.7;
                if (k > 0.5) { near = min(near, h.y); }
            }
        }
    }
    return Hit(clamp(bg.color + glow, vec3f(0.0), vec3f(1.0)), near);
}

fn shade(ro: vec3f, rd: vec3f, tmin: f32, tmax: f32) -> Hit {
    let f = form();
    let bg = background(ro, rd, tmax);
    if (f == 3) { return strings(ro, rd, bg); }
    let b = box_span(ro, rd, bmin(), bmax());
    if (b.x < b.y && b.y > tmin) {
        var t = max(b.x, tmin);
        let steps = select(80, 120, quality() > 0.6);
        let far = min(b.y, bg.t);
        for (var i = 0; i < 120; i = i + 1) {
            if (i >= steps || t > far) { break; }
            let d = sdf(ro + rd * t);
            if (d < 0.0008 * t + 0.001) { return Hit(tone(shade_form(ro + rd * t, rd) * 1.3), t); }
            t += d * select(0.9, 0.7, f == 0 || f == 4);
        }
    }
    return bg;
}
