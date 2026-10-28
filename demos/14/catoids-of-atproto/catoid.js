// The catoid: a cat built from signed distance fields (round cones, capsules, ellipsoids, smooth unions),
// ray-marched in a WebGL2 fragment shader. The same sculpture stands in the Catoid Sweep rooms of
// Room World (world2.anthonybecker.me), there in WGSL. Here every proportion is a uniform, so any set of
// numbers can be turned into a cat.

export const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uA;      // half body length, body radius, leg length, head radius
uniform vec4 uB;      // tail length, ear scale, gait speed, stripe frequency (0 = plain coat)
uniform vec3 uCoat;
uniform vec3 uRim;
uniform vec3 uEye;
uniform vec3 uCam;
uniform vec3 uLook;
uniform float uFx;    // 1: scanlines and grain (the big view), 0: clean (thumbnails)
uniform float uForm;  // how it is cast: 0 a coat, 1 a gyroid lattice (after Grossman), 2 woven wire (after Asawa)
out vec4 fragColor;

const float PI = 3.14159265;
const float PLINTH = 0.18;
float cL, cR, cLeg, cHead, cTail, cH, cPh;
float mat;

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z);
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba), z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
vec2 boxSpan(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd, t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv, tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}

vec3 headC() { return vec3(cL + cR * 0.45 + cHead * 0.75, cH + cR * 0.55 + cHead * 0.45, 0.0); }

float cat(vec3 p) {
  p.y -= PLINTH;
  float thick = clamp((cR - 0.19) / 0.43, 0.0, 1.0);
  float d = sdRoundCone(p, vec3(-cL, cH, 0.0), vec3(cL, cH + 0.05, 0.0), cR, cR * 0.9);
  d = smin(d, sdEllipsoid(p - vec3(0.0, cH - cR * 0.2, 0.0), vec3(cL * 0.85 + cR * 0.5, cR * 0.92, cR * 1.02)), 0.12);
  for (int i = 0; i < 4; i++) {
    float fx = i < 2 ? 1.0 : -1.0;
    float side = (i & 1) == 0 ? 1.0 : -1.0;
    float ph = cPh + ((i == 1 || i == 2) ? PI : 0.0);
    vec3 hip = vec3(fx * cL * 0.82, cH - cR * 0.2, side * max(cR * 0.55, 0.11));
    vec3 paw = vec3(hip.x + sin(ph) * cLeg * 0.32, 0.075 + max(cos(ph), 0.0) * cLeg * 0.14, hip.z);
    d = smin(d, sdRoundCone(p, paw, hip, 0.07, mix(0.1, 0.17, thick)), 0.08);
    d = smin(d, sdEllipsoid(p - paw - vec3(0.035, -0.015, 0.0), vec3(0.1, 0.06, 0.08)), 0.04);
  }
  vec3 a = vec3(-cL - cR * 0.6, cH + cR * 0.3, 0.0);
  float ang = 2.35, seg = cTail / 6.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    ang = ang - 0.32 + sin(uTime * 1.7 - fi * 0.7) * 0.12;
    vec3 b = a + vec3(cos(ang), sin(ang), sin(uTime * 1.1 - fi * 0.5) * 0.06) * seg;
    d = smin(d, sdCapsule(p, a, b, mix(0.075, 0.035, fi / 5.0) * (1.0 + thick * 0.6)), 0.05);
    a = b;
  }
  vec3 hc = headC() + vec3(0.0, sin(cPh * 2.0) * 0.012, 0.0);
  float h = length(p - hc) - cHead;
  h = smin(h, sdEllipsoid(p - hc - vec3(0.02, -cHead * 0.28, 0.0), cHead * vec3(0.8, 0.62, 1.08)), 0.06);
  vec3 mz = hc + vec3(cHead * 0.82, -cHead * 0.3, 0.0);
  h = smin(h, sdEllipsoid(p - mz, cHead * vec3(0.3, 0.26, 0.38)), 0.06);
  d = smin(d, h, 0.16);
  float ear = 1e5, es = uB.y;
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0;
    vec3 base = hc + vec3(-cHead * 0.1, cHead * 0.62, s * cHead * 0.52);
    vec3 tip = base + vec3(-0.04, cHead * 0.72 * es, s * cHead * 0.26 * es);
    vec3 q = p - base; q.x *= 1.7;
    ear = min(ear, sdRoundCone(q, vec3(0.0), (tip - base) * vec3(1.7, 1.0, 1.0), cHead * 0.42 * mix(1.0, es, 0.5), 0.02) / 1.7);
  }
  d = smin(d, ear, 0.03);
  mat = 0.0;
  float eyes = min(length(p - (hc + vec3(cHead * 0.72, cHead * 0.18, cHead * 0.4))), length(p - (hc + vec3(cHead * 0.72, cHead * 0.18, -cHead * 0.4)))) - cHead * 0.16;
  if (eyes < 0.012) mat = 1.0;
  if (length(p - (mz + vec3(cHead * 0.24, cHead * 0.12, 0.0))) < cHead * 0.13) mat = 2.0;
  if (uForm > 0.5 && uForm < 1.5) {
    // a gyroid sheet drifting through the volume: only the lattice is left
    vec3 q = p * 12.0 + vec3(0.0, uTime * 0.25, uTime * 0.1);
    d = max(d, abs(sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x)) / 12.0 * 0.55 - 0.016);
    mat = 0.0;
  } else if (uForm > 1.5) {
    // a thin shell, woven: two families of wire planes cut it into a diamond mesh, inside showing through
    float shell = abs(d) - 0.006;
    float u = dot(p, vec3(0.7, 0.7, 0.14)) * 14.0, v = dot(p, vec3(0.7, -0.7, 0.14)) * 14.0;
    float weave = (min(abs(fract(u) - 0.5), abs(fract(v) - 0.5)) - 0.07) / 14.0;
    d = max(shell, weave);
    mat = 0.0;
  }
  return d;
}

vec3 catN(vec3 p) {
  vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(cat(p + e.xyy) - cat(p - e.xyy), cat(p + e.yxy) - cat(p - e.yxy), cat(p + e.yyx) - cat(p - e.yyx)));
}
vec3 boxMin() { return vec3(-cL - cR - cTail - 0.15, PLINTH, -cR - 0.45); }
vec3 boxMax() { return vec3(cL + cR + cHead * 2.6 + 0.1, PLINTH + cH + cR + cHead * 2.6 + max(cTail * 0.7, 0.4), cR + 0.45); }

const vec3 LIGHT = vec3(0.35, 0.85, 0.4);
float softShadow(vec3 p) {
  vec3 l = normalize(LIGHT);
  vec2 b = boxSpan(p, l, boxMin(), boxMax());
  if (b.x > b.y || b.y < 0.0) return 1.0;
  float t = max(b.x, 0.02), res = 1.0;
  for (int i = 0; i < 24; i++) {
    if (t > b.y) break;
    float h = cat(p + l * t);
    res = min(res, 10.0 * h / t);
    if (res < 0.02) break;
    t += clamp(h, 0.03, 0.4);
  }
  return clamp(res, 0.0, 1.0);
}

vec3 shadeCat(vec3 p, vec3 rd) {
  vec3 n = catN(p);
  float m = mat;
  vec3 cp = p - vec3(0.0, PLINTH, 0.0);
  vec3 base = uCoat;
  if (uForm > 0.5) base = uForm < 1.5 ? mix(vec3(0.55, 0.36, 0.17), uCoat, 0.35) : vec3(0.78, 0.6, 0.25);
  if (uB.w > 0.0 && uForm < 0.5) {
    float stripe = smoothstep(0.35, 0.6, sin(cp.x * uB.w + noise3(cp * 3.0) * 2.4 + noise3(cp * 7.0)));
    base = mix(base, base * 0.33, stripe * 0.75 * smoothstep(-0.2, 0.4, n.y));
  }
  base = mix(base, vec3(0.92, 0.88, 0.8), smoothstep(-0.25, -0.7, n.y) * 0.8);
  if (m == 1.0) base = uEye * 0.5;
  if (m == 2.0) base = vec3(0.85, 0.45, 0.5);
  vec3 l = normalize(LIGHT);
  float diff = max(dot(n, l), 0.0) * (0.35 + 0.65 * softShadow(p + n * 0.01));
  float ao = clamp(0.5 + 0.5 * cat(p + n * 0.12) / 0.12, 0.0, 1.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
  float back = max(dot(n, normalize(vec3(-0.6, 0.3, -0.8))), 0.0);
  float spec = pow(max(dot(reflect(rd, n), l), 0.0), m == 1.0 ? 90.0 : 24.0) * (m == 1.0 ? 1.2 : 0.25);
  if (uForm > 0.5) spec = pow(max(dot(reflect(rd, n), l), 0.0), 40.0) * 0.9; // metal
  return base * (0.08 + diff * 1.1) * ao + uRim * (rim * 0.6 + back * 0.25) + vec3(spec);
}

vec3 tone(vec3 c) { return 1.0 - exp(-max(c, 0.0)); }

void main() {
  cL = uA.x; cR = uA.y; cLeg = uA.z; cHead = uA.w; cTail = uB.x;
  cH = max(cLeg + cR * 0.5, cR + 0.1);
  cPh = uTime * uB.z;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 fw = normalize(uLook - uCam), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 ro = uCam, rd = normalize(fw * 1.7 + rt * uv.x + up * uv.y);
  float best = 1e9; int kind = 0;
  vec2 cb = boxSpan(ro, rd, boxMin(), boxMax());
  if (cb.x < cb.y && cb.y > 0.0) {
    float t = max(cb.x, 0.0);
    float k = uForm > 0.5 ? 0.7 : 0.9;
    for (int i = 0; i < 160; i++) {
      if (t > cb.y) break;
      float d = cat(ro + rd * t);
      if (d < 0.0012 * t + 0.0008) { best = t; kind = 3; break; }
      t += d * k;
    }
  }
  vec3 pmin = vec3(-2.7, 0.0, -1.0), pmax = vec3(2.7, PLINTH, 1.0);
  vec2 pb = boxSpan(ro, rd, pmin, pmax);
  if (pb.x < pb.y && pb.x > 0.0 && pb.x < best) { best = pb.x; kind = 2; }
  float tf = rd.y < 0.0 ? -ro.y / rd.y : -1.0;
  if (tf > 0.0 && tf < best) { best = tf; kind = 1; }
  vec3 p = ro + rd * best;
  vec3 col;
  if (kind == 3) {
    col = shadeCat(p, rd) * 1.3;
  } else if (kind == 2) {
    col = vec3(0.012, 0.012, 0.018);
    float edge = min(min(abs(p.x - pmin.x), abs(p.x - pmax.x)), min(abs(p.z - pmin.z), abs(p.z - pmax.z)));
    if (p.y > PLINTH - 0.002) {
      col += vec3(0.05) * pow(max(dot(reflect(rd, vec3(0, 1, 0)), normalize(LIGHT)), 0.0), 40.0);
      col *= 0.4 + 0.6 * softShadow(p);
      col += uRim * smoothstep(0.025, 0.0, edge) * 1.6;
    } else {
      col += uRim * smoothstep(0.015, 0.0, abs(p.y - PLINTH + 0.015)) * 1.2;
    }
  } else if (kind == 1) {
    col = vec3(0.012, 0.012, 0.02);
    vec2 g = abs(fract(p.xz * 2.0) - 0.5);
    float fade = exp(-length(p.xz) * 0.18);
    col += vec3(0.05, 0.06, 0.09) * smoothstep(0.47, 0.5, max(g.x, g.y)) * fade;
    col += uRim * exp(-pow(max(abs(p.x) - 2.4, 0.0), 2.0) * 1.5 - pow(max(abs(p.z) - 0.9, 0.0), 2.0) * 3.0) * 0.08;
  } else {
    col = mix(vec3(0.02, 0.018, 0.035), vec3(0.0), clamp(rd.y * 2.0, 0.0, 1.0));
    col += uRim * 0.03 * exp(-abs(rd.y) * 8.0);
  }
  col = tone(col);
  col = pow(col, vec3(1.0 / 2.2));
  if (uFx > 0.5) {
    col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 1.6);
    col += (hash13(vec3(gl_FragCoord.xy, uTime * 60.0)) - 0.5) * 0.035;
    col *= 1.0 - 0.35 * dot(uv, uv);
  }
  fragColor = vec4(col, 1.0);
}`;

const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

/** A renderer on one canvas. draw(params, time, camera) */
export function createRenderer(canvas, { preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  const u = Object.fromEntries(['uRes', 'uTime', 'uA', 'uB', 'uCoat', 'uRim', 'uEye', 'uCam', 'uLook', 'uFx', 'uForm'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  return {
    gl,
    draw(c, time, cam, look, fx = 1) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform4f(u.uA, c.L, c.R, c.leg, c.head);
      gl.uniform4f(u.uB, c.tail, c.ear, c.gait, c.stripes);
      gl.uniform3f(u.uCoat, ...c.coat);
      gl.uniform3f(u.uRim, ...c.rim);
      gl.uniform3f(u.uEye, ...c.eye);
      gl.uniform3f(u.uCam, ...cam);
      gl.uniform3f(u.uLook, ...look);
      gl.uniform1f(u.uFx, fx);
      gl.uniform1f(u.uForm, c.form ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/** The camera that frames a catoid from the side and a little in front, turning slowly round it. */
export function frame(c, angle, dist = 1) {
  const len = 2 * (c.L + c.R) + c.head * 2 + c.tail * 0.6;
  const r = (2.6 + len * 1.05) * dist;
  const look = [0.15, 0.18 + Math.max(c.leg + c.R * 0.5, c.R + 0.1) + 0.1, 0];
  return { cam: [Math.sin(angle) * r, look[1] + 0.55 * dist + 0.25, Math.cos(angle) * r], look };
}
