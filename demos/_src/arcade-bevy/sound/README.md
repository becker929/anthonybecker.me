# Sounds

The arcade room's sound effects for five machines (the first cabinet, Bertie, Nimrod, Whirlwind and Prinz), built offline in Python from recorded samples. Nobody has heard them yet. They were made and checked by measurement only.

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

- Names ending in a number are takes of one sound: `notch-1..4`, `bertie-key-1..3`, `nimrod-step-1..4`, `whirlwind-notch-1..4`, `whirlwind-bounce-1..4`, `prinz-cursor-1..3`. The game asks for the name without the number. Play the takes in turn.
- `hum` goes in an `AudioBufferSourceNode` with `loop = true`. It is quiet in the file (-30 dBFS RMS). The game scales it by how near the player stands.
- Every other name is a one-shot.
- Levels are set against each other in the files: the bounce, cursor, step and notch takes quietest, fire, hit and win loudest. Play them all at the same gain to keep that.
- File names are plain, not named by content. If the folder is cached for long, a rebuilt sound will not reach returning players.

## Two kinds of sound

- Mechanical (plungers, keys, detents, relays, contactors, bells): heard from the cabinet itself, full range, with real low thump. Made from foley and percussion one-shots, cut short and pitched down by resampling.
- Electrical (static, crackle, discharge, hum): heard through a small paper-cone speaker. Band-limited to about 250 Hz - 4 kHz at 12 dB per octave, with mild saturation. Made from texture recordings.

Synthesis is support only: a falling sine under each thump, and 60 and 120 Hz sines under the recorded hum. The room is four early reflections within 31 ms, 22 dB down. There is no reverb tail. The notch, dial, keys, dud, refused and step sounds are dry, and so are the new repeated takes, the buzzers, the hooter and the stops.

Shared parts, used below:

- relay: two short clicks 4-8 ms apart (armature, then contact) drawn from Perc Knock Rattle, Wood Tip Tag, Wood MS, Clap Snap Fings, Rimshot Serendipity of Surprise and E-Perc Metal Chop, pitched down 2-9 semitones, with E-Perc Click Unsounded as a dull body.
- contactor: the bolt of Foley Door Lock (the loud event 0.36 s into the file) pitched down, with Wood MPC 4 as a wooden body.
- thump: Kick Thud low-passed at 400 Hz, with a sine falling from about 85 to 48 Hz under it.
- plunger: Perc Snap Tap (the cap), Wood Clog Medium (the stop), and the thump.
- static: Static Sunny Eve with its loud pops squashed, through the speaker filter.
- crackle: Vinyl Dirt 2 through the speaker filter, pops kept.
- discharge: Crackle Tuning plus FX Broken Box, saturated hard, through the speaker filter.
- hum voice: Noise Amp Hum (a 50 Hz recording) resampled to exactly 60 Hz. Its harmonics are lifted by a soft clip and a rectifier curve, and only the part above 150 Hz is added back, so a laptop speaker has something to play.

Added for the three 1951 machines:

- hum glide: the hum voice gliding between two pitches under a swell, band-limited to 60 Hz - 3 kHz. Lamps warming, power dropping.
- tick: a relay's armature click alone, with no contact tack, for sounds that repeat many times.
- clack: a boxwood chess piece on a board. Wood Clack down 3 (the piece), Wood Block Low down 2 (the board), Wood Dry Low down 5.
- buzz: Buzz Noise (a recorded 50 Hz mains buzz, the slice from 4 s) repitched, through the speaker filter and saturated.
- hoot: a note of the Mark 1's hooter. Organ Tonewheel C3 repitched to the note, through the speaker filter and saturated so its edges square up, switched on in 1.5 ms and off in 15 ms.

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

Nimrod:

| name | what it is | made of |
|---|---|---|
| `nimrod-step-1..4` | one step of the machine's work, 6-8 a move | One armature tick, a different click each take (Wood Tip Tag, Clap Snap Fings, Rimshot Serendipity of Surprise, E-Perc Metal Chop, down 2-6), E-Perc Click Unsounded under it, and E-Perc Tube 1 down about 9 as a filament tick 24 dB under. 55 ms, high-passed at 200 Hz, dry. |
| `nimrod-press` | a desk button took | Perc Snap Tap down 2 (the bakelite), Wood MPC 3 down 6 (the body), a short thump. Four relays 26-30 ms apart from 30 ms, falling a little, as the lamps go out. |
| `nimrod-refused` | a press that does nothing | Wood Under The Rug down 7, Wood Clog Medium down 9, a thump, low-passed at 1.8 kHz. No relay. |
| `nimrod-move` | the machine's move puts lamps out | Six relays inside 8 ms and a contactor down 4. Three contact bounces at 25, 45 and 70 ms. Metallic Rattle down 7, low-passed, dying in 0.25 s. |
| `nimrod-win` | the visitor wins | Fourteen relays rising in pitch, the gaps widening from 22 to 65 ms as they settle. A contactor at 0.55 s, and the hum glide rising 3 semitones to pitch, swelling for 0.35 s. Faint static. No bell. |
| `nimrod-lose` | the machine wins | Contactors down 6 and down 9, 0.3 s apart, each with a thump, and a relay. The hum glide falls 9 semitones over 1.5 s. |
| `nimrod-deal` | a new position, and stepping up | Twelve relays 25-45 ms apart, rising a little. The hum glide swells in under them and settles by 1 s. |
| `nimrod-switch` | the game switch thrown | A contactor down 1 and Wood Clack down 4 (the lever over centre), a thump, and E-Perc Spring down 4 ringing for 0.35 s. |
| `nimrod-comp` | COMP. MOVE pressed and taken | The plunger down 5, low-passed at 1.4 kHz for a soft rubber stop. A relay at 80 ms. |

Whirlwind:

| name | what it is | made of |
|---|---|---|
| `whirlwind-notch-1..4` | a knob moves a notch | Wood Clack down 4-6 and Perc Knock Rattle down 7-10 (the detent), Metallic High Short down 11-12.5 (about 2.7 kHz) 16-18 dB under as the ring of steel. 90 ms, dry. |
| `whirlwind-stop` | a knob against its end | Wood Under The Rug down 6, Perc Knock Rattle down 10, a thump, low-passed at 1.5 kHz. No ring. |
| `whirlwind-release` | the ball is released | The plunger down 3, Clave Spring down 6 ringing under it. A contactor and a relay pull in at 70 ms. |
| `whirlwind-bounce-1..4` | each bounce, 2-11 a ball | An armature tick, a different click each take (Wood Tip Tag, Wood MS, Clap Snap Fings, Perc Knock Rattle, down 2.5-4), and Click Vinyl through the speaker filter 9 dB under as the tick on the tube. 35 ms, dry, the quietest sound here. |
| `whirlwind-drop` | the ball goes through | Six relays in 0.15 s. Tube Hit down 4 (near 700 Hz) as the steel rod, with a copy 8 cents flat, damped to about 1 s. A relay with it. |
| `whirlwind-miss` | a ball misses | A relay, 0.25 s of the buzz at about 60 Hz (its harmonics carry it), a relay letting go. |
| `whirlwind-over` | the fifth miss | A contactor, then six relays falling from down 3 to down 10, the gaps widening to 0.35 s. The hum glide falls 9 semitones over 1.8 s. Static fades. |
| `whirlwind-hole` | a new hole is set up | Five stepping-switch steps 55 ms apart: Perc Knock Rattle down 5 with E-Perc Metal Chop as the pawl, at one pitch. A light contactor seats it. |
| `whirlwind-refused` | the plunger while a ball is out | Wood Under The Rug down 5, Wood Clog Medium down 8, a thump, Metallic Rattle down 6 as the small rattle, low-passed at 2.6 kHz. |
| `whirlwind-reset` | a new run | A contactor down 2 and Wood Clack down 5 (the toggle), a thump, E-Perc Spring ringing. Five relays over 0.45 s, the gaps widening. |

Prinz:

| name | what it is | made of |
|---|---|---|
| `prinz-select` | a piece picked up or put back | Wood Tip Tag down 2 and Wood Dry Low down 3 (the tick), Perc Wood Scratch band-limited to 300 Hz - 2.5 kHz, 14 dB under (the felt scuff). Low-passed at 4 kHz. |
| `prinz-place` | the visitor's piece set down | The clack, a little thump, a quieter room (24 dB down). |
| `prinz-capture` | a piece taken | The clack up 1. The taken piece onto baize at 130 ms: Wood Under The Rug down 4, low-passed at 900 Hz, with a soft thump, and a smaller bounce at 190 ms. |
| `prinz-refused` | a square that cannot be chosen | A contactor down 9 and a thump, low-passed at 1.5 kHz. |
| `prinz-think` | the machine searches | 3 s. About 65 relays at random, 15-75 ms apart, levels spread over 9 dB. Five uniselector runs of 6-10 steps 25 ms apart, each at one pitch. The hum glide and static, faint. A fade over the last 0.3 s. |
| `prinz-reply` | the machine moves a Black piece | A relay, then the clack down 2 and a thump at 90 ms. |
| `prinz-mate` | the visitor mated | The hooter: 417 Hz for 0.26 s, then 521 Hz for 0.30 s (a major third up; both whole fractions of a 4.17 kHz pulse rate, as the Mark 1's notes were). A relay keys it. |
| `prinz-refuted` | a wrong move shown | 0.38 s of the buzz an octave up, at 100 Hz (a 50 Hz buzzer), saturated harder. A relay starts it and one lets it go. |
| `prinz-reset` | the pieces go back | Fourteen small clacks from Wood Clack, Wood Dry Low, Wood Tip Tag and Wood MS, 25-60 ms apart, quieter as they go. Sticks Rattle, low-passed at 3 kHz, under the first half. |
| `prinz-next` | the big button sets the next problem | The plunger down 4, a contactor down 4 at 12 ms, a thump. |
| `prinz-cursor-1..3` | the keyboard's square moves | A tiny tick (E-Perc Metal Chop, Wood Tip Tag or Rimshot Serendipity of Surprise) with Perc Knock Rattle, high-passed at 400 Hz. 28 ms, dry. |

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
| nimrod-step-1 | 0.065 | -19.6 | -39.7 | 0.2 | 0% | 85% | 7% | 8% | 4.5 |
| nimrod-step-2 | 0.065 | -19.0 | -39.7 | 0.2 | 0% | 74% | 20% | 6% | 4.5 |
| nimrod-step-3 | 0.065 | -19.5 | -39.7 | 0.2 | 0% | 33% | 55% | 12% | 4.5 |
| nimrod-step-4 | 0.065 | -21.8 | -39.7 | 0.1 | 0% | 72% | 26% | 2% | 4.6 |
| nimrod-press | 0.305 | -8.9 | -28.1 | 0.2 | 63% | 29% | 7% | 1% | 6.7 |
| nimrod-refused | 0.160 | -12.1 | -28.4 | 1.1 | 48% | 52% | 0% | 0% | 4.7 |
| nimrod-move | 0.405 | -7.2 | -30.2 | 1.4 | 25% | 63% | 11% | 2% | 6.0 |
| nimrod-win | 1.895 | -6.0 | -27.0 | 0.3 | 9% | 71% | 15% | 6% | 27.6 |
| nimrod-lose | 1.795 | -7.0 | -30.7 | 0.3 | 55% | 40% | 4% | 1% | 18.8 |
| nimrod-deal | 1.095 | -9.0 | -28.8 | 0.5 | 6% | 74% | 16% | 4% | 15.9 |
| nimrod-switch | 0.425 | -8.0 | -28.9 | 0.2 | 64% | 25% | 4% | 8% | 7.2 |
| nimrod-comp | 0.285 | -9.0 | -26.3 | 1.3 | 60% | 39% | 1% | 0% | 5.7 |
| whirlwind-notch-1 | 0.100 | -16.0 | -35.8 | 0.2 | 1% | 83% | 12% | 4% | 4.9 |
| whirlwind-notch-2 | 0.100 | -15.0 | -35.9 | 0.2 | 1% | 77% | 4% | 17% | 4.9 |
| whirlwind-notch-3 | 0.100 | -16.0 | -35.9 | 0.2 | 1% | 85% | 12% | 2% | 4.8 |
| whirlwind-notch-4 | 0.100 | -15.1 | -35.9 | 0.2 | 1% | 78% | 11% | 10% | 4.9 |
| whirlwind-bounce-1 | 0.045 | -23.5 | -42.1 | 0.2 | 0% | 84% | 8% | 8% | 4.3 |
| whirlwind-bounce-2 | 0.045 | -23.5 | -42.1 | 0.1 | 0% | 71% | 28% | 1% | 4.3 |
| whirlwind-bounce-3 | 0.045 | -23.4 | -42.1 | 0.2 | 0% | 72% | 22% | 6% | 4.3 |
| whirlwind-bounce-4 | 0.045 | -20.9 | -42.0 | 0.3 | 0% | 91% | 7% | 2% | 4.3 |
| whirlwind-stop | 0.120 | -14.0 | -31.0 | 1.1 | 37% | 63% | 0% | 0% | 4.6 |
| whirlwind-release | 0.405 | -6.0 | -24.9 | 1.0 | 54% | 38% | 7% | 1% | 6.8 |
| whirlwind-drop | 1.345 | -6.2 | -28.4 | 0.6 | 4% | 80% | 14% | 2% | 14.0 |
| whirlwind-miss | 0.340 | -9.9 | -29.6 | 0.3 | 2% | 92% | 4% | 2% | 7.4 |
| whirlwind-over | 1.995 | -7.0 | -28.5 | 0.3 | 13% | 75% | 10% | 2% | 24.1 |
| whirlwind-hole | 0.350 | -10.0 | -32.1 | 0.6 | 7% | 77% | 11% | 5% | 7.9 |
| whirlwind-refused | 0.190 | -10.0 | -27.4 | 0.9 | 46% | 54% | 0% | 0% | 5.0 |
| whirlwind-reset | 0.725 | -7.0 | -29.1 | 0.2 | 51% | 36% | 8% | 4% | 9.9 |
| prinz-select | 0.150 | -15.0 | -36.2 | 0.3 | 1% | 83% | 12% | 4% | 4.8 |
| prinz-place | 0.215 | -8.0 | -28.3 | 0.2 | 29% | 41% | 10% | 20% | 5.4 |
| prinz-capture | 0.405 | -8.1 | -30.2 | 0.2 | 29% | 47% | 9% | 15% | 6.2 |
| prinz-refused | 0.170 | -12.0 | -27.8 | 0.5 | 65% | 34% | 1% | 0% | 5.3 |
| prinz-think | 3.045 | -8.0 | -28.6 | 0.3 | 5% | 74% | 17% | 4% | 51.0 |
| prinz-reply | 0.315 | -7.9 | -28.1 | 0.5 | 35% | 47% | 10% | 8% | 6.3 |
| prinz-mate | 0.630 | -14.0 | -20.4 | 0.6 | 0% | 94% | 4% | 2% | 11.5 |
| prinz-refuted | 0.460 | -17.0 | -24.3 | 0.6 | 1% | 99% | 0% | 0% | 10.0 |
| prinz-reset | 0.845 | -9.1 | -29.0 | 0.2 | 1% | 67% | 12% | 20% | 12.8 |
| prinz-next | 0.385 | -7.1 | -23.7 | 1.0 | 76% | 21% | 2% | 1% | 6.2 |
| prinz-cursor-1 | 0.038 | -24.1 | -40.8 | 0.1 | 0% | 41% | 43% | 16% | 4.4 |
| prinz-cursor-2 | 0.038 | -22.5 | -40.9 | 0.2 | 0% | 83% | 8% | 8% | 4.3 |
| prinz-cursor-3 | 0.038 | -22.0 | -40.8 | 0.2 | 0% | 27% | 57% | 16% | 4.3 |

Total: 803 KB in 67 files (66 sounds and the manifest). The hum is 188 KB of that, `prinz-think` 51 KB. The script fails above 1200 KB.

Checks the script runs, all passing:

- No file peaks above -3 dBFS after AAC. No DC offset. The last 5 ms of every one-shot is under -60 dBFS.
- Every sound that starts with a click reaches a quarter of its peak within 2 ms (the new ones within 1.4 ms). `step-up` and `step-away` start with static by design, so their thunks come at 62 and 100 ms.
- Takes: the notch takes correlate at 0.45-0.88 with each other and their RMS is within 0.1 dB. The key takes correlate at 0.71-0.83 and match in RMS. `nimrod-step` 0.24-0.56, `whirlwind-notch` 0.48-0.77, `whirlwind-bounce` 0.32-0.76, `prinz-cursor` 0.28-0.37, each within 0.11 dB in RMS. So they differ in waveform and match in loudness. The script fails a pair above 0.9 or a spread above 1.5 dB.
- Hum loop point: the jump from the last sample to the first is 0.0037. The median step between neighbouring samples inside the loop is 0.0073, so the seam is a smaller step than most.
- Hum spectrum across the seam: half a second centred on the seam is within 0.6 dB of the loop's mean in all six bands, inside the range the loop shows everywhere else.
- Hum clicks: the highs in the 20 ms around the seam are at -39.4 dB. The median 10 ms block is -40.3 and the loudest is -36.9. There is no burst at the seam.
- Hum steadiness: RMS over any 250 ms stays between -30.5 and -29.6 dBFS. The crackle's pops are spread over 21 places in the loop, so no single pop marks the repeat.

What the numbers imply:

- The hum is 48% below 150 Hz and 41% in 150 Hz - 2 kHz. 93% of that mid band sits on exact multiples of 60 Hz. So on speakers with no bass it is still a hum, not just hiss.
- `fire`, `hit`, the keys and `ground` carry 40-67% of their energy below 150 Hz. On a phone that part is lost and what remains is the click, the crackle and the clack. They will sound smaller there, but not empty.
- The bells (`wave`, `bertie-win`, `bertie-lose`) are almost all in 150 Hz - 4 kHz, so they will sound the same on anything.
- `prinz-mate` and `prinz-refuted` are steady tones, so they are dense: their peaks are set low (-14 and -17 dBFS) to put their RMS (-20 and -24 dBFS) near the loudest one-shots, not 10 dB above them.
- The repeated sounds are the quietest in the room: bounce and cursor near -41 dBFS RMS, step -40, the Whirlwind notch -36, against -24 to -31 for the one-shots.

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
- The three 1951 machines, most likely wrong first:
  1. `prinz-mate`: a tonewheel organ squared by saturation may sound like an organ or a modern square-wave beep, not the Mark 1's hooter. The notes (417 and 521 Hz, rising) are a choice, not the historical tune.
  2. `prinz-think`: 3 s of random relays may read as rain or a typewriter, not a machine working. The uniselector runs are short and may not stand out.
  3. `whirlwind-bounce`: a relay tick plus a vinyl click. It may sound like a mechanical tick only, not something on a tube, or be too quiet to hear under the hum.
  4. `prinz-place`, `prinz-capture`, `prinz-reply`, `prinz-reset`: the clack is drum-machine wood blocks. It may sound like a wood block, not a weighted chess piece on a board.
  5. `prinz-refuted` and `whirlwind-miss`: the recorded buzz through the speaker filter may sound like a bad cable, not a buzzer.
  6. `nimrod-win`: relays and a hum swell, with no bell or tone, may not read as a win at all.
  7. `prinz-cursor`: the three takes differ a lot in balance (27-83% in 150 Hz - 2 kHz), so they may sound like three different things.
- How a browser decodes the AAC. `afconvert` trims the encoder's padding when decoding and the onsets above rely on that. Safari and Chrome should do the same with `decodeAudioData`, but that was not tested.
- The loop was checked on the samples, not in a real `AudioBufferSourceNode`. If the AudioContext is not at 24 kHz the browser resamples the buffer, and the seam after resampling was not checked.
