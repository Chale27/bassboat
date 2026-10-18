// Locate the HyperFrames CLI. Order: $HYPERFRAMES_BIN, render/node_modules
// (npm ci), ~/HyperFrames checkout, global `hyperframes`, then pinned npx.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HF_VERSION = "0.8.172";
const RENDER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function hyperframesCmd() {
  if (process.env.HYPERFRAMES_BIN) return [process.env.HYPERFRAMES_BIN];
  const local = path.join(RENDER_DIR, "node_modules", ".bin", "hyperframes");
  if (fs.existsSync(local)) return [local];
  const home = path.join(os.homedir(), "HyperFrames");
  for (const c of [path.join(home, "node_modules", ".bin", "hyperframes"), path.join(home, "packages", "cli", "bin", "hyperframes.js")]) {
    if (fs.existsSync(c)) return c.endsWith(".js") ? [process.execPath, c] : [c];
  }
  const which = spawnSync("sh", ["-c", "command -v hyperframes"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return [which.stdout.trim()];
  return ["npx", "--yes", `hyperframes@${HF_VERSION}`];
}

export function runHF(args, opts = {}) {
  const [cmd, ...pre] = hyperframesCmd();
  const r = spawnSync(cmd, [...pre, ...args], { stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8", env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1", HYPERFRAMES_NO_TELEMETRY: "1" } });
  if (r.status !== 0) {
    const tail = (r.stderr || r.stdout || "").split("\n").slice(-20).join("\n");
    throw new Error(`hyperframes ${args[0]} failed (exit ${r.status})${tail ? ":\n" + tail : ""}`);
  }
  return r;
}

export function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
}
