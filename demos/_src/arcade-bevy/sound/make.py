"""Make the arcade room's sounds from recorded samples, offline, and measure every one.

  uv run --with numpy --with scipy --with soundfile python sound/make.py

Writes sound/out/: one file per sound and sounds.json (name -> file name). Audio never goes in git.
One-shots are AAC .m4a (afconvert). The hum is a 16-bit mono WAV at 24 kHz, because AAC pads a file
with silence and a padded file cannot loop.

The machines are from 1947 to 1951, so every sound is one of two kinds:

- mechanical (plungers, keys, detents, relays, contactors, bells): heard straight from the cabinet,
  full range with real low thump. Built from foley and percussion one-shots (wood, knocks, a door
  lock, a spring, bells), cut short and pitched down by resampling, the way a sampler would.
- electrical (static, crackle, discharge, hum): heard through a small paper-cone speaker, so
  band-limited to about 250 Hz - 4 kHz with gentle slopes and mild saturation. Built from texture
  recordings (static, vinyl dirt, tuning crackle, amp hum).

Synthesis is support only: a sine under a thump, 60 and 120 Hz sines under the recorded hum.
Nothing here uses Ableton Live. It only reads the Core Library's sample files.

Nobody can listen while this runs, so the script measures instead: length, peak, RMS, onset, band
balance, DC, tail, takes against each other, and the hum's loop point. It exits 1 if a check fails.
Everything is seeded, so a rerun makes the same audio.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample, resample_poly, sosfilt

CORE = Path("/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples")
OUT = Path(__file__).parent / "out"
SR = 44100          # one-shots
HUM_SR = 24000      # the loop; nothing in it is above 4 kHz
HUM_SECONDS = 4.0
HUM_RMS_DB = -30.0
CEILING_DB = -3.0   # no file may peak above this, after AAC


# ---------------------------------------------------------------- helpers

@lru_cache(maxsize=None)
def _index() -> dict:
    return {p.name: p for p in CORE.rglob("*") if p.suffix.lower() in (".wav", ".aif")}


@lru_cache(maxsize=None)
def load(name: str, sr: int = SR) -> np.ndarray:
    """A Core Library sample as mono floats at our rate, peak 1."""
    x, sr0 = sf.read(_index()[name], always_2d=True)
    x = x.mean(axis=1)
    if sr0 != sr:
        f = Fraction(sr, sr0)
        x = resample_poly(x, f.numerator, f.denominator)
    return x / (np.abs(x).max() + 1e-12)


def db(g: float) -> float:
    return 10 ** (g / 20)


def pitch(x: np.ndarray, st: float) -> np.ndarray:
    """Repitch by resampling. Down is longer and darker, like a slowed tape."""
    if st == 0:
        return x.copy()
    f = Fraction(2 ** (-st / 12)).limit_denominator(400)
    return resample_poly(x, f.numerator, f.denominator)


def bend(x: np.ndarray, st0: float, st1: float) -> np.ndarray:
    """Repitch with a glide from st0 to st1 semitones. Used for power sagging and warming."""
    n = len(x)
    rate = 2 ** (np.linspace(st0, st1, n) / 12)
    pos = np.cumsum(rate) - rate[0]
    pos = pos[pos < n - 1]
    return np.interp(pos, np.arange(n), x)


def filt(x, kind, hz, order=2, sr=SR):
    return sosfilt(butter(order, hz, kind, fs=sr, output="sos"), x)


def lp(x, hz, order=2, sr=SR):
    return filt(x, "lowpass", hz, order, sr)


def hp(x, hz, order=2, sr=SR):
    return filt(x, "highpass", hz, order, sr)


def saturate(x, drive=1.5):
    """Soft clip. drive is how far past the knee the peaks go."""
    return np.tanh(x * drive) / np.tanh(drive)


def speaker(x, sr=SR, drive=1.5):
    """A small paper cone: 250 Hz - 4 kHz at 12 dB per octave, and a little grit."""
    x = lp(hp(x, 250, 2, sr), 4000, 2, sr)
    return saturate(x / (np.abs(x).max() + 1e-12), drive)


def tame(x, k=4.0):
    """Squash pops that stand more than k times above the RMS, so a bed stays a bed."""
    r = np.sqrt(np.mean(x ** 2)) * k
    return np.tanh(x / r) * r


def fade(x, a=0.0, r=0.008, sr=SR):
    """Cosine fade in over a seconds and out over r seconds."""
    x = x.copy()
    na, nr = int(a * sr), int(r * sr)
    if na:
        x[:na] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    if nr:
        x[-nr:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nr))
    return x


def decay(x, t60, sr=SR):
    """Exponential decay that is 60 dB down after t60 seconds. Shortens a ring without a cut."""
    return x * 10 ** (-3 * np.arange(len(x)) / (t60 * sr))


def swell(n, rise, fall, sr=SR):
    """An envelope that rises over `rise` seconds, then dies away over `fall`."""
    t = np.arange(n) / sr
    up = np.clip(t / rise, 0, 1) ** 2
    down = 10 ** (-3 * np.clip(t - rise, 0, None) / fall)
    return up * down


def strike(name, st=0.0, dur=None, window=None, t60=None):
    """A one-shot from its first transient: cut the lead-in, pitch it, shorten it."""
    x = load(name)
    if window:
        x = x[int(window[0] * SR):int(window[1] * SR)]
    start = int(np.argmax(np.abs(x) > 0.08 * np.abs(x).max()))
    x = fade(x[max(0, start - 8):], a=0.0002, r=0)     # 8 samples of lead-in keep the edge clean
    x = pitch(x, st)
    if dur:
        x = x[:int(dur * SR)]
    if t60:
        x = decay(x, t60)
    x = fade(x, r=min(0.008, len(x) / SR / 3))
    return x / (np.abs(x).max() + 1e-12)


def mix(layers, dur=None):
    """Sum layers given as (signal, start seconds, gain dB)."""
    n = max(int(t * SR) + len(x) for x, t, _ in layers)
    if dur:
        n = int(dur * SR)
    out = np.zeros(n)
    for x, t, g in layers:
        i = int(t * SR)
        x = x[:max(0, n - i)]
        out[i:i + len(x)] += x * db(g)
    return out


def room(x, wet=-22.0):
    """A very short room: four early reflections off a wall and a floor. No tail."""
    out = np.concatenate([x, np.zeros(int(0.035 * SR))])
    dull = lp(x, 3000, 1)
    for ms, g in ((9.1, 0), (13.7, -3), (21.3, -6), (31.0, -9)):
        i = int(ms * SR / 1000)
        out[i:i + len(x)] += dull * db(wet + g)
    return out


def sine_drop(f0, f1, dur, t60=0.12):
    """Support for a thump: a sine falling from f0 to f1. A small sample has no weight alone."""
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    return fade(decay(np.sin(2 * np.pi * np.cumsum(f) / SR), t60), r=0.01)


def finish(x, peak_db, dc_hz=25):
    """Remove DC, close the tail, pad 10 ms of silence for the encoder, set the peak."""
    x = hp(x, dc_hz, 1)
    x = fade(x, r=min(0.012, len(x) / SR / 4))
    x = np.concatenate([x, np.zeros(int(0.010 * SR))])
    return x / np.abs(x).max() * db(peak_db)


def match(takes, peak_db):
    """Takes of one sound get the same RMS. The loudest peak among them sits at peak_db."""
    rms = [np.sqrt(np.mean(t ** 2)) for t in takes]
    takes = [t * rms[0] / r for t, r in zip(takes, rms)]
    top = max(np.abs(t).max() for t in takes)
    return [t / top * db(peak_db) for t in takes]


# ---------------------------------------------------------------- shared parts

RELAYS = ("Perc Knock Rattle.wav", "Wood Tip Tag.wav", "Wood MS.wav", "Clap Snap Fings.wav",
          "Rimshot Serendipity of Surprise.wav", "E-Perc Metal Chop.wav")


def relay(rng, st=None):
    """One relay: armature tick, contact tack a few ms later, a small dull body under it."""
    st = rng.uniform(-7, -2) if st is None else st
    tick = strike(RELAYS[rng.integers(len(RELAYS))], st, dur=0.045, t60=0.05)
    tack = strike(RELAYS[rng.integers(len(RELAYS))], st + 3, dur=0.03, t60=0.03)
    body = strike("E-Perc Click Unsounded.wav", st / 2, dur=0.04)
    return lp(mix([(tick, 0, 0), (tack, rng.uniform(0.004, 0.008), -7), (body, 0, -8)]), 7000, 1)


def chatter(times, rng, st0=-3.0, st1=-3.0, spread=3.0):
    """Relays at the given times. st0 to st1 moves the pitch along the run."""
    out = []
    for k, t in enumerate(times):
        st = st0 + (st1 - st0) * k / max(1, len(times) - 1) + rng.uniform(-1, 1)
        out.append((relay(rng, st), t, -rng.uniform(0, spread)))
    return mix(out)


def clunk(st=-3.0):
    """A contactor pulling in: the bolt of a door lock, pitched down, with a wooden body."""
    bolt = strike("Foley Door Lock.wav", st, dur=0.20, window=(0.34, 0.62), t60=0.22)
    body = strike("Wood MPC 4.wav", st - 2, dur=0.16, t60=0.14)
    return lp(mix([(bolt, 0, 0), (body, 0, -7)]), 6000, 1)


def thump(st=0.0, f0=85.0, f1=48.0):
    """Weight: a felted kick, low-passed, with a falling sine under it."""
    kick = lp(strike("Kick Thud.aif", st, dur=0.28, t60=0.25), 400)
    return mix([(kick, 0, 0), (sine_drop(f0, f1, 0.2), 0, -8)])


def plunger(st=0.0):
    """A fat sprung button driven home: slap of the cap, the stop underneath, weight."""
    cap = strike("Perc Snap Tap.wav", st - 3, dur=0.12, t60=0.10)
    stop = strike("Wood Clog Medium.wav", st - 6, dur=0.10, t60=0.09)
    return mix([(cap, 0, 0), (stop, 0.003, -5), (thump(st), 0, -6)])


def static(dur, at=1.0):
    """Tube static through the speaker. The recording's loud pops are squashed to a hiss."""
    x = load("Static Sunny Eve.wav")
    x = x[int(at * SR):][:int(dur * SR) + SR // 10]
    x = speaker(tame(x, 3.0))[SR // 10:]          # drop the filters' start-up
    assert len(x) == int(dur * SR), "the static recording is too short for this slice"
    return x / np.abs(x).max()


def crackle(dur, at=0.5):
    """Crackle through the speaker: vinyl dirt, pops kept."""
    x = load("Vinyl Dirt 2.wav")
    x = x[int(at * SR):][:int(dur * SR) + SR // 10]
    x = speaker(x, drive=2.5)[SR // 10:]
    assert len(x) == int(dur * SR), "the crackle recording is too short for this slice"
    return x / np.abs(x).max()


def arc(dur, at=0.0):
    """An electrical discharge: tuning crackle and a splintering box, saturated hard."""
    a = load("Crackle Tuning.wav")[int(at * SR):][:int(dur * SR)]
    b = strike("FX Broken Box.wav", -2, dur=dur)
    n = min(len(a), len(b))
    return speaker(a[:n] / np.abs(a[:n]).max() + 0.7 * b[:n], drive=3.0)


def bell(name, st, dur, cents=0.0, lowpass=6000):
    """A struck bell. `cents` adds a second, mistuned strike so it beats like an old one."""
    x = strike(name, st)
    if cents:
        y = strike(name, st + cents / 100)
        n = min(len(x), len(y))
        x = x[:n] + 0.6 * y[:n]
    x = fade(decay(x[:int(dur * SR)], dur * 1.6), r=0.03)
    return lp(x, lowpass, 1) / np.abs(x).max()


def hum_tone(n, sr, rng, circular=False):
    """Transformer hum from a real amp-hum recording, as long as asked.

    The recording hums at 50 Hz for 1.3 s. It is resampled so the hum is exactly 60 Hz, then pieces
    of it are overlapped. Each piece starts a whole number of cycles in, so the tone never jumps.
    With circular=True the last piece wraps onto the first and the result loops with no seam.
    """
    raw, sr0 = sf.read(_index()["Noise Amp Hum.wav"], always_2d=True)
    raw = raw.mean(axis=1)
    spec = np.abs(np.fft.rfft(raw * np.hanning(len(raw)), 1 << 22))
    f0 = np.argmax(spec[:int(100 * (1 << 22) / sr0)]) * sr0 / (1 << 22)
    x = resample(raw, int(round(len(raw) * (f0 / 60.0) * sr / sr0)))
    x = x[sr // 20:-sr // 20]                       # the ends ring after an FFT resample
    period = sr // 60
    hop, xf = 30 * period, 6 * period               # half-second pieces, 100 ms overlaps
    assert n % hop == 0 or not circular
    seg = hop + xf
    starts = np.arange(0, len(x) - seg, period)
    ramp = np.linspace(0, 1, xf, endpoint=False)
    win = np.concatenate([ramp, np.ones(hop - xf), 1 - ramp])
    out = np.zeros(n + (0 if circular else seg))
    for k in range(-(-n // hop)):
        s = starts[rng.integers(len(starts))]
        idx = (k * hop + np.arange(seg)) % n if circular else k * hop + np.arange(seg)
        out[idx] += x[s:s + seg] * win
    out = out[:n]
    return out / np.abs(out).max()


def hum_voice(n, sr, rng, circular=False, harmonics=0.0):
    """The hum as it is heard: the 60 Hz recording, with its harmonics lifted.

    A laptop or phone plays almost nothing at 60 Hz, so the hum must live at 120 Hz and up. The
    recording is bent two ways: a soft clip (odd harmonics, a transformer near saturation) and a
    rectifier (120 Hz and its multiples, power-supply ripple). Only the part above 150 Hz is added
    back. `harmonics` is that part's level in dB against the plain recording.
    """
    tone = hum_tone(n, sr, rng, circular)
    bent = tone + np.tanh(4 * tone) + 0.8 * np.abs(tone)
    if circular:
        # Filter two laps and keep the second: the filter has settled, so the loop stays closed.
        high = hp(np.tile(bent, 2), 150, 2, sr)[n:]
    else:
        high = hp(bent, 150, 2, sr)
    rms = lambda x: np.sqrt(np.mean(x ** 2))
    return tone / rms(tone) + db(harmonics) * high / rms(high)


# ---------------------------------------------------------------- the first cabinet

def notch():
    """notch-1..4: one detent of a heavy rotary switch. Tiny, dry, quiet: it repeats 10 times a second.

    A wooden tick (Wood Tip Tag) for the ball dropping into the notch, a knock (Perc Knock Rattle)
    pitched down a fourth or more for the weight of the knob, and a dull click under both. Each
    take moves the pitches and the balance a little. No room, no static.
    """
    takes = []
    for tick_st, knock_st, bal in ((-5, -7, 0), (-3.5, -9, -2), (-6.5, -6, -1), (-4.2, -10.5, -3)):
        x = mix([
            (strike("Wood Tip Tag.wav", tick_st, dur=0.035, t60=0.03), 0, bal),
            (strike("Perc Knock Rattle.wav", knock_st, dur=0.045, t60=0.04), 0.0005, -3),
            (strike("E-Perc Click Unsounded.wav", knock_st / 2, dur=0.04, t60=0.04), 0, -9),
        ], dur=0.045)
        takes.append(finish(lp(x, 5000, 1), 0))
    return match(takes, -17)


def fire():
    """fire: the plunger slams, a contactor pulls in 40 ms later, the beam launches with a crackling whoosh.

    Plunger: snap + clog + felt kick with a sine under it. Contactor: door-lock bolt, down 3
    semitones. Discharge: tuning crackle, a splintering box and static through the speaker, with
    the band sweeping up from about 500 Hz to 2.6 kHz as it dies over 0.7 s.
    """
    n = int(0.75 * SR)
    a = arc(0.75)[:n]
    s = static(0.75, at=2.0)[:n]
    wh = a[:len(s)] + 0.5 * s[:len(a)]
    r = np.linspace(0, 1, len(wh)) ** 0.7
    wh = lp(hp(wh, 300), 1200) * (1 - r) + lp(hp(wh, 1500), 4000) * r    # the upward sweep
    wh = wh / np.abs(wh).max() * swell(len(wh), 0.03, 0.55)
    x = mix([(plunger(), 0, 0), (clunk(-3), 0.040, -4), (wh, 0.050, -5)])
    return finish(room(x), -4)


def button_up():
    """button-up: the plunger's sprung return. A short spring (Clave Spring) and a light wooden stop."""
    spring = strike("Clave Spring.wav", -4, dur=0.20, t60=0.25)
    stop = strike("Wood Blawk.wav", -5, dur=0.06, t60=0.06)
    x = mix([(spring, 0, -4), (stop, 0.022, 0), (strike("E-Perc Click Unsounded.wav", 0, dur=0.04), 0.022, -6)])
    return finish(room(lp(x, 6000, 1)), -13)


def dud():
    """dud: the plunger pressed with nothing to fire. The same press, but dull and dead.

    A muffled wood knock (Wood Under The Rug) and the clog stop, low-passed at 2.2 kHz, a little
    weight. No contactor, no discharge, no ring.
    """
    x = mix([
        (strike("Wood Under The Rug.wav", -5, dur=0.12, t60=0.09), 0, 0),
        (strike("Wood Clog Medium.wav", -8, dur=0.10, t60=0.08), 0.003, -6),
        (thump(-2, 70, 45)[:int(0.14 * SR)], 0, -8),
    ], dur=0.17)
    return finish(lp(x, 2200), -10)


def hit():
    """hit: a target struck. The beam defocuses into a burst: crackle, a low thump, a short dying ring.

    Burst: the discharge again, harder and shorter (0.25 s). Thump: felt kick with a sine from 95
    to 42 Hz. Ring: a noisy bell resonance (Bell Reso Noise 3) down 3 semitones, sagging another 2
    as it dies, through the speaker. Static trails off under it.
    """
    burst = arc(0.4, at=0.3)
    burst = burst * swell(len(burst), 0.004, 0.22)
    ring = bend(strike("Bell Reso Noise 3.aif", -3, dur=0.7), 0, -2)
    ring = speaker(decay(ring, 0.6), drive=1.2)
    tail = static(0.8, at=4.0)
    tail = tail * swell(len(tail), 0.01, 0.6)
    x = mix([(burst, 0, 0), (thump(0, 95, 42), 0, -5), (strike("Kick Felt Crack.wav", 0, dur=0.3, t60=0.3), 0, -10),
             (ring, 0.012, -8), (tail, 0, -14)], dur=0.85)
    return finish(room(x), -4)


def ground():
    """ground: the shell lands and misses. A small dull thud with a puff of static.

    Thud: Wood Rough Low and a low-passed kick, both dark. Static: 0.3 s through the speaker, with
    a few crackles.
    """
    puff = static(0.4, at=6.0)
    puff = puff * swell(len(puff), 0.006, 0.28)
    pops = crackle(0.4, at=1.2)
    pops = pops * swell(len(pops), 0.006, 0.3)
    x = mix([(lp(strike("Wood Rough Low.aif", -4, dur=0.25, t60=0.2), 1200), 0, 0),
             (thump(-3, 75, 45), 0, -8), (puff, 0.004, -8), (pops, 0.004, -10)], dur=0.42)
    return finish(room(x), -10)


def wave():
    """wave: wave cleared. Relays chatter, then a bell is struck twice, old and a little out of tune.

    Seven relays in 0.3 s. The bell is a cash-register bell (Bell Cash, about 1.3 kHz), each strike
    doubled with a copy 28 cents flat so it beats. The second strike is 35 cents flat of the first.
    """
    rng = np.random.default_rng(1947)
    times = np.cumsum([0, 0.05, 0.035, 0.06, 0.04, 0.05, 0.045])
    x = mix([
        (chatter(times, rng), 0, -5),
        (bell("Bell Cash.aif", -2, 0.7, cents=-28), 0.36, 0),
        (bell("Bell Cash.aif", -2.35, 1.2, cents=-28), 0.66, -1.5),
        (relay(rng, -5), 0.345, -6), (relay(rng, -5), 0.645, -6),      # the striker's solenoid
        (static(1.7, at=3.0) * swell(int(1.7 * SR), 0.1, 1.4), 0, -26),
    ], dur=1.8)
    return finish(room(x), -6)


def over():
    """over: out of shells. The main relay drops out, the hum sags, the static fades.

    Contactor and a relay at the start, one more relay 0.2 s later. The hum is the same recording
    as the loop, gliding down 9 semitones over 1.6 s through the speaker. Static and crackle fade
    under it.
    """
    rng = np.random.default_rng(1948)
    n = int(1.9 * SR)
    h = hum_voice(int(2.6 * SR), SR, rng, harmonics=3)
    h = bend(h, 0, -9)[:n]
    h = lp(hp(h, 60), 3000) * swell(n, 0.02, 1.5)
    s = static(1.9, at=5.0)[:n] * swell(n, 0.02, 1.2)
    c = crackle(1.9, at=0.2)[:n] * swell(n, 0.02, 1.4)
    x = mix([(clunk(-5), 0, 0), (relay(rng, -6), 0.012, -4), (relay(rng, -8), 0.21, -7),
             (h / np.abs(h).max(), 0.02, -5), (s, 0.02, -13), (c, 0.02, -14)], dur=1.95)
    return finish(room(x), -7)


def restart():
    """restart: the machine resets. Relays reset in sequence, the tube warms. Short.

    Six relays, each a little higher than the last, the gaps closing. A contactor at 0.42 s. Under
    them the hum rises 5 semitones to pitch and static swells, then both settle by 1 s.
    """
    rng = np.random.default_rng(1949)
    n = int(0.95 * SR)
    times = np.cumsum([0, 0.085, 0.075, 0.065, 0.055, 0.05])
    h = bend(hum_voice(int(1.4 * SR), SR, rng, harmonics=3), -5, 0)[:n]
    h = lp(hp(h, 60), 3000) * swell(n, 0.45, 0.6)
    s = static(0.95, at=7.0)[:n] * swell(n, 0.5, 0.5)
    x = mix([(chatter(times, rng, -8, -2, 2), 0, -2), (clunk(-2), 0.42, 0),
             (h / np.abs(h).max(), 0, -9), (s, 0, -13)], dur=0.98)
    return finish(room(x), -8)


def step_up():
    """step-up: the player steps to the cabinet. A soft settle, a quiet thunk, a little swell of static.

    Thunk: Wood Rough Low under 500 Hz and a soft kick, 60 ms in. The static rises for 0.25 s and
    falls for 0.4 s, with a trace of hum.
    """
    rng = np.random.default_rng(1950)
    n = int(0.68 * SR)
    s = static(0.68, at=8.0)[:n] * swell(n, 0.25, 0.42)
    h = lp(hp(hum_voice(n, SR, rng, harmonics=3), 60), 2500) * swell(n, 0.25, 0.42)
    thunk = lp(strike("Wood Rough Low.aif", -6, dur=0.2, t60=0.16), 500)
    x = mix([(s, 0, -6), (h / np.abs(h).max(), 0, -14), (thunk, 0.06, 0), (thump(-4, 65, 45), 0.06, -6)], dur=0.7)
    return finish(x, -12)


def step_away():
    """step-away: the reverse, shorter. The static is already there and drops away; a lighter thunk ends it."""
    n = int(0.36 * SR)
    s = static(0.36, at=8.6)[:n] * swell(n, 0.012, 0.26)
    thunk = lp(strike("Wood Rough Low.aif", -3, dur=0.14, t60=0.11), 700)
    x = mix([(s, 0, -4), (thunk, 0.10, -2)], dur=0.38)
    return finish(x, -14)


def hum():
    """hum: the loop. 4 s, 24 kHz, built to repeat with no seam.

    Transformer hum from a real amp-hum recording, resampled from 50 to exactly 60 Hz and laid
    end over end on whole cycles, wrapping onto itself. Its harmonics are lifted by a soft-clip
    curve so it is heard on small speakers. Sines at 60 and 120 Hz sit under it as support (4 s
    holds a whole number of their cycles). Over that, tube static and tape hiss through the
    speaker filter with every pop squashed, and vinyl dirt very low. Each noise bed has its tail
    cross-faded into its head. Nothing is filtered after the loop is closed.
    """
    sr, n = HUM_SR, int(HUM_SECONDS * HUM_SR)
    rng = np.random.default_rng(60)
    t = np.arange(n) / sr

    def rms(x):
        return np.sqrt(np.mean(x ** 2))

    def bed(name, at, k):
        """A steady, speaker-filtered noise bed that loops: the tail fades into the head."""
        xf = sr // 2
        x = load(name, sr)[int(at * sr):][:n + xf + sr // 10]
        x = speaker(tame(x, k), sr, drive=1.0)[sr // 10:]
        assert len(x) == n + xf, f"{name} is too short for the loop"
        r = np.linspace(0, 1, xf, endpoint=False)
        out = x[:n].copy()
        out[:xf] = x[:xf] * np.sqrt(r) + x[n:] * np.sqrt(1 - r)    # equal power: noise is uncorrelated
        return out / rms(out)

    voice = hum_voice(n, sr, rng, circular=True, harmonics=1)
    voice = voice / rms(voice)
    x = (voice
         + db(-14) * np.sqrt(2) * np.sin(2 * np.pi * 60 * t)
         + db(-20) * np.sqrt(2) * np.sin(2 * np.pi * 120 * t + 1.0)
         + db(-9) * bed("Static Sunny Eve.wav", 1.0, 2.5)
         + db(-18) * bed("Noise Tape Floor.wav", 0.5, 3.0)
         + db(-20) * bed("Vinyl Dirt 1.wav", 0.1, 5.0))
    x = x - x.mean()
    return x / rms(x) * db(HUM_RMS_DB)


# ---------------------------------------------------------------- Bertie

def bertie_key():
    """bertie-key-1..3: a heavy key. A deep clack, and a relay answers 10-18 ms later.

    Key: a low wood body (Wood MPC 3, down 4-6 semitones), a snap for the keytop, a short thump.
    The relay is a different one each take and answers at 10, 14 and 18 ms.
    """
    rng = np.random.default_rng(1950)
    takes = []
    for st, gap in ((-5, 0.010), (-4, 0.014), (-6, 0.018)):
        x = mix([
            (strike("Wood MPC 3.wav", st, dur=0.13, t60=0.11), 0, 0),
            (strike("Perc Snap Tap.wav", st - 1, dur=0.08, t60=0.07), 0, -4),
            (thump(st / 2, 80, 50)[:int(0.12 * SR)], 0, -9),
            (relay(rng, st + 1), gap, -5),
        ], dur=0.135)
        takes.append(finish(lp(x, 6000, 1), 0))
    return match(takes, -9)


def bertie_lamp():
    """bertie-lamp: a big lamp's contactor. A clunk, and a tiny ping from the filament.

    Clunk: the door-lock contactor down 6 semitones with a little weight. Ping: a small metal tube
    hit (E-Perc Tube 1) down 9 semitones to about 3.2 kHz, 22 dB under the clunk, 20 ms later.
    """
    ping = strike("E-Perc Tube 1.aif", -9, dur=0.2, t60=0.25)
    x = mix([(clunk(-6), 0, 0), (thump(-3, 70, 46), 0, -9), (ping, 0.020, -22)], dur=0.30)
    return finish(room(x), -10)


def bertie_win():
    """bertie-win: the player wins. A relay flourish and three bells rising, modest, 1950 fairground.

    Eight relays speeding up over 0.3 s. Then three strikes up a major triad: a mallet bell (Bell
    Brooklyn) near 780 Hz, the cash-register bell near 970 Hz (it sits about 30 cents flat of the
    other bell, and is left there), and the mallet bell near 1170 Hz. Each has a mistuned double.
    A contactor closes under the last one.
    """
    rng = np.random.default_rng(1951)
    times = np.cumsum([0, 0.06, 0.05, 0.045, 0.04, 0.035, 0.03, 0.03])
    x = mix([
        (chatter(times, rng, -6, -1, 2), 0, -4),
        (bell("Bell Brooklyn C5.aif", -5, 0.6, cents=-18), 0.32, -3),
        (bell("Bell Cash.aif", -5, 0.6, cents=-25), 0.50, -3),
        (bell("Bell Brooklyn C5.aif", 2, 1.2, cents=-22), 0.70, 0),
        (relay(rng, -4), 0.31, -8), (relay(rng, -4), 0.49, -8), (clunk(-2), 0.69, -8),
    ], dur=1.9)
    return finish(room(x), -4.5)


def bertie_lose():
    """bertie-lose: the machine wins. Two low struck tones, the second lower, with relays. Not mocking.

    Four unhurried relays, then a tin bell (Bell Tin) down 7 semitones (about 430 Hz) and again
    down 11 (about 340 Hz), a major third lower, soft and low-passed at 3 kHz. One relay lets go at
    the end.
    """
    rng = np.random.default_rng(1952)
    times = np.cumsum([0, 0.07, 0.08, 0.09])
    x = mix([
        (chatter(times, rng, -5, -8, 2), 0, -6),
        (bell("Bell Tin.wav", -7, 0.9, cents=-14, lowpass=3000), 0.30, -1),
        (bell("Bell Tin.wav", -11, 1.1, cents=-14, lowpass=3000), 0.78, 0),
        (relay(rng, -9), 1.30, -10),
    ], dur=1.9)
    return finish(room(x), -6.5)


def bertie_draw():
    """bertie-draw: a flat double clunk and one neutral chime.

    The same contactor twice, 0.15 s apart, at the same pitch so it reads as flat. Then the tin
    bell once, down 2 semitones, damped to 0.6 s.
    """
    x = mix([(clunk(-5), 0, 0), (clunk(-5), 0.15, -1), (thump(-3, 70, 46), 0, -8),
             (bell("Bell Tin.wav", -2, 0.6, cents=-12, lowpass=4000), 0.34, -4)], dur=1.0)
    return finish(room(x), -8)


def bertie_reset():
    """bertie-reset: the reset plunger, and a cascade of relays letting go.

    The plunger a little lower than the cabinet's. Then nine relays over 0.6 s, falling in pitch,
    the gaps widening, for nine lamps going out.
    """
    rng = np.random.default_rng(1953)
    times = 0.11 + np.cumsum([0, 0.04, 0.045, 0.05, 0.06, 0.07, 0.08, 0.095, 0.11])
    x = mix([(plunger(-2), 0, 0), (chatter(times, rng, -2, -9, 2), 0, -3)], dur=0.82)
    return finish(room(x), -7)


def bertie_refused():
    """bertie-refused: a taken square pressed. A dull buzz-clack.

    Clack: the muffled wood knock. Buzz: a buzz hit (FX Buzz Unsounded) up 4 semitones so it sits
    near 120 Hz, through the speaker and saturated, 0.2 s, with a rattling knock (E-Perc Knock
    Buzz) inside it.
    """
    buzz = speaker(hp(strike("FX Buzz Unsounded.wav", 4, dur=0.22), 100), drive=3.0)
    buzz = buzz * swell(len(buzz), 0.004, 0.2)
    x = mix([(lp(strike("Wood Under The Rug.wav", -6, dur=0.12, t60=0.09), 2500), 0, 0),
             (thump(-2, 70, 46)[:int(0.14 * SR)], 0, -7), (buzz, 0.004, -5),
             (lp(strike("E-Perc Knock Buzz.aif", -3, dur=0.2, t60=0.18), 3000), 0.004, -8)], dur=0.27)
    return finish(x, -9)


def bertie_dial():
    """bertie-dial: one position of a five-position rotary switch. Heavier and slower than the notch.

    A cassette pushed home (Wood Insert Cassette: two knocks 40 ms apart, the wiper leaving one
    contact and seating on the next) down 5 semitones, with a low wooden knock under the second.
    """
    x = mix([
        (strike("Wood Insert Cassette.wav", -5, dur=0.125, t60=0.2), 0, 0),
        (strike("E-Perc Wood Knock.wav", 4, dur=0.08, t60=0.08), 0.053, -8),
        (strike("Perc Knock Rattle.wav", -9, dur=0.06, t60=0.05), 0, -6),
    ], dur=0.13)
    return finish(lp(x, 5000, 1), -13)


# ---------------------------------------------------------------- parts for the three 1951 machines

def hum_glide(dur, rng, st0, st1, rise, fall, harmonics=3):
    """The hum voice gliding from st0 to st1 semitones under a swell, through the speaker's band."""
    n = int(dur * SR)
    src = int(n * 2 ** (max(st0, st1, 0) / 12)) + SR // 5      # a glide up reads faster, so needs more
    h = bend(hum_voice(src, SR, rng, harmonics=harmonics), st0, st1)
    assert len(h) >= n, "the hum source is too short for this glide"
    h = lp(hp(h[:n], 60), 3000) * swell(n, rise, fall)
    return h / np.abs(h).max()


def tick(name, st, dur=0.03, t60=0.025):
    """A relay's armature alone, with no contact tack. For sounds that repeat many times."""
    return strike(name, st, dur=dur, t60=t60)


def clack(st=0.0):
    """A boxwood chess piece on a varnished board: the piece's clack, the board's knock under it."""
    piece = strike("Wood Clack.wav", st - 3, dur=0.10, t60=0.08)
    board = strike("Wood Block Low.aif", st - 2, dur=0.12, t60=0.09)
    knock = strike("Wood Dry Low.aif", st - 5, dur=0.08, t60=0.07)
    return mix([(piece, 0, 0), (board, 0.001, -7), (knock, 0, -6)])


def buzz(dur, st, at=4.0, drive=2.5):
    """A mains buzzer: a slice of a recorded 50 Hz buzz, repitched, through the speaker."""
    x = load("Buzz Noise.wav")[int(at * SR):]
    x = pitch(x, st)[:int(dur * SR) + SR // 10]
    x = speaker(x, drive=drive)[SR // 10:]                 # drop the filters' start-up
    assert len(x) == int(dur * SR), "the buzz recording is too short for this slice"
    return x / np.abs(x).max()


def hoot(hz, dur):
    """One note of the Mark 1's hooter: a tonewheel organ's C3 repitched, through the speaker, hard on and off.

    The hooter was the machine's own pulses sent to a loudspeaker, so it is clean but square-edged.
    The speaker's saturation gives it those edges.
    """
    st = 12 * np.log2(hz / 130.81)
    x = pitch(load("Organ Tonewheel C3.wav")[int(0.3 * SR):], st)[:int(dur * SR) + SR // 10]
    x = speaker(x, drive=2.2)[SR // 10:]
    assert len(x) == int(dur * SR), "the organ recording is too short for this note"
    return fade(x / np.abs(x).max(), a=0.0015, r=0.015)


# ---------------------------------------------------------------- Nimrod

def nimrod_press():
    """nimrod-press: a heavy bakelite button bottoms out, then the lamps to its right go out in a ripple.

    Button: a hard snap (Perc Snap Tap) for the bakelite, Wood MPC 3 down 6 for the body, a short
    thump. Ripple: four relays 25-30 ms apart, each a little lower.
    """
    rng = np.random.default_rng(2101)
    times = 0.03 + np.cumsum([0, 0.026, 0.028, 0.03])
    x = mix([
        (strike("Perc Snap Tap.wav", -2, dur=0.08, t60=0.06), 0, 0),
        (strike("Wood MPC 3.wav", -6, dur=0.12, t60=0.10), 0, -3),
        (thump(-2, 80, 50)[:int(0.12 * SR)], 0, -9),
        (chatter(times, rng, -3, -6, 3), 0, -6),
    ], dur=0.26)
    return finish(room(lp(x, 7000, 1)), -9)


def nimrod_refused():
    """nimrod-refused: the button hits its stop and does nothing. A dull thunk, no relay."""
    x = mix([
        (strike("Wood Under The Rug.wav", -7, dur=0.12, t60=0.08), 0, 0),
        (strike("Wood Clog Medium.wav", -9, dur=0.09, t60=0.07), 0.002, -7),
        (thump(-3, 70, 45)[:int(0.13 * SR)], 0, -8),
    ], dur=0.15)
    return finish(lp(x, 1800), -12)


def nimrod_step():
    """nimrod-step-1..4: one step of the machine's work. A small crisp relay and a faint filament tick.

    It plays 6 to 8 times a move, 0.22 s apart, so it is short, quiet and dry. Each take uses a
    different click for the armature, so the takes differ in waveform, not only in pitch.
    """
    takes = []
    for name, st, ping_st in (("Wood Tip Tag.wav", -2, -9), ("Clap Snap Fings.wav", -4, -10),
                              ("Rimshot Serendipity of Surprise.wav", -5, -8.5), ("E-Perc Metal Chop.wav", -6, -9.5)):
        x = mix([
            (tick(name, st), 0, 0),
            (strike("E-Perc Click Unsounded.wav", st / 2, dur=0.03, t60=0.03), 0, -10),
            (strike("E-Perc Tube 1.aif", ping_st, dur=0.05, t60=0.05), 0.004, -24),
        ], dur=0.055)
        takes.append(finish(lp(hp(x, 200), 8000, 1), 0))
    return match(takes, -19)


def nimrod_move():
    """nimrod-move: the machine's move. A bank of relays dropping together, a clack with a short tail.

    Six relays inside 8 ms and a contactor down 4 make the clack. Three contacts bounce after it
    (25-70 ms), and a metal rattle (Metallic Rattle, down 7, low-passed) dies in 0.25 s.
    """
    rng = np.random.default_rng(2102)
    bank = [(relay(rng, rng.uniform(-7, -3)), rng.uniform(0, 0.008), -rng.uniform(0, 3)) for _ in range(6)]
    bounces = [(relay(rng, -4), t, g) for t, g in ((0.025, -10), (0.045, -13), (0.07, -16))]
    rattle = lp(strike("Metallic Rattle.wav", -7, dur=0.25, t60=0.22), 3000)
    x = mix(bank + bounces + [(clunk(-4), 0, -2), (thump(-3, 75, 46), 0, -10), (rattle, 0.01, -16)], dur=0.36)
    return finish(room(x), -7)


def nimrod_win():
    """nimrod-win: the visitor wins. A bright cascade of relays settling, then the lamps' warm hum swells.

    Fourteen relays rising in pitch, the gaps widening as they settle. A contactor at 0.55 s as the
    lamps come on, and the hum voice rising 3 semitones to pitch, swelling for 0.35 s and dying over
    a second. Pleased but old: no bell.
    """
    rng = np.random.default_rng(2103)
    times = np.cumsum([0, 0.022, 0.022, 0.024, 0.026, 0.028, 0.03, 0.033, 0.036, 0.04, 0.045, 0.05, 0.057, 0.065])
    h = hum_glide(1.3, rng, -3, 0, 0.35, 0.9)
    x = mix([(chatter(times, rng, -5, 1, 3), 0, 0), (clunk(-3), 0.55, -4),
             (h, 0.5, -6), (static(1.3, at=0.2) * swell(int(1.3 * SR), 0.35, 0.8), 0.5, -20)], dur=1.85)
    return finish(room(x), -6)


def nimrod_lose():
    """nimrod-lose: the machine wins. Two heavy relay clunks and a falling transformer hum. Final.

    Contactors down 6 and down 9, 0.3 s apart, each with a thump. The hum voice falls 9 semitones
    over 1.5 s.
    """
    rng = np.random.default_rng(2104)
    h = hum_glide(1.6, rng, 0, -9, 0.02, 1.3)
    x = mix([(clunk(-6), 0, 0), (thump(-3, 80, 46), 0, -7), (clunk(-9), 0.30, 0), (thump(-5, 70, 42), 0.30, -6),
             (relay(rng, -8), 0.31, -8), (h, 0.02, -7)], dur=1.75)
    return finish(room(x), -7)


def nimrod_deal():
    """nimrod-deal: a new position. Relays rattle as rows of lamps come on, then a soft hum.

    Twelve relays over 0.4 s, rising a little. The hum voice swells in under them and settles.
    """
    rng = np.random.default_rng(2105)
    times = np.cumsum([0] + list(rng.uniform(0.025, 0.045, 11)))
    h = hum_glide(0.9, rng, -2, 0, 0.3, 0.5)
    x = mix([(chatter(times, rng, -6, -2, 4), 0, 0), (h, 0.15, -10)], dur=1.05)
    return finish(room(x), -9)


def nimrod_switch():
    """nimrod-switch: a big lever toggle snapping over centre. A hard clack with a spring ring.

    Clack: the door-lock contactor down 1 and a hard wood clack. Ring: a sprung metal hit (E-Perc
    Spring) down 4, dying in 0.35 s.
    """
    ring = strike("E-Perc Spring.wav", -4, dur=0.35, t60=0.35)
    x = mix([(clunk(-1), 0, 0), (strike("Wood Clack.wav", -4, dur=0.08, t60=0.06), 0, -3),
             (thump(-2, 85, 50)[:int(0.14 * SR)], 0, -10), (lp(ring, 5000, 1), 0.004, -11)], dur=0.38)
    return finish(room(x), -8)


def nimrod_comp():
    """nimrod-comp: COMP. MOVE pressed. A deep plunger into a soft rubber stop, then the first relay.

    The plunger down 5, low-passed at 1.4 kHz so the stop is soft. A relay pulls in at 80 ms.
    """
    rng = np.random.default_rng(2106)
    x = mix([(lp(plunger(-5), 1400), 0, 0), (relay(rng, -3), 0.08, -6)], dur=0.24)
    return finish(room(x), -9)


# ---------------------------------------------------------------- Whirlwind

def whirlwind_notch():
    """whirlwind-notch-1..4: a heavy rotary switch's detent. A short dry clack with a little ring of steel.

    Clack: Wood Clack and Perc Knock Rattle, pitched down. Ring: a short metal hit (Metallic High
    Short) down 12, about 2.7 kHz, 16-18 dB under. It repeats as the knob turns, so it is quiet.
    """
    takes = []
    for clack_st, knock_st, ring_st, ring_g in ((-5, -8, -12, -16), (-4, -9.5, -11, -18),
                                                (-6, -7, -12.5, -17), (-4.5, -10, -11.5, -16)):
        x = mix([
            (strike("Wood Clack.wav", clack_st, dur=0.04, t60=0.035), 0, 0),
            (strike("Perc Knock Rattle.wav", knock_st, dur=0.045, t60=0.04), 0.0005, -4),
            (strike("Metallic High Short.aif", ring_st, dur=0.09, t60=0.08), 0.002, ring_g),
        ], dur=0.09)
        takes.append(finish(lp(x, 7000, 1), 0))
    return match(takes, -15)


def whirlwind_stop():
    """whirlwind-stop: the detent against its end stop. A duller thud, no ring."""
    x = mix([
        (strike("Wood Under The Rug.wav", -6, dur=0.09, t60=0.07), 0, 0),
        (strike("Perc Knock Rattle.wav", -10, dur=0.05, t60=0.04), 0, -6),
        (thump(-2, 75, 48)[:int(0.10 * SR)], 0, -10),
    ], dur=0.11)
    return finish(lp(x, 1500), -14)


def whirlwind_release():
    """whirlwind-release: the plunger slammed home, a deep sprung thunk, then a relay pulling in.

    The plunger down 3 with a spring (Clave Spring, down 6) ringing under it. A contactor and a
    relay pull in at 70 ms.
    """
    rng = np.random.default_rng(2201)
    spring = strike("Clave Spring.wav", -6, dur=0.25, t60=0.3)
    x = mix([(plunger(-3), 0, 0), (spring, 0.004, -12), (clunk(-2), 0.07, -7), (relay(rng, -3), 0.072, -6)], dur=0.36)
    return finish(room(x), -6)


def whirlwind_bounce():
    """whirlwind-bounce-1..4: a bounce. A quiet dry relay tick with a soft electronic tick on the tube.

    The relay is an armature click, a different one each take, moved a semitone or so. The tube's
    tick is a vinyl click through the speaker. 2 to 11 play per ball, so it is short and quiet.
    """
    takes = []
    for name, st in (("Wood Tip Tag.wav", -3), ("Wood MS.wav", -4), ("Clap Snap Fings.wav", -2.5), ("Perc Knock Rattle.wav", -3.5)):
        el = speaker(strike("Click Vinyl.wav", st, dur=0.02, t60=0.015), drive=1.2)
        x = mix([(tick(name, st, dur=0.025, t60=0.02), 0, 0), (fade(el, r=0.004), 0.001, -9)], dur=0.035)
        takes.append(finish(lp(hp(x, 250), 7000, 1), 0))
    return match(takes, -21)


def whirlwind_drop():
    """whirlwind-drop: the ball goes through. A quick run of relays, then a struck steel rod.

    Six relays in 0.15 s. The rod: a tube hit (Tube Hit, about 880 Hz) down 4, near 700 Hz, with
    a copy 8 cents flat so it beats a little, damped to about a second. A relay fires with it.
    """
    rng = np.random.default_rng(2202)
    times = np.cumsum([0, 0.03, 0.028, 0.03, 0.026, 0.03])
    x = mix([(chatter(times, rng, -5, -2, 3), 0, -3), (relay(rng, -4), 0.2, -7),
             (bell("Tube Hit.wav", -4, 1.0, cents=-8, lowpass=4000), 0.21, 0)], dur=1.3)
    return finish(room(x), -6)


def whirlwind_miss():
    """whirlwind-miss: a register clearing. A short low buzz between two relays.

    A relay, then 0.25 s of recorded mains buzz moved up to about 60 Hz, through the speaker, so
    its harmonics carry it. A relay lets go at the end.
    """
    rng = np.random.default_rng(2203)
    b = buzz(0.25, 3)
    b = b * swell(len(b), 0.006, 0.22)
    x = mix([(relay(rng, -4), 0, 0), (b, 0.006, -3), (relay(rng, -6), 0.27, -4)], dur=0.33)
    return finish(x, -10)


def whirlwind_over():
    """whirlwind-over: the fifth miss. Relays drop out one after another over a fading transformer hum.

    A contactor at the start, then five relays, falling in pitch, the gaps widening. The hum voice
    falls 9 semitones over 1.8 s.
    """
    rng = np.random.default_rng(2204)
    times = np.array([0.0, 0.22, 0.47, 0.76, 1.1, 1.45])
    h = hum_glide(1.9, rng, 0, -9, 0.02, 1.5)
    x = mix([(clunk(-5), 0, 0), (chatter(times, rng, -3, -10, 1), 0.01, -3), (h, 0.02, -6),
             (static(1.9, at=3.5) * swell(int(1.9 * SR), 0.02, 1.2), 0.02, -16)], dur=1.95)
    return finish(room(x), -7)


def whirlwind_hole():
    """whirlwind-hole: a new hole. A stepping switch ratchets five steps.

    Each step is a knock (Perc Knock Rattle, down 5) with a metal pawl (E-Perc Metal Chop) on top,
    55 ms apart, all at one pitch the way a ratchet sounds. The last step seats a little heavier.
    """
    steps = []
    for k in range(5):
        st = -5 - 0.3 * (k % 2)                         # the pawl alternates two teeth, very slightly
        s = mix([(strike("Perc Knock Rattle.wav", st, dur=0.04, t60=0.035), 0, 0),
                 (strike("E-Perc Metal Chop.wav", st + 4, dur=0.025, t60=0.02), 0.002, -6),
                 (strike("E-Perc Click Unsounded.wav", st / 2, dur=0.03), 0, -10)])
        steps.append((s, 0.055 * k, -2 if k < 4 else 0))
    steps.append((clunk(-3), 0.22, -9))
    return finish(lp(mix(steps, dur=0.34), 7000, 1), -10)


def whirlwind_refused():
    """whirlwind-refused: the plunger while a ball is out. A dead thump with a small rattle."""
    x = mix([
        (strike("Wood Under The Rug.wav", -5, dur=0.12, t60=0.09), 0, 0),
        (strike("Wood Clog Medium.wav", -8, dur=0.10, t60=0.08), 0.003, -6),
        (thump(-2, 70, 45)[:int(0.14 * SR)], 0, -8),
        (lp(strike("Metallic Rattle.wav", -6, dur=0.12, t60=0.1), 3000), 0.006, -13),
    ], dur=0.18)
    return finish(lp(x, 2600), -10)


def whirlwind_reset():
    """whirlwind-reset: a new run. A heavy toggle snap, then relays settling.

    The toggle: a contactor down 2, a wood clack, and the spring ring. Then five relays over 0.45 s,
    the gaps widening.
    """
    rng = np.random.default_rng(2205)
    times = 0.12 + np.cumsum([0, 0.06, 0.075, 0.09, 0.11])
    ring = strike("E-Perc Spring.wav", -5, dur=0.3, t60=0.3)
    x = mix([(clunk(-2), 0, 0), (strike("Wood Clack.wav", -5, dur=0.08, t60=0.06), 0, -4),
             (thump(-2, 80, 48)[:int(0.14 * SR)], 0, -9), (lp(ring, 5000, 1), 0.004, -14),
             (chatter(times, rng, -3, -6, 3), 0, -5)], dur=0.68)
    return finish(room(x), -7)


# ---------------------------------------------------------------- Prinz

def prinz_select():
    """prinz-select: a piece picked up or put back. A soft wooden tick and a little felt scuff.

    Tick: Wood Tip Tag down 2 with a dry low wood under it, low-passed at 4 kHz. Scuff: Perc Wood
    Scratch, low-passed and band-limited, 14 dB under.
    """
    scuff = lp(hp(strike("Perc Wood Scratch.aif", -2, dur=0.12, t60=0.12), 300), 2500)
    x = mix([(strike("Wood Tip Tag.wav", -2, dur=0.05, t60=0.04), 0, 0),
             (strike("Wood Dry Low.aif", -3, dur=0.05, t60=0.04), 0, -5), (scuff, 0.012, -14)], dur=0.14)
    return finish(lp(x, 4000), -15)


def prinz_place():
    """prinz-place: the visitor's piece set down. A solid boxwood clack on a varnished board."""
    x = mix([(clack(0), 0, 0), (thump(-2, 90, 55)[:int(0.12 * SR)], 0, -14)], dur=0.17)
    return finish(room(x, -24), -8)


def prinz_capture():
    """prinz-capture: a piece taken. A clack, then the taken piece dropping onto baize, muffled.

    The clack, a little higher. The drop: Wood Under The Rug down 4, low-passed at 900 Hz with a
    soft thump, at 130 ms, and a smaller bounce 60 ms after it.
    """
    drop = lp(strike("Wood Under The Rug.wav", -4, dur=0.12, t60=0.09), 900)
    x = mix([(clack(1), 0, 0), (drop, 0.13, -5), (thump(-4, 65, 45)[:int(0.12 * SR)], 0.13, -13),
             (lp(strike("Wood Under The Rug.wav", -2, dur=0.06, t60=0.05), 900), 0.19, -15)], dur=0.36)
    return finish(room(x, -24), -8)


def prinz_refused():
    """prinz-refused: a square that cannot be chosen. A short, low, dull relay clunk."""
    x = mix([(clunk(-9), 0, 0), (thump(-4, 70, 45)[:int(0.12 * SR)], 0, -8)], dur=0.16)
    return finish(lp(x, 1500), -12)


def prinz_think():
    """prinz-think: the machine searches. About 3 s of fast relay and uniselector chatter over a faint valve hum.

    Relays at random, about 22 a second, with gaps from 15 to 75 ms. Five uniselector runs of 6-10
    steps, 25 ms apart, each at one pitch. Under them the hum voice and static, faint, swelling in
    and out. The whole fades over its last 0.3 s.
    """
    rng = np.random.default_rng(2301)
    dur = 3.0
    n = int(dur * SR)
    t, times = 0.0, []
    while t < dur - 0.2:
        times.append(t)
        t += rng.uniform(0.015, 0.075)
    layers = [(chatter(times, rng, -4, -4, 9), 0, -3)]
    for start in (0.25, 0.8, 1.4, 1.95, 2.45):
        st = rng.uniform(-7, -3)
        steps = rng.integers(6, 11)
        for k in range(steps):
            if start + 0.025 * k < dur - 0.15:
                layers.append((tick("Perc Knock Rattle.wav", st, dur=0.022, t60=0.02), start + 0.025 * k, -6))
    h = hum_glide(dur, rng, 0, 0, 0.3, 4.0)
    s = static(dur, at=6.5) * swell(n, 0.3, 4.0)
    layers += [(h, 0, -16), (s, 0, -22)]
    x = mix(layers, dur=dur)
    x = x * np.minimum(1, np.linspace(dur, 0, n) / 0.3)       # a linear fade over the last 0.3 s
    return finish(room(x), -8)


def prinz_reply():
    """prinz-reply: the machine moves a Black piece. A relay click, then a heavier wooden clack 90 ms later."""
    rng = np.random.default_rng(2302)
    x = mix([(relay(rng, -3), 0, 0), (clack(-2), 0.09, -1), (thump(-3, 80, 50)[:int(0.12 * SR)], 0.09, -12)], dur=0.27)
    return finish(room(x, -24), -8)


def prinz_mate():
    """prinz-mate: the Mark 1's hooter. A short clean two-note hoot, about 0.6 s.

    The hooter's notes were whole fractions of the machine's pulse rate. These are 417 and 521 Hz
    (a major third), a tonewheel organ repitched and squared by the speaker. A relay keys it.
    """
    rng = np.random.default_rng(2303)
    x = mix([(relay(rng, -4), 0, -8), (hoot(417, 0.26), 0.002, 0), (hoot(521, 0.30), 0.30, 0)], dur=0.62)
    return finish(x, -14)                 # a steady tone is dense, so its peak sits low


def prinz_refuted():
    """prinz-refuted: a wrong move shown. A low buzzer burst, about 0.4 s.

    The recorded mains buzz up an octave to 100 Hz, as a 50 Hz buzzer sounds, through the speaker
    and saturated. A relay starts it and lets it go.
    """
    rng = np.random.default_rng(2304)
    b = fade(buzz(0.38, 12, drive=3.0), a=0.003, r=0.02)
    x = mix([(relay(rng, -4), 0, -2), (b, 0.004, 0), (relay(rng, -5), 0.39, -6)], dur=0.45)
    return finish(x, -17)                 # a steady buzz is dense, so its peak sits low


def prinz_reset():
    """prinz-reset: the pieces go back. Wooden pieces set out quickly, a short rattle, about 0.8 s.

    Fourteen small clacks from four wood samples, 25-60 ms apart, louder at first. A wooden rattle
    (Sticks Rattle, low-passed) runs under the first half.
    """
    rng = np.random.default_rng(2305)
    woods = ("Wood Clack.wav", "Wood Dry Low.aif", "Wood Tip Tag.wav", "Wood MS.wav")
    t, layers = 0.0, []
    for k in range(14):
        piece = strike(woods[rng.integers(len(woods))], rng.uniform(-5, -1), dur=0.07, t60=0.06)
        layers.append((piece, t, -rng.uniform(0, 4) - 0.4 * k))
        t += rng.uniform(0.025, 0.06)
    rattle = load("Sticks Rattle.aif")[int(0.45 * SR):int(0.85 * SR)]
    rattle = lp(rattle, 3000) * swell(len(rattle), 0.02, 0.3)
    layers.append((rattle / np.abs(rattle).max(), 0.03, -12))
    return finish(room(mix(layers, dur=0.8), -24), -9)


def prinz_next():
    """prinz-next: the big button sets the next problem. A heavy latch clunk."""
    x = mix([(plunger(-4), 0, 0), (clunk(-4), 0.012, -2), (thump(-4, 75, 44), 0.012, -8)], dur=0.34)
    return finish(room(x), -7)


def prinz_cursor():
    """prinz-cursor-1..3: the keyboard's square moves. A tiny stepping-switch tick.

    A metal pawl and a light knock, 25 ms, high-passed so it stays small. A different pair each take.
    """
    takes = []
    for pawl, st in (("E-Perc Metal Chop.wav", -2), ("Wood Tip Tag.wav", 0), ("Rimshot Serendipity of Surprise.wav", -3)):
        x = mix([(tick(pawl, st, dur=0.022, t60=0.018), 0, 0),
                 (strike("Perc Knock Rattle.wav", st - 3, dur=0.022, t60=0.018), 0.001, -6)], dur=0.028)
        takes.append(finish(lp(hp(x, 400), 7000, 1), 0))
    return match(takes, -22)


def build() -> dict:
    """Every sound by the name the page plays."""
    out = {}
    for k, x in enumerate(notch()):
        out[f"notch-{k + 1}"] = x
    out.update({"fire": fire(), "button-up": button_up(), "dud": dud(), "hit": hit(), "ground": ground(),
                "wave": wave(), "over": over(), "restart": restart(), "step-up": step_up(),
                "step-away": step_away(), "hum": hum()})
    for k, x in enumerate(bertie_key()):
        out[f"bertie-key-{k + 1}"] = x
    out.update({"bertie-lamp": bertie_lamp(), "bertie-win": bertie_win(), "bertie-lose": bertie_lose(),
                "bertie-draw": bertie_draw(), "bertie-reset": bertie_reset(),
                "bertie-refused": bertie_refused(), "bertie-dial": bertie_dial()})
    for k, x in enumerate(nimrod_step()):
        out[f"nimrod-step-{k + 1}"] = x
    out.update({"nimrod-press": nimrod_press(), "nimrod-refused": nimrod_refused(), "nimrod-move": nimrod_move(),
                "nimrod-win": nimrod_win(), "nimrod-lose": nimrod_lose(), "nimrod-deal": nimrod_deal(),
                "nimrod-switch": nimrod_switch(), "nimrod-comp": nimrod_comp()})
    for group, takes in (("whirlwind-notch", whirlwind_notch()), ("whirlwind-bounce", whirlwind_bounce())):
        for k, x in enumerate(takes):
            out[f"{group}-{k + 1}"] = x
    out.update({"whirlwind-stop": whirlwind_stop(), "whirlwind-release": whirlwind_release(),
                "whirlwind-drop": whirlwind_drop(), "whirlwind-miss": whirlwind_miss(),
                "whirlwind-over": whirlwind_over(), "whirlwind-hole": whirlwind_hole(),
                "whirlwind-refused": whirlwind_refused(), "whirlwind-reset": whirlwind_reset()})
    out.update({"prinz-select": prinz_select(), "prinz-place": prinz_place(), "prinz-capture": prinz_capture(),
                "prinz-refused": prinz_refused(), "prinz-think": prinz_think(), "prinz-reply": prinz_reply(),
                "prinz-mate": prinz_mate(), "prinz-refuted": prinz_refuted(), "prinz-reset": prinz_reset(),
                "prinz-next": prinz_next()})
    for k, x in enumerate(prinz_cursor()):
        out[f"prinz-cursor-{k + 1}"] = x
    return out


# ---------------------------------------------------------------- write and measure

# Longest allowed length in seconds, and whether the sound must start with a click (onset < 5 ms).
LIMITS = {"notch": (0.07, True), "bertie-dial": (0.15, True), "bertie-key": (0.15, True),
          "wave": (2.05, True), "over": (2.05, True), "bertie-win": (2.05, True), "bertie-lose": (2.05, True),
          "step-up": (1.2, False), "step-away": (1.2, False), "hum": (4.01, False),
          "nimrod-step": (0.08, True), "whirlwind-notch": (0.12, True), "whirlwind-bounce": (0.06, True),
          "prinz-cursor": (0.05, True), "nimrod-win": (2.05, True), "nimrod-lose": (2.05, True),
          "whirlwind-over": (2.05, True), "whirlwind-drop": (1.5, True), "prinz-think": (3.1, True),
          "prinz-mate": (0.7, True), "prinz-refuted": (0.5, True), "prinz-reset": (0.9, True)}
# Takes of one sound: how many there are. They must differ in waveform and match in loudness.
TAKE_COUNTS = {"notch": 4, "bertie-key": 3, "nimrod-step": 4, "whirlwind-notch": 4, "whirlwind-bounce": 4, "prinz-cursor": 3}
SIZE_LIMIT_KB = 1200


def encode(x, path: Path, tmp: Path) -> np.ndarray:
    """Write AAC with afconvert, then decode it again: the decoded audio is what the page plays."""
    wav = tmp / (path.stem + ".wav")
    sf.write(wav, x, SR, subtype="PCM_24")
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", str(wav), str(path)], check=True)
    back = tmp / (path.stem + ".back.wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI24", str(path), str(back)], check=True)
    y, sr = sf.read(back)
    assert sr == SR
    return y


def measure(x, sr) -> dict:
    peak = np.abs(x).max()
    spec = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    total = spec.sum()
    return {
        "len": len(x) / sr,
        "peak": 20 * np.log10(peak),
        "rms": 10 * np.log10(np.mean(x ** 2)),
        "onset": 1000 * np.argmax(np.abs(x) >= 0.25 * peak) / sr,     # first sample at a quarter of the peak
        "bands": [100 * spec[(f >= a) & (f < b)].sum() / total for a, b in ((0, 150), (150, 2000), (2000, 4000), (4000, 1e9))],
        "dc": abs(x.mean()),
        "tail": 20 * np.log10(np.abs(x[-int(0.005 * sr):]).max() + 1e-9),
    }


def take_correlation(a, b) -> float:
    """The best normalised cross-correlation of two takes at any shift up to 5 ms."""
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    full = np.correlate(a, b, "full")[n - 1 - 220:n + 220]
    return float(np.abs(full).max() / np.sqrt((a ** 2).sum() * (b ** 2).sum()))


def check_hum(x, sr, bad):
    """Is the loop point clean? Compare the seam with the rest of the loop three ways."""
    step = np.abs(np.diff(x))
    jump = abs(x[0] - x[-1])
    print(f"\nhum loop: jump across the seam {jump:.5f}; steps inside the loop: median {np.median(step):.5f}, "
          f"99th percentile {np.percentile(step, 99):.5f}")
    if jump > np.percentile(step, 99):
        bad.append("hum: the seam jumps more than 99% of ordinary steps")

    # Spectrum of 0.5 s centred on the seam against the same window everywhere else in the loop.
    w = sr // 2
    edges = [0, 150, 500, 1000, 2000, 4000, sr / 2]
    f = np.fft.rfftfreq(w, 1 / sr)

    def bands(seg):
        s = np.abs(np.fft.rfft(seg * np.hanning(w))) ** 2
        return np.array([10 * np.log10(s[(f >= a) & (f < b)].sum() + 1e-20) for a, b in zip(edges, edges[1:])])

    seam = bands(np.concatenate([x[-w // 2:], x[:w // 2]]))
    inside = np.array([bands(x[i:i + w]) for i in range(0, len(x) - w, w // 4)])
    lo, hi, mean = inside.min(0), inside.max(0), inside.mean(0)
    print("hum loop: band level at the seam, dB relative to the loop's mean (range inside the loop):")
    for k, (a, b) in enumerate(zip(edges, edges[1:])):
        print(f"  {a:5.0f}-{b:5.0f} Hz  seam {seam[k] - mean[k]:+5.1f}   inside {lo[k] - mean[k]:+5.1f} .. {hi[k] - mean[k]:+5.1f}")
        if not lo[k] - 1.5 <= seam[k] <= hi[k] + 1.5:
            bad.append(f"hum: the seam's {a:.0f}-{b:.0f} Hz band is outside the loop's own range")

    # A click is a burst of highs. Compare 10 ms of highs at the seam with every other 10 ms.
    y = np.concatenate([x, x])
    highs = sosfilt(butter(4, 2500, "highpass", fs=sr, output="sos"), y)[len(x) // 2:len(x) // 2 + len(x)]
    blk = sr // 100
    e = 10 * np.log10(np.mean(highs[:len(highs) // blk * blk].reshape(-1, blk) ** 2, axis=1))
    seam_e = e[len(e) // 2 - 1:len(e) // 2 + 1].max()         # the seam sits in the middle of this window
    print(f"hum loop: highs in the 20 ms around the seam {seam_e:.1f} dB; all 10 ms blocks: median {np.median(e):.1f}, max {e.max():.1f}")
    if seam_e > np.percentile(e, 99.5) + 1:
        bad.append("hum: a burst of highs at the seam (a click)")

    # Steady: no 250 ms stretch may stand out, or the 4 s repeat would be heard as a rhythm.
    r = np.array([10 * np.log10(np.mean(np.roll(x, -i)[:sr // 4] ** 2)) for i in range(0, len(x), sr // 8)])
    print(f"hum loop: 250 ms RMS ranges {r.min():.1f} .. {r.max():.1f} dBFS")
    if r.max() - r.min() > 2.0:
        bad.append("hum: level wanders more than 2 dB inside the loop")


def main():
    sounds = build()
    OUT.mkdir(exist_ok=True)
    for old in OUT.iterdir():
        old.unlink()
    played, manifest, bad = {}, {}, []
    with tempfile.TemporaryDirectory() as tmp:
        for name, x in sounds.items():
            if name == "hum":
                manifest[name] = "hum.wav"
                sf.write(OUT / "hum.wav", x, HUM_SR, subtype="PCM_16")
                played[name] = (sf.read(OUT / "hum.wav")[0], HUM_SR)
            else:
                manifest[name] = name + ".m4a"
                played[name] = (encode(x, OUT / manifest[name], Path(tmp)), SR)
    (OUT / "sounds.json").write_text(json.dumps(manifest, indent=1) + "\n")

    print("Measured on the files as the page will decode them (AAC decoded again; the hum's WAV read back).")
    print("Onset is the first sample at a quarter of the peak. Bands are shares of the energy.\n")
    print("| sound | length s | peak dBFS | RMS dBFS | onset ms | <150 Hz | 150-2k | 2k-4k | >4k | file KB |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    stats = {}
    for name, (y, sr) in played.items():
        m = stats[name] = measure(y, sr)
        size = (OUT / manifest[name]).stat().st_size
        b = m["bands"]
        print(f"| {name} | {m['len']:.3f} | {m['peak']:.1f} | {m['rms']:.1f} | {m['onset']:.1f} | "
              f"{b[0]:.0f}% | {b[1]:.0f}% | {b[2]:.0f}% | {b[3]:.0f}% | {size / 1024:.1f} |")
        group = next((g for g in LIMITS if name.startswith(g)), None)
        longest, click = LIMITS.get(group, (1.25, True))
        if m["len"] > longest:
            bad.append(f"{name}: {m['len']:.2f} s is longer than {longest} s")
        if click and m["onset"] > 5:
            bad.append(f"{name}: onset {m['onset']:.1f} ms")
        if m["peak"] > CEILING_DB:
            bad.append(f"{name}: peak {m['peak']:.1f} dBFS")
        if m["dc"] > 1e-3:
            bad.append(f"{name}: DC offset {m['dc']:.4f}")
        if name != "hum" and m["tail"] > -60:
            bad.append(f"{name}: last 5 ms at {m['tail']:.1f} dBFS")
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"\ntotal size of sound/out: {total / 1024:.0f} KB in {len(list(OUT.iterdir()))} files")
    if total > SIZE_LIMIT_KB * 1024:
        bad.append(f"sound/out is over {SIZE_LIMIT_KB} KB")

    print("\ntakes: best correlation between any two, and the spread of their RMS")
    for group, count in TAKE_COUNTS.items():
        names = [f"{group}-{k + 1}" for k in range(count)]
        cors = [take_correlation(played[a][0], played[b][0]) for i, a in enumerate(names) for b in names[i + 1:]]
        rms = [stats[n]["rms"] for n in names]
        print(f"  {group}: correlation {min(cors):.2f} .. {max(cors):.2f}; RMS spread {max(rms) - min(rms):.2f} dB")
        if max(cors) > 0.9:
            bad.append(f"{group}: two takes correlate at {max(cors):.2f}")
        if max(rms) - min(rms) > 1.5:
            bad.append(f"{group}: takes differ by {max(rms) - min(rms):.1f} dB")

    if abs(stats["hum"]["rms"] - HUM_RMS_DB) > 0.5:
        bad.append(f"hum: RMS {stats['hum']['rms']:.1f} dBFS")
    check_hum(*played["hum"], bad)

    if bad:
        print("\nFAILED CHECKS:\n  " + "\n  ".join(bad))
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    main()
