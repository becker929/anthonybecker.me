#!/usr/bin/env node
// verify.mjs — check the JS feature port and model against the Python
// reference values in out/library_synth.csv.
//
//   node meter/verify.mjs
//
// For 60 of the synth-library WAVs (6 per fine label, 10 labels) this:
//   1. parses the 16-bit PCM WAV itself (no Web Audio, no libraries)
//   2. runs meter.js's pure feature functions on the decoded samples
//   3. compares each of the 7 model features to the CSV's Python values
//      (max relative error, and how many of the 60 are within 1%)
//   4. runs the model.json logistic regression on (a) the CSV's own
//      feature values and (b) the JS-computed features, and reports how
//      often the two predicted classes agree
//
// Target: every feature within 1% on >=57/60 files, predictions agreeing
// on all 60.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFeatures, predict } from "./../../anthonybecker.me/research/sound-function/meter/meter.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SF_ROOT = path.resolve(HERE, ".."); // /home/user/sound-function
const CSV_PATH = path.join(SF_ROOT, "out", "library_synth.csv");
const MODEL_PATH = path.resolve(HERE, "../../anthonybecker.me/research/sound-function/meter/model.json");

const BASE_FEATURE_NAMES = [
  "crest_factor_db",
  "decay40_ms",
  "sustain_share",
  "band_sub_share",
  "band_low_share",
  "spectral_centroid_hz_100ms",
  "centroid_slope_hz_per_ms",
];

// ---------------------------------------------------------------------
// Minimal 16-bit PCM WAV reader (RIFF/WAVE, fmt + data chunks only).
// Returns { samples: Float64Array (mono, -1..1), sampleRate }.
// ---------------------------------------------------------------------
function readWav16(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${filePath}: not a RIFF/WAVE file`);
  }
  let offset = 12;
  let fmt = null;
  let dataStart = -1, dataLen = 0;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (chunkId === "fmt ") {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        numChannels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (chunkId === "data") {
      dataStart = body;
      dataLen = chunkSize;
    }
    offset = body + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }
  if (!fmt) throw new Error(`${filePath}: no fmt chunk`);
  if (dataStart < 0) throw new Error(`${filePath}: no data chunk`);
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`${filePath}: expected 16-bit PCM, got format=${fmt.audioFormat} bits=${fmt.bitsPerSample}`);
  }
  const bytesPerSample = 2;
  const frameSize = bytesPerSample * fmt.numChannels;
  const nFrames = Math.floor(dataLen / frameSize);
  const mono = new Float64Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let sum = 0;
    for (let ch = 0; ch < fmt.numChannels; ch++) {
      const p = dataStart + i * frameSize + ch * bytesPerSample;
      sum += buf.readInt16LE(p) / 32768;
    }
    mono[i] = sum / fmt.numChannels;
  }
  return { samples: mono, sampleRate: fmt.sampleRate };
}

// ---------------------------------------------------------------------
// Tiny CSV reader (no quoted fields in this file — plain comma-split is fine).
// ---------------------------------------------------------------------
function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const lines = text.split(/\r?\n/); // the file is CRLF-terminated
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

function labelOf(row) {
  return row.sound || row.file.split("/").pop().split("__")[0];
}

function pickSixty(rows) {
  const byLabel = new Map();
  for (const r of rows) {
    const lab = labelOf(r);
    if (!byLabel.has(lab)) byLabel.set(lab, []);
    byLabel.get(lab).push(r);
  }
  const picked = [];
  for (const [, list] of byLabel) {
    // Spread picks across the 40-per-label range rather than clustering at the start.
    const step = Math.floor(list.length / 6) || 1;
    for (let i = 0; i < 6; i++) picked.push(list[Math.min(i * step, list.length - 1)]);
  }
  return picked;
}

function relErr(jsVal, pyVal) {
  const denom = Math.max(Math.abs(pyVal), 1e-9);
  return Math.abs(jsVal - pyVal) / denom;
}

function main() {
  const model = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
  // check the base seven plus whatever the current model.json actually uses
  const FEATURE_NAMES = [...new Set([...BASE_FEATURE_NAMES, ...model.features])];
  const rows = readCsv(CSV_PATH);
  const chosen = pickSixty(rows);

  const stats = {};
  for (const f of FEATURE_NAMES) stats[f] = { maxRel: 0, within1pct: 0, worstFile: "" };

  let agree = 0;
  const disagreements = [];
  const perFileErrors = [];

  for (const row of chosen) {
    const wavPath = path.join(SF_ROOT, row.file);
    const { samples, sampleRate } = readWav16(wavPath);
    if (sampleRate !== 44100) {
      console.error(`WARNING: ${row.file} is ${sampleRate} Hz, not 44100 — skipping (verify assumes native 44100 wavs)`);
      continue;
    }
    const jsFeatures = extractFeatures(samples, 44100);

    const pyFeatures = {};
    for (const f of FEATURE_NAMES) pyFeatures[f] = parseFloat(row[f]);

    const fileErr = {};
    for (const f of FEATURE_NAMES) {
      const err = relErr(jsFeatures[f], pyFeatures[f]);
      fileErr[f] = err;
      if (err <= 0.01) stats[f].within1pct++;
      if (err > stats[f].maxRel) { stats[f].maxRel = err; stats[f].worstFile = row.file; }
    }
    perFileErrors.push({ file: row.file, label: labelOf(row), fileErr });

    const predFromCsv = predict(model, pyFeatures).top;
    const predFromJs = predict(model, jsFeatures).top;
    if (predFromCsv === predFromJs) agree++;
    else disagreements.push({ file: row.file, label: labelOf(row), predFromCsv, predFromJs });
  }

  const n = chosen.length;
  console.log(`\nVerified ${n} files from out/library_synth.csv against the JS port.\n`);
  console.log("feature".padEnd(28), "max rel err".padStart(12), "within 1%".padStart(12));
  for (const f of FEATURE_NAMES) {
    const s = stats[f];
    console.log(
      f.padEnd(28),
      (s.maxRel * 100).toFixed(3).padStart(10) + "%",
      `${s.within1pct}/${n}`.padStart(12),
      s.maxRel > 0.01 ? `  (worst: ${s.worstFile})` : ""
    );
  }
  console.log(`\nprediction agreement (CSV features vs JS features, same model.json): ${agree}/${n}`);
  if (disagreements.length) {
    console.log("disagreements:");
    for (const d of disagreements) console.log(`  ${d.file} (${d.label}): csv->${d.predFromCsv}  js->${d.predFromJs}`);
  }

  const allFeaturesPass = FEATURE_NAMES.every((f) => stats[f].within1pct >= 57);
  const predictionsPass = agree === n;
  console.log(`\nTarget: every feature within 1% on >=57/${n}, predictions agreeing on all ${n}.`);
  console.log(allFeaturesPass && predictionsPass ? "PASS" : "FAIL");
  process.exitCode = allFeaturesPass && predictionsPass ? 0 : 1;
}

main();
