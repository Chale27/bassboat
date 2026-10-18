#!/usr/bin/env bash
# Bass Boat setup for Chale's Mac. Safe to run again (idempotent).
#
#   bash mac/install.sh            # or: curl -fsSL <raw url>/mac/install.sh | bash
#
# 1. clone or pull Chale27/bassboat into ~/BassBoat
# 2. npm ci in render/
# 3. check node, ffmpeg, ffprobe, git, hyperframes and print what's missing
# 4. install the Spinner launchd job (23:00 nightly) and load it
# 5. copy tasks/<crew>/SKILL.md -> ~/.claude/scheduled-tasks/bassboat-<crew>/SKILL.md
# 6. create ~/.bassboat.env (chmod 600) for ELEVENLABS_API_KEY if it doesn't exist
#
# Secrets never go in the repo. Env overrides: BASSBOAT_REPO (git url),
# BASSBOAT_DIR (default ~/BassBoat), BASSBOAT_NO_LAUNCHD=1 (skip launchctl).
set -uo pipefail

REPO_URL="${BASSBOAT_REPO:-https://github.com/Chale27/bassboat.git}"
DEST="${BASSBOAT_DIR:-$HOME/BassBoat}"
LABEL="com.bassboat.spinner"
MISSING=""
note() { printf '%s\n' "$*"; }
miss() { MISSING="${MISSING}  - $1
"; }

note "== Bass Boat install -> $DEST"

# ---- 1. repo
if ! command -v git >/dev/null 2>&1; then
  note "git is missing: run 'xcode-select --install' and re-run this script."
  exit 1
fi
if [ -d "$DEST/.git" ]; then
  note "pulling latest in $DEST"
  git -C "$DEST" pull --rebase --autostash || note "  warning: git pull failed (offline or local changes); continuing with what's there"
else
  if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
    note "$DEST exists and is not a git clone; move it aside and re-run."
    exit 1
  fi
  git clone "$REPO_URL" "$DEST" || { note "git clone of $REPO_URL failed"; exit 1; }
fi
mkdir -p "$DEST/logs"

# ---- 2/3. tools
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  miss "node 20+   (brew install node)"
else
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null || miss "node 20+ (found $(node -v); brew upgrade node)"
fi
command -v ffmpeg >/dev/null 2>&1 || miss "ffmpeg    (brew install ffmpeg)"
command -v ffprobe >/dev/null 2>&1 || miss "ffprobe   (comes with: brew install ffmpeg)"

if command -v npm >/dev/null 2>&1; then
  note "installing render dependencies (npm ci)"
  ( cd "$DEST/render" && { npm ci --no-audit --no-fund || npm install --no-audit --no-fund; } ) || miss "render/ npm dependencies (npm ci failed; see output above)"
else
  miss "npm       (comes with: brew install node)"
fi

HF=""
if [ -x "$DEST/render/node_modules/.bin/hyperframes" ]; then HF="$DEST/render/node_modules/.bin/hyperframes"
elif [ -x "$HOME/HyperFrames/node_modules/.bin/hyperframes" ]; then HF="$HOME/HyperFrames/node_modules/.bin/hyperframes"
elif command -v hyperframes >/dev/null 2>&1; then HF="$(command -v hyperframes)"
fi
if [ -z "$HF" ]; then
  miss "hyperframes (cd $DEST/render && npm ci)"
else
  note "hyperframes: $HF ($("$HF" --version 2>/dev/null | head -n1))"
  # make sure the headless Chrome it renders with is present
  HYPERFRAMES_SKIP_SKILLS=1 "$HF" browser ensure >/dev/null 2>&1 || true
fi

# ---- 6. secrets file (outside the repo)
ENV_FILE="$HOME/.bassboat.env"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<'ENVEOF'
# Bass Boat secrets. Read by render/queue.mjs, render/render.sh and render/voice.mjs.
# Never commit this file.
ELEVENLABS_API_KEY=
# Optional:
# ELEVENLABS_VOICE_ID=            # used when crew.json settings.voice is null
# BASSBOAT_AUDITION_VOICES=id1,id2,id3   # Spinner auditions these when no voice is picked
# ELEVENLABS_USD_PER_1K_CHARS=0.30       # cost estimate for logs
ENVEOF
  chmod 600 "$ENV_FILE"
  note "created $ENV_FILE (chmod 600): paste your ElevenLabs key there"
else
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  grep -q '^ELEVENLABS_API_KEY=..*' "$ENV_FILE" || note "note: ELEVENLABS_API_KEY is empty in $ENV_FILE (videos will render without voice)"
fi

# ---- 4. launchd
PLIST_SRC="$DEST/mac/$LABEL.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_DIR="$(dirname "${NODE_BIN:-/opt/homebrew/bin/node}")"
JOB_PATH="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
if [ "$(uname -s)" = "Darwin" ] && [ "${BASSBOAT_NO_LAUNCHD:-0}" != "1" ]; then
  mkdir -p "$HOME/Library/LaunchAgents"
  sed -e "s#__HOME__#$HOME#g" -e "s#__PATH__#$JOB_PATH#g" "$PLIST_SRC" > "$PLIST_DST.tmp" && mv "$PLIST_DST.tmp" "$PLIST_DST"
  plutil -lint "$PLIST_DST" >/dev/null || { note "plist failed plutil -lint"; exit 1; }
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  if launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"; then
    note "launchd: $LABEL loaded (23:00 nightly, logs in $DEST/logs/)"
  else
    note "launchd: bootstrap failed; try: launchctl bootstrap gui/$(id -u) $PLIST_DST"
  fi
else
  # still write the filled-in plist so it can be inspected
  mkdir -p "$DEST/logs"
  sed -e "s#__HOME__#$HOME#g" -e "s#__PATH__#$JOB_PATH#g" "$PLIST_SRC" > "$DEST/logs/$LABEL.plist"
  note "launchd: skipped (not macOS or BASSBOAT_NO_LAUNCHD=1); filled plist at $DEST/logs/$LABEL.plist"
fi

# ---- 5. scheduled-task prompts
COUNT=0
for f in "$DEST"/tasks/*/SKILL.md; do
  [ -f "$f" ] || continue
  crew="$(basename "$(dirname "$f")")"
  mkdir -p "$HOME/.claude/scheduled-tasks/bassboat-$crew"
  cp "$f" "$HOME/.claude/scheduled-tasks/bassboat-$crew/SKILL.md"
  COUNT=$((COUNT + 1))
done
note "copied $COUNT crew prompts to ~/.claude/scheduled-tasks/bassboat-<crew>/"

# ---- summary
if [ -n "$MISSING" ]; then
  note ""
  note "Missing (install these, then re-run mac/install.sh):"
  printf '%s' "$MISSING"
  exit 1
fi
note ""
note "All set. Test one render now:"
note "  mkdir -p /tmp/bbtest && cp $DEST/render/fixtures/sample-storyboard.json /tmp/bbtest/storyboard.json && bash $DEST/render/render.sh /tmp/bbtest/storyboard.json"
