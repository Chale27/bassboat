# render/ (Spinner)

Turns an approved `week/<wk>/<id>/storyboard.json` into `final.mp4` (1080x1920, 25-32 s) and `preview.jpg`. Everything on screen is drawn in code (SVG + GSAP in a HyperFrames composition): no stock footage, no copyrighted music.

## How Spinner uses it

launchd runs `node ~/BassBoat/render/queue.mjs` at 23:00 every night (`mac/com.bassboat.spinner.plist`, logs in `~/BassBoat/logs/`). The queue picks every video in `crew.json` with status `approved`, in order, and for each one runs `render.sh`:

1. **voice**: `voice.mjs` calls ElevenLabs `with-timestamps` once (only if a key is set and `voice.mp3` is missing) and writes `voice.mp3` + `timings.json` (word start/end times).
2. **build**: `build.mjs` writes a HyperFrames project to `<video>/hf/`.
3. **render**: `npx hyperframes render` at 30 fps.
4. **export**: ffmpeg to H.264 High, yuv420p, 30 fps, AAC 48 kHz, about -14 LUFS, `+faststart`, under 50 MB, plus `preview.jpg` (frame at 1.0 s).

On success the video moves to `awaiting_final` with `final`, `poster`, `cost.render_seconds`, `cost.elevenlabs_chars` filled. If one video fails, the others still render and `crew.spinner.state` becomes `needs_you`. If there's a key but no voice picked (`settings.voice` is null), the queue runs a 3-voice audition (from `BASSBOAT_AUDITION_VOICES`) and asks Chale to pick, without rendering.

## Commands

```bash
npm ci                                              # once, in render/
node render/queue.mjs [--dry-run] [--only <id>]     # what launchd runs
bash render/render.sh week/<wk>/<id>/storyboard.json [--no-voice] [--out DIR] [--keep]
node render/build.mjs <storyboard.json> [--voice voice.mp3 --timings timings.json] [--out dir] [--style clay|blueprint|isometric]
node render/voice.mjs <storyboard.json>... [--dry-run] [--force] [--voice-id ID] [--model eleven_multilingual_v2]
node render/voice.mjs --audition "id1,id2,id3" <storyboard.json>   # audition-<id>.mp3 next to it
node render/style-tests.mjs                          # tests/style-{clay,blueprint,isometric}.mp4 + tests/styles.jpg
node render/tests/run-unit.mjs                       # offline tests (mock ElevenLabs, fake render)
npx hyperframes check week/<wk>/<id>/hf              # lint a built project
```

## Env (in `~/.bassboat.env`, never in the repo)

| var | use |
|---|---|
| `ELEVENLABS_API_KEY` | required for voice; without it videos render silent (captions only) and Spinner says so |
| `ELEVENLABS_VOICE_ID` | fallback voice when neither the storyboard nor `settings.voice` names one |
| `BASSBOAT_AUDITION_VOICES` | 3 comma-separated voice ids for the audition |
| `ELEVENLABS_MODEL` | default `eleven_multilingual_v2` |
| `ELEVENLABS_USD_PER_1K_CHARS` | cost estimate written to logs (default 0.30) |
| `HYPERFRAMES_BIN` | override the HyperFrames CLI (default: `render/node_modules/.bin/hyperframes`, then `~/HyperFrames`, then `npx hyperframes@0.8.172`) |
| `BASSBOAT_CRF` | starting x264 CRF for final.mp4 (default 20) |

## What the builder understands (for Jig)

- **scene**: `dock`, `boat`, `underwater`, `cutaway` (x-ray with swim bladder, gills, spine), `studio`. Consecutive shots on the same scene are one continuous camera move; scene changes are hard cuts, and any after the third become 0.5 s dissolves (the bible allows 0-3 cuts).
- **subject**: `bass`, `bass:largemouth|smallmouth|spotted`, organ focus such as `bass:swim-bladder`, `bass:jaw`, `bass:eye`, `bass:gills`, `bass:lateral-line` (adds a labeled callout), `bass:nest` (nest with eggs on the bottom), `lure:crankbait|worm|jig|spinnerbait`, `angler`, `boat`, `bluegill`, `minnow`. Anything else falls back to a bass and is listed under `warnings` in `hf/build.json`.
- **action** keywords move the subject: swims past/across (travel), rise/reeled up, dive/sink/lowered, strike/bite (lunges at the lure, jaw opens), inflate/swell (swim bladder grows in a cutaway), turn, release, cast/hook set (angler). A lure word in a bass shot hangs that lure on a line.
- **camera**: `push-in`, `pull-out`, `orbit`, `pan`, `static` (parallax across far/mid/subject/near layers).
- **captions**: each line splits into 2-4 word cards, white bold with a dark outline, inside y 1250-1510 (above the bottom fifth). With `timings.json` they land on the spoken words and the video ends 0.35 s after the last word; without, they spread evenly over each line's shot.
- **ten-facts**: `shot.counter` shows a "N/10" badge; a stopwatch runs from 0.0 s.

Styles live in `scenes/palettes.mjs` (palettes, CSS variables, SVG defs). Fonts (Inter, JetBrains Mono, OFL) and GSAP are vendored in `vendor/` because renders must not need a CDN.
