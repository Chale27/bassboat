#!/usr/bin/env node
// Spinner nightly queue (launchd runs this at 23:00 on Chale's Mac).
//
//   node render/queue.mjs [--crew path/to/crew.json] [--only <video id>] [--dry-run]
//
// Renders every video with status "approved", in crew.json order, through
// render/render.sh. On success: status -> "awaiting_final", final/poster
// paths filled, cost.render_seconds / cost.elevenlabs_chars / cost.usd
// updated. One failing video never stops the others; it marks Spinner
// needs_you. crew.json is re-read right before every write (other crew
// members may have changed it during a long render) and written back
// pretty-printed with 2 spaces.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const LOG_KEEP = 20;

function parseArgs(argv) {
  const o = { crew: path.join(REPO, "crew.json"), only: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--crew") o.crew = path.resolve(argv[++i]);
    else if (argv[i] === "--only") o.only = argv[++i];
    else if (argv[i] === "--dry-run") o.dryRun = true;
    else if (argv[i] === "--render-cmd") o.renderCmd = argv[++i]; // tests: substitute render.sh
  }
  return o;
}

// load ~/.bassboat.env (KEY=VALUE lines) without printing anything
function loadEnvFile() {
  const f = path.join(os.homedir(), ".bassboat.env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
function writeJson(f, obj) {
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  fs.renameSync(tmp, f);
}

// Re-read, apply a mutation, write. Keeps other crew members' edits.
function updateCrew(crewPath, fn) {
  const crew = readJson(crewPath);
  fn(crew);
  crew.updatedAt = new Date().toISOString();
  writeJson(crewPath, crew);
  return crew;
}

function spinner(crew) {
  crew.crew = crew.crew || {};
  crew.crew.spinner = crew.crew.spinner || { name: "Spinner", role: "Render", schedule: "Nightly 11:00 PM", state: "idle", lastRunAt: null, lastSummary: "", log: [] };
  crew.crew.spinner.log = Array.isArray(crew.crew.spinner.log) ? crew.crew.spinner.log : [];
  return crew.crew.spinner;
}

function voiceTotals(sbPath) {
  try {
    const sb = readJson(sbPath);
    const v = (sb.log || []).filter((e) => e.step === "voice");
    return { chars: v.reduce((a, e) => a + (Number(e.elevenlabs_chars) || 0), 0), usd: v.reduce((a, e) => a + (Number(e.cost_usd) || 0), 0), voiceId: sb?.voice?.voice || null };
  } catch {
    return { chars: 0, usd: 0, voiceId: null };
  }
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  loadEnvFile();
  const root = path.dirname(a.crew);
  if (!fs.existsSync(a.crew)) {
    console.error(`queue: ${a.crew} not found`);
    return 1;
  }
  const crew0 = readJson(a.crew);
  const queue = (crew0.videos || []).filter((v) => v.status === "approved" && (!a.only || v.id === a.only));
  const startedAt = new Date().toISOString();
  console.log(`queue: ${queue.length} approved video(s)${a.dryRun ? " (dry run)" : ""}`);
  for (const v of queue) console.log(`  - ${v.id} -> ${v.storyboard}`);
  if (a.dryRun) return 0;

  if (!queue.length) {
    updateCrew(a.crew, (c) => {
      const s = spinner(c);
      s.state = "idle";
      s.lastRunAt = startedAt;
      s.lastSummary = "Nothing approved to render.";
      s.log.push({ at: startedAt, note: "No approved videos." });
      s.log = s.log.slice(-LOG_KEEP);
    });
    return 0;
  }

  // Voice needs a key and a voice id. Key but no voice anywhere -> audition and ask Chale.
  const hasKey = !!process.env.ELEVENLABS_API_KEY;
  const settingsVoice = crew0?.settings?.voice || null;
  const anyVoice = settingsVoice || process.env.ELEVENLABS_VOICE_ID || queue.some((v) => voiceTotals(path.join(root, v.storyboard)).voiceId);
  if (hasKey && !anyVoice) {
    const first = path.join(root, queue[0].storyboard);
    const ids = (process.env.BASSBOAT_AUDITION_VOICES || "").trim();
    let note = "No voice picked yet (settings.voice is null).";
    if (ids) {
      const r = spawnSync(process.execPath, [path.join(HERE, "voice.mjs"), "--audition", ids, first], { stdio: "inherit" });
      note += r.status === 0 ? ` Auditions saved next to ${queue[0].storyboard} (audition-<voice>.mp3); pick one and set settings.voice.` : " Audition failed, see logs/.";
    } else {
      note += " Set BASSBOAT_AUDITION_VOICES in ~/.bassboat.env to 3 ElevenLabs voice ids, or set settings.voice directly.";
    }
    updateCrew(a.crew, (c) => {
      const s = spinner(c);
      s.state = "needs_you";
      s.lastRunAt = startedAt;
      s.lastSummary = note;
      s.log.push({ at: startedAt, note });
      s.log = s.log.slice(-LOG_KEEP);
    });
    console.log(`queue: ${note}`);
    return 0;
  }

  updateCrew(a.crew, (c) => {
    const s = spinner(c);
    s.state = "running";
    s.lastRunAt = startedAt;
    s.lastSummary = `Rendering ${queue.length} approved video(s).`;
  });

  const done = [], failed = [];
  const renderCmd = a.renderCmd ? a.renderCmd.split(" ") : ["bash", path.join(HERE, "render.sh")];
  for (const v of queue) {
    const sbPath = path.join(root, v.storyboard);
    const outDir = path.dirname(sbPath);
    const t0 = Date.now();
    console.log(`\n=== ${v.id}`);
    let ok = false, why = "", secs = 0;
    if (!fs.existsSync(sbPath)) why = `storyboard missing: ${v.storyboard}`;
    else {
      // when settings.voice is set and the storyboard has none, pass it via env for voice.mjs
      const env = { ...process.env };
      if (settingsVoice && !env.ELEVENLABS_VOICE_ID) env.ELEVENLABS_VOICE_ID = settingsVoice;
      const r = spawnSync(renderCmd[0], [...renderCmd.slice(1), sbPath], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
      process.stdout.write(r.stdout || "");
      process.stderr.write(r.stderr || "");
      ok = r.status === 0 && fs.existsSync(path.join(outDir, "final.mp4"));
      if (!ok) why = ((r.stderr || "").trim().split("\n").filter(Boolean).pop() || `exit ${r.status}`).slice(0, 200);
      secs = Number(((r.stdout || "").match(/RENDER_SECONDS=(\d+)/) || [])[1]) || Math.round((Date.now() - t0) / 1000);
    }
    const rel = (f) => path.relative(root, path.join(outDir, f)).split(path.sep).join("/");
    const vt = voiceTotals(sbPath);
    updateCrew(a.crew, (c) => {
      const vid = (c.videos || []).find((x) => x.id === v.id);
      if (!vid) return;
      vid.cost = vid.cost || { minutes_crew: 0, render_seconds: 0, elevenlabs_chars: 0, usd: 0, my_minutes: 0 };
      if (ok) {
        if (vid.status === "approved") vid.status = "awaiting_final"; // don't clobber a status Chale changed meanwhile
        vid.final = rel("final.mp4");
        vid.poster = rel("preview.jpg");
        vid.cost.render_seconds = (Number(vid.cost.render_seconds) || 0) + secs;
        const prevChars = Number(vid.cost.elevenlabs_chars) || 0;
        if (vt.chars > prevChars) {
          const newUsd = vt.chars ? (vt.usd * (vt.chars - prevChars)) / vt.chars : 0;
          vid.cost.usd = Math.round(((Number(vid.cost.usd) || 0) + newUsd) * 10000) / 10000;
          vid.cost.elevenlabs_chars = vt.chars;
        }
      }
    });
    if (ok) { done.push(v.id); console.log(`=== ${v.id}: ok (${secs}s)`); }
    else { failed.push({ id: v.id, why }); console.log(`=== ${v.id}: FAILED: ${why}`); }
  }

  const at = new Date().toISOString();
  const silent = !hasKey ? " No ElevenLabs key, so videos were rendered without voice." : "";
  const summary = failed.length
    ? `Rendered ${done.length} of ${queue.length}; failed: ${failed.map((f) => `${f.id} (${f.why})`).join("; ")}.${silent}`
    : `Rendered ${done.length} video(s) to awaiting_final.${silent}`;
  updateCrew(a.crew, (c) => {
    const s = spinner(c);
    s.state = failed.length || !hasKey ? "needs_you" : "ok";
    s.lastRunAt = at;
    s.lastSummary = summary;
    s.log.push({ at, note: summary });
    s.log = s.log.slice(-LOG_KEEP);
  });
  console.log(`\nqueue: ${summary}`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => { console.error(`queue: ${e.stack || e.message}`); process.exit(1); });
}
