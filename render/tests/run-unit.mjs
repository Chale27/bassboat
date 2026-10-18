#!/usr/bin/env node
// Offline tests for the render pipeline (no ElevenLabs key, no rendering).
//   node render/tests/run-unit.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { alignmentToWords, chunkLine, planTiming } from "../lib/timing.mjs";
import { buildProject, parseSubject, validateStoryboard } from "../build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(HERE, "..");
const fx = (f) => JSON.parse(fs.readFileSync(path.join(R, "fixtures", f), "utf8"));
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log(`ok - ${name}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bb-render-"));

await test("alignment -> words", () => {
  const w = alignmentToWords({ characters: [..."Hi you  there"], character_start_times_seconds: [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1, 1.1, 1.2], character_end_times_seconds: [.1, .2, .3, .4, .5, .6, .7, .8, .9, 1, 1.1, 1.2, 1.3] });
  assert.deepEqual(w, [{ text: "Hi", start: 0, end: 0.2 }, { text: "you", start: 0.3, end: 0.6 }, { text: "there", start: 0.8, end: 1.3 }]);
  const sb = fx("sample-storyboard.json");
  const words = alignmentToWords(fx("fake-alignment.json").alignment);
  assert.equal(words.length, sb.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0));
});

await test("caption chunks are 2-4 words", () => {
  for (const line of ["one", "two words", "a b c d", "a b c d e", "a b c d e f g", "a b c d e f g h i j"]) {
    const c = chunkLine(line);
    assert.equal(c.flat().join(" "), line);
    if (line.split(" ").length >= 2) for (const k of c) assert.ok(k.length >= 2 && k.length <= 4, `${line} -> ${JSON.stringify(c)}`);
  }
});

await test("timing without voice: est_seconds, cards inside shots", () => {
  const sb = fx("sample-storyboard.json");
  const t = planTiming(sb);
  assert.equal(t.total, Math.round(sb.shots.reduce((a, s) => a + s.est_seconds, 0) * 1000) / 1000);
  assert.equal(t.cards[0].start, 0);
  for (const c of t.cards) {
    const sh = t.shots.find((s) => s.n === c.shot);
    assert.ok(c.start >= sh.start - 1e-6 && c.end <= sh.end + 1e-6, JSON.stringify(c));
  }
});

await test("timing with ElevenLabs words: cards on word starts, ends on last word", () => {
  const sb = fx("sample-storyboard.json");
  const words = alignmentToWords(fx("fake-alignment.json").alignment);
  const t = planTiming(sb, words, 26.5);
  const last = words[words.length - 1];
  assert.ok(t.total >= last.end && t.total <= last.end + 0.4, `total ${t.total} vs last word ${last.end}`);
  assert.equal(t.cards[1].start, words[t.cards[0].text.split(" ").length].start);
  assert.equal(t.shots[1].start, words[sb.lines.filter((l) => l.shot === 1).reduce((a, l) => a + l.text.split(" ").length, 0)].start);
});

await test("subjects parse", () => {
  const sb = { title: "", hook: "" };
  assert.equal(parseSubject({ subject: "bass:smallmouth jaw" }, sb).species, "smallmouth");
  assert.equal(parseSubject({ subject: "bass:smallmouth jaw" }, sb).focus, "mouth");
  assert.equal(parseSubject({ subject: "bass:largemouth" }, sb).focus, null);
  assert.equal(parseSubject({ subject: "lure:worm" }, sb).kind, "worm");
  assert.equal(parseSubject({ subject: "bass:swim-bladder" }, sb).focus, "bladder");
  assert.equal(parseSubject({ subject: "bluegill" }, sb).type, "bluegill");
});

await test("what-happens-if fixture builds within the bible", () => {
  const sb = fx("sample-storyboard.json");
  assert.deepEqual(validateStoryboard(sb).errors, []);
  const { html, report } = buildProject(sb);
  assert.ok(report.total >= 25 && report.total <= 32);
  assert.ok(report.hardCuts <= 3);
  assert.ok(html.includes('data-composition-id="main"') && html.includes('window.__timelines["main"]'));
  assert.ok(!/Math\.random|Date\.now|fetch\(/.test(html), "non-deterministic code in composition");
  // the first subject is visible at t=0 (no hidden set at 0)
  assert.ok(!html.includes('["set","#s0-sub0",{"autoAlpha":0}'));
  // caption box stays above the bottom fifth: top 1250 + height 260 = 1510 < 1536
  assert.ok(/\.cap \{[^}]*top: 1250px;[^}]*height: 260px/.test(html));
});

await test("ten-facts fixture has counter + stopwatch", () => {
  const sb = fx("sample-ten-facts.json");
  const { html, report } = buildProject(sb);
  assert.equal((html.match(/class="clip counter"/g) || []).length, 10);
  assert.ok(html.includes('id="watch"') && html.includes("onUpdate"));
  assert.ok(report.hardCuts <= 3);
});

await test("voice --dry-run prints chars + cost without a key", () => {
  const r = spawnSync(process.execPath, [path.join(R, "voice.mjs"), "--dry-run", path.join(R, "fixtures", "sample-storyboard.json")], { encoding: "utf8", env: { ...process.env, ELEVENLABS_API_KEY: "" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\d+ chars, \d+ words, est \$\d/);
});

await test("voice against a mock ElevenLabs server writes mp3, timings, log", async () => {
  const dir = path.join(tmp, "voice");
  fs.mkdirSync(dir, { recursive: true });
  const sbPath = path.join(dir, "storyboard.json");
  fs.copyFileSync(path.join(R, "fixtures", "sample-storyboard.json"), sbPath);
  const align = fx("fake-alignment.json").alignment;
  let seen = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      seen = { url: req.url, key: req.headers["xi-api-key"], body: JSON.parse(body) };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ audio_base64: Buffer.from("ID3fake-mp3").toString("base64"), alignment: align, normalized_alignment: align }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const { main } = await import("../voice.mjs");
  process.env.ELEVENLABS_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.ELEVENLABS_API_KEY = "test-key-not-real";
  const code = await main([sbPath, "--voice-id", "VOICE123"]);
  server.close();
  delete process.env.ELEVENLABS_BASE_URL;
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(code, 0);
  assert.equal(seen.key, "test-key-not-real");
  assert.match(seen.url, /^\/v1\/text-to-speech\/VOICE123\/with-timestamps/);
  assert.equal(seen.body.model_id, "eleven_multilingual_v2");
  assert.ok(fs.readFileSync(path.join(dir, "voice.mp3")).toString().startsWith("ID3"));
  const t = JSON.parse(fs.readFileSync(path.join(dir, "timings.json"), "utf8"));
  assert.ok(t.words.length > 50 && t.duration > 20);
  const log = JSON.parse(fs.readFileSync(sbPath, "utf8")).log.pop();
  assert.equal(log.step, "voice");
  assert.equal(log.elevenlabs_chars, seen.body.text.length);
  assert.ok(log.cost_usd > 0 && log.at);
});

await test("queue: renders approved in order, tolerates a failure", () => {
  const root = path.join(tmp, "repo");
  for (const id of ["a", "b", "c"]) {
    fs.mkdirSync(path.join(root, "week", "x", id), { recursive: true });
    fs.writeFileSync(path.join(root, "week", "x", id, "storyboard.json"), JSON.stringify({ id, log: [] }));
  }
  const crew = {
    updatedAt: null, settings: { voice: null }, crew: { spinner: { name: "Spinner", state: "idle", lastRunAt: null, lastSummary: "", log: [] } },
    videos: ["a", "b", "c"].map((id, i) => ({ id, status: i === 2 ? "scripted" : "approved", storyboard: `week/x/${id}/storyboard.json`, final: null, poster: null, cost: { minutes_crew: 0, render_seconds: 0, elevenlabs_chars: 0, usd: 0, my_minutes: 0 } })),
  };
  const crewPath = path.join(root, "crew.json");
  fs.writeFileSync(crewPath, JSON.stringify(crew, null, 2));
  // fake render: video "b" fails
  const fake = path.join(tmp, "fake-render.sh");
  fs.writeFileSync(fake, `#!/usr/bin/env bash\nset -e\nd=$(dirname "$1")\ncase "$d" in *"/b") echo "boom: hyperframes failed" >&2; exit 1;; esac\ntouch "$d/final.mp4" "$d/preview.jpg"\necho RENDER_SECONDS=42\n`);
  fs.chmodSync(fake, 0o755);
  const r = spawnSync(process.execPath, [path.join(R, "queue.mjs"), "--crew", crewPath, "--render-cmd", fake], { encoding: "utf8", env: { ...process.env, ELEVENLABS_API_KEY: "", HOME: tmp } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const out = JSON.parse(fs.readFileSync(crewPath, "utf8"));
  const [a, b, c] = out.videos;
  assert.equal(a.status, "awaiting_final");
  assert.equal(a.final, "week/x/a/final.mp4");
  assert.equal(a.poster, "week/x/a/preview.jpg");
  assert.equal(a.cost.render_seconds, 42);
  assert.equal(b.status, "approved");
  assert.equal(c.status, "scripted");
  assert.equal(out.crew.spinner.state, "needs_you");
  assert.match(out.crew.spinner.lastSummary, /Rendered 1 of 2; failed: b \(boom/);
  assert.ok(out.updatedAt && out.crew.spinner.lastRunAt && out.crew.spinner.log.length === 1);
  assert.ok(fs.readFileSync(crewPath, "utf8").includes('\n  "settings": {'), "2-space JSON");
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n} tests passed`);
