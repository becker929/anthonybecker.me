# The video library

Anthony's rule, 12 November 2026: everything built on this Mac for his vibe-coded websites gets videos. A job runs every two hours. It looks for merged work with no films, makes three films for each new subject, puts them in R2, and lists them at https://anthonybecker.me/videos/. The films are for sharing on Bluesky.

## The three films

| Style | Frame | Length | What it is |
|---|---|---|---|
| `calm` | 1920x1080 | about a minute | A quiet documentary. It uses slow camera moves, long dissolves, a serif title and lower third, and data cards that count up. Narration and subtitles play over soft pads. |
| `hype` | 1920x1080 | about half a minute | A DIY hype cut. Its grammar is drawn fresh for every film (see below). |
| `short` | 1080x1920 | 10 seconds | One idea, said and shown: a hook, big kinetic words, a progress bar and the site's name. |

### Why the hype grammar is drawn

Anthony said the usual hype video "cannot just be the Claude top-of-your-head style. Those have gotten very repetitive online." So `grammar.js` holds the choices as catalogues, and `drawHype` draws one of each for every film:

- 14 shot types: push, pull, macro, dutch, whip, crash zoom, handheld, split screens, a grid, mirror, picture in picture, freeze-frame sticker.
- 16 transitions: dissolve, dips, flash, whip pans, push, slide, iris, diagonal wipe, luma, glitch slices, zoom-through, spin, blinds, pixel.
- 15 effects, such as RGB split, pixelate, posterize, scanlines, halftone, duotone, VHS, strobe, trails and bloom.
- Fonts from five families installed on this Mac.
- 8 caption styles: stroke, box, type, kinetic, stamp, ticker, label, sticker.
- 8 colour grades and 8 palettes.
- 7 cut methods: on the beat, on the bar, accelerating, stutter, jump, match and off-beat.
- 6 beats for the music: breakbeat, four-floor, half-time, jungle, boom-bap and gallop.
- Letterbox and speed ramps, each on or off.

Each hype film's choices are saved as a fingerprint in the library index. The next films draw from what the last eight did not use, and fall back to used choices only when nothing else is left.

## Making a subject's films by hand

```
W=~/_agent_scratch/videos/<slug>; mkdir -p $W     # write $W/subject.json (below)
node videos/_src/make.mjs $W                       # footage, voice, edits, frames, sound, MP4s
node videos/_src/publish.mjs $W                    # R2 and the index
```

`make.mjs` runs these steps, and skips any whose output is already there:

1. `capture.mjs` films each shot in Chrome, wide and tall, from Chrome's screencast. The browser is muted, so nothing plays on this Mac's speakers.
2. `narrate.py` speaks the narration with Kokoro (af_heart), from zpkt's voice package.
3. `direct.mjs` writes each style's edit decision list.
4. `shoot.mjs` paints every frame with `edit.html` and `edit.js`.
5. `music.mjs` renders the music; ffmpeg lays the voice over it and ducks the music under the voice.
6. ffmpeg encodes `<style>/<style>.mp4` and a poster.

Other tools:

- `node subjects.mjs [since]` lists merged pull requests with no films.
- `node skip.mjs "<reason>" <pr url>...` marks work that needs none.

### subject.json

```json
{
  "slug": "arcade-of-firsts",            "title": "An arcade of the first electronic games",
  "short_title": "The arcade",            "hook": "5 machines. 1 day.",
  "when": "12 November 2026",             "repo": "becker929/anthonybecker.me",
  "prs": ["https://github.com/becker929/anthonybecker.me/pull/107"],
  "url": "https://arcade.anthonybecker.me/", "site": "arcade.anthonybecker.me",
  "pitch": "One sentence for the library page.",
  "lower": "the lower third's second line",
  "facts": [{ "label": "machines", "value": 5 }],          "barsTitle": "One day of work, counted",
  "timeline": [{ "when": "1947", "label": "..." }],         "timelineTitle": "...",
  "narration": { "calm": ["6 to 9 sentences"], "short": ["2 short sentences"] },
  "captions": { "hype": ["4 to 7 short lines"] },
  "shots": [
    { "key": "room", "url": "https://...", "wait": 18000, "seconds": 8, "setup": "js before filming", "during": "js while filming, may await" },
    { "key": "hero", "image": "/abs/path/to/a/render.png" },
    { "key": "clip", "video": "/abs/path/to/a/clip.mp4" }
  ]
}
```

The `prs` list is what marks the work as covered, so list every pull request the films are about. Shots should show the thing working, with motion in them: scrolling, playing, a game in progress. A 3D page needs its `wait` (the arcade loads in about 15 s).

## Storage

Everything lives in R2 bucket `anthonybecker-audio`, under `audio/video/library/`, served by the site's Worker at `/audio/video/library/...`:

- `<slug>/<style>-<hash>.mp4` and `.jpg`: the films and posters, named by content and cached for good.
- `<slug>/subject.json`.
- `index.json`: the library, newest first. It holds `videos` (each with its styles, poster, length and the hype grammar) and `skipped` (pull requests passed over, with reasons).

Media never goes in git. Work folders (`~/_agent_scratch/videos/<slug>`) hold the footage and frames; they can be deleted once the films are published.

## The job

A scheduled task in the Claude desktop app (`video-library`, every two hours) runs the steps above. Its prompt is the source of truth for what it does. It makes at most two subjects a run, checks each film by numbers, has one contact sheet looked at, publishes, and sends one phone notification when something new is up.
