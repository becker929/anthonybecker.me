// meter.js — feature extraction + logistic-regression role model.
//
// Plain ES module, no libraries, no DOM access at the top level (this file
// is imported from both the browser page and a Node verify script). Every
// function here is pure: samples in, numbers out.
//
// Feature definitions are chosen to match the Python reference exactly
// (numpy + librosa 0.11, default stft: n_fft=2048, hop=512, periodic Hann
// window, center=True, pad_mode="constant" i.e. zero padding n_fft//2 on
// both sides). See analysis/signal_features.py and analysis/hits_extra.py
// in the sound-function repo for the Python source these mirror.

const EPS = 1e-12;

// Band edges in Hz, [lo, hi) — shared with the Python band-share code.
export const BANDS = {
  sub: [20, 60],
  low: [60, 150],
  lowmid: [150, 400],
  mid: [400, 2000],
  high: [2000, 6000],
  air: [6000, 16000],
};

// Plain-language names for the "why" list. Only these seven are computed;
// a model.json that names anything else should be treated as an error by
// the caller (see requireFeatures below), not guessed at.
export const FEATURE_LABELS = {
  crest_factor_db: "peak over average",
  decay40_ms: "time to fade 40 dB (ms)",
  sustain_share: "share of energy after 50 ms",
  band_sub_share: "share below 60 Hz",
  band_low_share: "share 60–150 Hz",
  spectral_centroid_hz_100ms: "brightness in the first 100 ms (Hz)",
  centroid_slope_hz_per_ms: "how fast brightness falls (Hz per ms)",
};

// All keys extractFeatures() can produce (the seven named features plus
// the four extra band shares that fall out of the same computation, kept
// in case a re-exported model wants one of them).
export const IMPLEMENTED_FEATURES = [
  "crest_factor_db",
  "decay40_ms",
  "sustain_share",
  "centroid_slope_hz_per_ms",
  "spectral_centroid_hz_100ms",
  "band_sub_share",
  "band_low_share",
  "band_lowmid_share",
  "band_mid_share",
  "band_high_share",
  "band_air_share",
];

/** Throws if model.features names anything extractFeatures() cannot produce. */
export function requireFeatures(model) {
  const missing = model.features.filter((f) => !IMPLEMENTED_FEATURES.includes(f));
  if (missing.length) {
    throw new Error(`model.json needs features this page cannot compute yet: ${missing.join(", ")}`);
  }
}

// ---------------------------------------------------------------------
// FFT: iterative radix-2 Cooley-Tukey, in place, n a power of two.
// Forward transform, exp(-2*pi*i*k*n/N) convention (matches numpy.fft).
// ---------------------------------------------------------------------
function fftRadix2(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWr = 1, curWi = 0;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k], aIm = im[i + k];
        const bRe0 = re[i + k + half], bIm0 = im[i + k + half];
        const bRe = bRe0 * curWr - bIm0 * curWi;
        const bIm = bRe0 * curWi + bIm0 * curWr;
        re[i + k] = aRe + bRe; im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe; im[i + k + half] = aIm - bIm;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr; curWi = nextWi;
      }
    }
  }
}

/** Periodic Hann window (scipy get_window('hann', N, fftbins=True)). */
function hannPeriodic(N) {
  const w = new Float64Array(N);
  for (let n = 0; n < N; n++) w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N);
  return w;
}

/**
 * librosa.stft magnitude, default settings: n_fft=2048 (or the small-n
 * fallback below), hop=n_fft/4 unless overridden, periodic Hann window,
 * center=True with pad_mode="constant" (zero pad n_fft/2 each side).
 *
 * Returns { mags: Float64Array[nFrames][nBins], freqs: Float64Array[nBins],
 *           hop, nFft, nFrames }.
 */
export function stftMag(y, sr, nFftWanted = 2048) {
  const n = y.length;
  let nFft = nFftWanted;
  if (n < nFft) {
    nFft = Math.max(64, Math.pow(2, Math.floor(Math.log2(Math.max(n, 2)))));
  }
  const hop = Math.max(1, Math.floor(nFft / 4));
  const half = nFft >> 1; // n_fft is always a power of two >= 64, so this is exact
  const nFrames = 1 + Math.floor(n / hop);
  const window = hannPeriodic(nFft);
  const nBins = nFft / 2 + 1;

  const re = new Float64Array(nFft);
  const im = new Float64Array(nFft);
  const mags = new Array(nFrames);

  for (let i = 0; i < nFrames; i++) {
    const start = i * hop - half; // index into the *unpadded* signal
    for (let k = 0; k < nFft; k++) {
      const idx = start + k;
      const v = idx >= 0 && idx < n ? y[idx] : 0; // zero pad, pad_mode="constant"
      re[k] = v * window[k];
      im[k] = 0;
    }
    fftRadix2(re, im);
    const frameMag = new Float64Array(nBins);
    for (let k = 0; k < nBins; k++) frameMag[k] = Math.hypot(re[k], im[k]);
    mags[i] = frameMag;
  }

  const freqs = new Float64Array(nBins);
  for (let k = 0; k < nBins; k++) freqs[k] = (k * sr) / nFft;

  return { mags, freqs, hop, nFft, nFrames };
}

/** crest_factor_db = 20*log10(peak) - 20*log10(rms). */
export function crestFactorDb(y) {
  let maxAbs = 0, sumSq = 0;
  for (let i = 0; i < y.length; i++) {
    const v = y[i];
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / y.length);
  return 20 * Math.log10(maxAbs) - 20 * Math.log10(rms);
}

/**
 * decay40_ms and sustain_share, matching analysis/hits_extra.py's
 * env_timings exactly: a 2 ms RMS envelope, time from the peak frame to
 * -40 dB, and the share of energy after the first 50 ms.
 */
export function envTimings(y, sr = 44100) {
  const winMs = 2.0;
  const w = Math.round((sr * winMs) / 1000); // 88 samples at 44100 Hz
  const n = Math.floor(y.length / w);
  let decay40_ms, sustain_share;

  if (n < 2) {
    decay40_ms = NaN;
  } else {
    const e = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      const base = i * w;
      for (let k = 0; k < w; k++) {
        const v = y[base + k];
        sum += v * v;
      }
      e[i] = Math.sqrt(sum / w) + EPS;
    }
    let eMax = 0;
    for (let i = 0; i < n; i++) if (e[i] > eMax) eMax = e[i];
    const db = new Float64Array(n);
    for (let i = 0; i < n; i++) db[i] = 20 * Math.log10(e[i] / eMax);
    let p = 0;
    for (let i = 1; i < n; i++) if (db[i] > db[p]) p = i;
    decay40_ms = n * winMs; // default: never crosses -40 dB
    for (let j = 0; p + j < n; j++) {
      if (db[p + j] <= -40) { decay40_ms = j * winMs; break; }
    }
  }

  let sumAll = 0;
  for (let i = 0; i < y.length; i++) sumAll += y[i] * y[i];
  const k = Math.floor(sr * 0.05);
  let sumTail = 0;
  for (let i = k; i < y.length; i++) sumTail += y[i] * y[i];
  sustain_share = sumTail / (sumAll + EPS);

  return { decay40_ms, sustain_share };
}

/** Six band power shares (of the six bands' own total, +EPS), from an STFT. */
export function bandShares(mags, freqs) {
  const names = Object.keys(BANDS);
  const bandOfBin = new Array(freqs.length).fill(null);
  for (let k = 0; k < freqs.length; k++) {
    const f = freqs[k];
    for (const name of names) {
      const [lo, hi] = BANDS[name];
      if (f >= lo && f < hi) { bandOfBin[k] = name; break; }
    }
  }
  const totals = Object.fromEntries(names.map((n) => [n, 0]));
  for (let i = 0; i < mags.length; i++) {
    const frame = mags[i];
    for (let k = 0; k < freqs.length; k++) {
      const b = bandOfBin[k];
      if (b === null) continue;
      const m = frame[k];
      totals[b] += m * m;
    }
  }
  const sumAll = names.reduce((s, n) => s + totals[n], 0) + EPS;
  const shares = {};
  for (const n of names) shares[`band_${n}_share`] = totals[n] / sumAll;
  return shares;
}

/** Per-frame spectral centroid (Hz); a silent frame gives 0, not NaN. */
export function spectralCentroidPerFrame(mags, freqs) {
  const out = new Array(mags.length);
  for (let i = 0; i < mags.length; i++) {
    const frame = mags[i];
    let num = 0, den = 0;
    for (let k = 0; k < freqs.length; k++) {
      num += freqs[k] * frame[k];
      den += frame[k];
    }
    out[i] = den > 0 ? num / den : 0;
  }
  return out;
}

/** Least-squares slope of centroid (Hz) vs. frame time (ms) — numpy.polyfit deg 1. */
export function centroidSlopeHzPerMs(centroids, hop, sr) {
  const n = centroids.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const t = ((i * hop) / sr) * 1000;
    const c = centroids[i];
    sumX += t; sumY += c; sumXY += t * c; sumXX += t * t;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Mean per-frame centroid of an STFT of only the first min(len, 4410) samples. */
export function spectralCentroidHz100ms(y, sr = 44100) {
  const segLen = Math.min(y.length, Math.round(sr * 0.1));
  const seg = y.subarray ? y.subarray(0, segLen) : y.slice(0, segLen);
  const { mags, freqs } = stftMag(seg, sr);
  const centroids = spectralCentroidPerFrame(mags, freqs);
  if (centroids.length === 0) return 0;
  let sum = 0;
  for (const c of centroids) sum += c;
  return sum / centroids.length;
}

/**
 * All seven named features from mono float samples at 44100 Hz, plus the
 * four extra band shares. Throws on empty or effectively silent audio.
 */
export function extractFeatures(y, sr = 44100) {
  if (!y || y.length === 0) throw new Error("no audio samples");
  let maxAbs = 0;
  for (let i = 0; i < y.length; i++) {
    const a = Math.abs(y[i]);
    if (a > maxAbs) maxAbs = a;
  }
  if (!(maxAbs > 1e-9)) throw new Error("silent audio");

  const crest_factor_db = crestFactorDb(y);
  const { decay40_ms, sustain_share } = envTimings(y, sr);
  const { mags, freqs, hop } = stftMag(y, sr);
  const bands = bandShares(mags, freqs);
  const centroids = spectralCentroidPerFrame(mags, freqs);
  const centroid_slope_hz_per_ms = centroidSlopeHzPerMs(centroids, hop, sr);
  const spectral_centroid_hz_100ms = spectralCentroidHz100ms(y, sr);

  return {
    crest_factor_db,
    decay40_ms,
    sustain_share,
    centroid_slope_hz_per_ms,
    spectral_centroid_hz_100ms,
    ...bands,
  };
}

/**
 * Run the exported logistic-regression model: z-score each feature, take
 * logits per class, softmax. Returns the ranked class list and, for the
 * top class, each feature's value and signed contribution (weight * z),
 * sorted by |contribution| descending.
 */
export function predict(model, featureValues) {
  requireFeatures(model);
  const z = model.features.map((f, j) => {
    const x = featureValues[f];
    return (x - model.mean[j]) / model.scale[j];
  });
  const logits = model.classes.map((_, ci) => {
    let s = model.bias[ci];
    for (let j = 0; j < model.features.length; j++) s += model.weights[ci][j] * z[j];
    return s;
  });
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sumExp);

  let topIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[topIdx]) topIdx = i;

  const contributions = model.features
    .map((f, j) => ({
      feature: f,
      label: FEATURE_LABELS[f] || f,
      value: featureValues[f],
      z: z[j],
      contribution: model.weights[topIdx][j] * z[j],
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    classes: model.classes,
    probs,
    top: model.classes[topIdx],
    topIndex: topIdx,
    contributions,
  };
}

/** Downsample a mono signal to `buckets` min/max pairs, for drawing a waveform. */
export function waveformPeaks(y, buckets = 400) {
  const n = y.length;
  const out = new Float32Array(buckets * 2);
  const step = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * step);
    const end = Math.max(start + 1, Math.floor((b + 1) * step));
    let mn = Infinity, mx = -Infinity;
    for (let i = start; i < end && i < n; i++) {
      const v = y[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === Infinity) { mn = 0; mx = 0; }
    out[b * 2] = mn;
    out[b * 2 + 1] = mx;
  }
  return out;
}
