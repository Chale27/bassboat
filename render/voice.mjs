#!/usr/bin/env node
// Spinner voice step: ElevenLabs text-to-speech with timestamps.
//
//   node render/voice.mjs week/<wk>/<id>/storyboard.json [more storyboards...]
//        [--voice-id ID] [--model eleven_multilingual_v2] [--force] [--dry-run]
//   node render/voice.mjs --audition "id1,id2,id3" week/<wk>/<id>/storyboard.json
//
// For each storyboard: POST /v1/text-to-speech/{voice_id}/with-timestamps,
// write voice.mp3 + timings.json (word start/end from the character
// alignment) next to the storyboard, and append
// {step:"voice", elevenlabs_chars, cost_usd, at} to the storyboard log.
//
// Env: ELEVENLABS_API_KEY (required unless --dry-run; never printed)
//      ELEVENLABS_VOICE_ID (fallback voice), ELEVENLABS_MODEL,
//      ELEVENLABS_USD_PER_1K_CHARS (cost estimate, default 0.30),
//      ELEVENLABS_BASE_URL (default https://api.elevenlabs.io; for tests)
// Voice id order: --voice-id, storyboard.voice.voice, crew.json settings.voice,
// ELEVENLABS_VOICE_ID.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alignmentToWords, round3 } from "./lib/timing.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const DEFAULT_MODEL = "eleven_multilingual_v2";

export function narrationText(sb) {
  if (Array.isArray(sb.lines) && sb.lines.length) return sb.lines.map((l) => String(l.text).trim()).join(" ");
  return String(sb.script || "").trim();
}

export function costUsd(chars) {
  const per1k = Number(process.env.ELEVENLABS_USD_PER_1K_CHARS || 0.3);
  return Math.round(chars * per1k * 10) / 10000; // 4 decimals
}

function crewVoice() {
  try {
    const crew = JSON.parse(fs.readFileSync(path.join(REPO, "crew.json"), "utf8"));
    return crew?.settings?.voice || null;
  } catch {
    return null;
  }
}

export function pickVoice(sb, flag) {
  return flag || sb?.voice?.voice || crewVoice() || process.env.ELEVENLABS_VOICE_ID || null;
}

export async function synthesize({ text, voiceId, model, apiKey }) {
  const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/$/, "");
  const url = `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        const err = new Error(`ElevenLabs HTTP ${res.status}: ${body}`);
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw Object.assign(err, { fatal: true });
        throw err;
      }
      const json = await res.json();
      if (!json.audio_base64) throw new Error("ElevenLabs response had no audio_base64");
      return { audio: Buffer.from(json.audio_base64, "base64"), alignment: json.alignment || json.normalized_alignment };
    } catch (e) {
      lastErr = e;
      if (e.fatal || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

export function timingsFrom(alignment, extra = {}) {
  const words = alignmentToWords(alignment);
  const ends = alignment?.character_end_times_seconds || [];
  const duration = ends.length ? round3(ends[ends.length - 1]) : words.length ? words[words.length - 1].end : 0;
  return { ...extra, duration, words };
}

function appendLog(sbPath, entry) {
  const sb = JSON.parse(fs.readFileSync(sbPath, "utf8"));
  sb.log = Array.isArray(sb.log) ? sb.log : [];
  sb.log.push(entry);
  fs.writeFileSync(sbPath, JSON.stringify(sb, null, 2) + "\n");
}

function parseArgs(argv) {
  const o = { _: [], force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") o.force = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--voice-id") o.voiceId = argv[++i];
    else if (a === "--model") o.model = argv[++i];
    else if (a === "--audition") o.audition = argv[++i];
    else if (a === "-h" || a === "--help") o.help = true;
    else o._.push(a);
  }
  return o;
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  if (a.help || !a._.length) {
    console.log("usage: node render/voice.mjs <storyboard.json>... [--voice-id ID] [--model M] [--force] [--dry-run]\n       node render/voice.mjs --audition \"id1,id2,id3\" <storyboard.json>");
    return a.help ? 0 : 2;
  }
  const model = a.model || process.env.ELEVENLABS_MODEL || DEFAULT_MODEL;
  const apiKey = process.env.ELEVENLABS_API_KEY || "";
  if (!a.dryRun && !apiKey) {
    console.error("ELEVENLABS_API_KEY is not set (put it in ~/.bassboat.env). Use --dry-run to estimate cost.");
    return 3;
  }

  // jobs: [{sbPath, voiceId, out (mp3 path), timings path, step}]
  const jobs = [];
  if (a.audition) {
    const ids = a.audition.split(",").map((s) => s.trim()).filter(Boolean);
    const sbPath = a._[0];
    const dir = path.dirname(sbPath);
    for (const id of ids) jobs.push({ sbPath, voiceId: id, out: path.join(dir, `audition-${id}.mp3`), timings: path.join(dir, `audition-${id}.timings.json`), step: "voice-audition" });
  } else {
    for (const sbPath of a._) {
      const dir = path.dirname(sbPath);
      jobs.push({ sbPath, voiceId: null, out: path.join(dir, "voice.mp3"), timings: path.join(dir, "timings.json"), step: "voice" });
    }
  }

  let totalChars = 0, failures = 0;
  for (const j of jobs) {
    let sb;
    try {
      sb = JSON.parse(fs.readFileSync(j.sbPath, "utf8"));
    } catch (e) {
      console.error(`${j.sbPath}: cannot read storyboard (${e.message})`);
      failures++;
      continue;
    }
    const text = narrationText(sb);
    const chars = text.length;
    const voiceId = j.voiceId || pickVoice(sb, a.voiceId);
    const label = `${sb.id || j.sbPath}${j.step === "voice-audition" ? ` [${voiceId}]` : ""}`;
    if (!a.force && j.step === "voice" && fs.existsSync(j.out) && fs.existsSync(j.timings)) {
      console.log(`${label}: voice.mp3 exists, skipping (--force to redo)`);
      continue;
    }
    totalChars += chars;
    if (a.dryRun) {
      console.log(`${label}: ${chars} chars, ${text.split(/\s+/).length} words, est $${costUsd(chars).toFixed(4)} (voice ${voiceId || "unset"}, ${model})`);
      continue;
    }
    if (!voiceId) {
      console.error(`${label}: no voice id (set storyboard.voice.voice, crew.json settings.voice, --voice-id or ELEVENLABS_VOICE_ID)`);
      failures++;
      continue;
    }
    try {
      const { audio, alignment } = await synthesize({ text, voiceId, model, apiKey });
      fs.writeFileSync(j.out, audio);
      const t = timingsFrom(alignment, { voice_id: voiceId, model_id: model, text });
      fs.writeFileSync(j.timings, JSON.stringify(t, null, 2) + "\n");
      appendLog(j.sbPath, { step: j.step, voice: voiceId, elevenlabs_chars: chars, cost_usd: costUsd(chars), at: new Date().toISOString() });
      console.log(`${label}: wrote ${path.relative(process.cwd(), j.out)} (${t.duration}s, ${t.words.length} words, ${chars} chars, est $${costUsd(chars).toFixed(4)})`);
    } catch (e) {
      console.error(`${label}: voice failed: ${String(e.message).replaceAll(apiKey || "\u0000", "***")}`);
      failures++;
    }
  }
  console.log(`total: ${totalChars} chars, est $${costUsd(totalChars).toFixed(4)}${a.dryRun ? " (dry run, no API calls)" : ""}`);
  return failures ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
