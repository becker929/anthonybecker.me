# What to do next

Written 11 September 2026. Short on purpose.

## 1. Keep the Mac awake, by default

The rig lost one bounce to sleep and one to the lock screen. Make awake the
default, not something a script has to fight for.

- Plug into power. Leave the lid open.
- System Settings, Lock Screen: "Turn display off on power adapter" set to
  Never. "Require password after screen saver begins" set to Never, or as long
  as it allows, while runs are going.
- System Settings, Displays, Advanced: "Prevent automatic sleeping on power
  adapter when the display is off" on.
- One durable command, once: `sudo pmset -c sleep 0 disksleep 0 displaysleep 0`
- Belt and braces: open a Terminal window, run `caffeinate -dis`, and leave
  it. The Live agent should also wrap every long run in `caffeinate -dis`,
  which it already started doing.
- Leave Live open on the clone. Do not quit it between runs.

## 2. How the two agents work together

Two agents, two machines, one rule: audio stays yours, only numbers get
published. Audio moves from your Mac to your own Drive to the research
agent's container, where it is measured and then dies with the container.
Nothing audio ever goes to the site or anywhere public. The site gets numbers.

- The research agent (the web session) writes job specs, reads results,
  measures, and publishes. It never touches the Mac.
- The Live agent (on the Mac) runs jobs against Live, writes stems and
  sidecars, and packs a zip. It never publishes anything. The only place
  your audio goes is your own Drive.
- Specs flow one way: the research agent publishes them at
  `anthonybecker.me/research/sound-function/repo/research/specs/` and writes
  you a prompt to paste. Results flow the other way: the Live agent leaves a
  zip on your Mac, you drop it in the Drive folder
  `claude-research-2026-09-06/tracks/` (or paste a link), and the research
  agent fetches it.
- Every job has an id like `live_multitrack_bounce_v1`. The zip, its
  MANIFEST.md, and the research write-up all carry the same id, so nothing has
  to be matched by memory.
- If the Live agent hits something the spec did not foresee, it writes it in
  MANIFEST.md under "things that fought us" and carries on. That section is
  how the spec gets fixed for next time. It worked well this round.

## 3. The next Live job, ready to paste

This is the one that turns every published pump number from a floor into a
value, and settles the split-duck question for your track exactly.

```
Bounce HW002_14 track 3 ("rumble") twice from the same clone, same
arrangement, same length: once exactly as it is, and once with ONLY the
LFOTool device bypassed (device on = 0). Change nothing else. Name them
03__rumble.wav and 03__rumble__lfotool-off.wav, each with a sidecar. This
time also record LFOTool's parameter values in the sidecar, not just its
name, so we can see whether it is shaping volume or a filter. Wrap the run
in caffeinate -dis. Pack as live_rumble_bypass_v1.zip with a MANIFEST.md in
the same style as last time, and leave it on the Mac for Anthony.
```

## 4. Things only you can do

In order of how much they unblock.

1. Paste the job above into the Live agent. About an hour of rig time.
2. Drop the resulting zip into the Drive folder, or paste a link here.
3. Do the listening test once with the new sounds. Thirty-one pairs, about
   fifteen minutes. Your three earlier answers were against the old set.
4. Make one track with a target in mind, using the clipper table: pick a
   crest, set the value, bounce it, put it in Drive. That closes the loop
   once, by hand, before the machine does it.
5. Optional: set the `LAB_TOKEN` secret on the site so the runner can post
   results without me. Not needed for anything above.
