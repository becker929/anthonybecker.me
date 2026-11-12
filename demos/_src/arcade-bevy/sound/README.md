# Sounds

The arcade room's sound effects, built offline in Python from recorded samples. Nobody has heard them yet. They were made and checked by measurement only.

## Run

```
uv run --with numpy --with scipy --with soundfile python sound/make.py
```

It needs macOS (`afconvert` encodes the AAC) and Ableton Live's Core Library on disk. It only reads the sample files. It never opens or talks to Live.

It writes `sound/out/` and prints the measurements. It exits 1 if a check fails. `sound/out/` is never committed: audio does not go in git.

The audio it builds is the same on every run (fixed seeds; the arrays hash the same three runs in a row). `hum.wav` and `sounds.json` are byte-identical between runs. The `.m4a` files differ by six bytes of timestamp, and in one comparison one file's decoded audio differed slightly, so the AAC encoder is not perfectly repeatable.

## What is in `sound/out/`

- `sounds.json`: name -> file name. The page plays sounds by these names.
- One `.m4a` per one-shot: AAC, mono, 44.1 kHz, `afconvert -f m4af -d aac -b 128000`.
- `hum.wav`: 16-bit mono WAV, 24 kHz, 4.000 s. It is a WAV because AAC pads a file with silence and a padded file cannot loop.

## How the page uses them

- Names ending in a number are takes of one sound: `notch-1..4`, `bertie-key-1..3`. Play them in turn.
- `hum` goes in an `AudioBufferSourceNode` with `loop = true`. It is quiet in the file (-30 dBFS RMS). The game scales it by how near the player stands.
- Every other name is a one-shot.
- Levels are set against each other in the files: notch and dial quietest, fire, hit and win loudest. Play them all at the same gain to keep that.
- File names are plain, not named by content. If the folder is cached for long, a rebuilt sound will not reach returning players.

## Two kinds of sound

- Mechanical (plungers, keys, detents, relays, contactors, bells): heard from the cabinet itself, full range, with real low thump. Made from foley and percussion one-shots, cut short and pitched down by resampling.
- Electrical (static, crackle, discharge, hum): heard through a small paper-cone speaker. Band-limited to about 250 Hz - 4 kHz at 12 dB per octave, with mild saturation. Made from texture recordings.

Synthesis is support only: a falling sine under each thump, and 60 and 120 Hz sines under the recorded hum. The room is four early reflections within 31 ms, 22 dB down. There is no reverb tail. The notch, dial, keys, dud, refused and step sounds are dry.

Shared parts, used below:

- relay: two short clicks 4-8 ms apart (armature, then contact) drawn from Perc Knock Rattle, Wood Tip Tag, Wood MS, Clap Snap Fings, Rimshot Serendipity of Surprise and E-Perc Metal Chop, pitched down 2-9 semitones, with E-Perc Click Unsounded as a dull body.
- contactor: the bolt of Foley Door Lock (the loud event 0.36 s into the file) pitched down, with Wood MPC 4 as a wooden body.
- thump: Kick Thud low-passed at 400 Hz, with a sine falling from about 85 to 48 Hz under it.
- plunger: Perc Snap Tap (the cap), Wood Clog Medium (the stop), and the thump.
- static: Static Sunny Eve with its loud pops squashed, through the speaker filter.
- crackle: Vinyl Dirt 2 through the speaker filter, pops kept.
- discharge: Crackle Tuning plus FX Broken Box, saturated hard, through the speaker filter.
- hum voice: Noise Amp Hum (a 50 Hz recording) resampled to exactly 60 Hz. Its harmonics are lifted by a soft clip and a rectifier curve, and only the part above 150 Hz is added back, so a laptop speaker has something to play.

## The sounds

First cabinet:

| name | what it is | made of |
|---|---|---|
| `notch-1..4` | one detent of a heavy rotary switch | Wood Tip Tag down 3.5-6.5 semitones (the ball dropping in), Perc Knock Rattle down 6-10.5 (the knob's weight), E-Perc Click Unsounded under both. 45 ms, dry. Each take moves the pitches and the balance. |
| `fire` | plunger slams, contactor clunks, the beam launches | Plunger at 0. Contactor (down 3) at 40 ms. Discharge and static from 50 ms, the band sweeping up from about 500 Hz to 2.6 kHz while it dies over 0.6 s. |
| `button-up` | the plunger's sprung return | Clave Spring down 4, and Wood Blawk down 5 as the stop 22 ms later. |
| `dud` | plunger pressed with nothing to fire | Wood Under The Rug down 5, Wood Clog Medium down 8, a little thump, all low-passed at 2.2 kHz. No contactor, no discharge. |
| `hit` | target struck, beam defocuses | The discharge as a 0.25 s burst. Thump with a sine from 95 to 42 Hz, and Kick Felt Crack. A ring: Bell Reso Noise 3 down 3 semitones, sagging 2 more as it dies, through the speaker. Static trailing off. |
| `ground` | shell lands and misses | Wood Rough Low down 4 (low-passed at 1.2 kHz) and a thump. A 0.3 s puff of static with a few crackles. |
| `wave` | wave cleared | Seven relays in 0.3 s. Bell Cash (a cash-register bell, about 1.15 kHz here) struck twice. Each strike is doubled with a copy 28 cents flat, and the second strike is 35 cents flat of the first. A relay fires with each strike. Faint static. |
| `over` | out of shells, power-down | Contactor (down 5) and a relay drop out, another relay at 0.2 s. The hum voice glides down 9 semitones over 1.6 s. Static and crackle fade. |
| `restart` | machine resets | Six relays rising in pitch with closing gaps. Contactor at 0.42 s. The hum voice rises 5 semitones to pitch and static swells, then both settle. |
| `step-up` | the player steps to the cabinet | Static rising for 0.25 s and falling for 0.4 s with a trace of hum. A soft thunk at 60 ms: Wood Rough Low down 6 under 500 Hz, and a soft thump. |
| `step-away` | the reverse, shorter | Static that is already there and drops away in 0.25 s. A lighter thunk (Wood Rough Low down 3) at 100 ms. |
| `hum` | the loop | The hum voice laid end over end on whole 60 Hz cycles so it wraps onto itself. 60 and 120 Hz sines under it. Static Sunny Eve and Noise Tape Floor through the speaker filter with every pop squashed. Vinyl Dirt 1 very low. Each noise bed has its tail cross-faded into its head. |

Bertie:

| name | what it is | made of |
|---|---|---|
| `bertie-key-1..3` | a heavy key, a relay answers | Wood MPC 3 down 4-6 semitones (the body), Perc Snap Tap (the keytop), a short thump. A relay answers at 10, 14 and 18 ms, a different one each take. |
| `bertie-lamp` | a big lamp's contactor | Contactor down 6 with a little thump. E-Perc Tube 1 down 9 (about 3.2 kHz) as the filament ping, 22 dB under, 20 ms later. |
| `bertie-win` | the player wins | Eight relays speeding up. Three bells up a major triad: Bell Brooklyn near 780 Hz, Bell Cash near 970 Hz (about 30 cents flat of the other bell, left that way), Bell Brooklyn near 1170 Hz. Each has a mistuned double. A contactor under the last. |
| `bertie-lose` | the machine wins | Four unhurried relays. Bell Tin down 7 semitones (about 430 Hz), then down 11 (about 340 Hz), soft, low-passed at 3 kHz. One relay lets go at 1.3 s. |
| `bertie-draw` | a draw | The same contactor twice, 0.15 s apart, at one pitch. Bell Tin once, down 2, damped to 0.6 s. |
| `bertie-reset` | the reset plunger | The plunger, down 2. Nine relays over 0.6 s, falling in pitch, the gaps widening. |
| `bertie-refused` | a taken square pressed | Wood Under The Rug down 6 (the clack). FX Buzz Unsounded up 4 so it sits near 120 Hz, through the speaker, saturated, 0.2 s. E-Perc Knock Buzz down 3 inside it. |
| `bertie-dial` | one position of the five-position switch | Wood Insert Cassette down 5: two knocks 40 ms apart (the wiper leaves one contact and seats on the next). E-Perc Wood Knock under the second. Perc Knock Rattle down 9. |

## Measurements

Measured on the files as the page decodes them: each `.m4a` decoded again with `afconvert`, and `hum.wav` read back. Onset is the first sample at a quarter of the peak. The bands are shares of the energy.

| sound | length s | peak dBFS | RMS dBFS | onset ms | <150 Hz | 150-2k | 2k-4k | >4k | file KB |
|---|---|---|---|---|---|---|---|---|---|
| notch-1 | 0.055 | -17.0 | -36.7 | 0.3 | 1% | 85% | 11% | 3% | 4.5 |
| notch-2 | 0.055 | -18.7 | -36.8 | 0.3 | 1% | 92% | 4% | 3% | 4.5 |
| notch-3 | 0.055 | -19.0 | -36.7 | 0.3 | 1% | 84% | 11% | 3% | 4.5 |
| notch-4 | 0.055 | -19.0 | -36.7 | 0.4 | 1% | 93% | 5% | 2% | 4.5 |
| fire | 0.683 | -4.0 | -23.4 | 0.8 | 41% | 51% | 6% | 2% | 11.0 |
| button-up | 0.245 | -13.0 | -34.8 | 0.3 | 4% | 80% | 15% | 1% | 5.5 |
| dud | 0.180 | -9.9 | -27.1 | 1.0 | 47% | 53% | 0% | 0% | 5.0 |
| hit | 0.895 | -4.1 | -26.6 | 1.9 | 49% | 43% | 7% | 1% | 11.5 |
| ground | 0.465 | -10.0 | -28.7 | 0.7 | 67% | 30% | 2% | 1% | 8.1 |
| wave | 1.845 | -6.1 | -28.0 | 0.4 | 2% | 70% | 24% | 3% | 21.5 |
| over | 1.995 | -6.9 | -30.7 | 0.3 | 20% | 72% | 6% | 2% | 23.0 |
| restart | 1.025 | -8.0 | -29.0 | 0.5 | 14% | 65% | 16% | 5% | 17.1 |
| step-up | 0.710 | -12.0 | -30.7 | 62.1 | 59% | 20% | 12% | 9% | 13.3 |
| step-away | 0.390 | -14.1 | -32.9 | 9.0 | 26% | 48% | 16% | 10% | 8.1 |
| hum | 4.000 | -16.3 | -30.0 | n/a | 48% | 41% | 7% | 4% | 187.5 |
| bertie-key-1 | 0.145 | -9.5 | -25.9 | 0.3 | 60% | 38% | 2% | 0% | 5.1 |
| bertie-key-2 | 0.145 | -9.0 | -25.9 | 0.3 | 56% | 41% | 2% | 0% | 5.2 |
| bertie-key-3 | 0.145 | -9.8 | -25.9 | 0.3 | 65% | 33% | 2% | 0% | 5.3 |
| bertie-lamp | 0.345 | -9.9 | -31.7 | 0.3 | 53% | 36% | 8% | 2% | 6.2 |
| bertie-win | 1.945 | -4.5 | -25.4 | 0.5 | 2% | 77% | 14% | 7% | 29.1 |
| bertie-lose | 1.945 | -6.5 | -28.8 | 0.3 | 1% | 93% | 4% | 1% | 23.2 |
| bertie-draw | 1.045 | -8.0 | -31.6 | 0.3 | 42% | 49% | 7% | 2% | 12.9 |
| bertie-reset | 0.865 | -6.8 | -26.1 | 0.9 | 32% | 56% | 10% | 2% | 12.8 |
| bertie-refused | 0.280 | -8.9 | -28.6 | 1.0 | 48% | 47% | 4% | 1% | 6.2 |
| bertie-dial | 0.140 | -13.0 | -30.9 | 0.2 | 1% | 84% | 14% | 1% | 5.5 |

Total: 442 KB in 26 files (25 sounds and the manifest). The hum is 188 KB of that.

Checks the script runs, all passing:

- No file peaks above -3 dBFS after AAC. No DC offset. The last 5 ms of every one-shot is under -60 dBFS.
- Every sound that starts with a click reaches a quarter of its peak within 2 ms. `step-up` and `step-away` start with static by design, so their thunks come at 62 and 100 ms.
- Takes: the notch takes correlate at 0.45-0.88 with each other and their RMS is within 0.1 dB. The key takes correlate at 0.71-0.83 and match in RMS. So they differ in waveform and match in loudness.
- Hum loop point: the jump from the last sample to the first is 0.0037. The median step between neighbouring samples inside the loop is 0.0073, so the seam is a smaller step than most.
- Hum spectrum across the seam: half a second centred on the seam is within 0.6 dB of the loop's mean in all six bands, inside the range the loop shows everywhere else.
- Hum clicks: the highs in the 20 ms around the seam are at -39.4 dB. The median 10 ms block is -40.3 and the loudest is -36.9. There is no burst at the seam.
- Hum steadiness: RMS over any 250 ms stays between -30.5 and -29.6 dBFS. The crackle's pops are spread over 21 places in the loop, so no single pop marks the repeat.

What the numbers imply:

- The hum is 48% below 150 Hz and 41% in 150 Hz - 2 kHz. 93% of that mid band sits on exact multiples of 60 Hz. So on speakers with no bass it is still a hum, not just hiss.
- `fire`, `hit`, the keys and `ground` carry 40-67% of their energy below 150 Hz. On a phone that part is lost and what remains is the click, the crackle and the clack. They will sound smaller there, but not empty.
- The bells (`wave`, `bertie-win`, `bertie-lose`) are almost all in 150 Hz - 4 kHz, so they will sound the same on anything.

## Not verified

- Nobody has heard any of this. The measurements show level, length, timing and balance. They do not show whether a relay sounds like a relay.
- Most likely to be wrong by ear, in order:
  1. `hum`: the lifted harmonics may be too buzzy (420 and 900 Hz are only 8 dB under the 60 Hz line). `harmonics=1` in `hum()` turns that down.
  2. `fire`: the discharge may read as paper tearing, not electricity. It is also 0.68 s, on the short side.
  3. `hit`: the ring is a noisy bell resonance and may sound too musical, or too little like a CRT.
  4. `bertie-refused`: the buzz is a drum-machine buzz hit through a filter. It may sound modern.
  5. `notch`: the pitch moves up to 3 semitones between takes to keep them different. It may sound like four knobs, not one.
  6. Relays everywhere: they are wood and rim clicks. They may sound wooden, not like metal contacts.
  7. `bertie-win`: three rising bells could be too cheerful for "modest".
- How a browser decodes the AAC. `afconvert` trims the encoder's padding when decoding and the onsets above rely on that. Safari and Chrome should do the same with `decodeAudioData`, but that was not tested.
- The loop was checked on the samples, not in a real `AudioBufferSourceNode`. If the AudioContext is not at 24 kHz the browser resamples the buffer, and the seam after resampling was not checked.
