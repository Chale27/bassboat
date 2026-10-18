#!/usr/bin/env bash
# Spinner render: storyboard.json -> final.mp4 + preview.jpg
#
#   render/render.sh week/<wk>/<id>/storyboard.json [--out DIR] [--no-voice] [--keep]
#
# 1. voice   (only if ELEVENLABS_API_KEY is set and voice.mp3 is missing)
# 2. build   (render/build.mjs -> <dir>/hf/)
# 3. render  (npx hyperframes render, 30 fps)
# 4. export  (ffmpeg: H.264 High yuv420p 1080x1920 30 fps, AAC 48 kHz,
#             loudness ~ -14 LUFS, +faststart, under 50 MB) -> final.mp4
#             and preview.jpg (frame at 1.0 s)
# 5. log     render_seconds appended to the storyboard log
# Exits nonzero on any failure. Works with macOS bash 3.2 and Linux bash.
set -euo pipefail

die() { echo "render.sh: $*" >&2; exit 1; }
usage() { echo "usage: render/render.sh <storyboard.json> [--out DIR] [--no-voice] [--keep]" >&2; exit 2; }

[ $# -ge 1 ] || usage
SB=""; OUT=""; NO_VOICE=0; KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="${2:-}"; shift 2 ;;
    --no-voice) NO_VOICE=1; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help) usage ;;
    *) SB="$1"; shift ;;
  esac
done
[ -n "$SB" ] || usage
[ -f "$SB" ] || die "storyboard not found: $SB"

RENDER_DIR="$(cd "$(dirname "$0")" && pwd)"
SB="$(cd "$(dirname "$SB")" && pwd)/$(basename "$SB")"
SB_DIR="$(dirname "$SB")"
[ -n "$OUT" ] || OUT="$SB_DIR"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
HF_DIR="$OUT/hf"

# secrets live outside the repo
if [ -f "$HOME/.bassboat.env" ]; then
  set -a; . "$HOME/.bassboat.env"; set +a
fi

command -v node >/dev/null 2>&1 || die "node not found"
command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg not found"
command -v ffprobe >/dev/null 2>&1 || die "ffprobe not found"

T0=$(date +%s)

# ---- 1. voice
VOICE_ARGS=""
if [ "$NO_VOICE" -eq 0 ] && [ -n "${ELEVENLABS_API_KEY:-}" ] && [ ! -f "$SB_DIR/voice.mp3" ]; then
  echo "== voice"
  node "$RENDER_DIR/voice.mjs" "$SB" || die "voice step failed"
fi
if [ "$NO_VOICE" -eq 0 ] && [ -f "$SB_DIR/voice.mp3" ]; then
  VOICE_ARGS="yes"
fi

# ---- 2. build
echo "== build"
if [ -n "$VOICE_ARGS" ]; then
  if [ -f "$SB_DIR/timings.json" ]; then
    node "$RENDER_DIR/build.mjs" "$SB" --out "$HF_DIR" --voice "$SB_DIR/voice.mp3" --timings "$SB_DIR/timings.json" || die "build failed"
  else
    node "$RENDER_DIR/build.mjs" "$SB" --out "$HF_DIR" --voice "$SB_DIR/voice.mp3" || die "build failed"
  fi
else
  node "$RENDER_DIR/build.mjs" "$SB" --out "$HF_DIR" || die "build failed"
fi

# ---- 3. hyperframes render
echo "== hyperframes render"
HF_CMD=()
while IFS= read -r part; do HF_CMD+=("$part"); done < <(node --input-type=module -e "import { hyperframesCmd } from '$RENDER_DIR/lib/hf.mjs'; console.log(hyperframesCmd().join('\n'))")
RAW="$HF_DIR/renders/raw.mp4"
mkdir -p "$HF_DIR/renders"
rm -f "$RAW"
HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1 "${HF_CMD[@]}" render "$HF_DIR" -o "$RAW" --fps 30 --quality standard --quiet || die "hyperframes render failed"
[ -s "$RAW" ] || die "hyperframes produced no output"

# ---- 4. final export
echo "== export"
FINAL="$OUT/final.mp4"
POSTER="$OUT/preview.jpg"
HAS_AUDIO=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$RAW" | head -n1 || true)
encode() { # $1 = crf
  local crf="$1"
  if [ -n "$HAS_AUDIO" ]; then
    ffmpeg -hide_banner -loglevel error -y -i "$RAW" \
      -map 0:v:0 -map 0:a:0 \
      -vf "scale=1080:1920:flags=lanczos,fps=30,format=yuv420p" \
      -c:v libx264 -profile:v high -preset slow -crf "$crf" -maxrate 10M -bufsize 20M -pix_fmt yuv420p \
      -af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" -c:a aac -b:a 160k -ar 48000 -ac 2 \
      -movflags +faststart -shortest "$FINAL.tmp.mp4"
  else
    # silent track so every upload has AAC audio
    ffmpeg -hide_banner -loglevel error -y -i "$RAW" -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
      -map 0:v:0 -map 1:a:0 \
      -vf "scale=1080:1920:flags=lanczos,fps=30,format=yuv420p" \
      -c:v libx264 -profile:v high -preset slow -crf "$crf" -maxrate 10M -bufsize 20M -pix_fmt yuv420p \
      -c:a aac -b:a 128k -ar 48000 -ac 2 \
      -movflags +faststart -shortest "$FINAL.tmp.mp4"
  fi
}
CRF=${BASSBOAT_CRF:-20}
encode "$CRF" || die "ffmpeg export failed"
SIZE=$(wc -c < "$FINAL.tmp.mp4" | tr -d ' ')
while [ "$SIZE" -gt 50000000 ] && [ "$CRF" -lt 32 ]; do
  CRF=$((CRF + 3))
  echo "   ${SIZE} bytes is over 50 MB, re-encoding at CRF $CRF"
  encode "$CRF" || die "ffmpeg export failed"
  SIZE=$(wc -c < "$FINAL.tmp.mp4" | tr -d ' ')
done
[ "$SIZE" -le 50000000 ] || die "final.mp4 is still over 50 MB"
mv -f "$FINAL.tmp.mp4" "$FINAL"
ffmpeg -hide_banner -loglevel error -y -ss 1.0 -i "$FINAL" -frames:v 1 -q:v 3 "$POSTER" || die "poster export failed"

DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$FINAL")
T1=$(date +%s)
SECS=$((T1 - T0))

# ---- 5. log
node -e '
const fs = require("fs");
const path = require("path");
const [sbPath, secs, finalAbs, size, dur, repo] = process.argv.slice(1);
const rel = path.relative(repo, finalAbs);
const final = rel.startsWith("..") ? finalAbs : rel.split(path.sep).join("/");
const sb = JSON.parse(fs.readFileSync(sbPath, "utf8"));
sb.log = Array.isArray(sb.log) ? sb.log : [];
sb.log.push({ step: "render", render_seconds: Number(secs), duration_s: Math.round(Number(dur) * 100) / 100, bytes: Number(size), final, cost_usd: 0, at: new Date().toISOString() });
fs.writeFileSync(sbPath, JSON.stringify(sb, null, 2) + "\n");
 ' "$SB" "$SECS" "$FINAL" "$SIZE" "$DUR" "$(cd "$RENDER_DIR/.." && pwd)" || die "could not write storyboard log"

[ "$KEEP" -eq 1 ] || rm -rf "$HF_DIR/renders"
echo "== done: $FINAL (${DUR}s, ${SIZE} bytes, CRF $CRF) + $POSTER in ${SECS}s"
echo "RENDER_SECONDS=$SECS"
