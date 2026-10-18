#!/usr/bin/env node
// Five-second house-style tests: the same shot (underwater bass swimming past
// a crankbait, push-in, one caption "This is your bass") in clay, blueprint and
// isometric -> render/tests/style-<name>.mp4 + render/tests/styles.jpg
//
//   node render/style-tests.mjs [clay blueprint isometric]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeProject } from "./build.mjs";
import { runHF, ffmpeg } from "./lib/hf.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTS = path.join(HERE, "tests");
const WORK = path.join(TESTS, ".work");
const styles = process.argv.slice(2).length ? process.argv.slice(2) : ["clay", "blueprint", "isometric"];

const storyboard = (style) => ({
  id: `style-test-${style}`,
  format: "what-happens-if",
  title: `House style test: ${style}`,
  hook: "This is your bass",
  style,
  script: "This is your bass",
  lines: [{ text: "This is your bass", shot: 1 }],
  shots: [{ n: 1, scene: "underwater", subject: "bass:largemouth", action: "bass swims past a crankbait", camera: "push-in", counter: null, est_seconds: 5 }],
  ending: "payoff",
  question: null,
  claims: [],
  voice: { provider: "elevenlabs", voice: null },
  log: [],
});

fs.mkdirSync(WORK, { recursive: true });
const stills = [];
for (const style of styles) {
  const dir = path.join(WORK, `style-${style}`);
  fs.mkdirSync(dir, { recursive: true });
  const sbPath = path.join(dir, "storyboard.json");
  fs.writeFileSync(sbPath, JSON.stringify(storyboard(style), null, 2) + "\n");
  const { outDir } = writeProject(sbPath, { out: path.join(dir, "hf"), allowShort: true });
  const raw = path.join(dir, "raw.mp4");
  const t0 = Date.now();
  runHF(["render", outDir, "-o", raw, "--fps", "30", "--quality", "draft", "--quiet"]);
  const out = path.join(TESTS, `style-${style}.mp4`);
  // small committed test clip: H.264 High, yuv420p, CRF 30, silent
  ffmpeg(["-i", raw, "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "30", "-r", "30", "-an", "-movflags", "+faststart", out]);
  const still = path.join(dir, "still.png");
  ffmpeg(["-ss", "2.5", "-i", out, "-frames:v", "1", still]);
  stills.push(still);
  const mb = fs.statSync(out).size / 1e6;
  console.log(`${style}: ${path.relative(process.cwd(), out)} ${mb.toFixed(2)} MB (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
if (stills.length > 1) {
  const sheet = path.join(TESTS, "styles.jpg");
  const inputs = stills.flatMap((s) => ["-i", s]);
  const labels = stills.map((_, i) => `[${i}]`).join("");
  ffmpeg([...inputs, "-filter_complex", `${labels}hstack=inputs=${stills.length},scale=${540 * stills.length}:-1`, "-q:v", "3", sheet]);
  console.log(`contact sheet: ${path.relative(process.cwd(), sheet)}`);
}
