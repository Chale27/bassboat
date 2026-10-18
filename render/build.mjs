#!/usr/bin/env node
// Spinner build step: storyboard.json -> HyperFrames project directory.
//
//   node render/build.mjs week/<wk>/<id>/storyboard.json [--voice voice.mp3 --timings timings.json] [--out dir] [--style clay|blueprint|isometric]
//
// No network. Everything is drawn in code (SVG) from render/scenes/. The
// output directory gets index.html (one 1080x1920 composition), vendor/
// (gsap + fonts), the voice file when given, and build.json (a report:
// total length, segments, cuts, warnings, caption cards).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  SCENES, STYLES, SPECIES, cssVars, globalDefs, PALETTES,
  bassSVG, BASS_VIEWBOX, BASS_ORIGINS, lureSVG, LURE_VIEWBOX, minnowSVG, MINNOW_VIEWBOX,
  anglerSVG, ANGLER_VIEWBOX, boatSVG, BOAT_VIEWBOX, bluegillSVG, BLUEGILL_VIEWBOX, nestSVG, NEST_VIEWBOX,
} from "./scenes/index.mjs";
import { rng, esc, layerSvg, W, H, r1 } from "./scenes/lib.mjs";
import { planTiming, round3 } from "./lib/timing.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCENE_NAMES = Object.keys(SCENES);
const CAMERAS = ["push-in", "orbit", "pull-out", "static", "pan"];
const MAX_HARD_CUTS = 3;
const DISSOLVE = 0.5;

// ---------------------------------------------------------------- validate
export function validateStoryboard(sb) {
  const errors = [], warnings = [];
  if (!sb || typeof sb !== "object") return { errors: ["storyboard is not an object"], warnings };
  for (const k of ["id", "format", "style", "shots", "lines"]) if (sb[k] == null) errors.push(`missing "${k}"`);
  if (sb.format && !["what-happens-if", "ten-facts"].includes(sb.format)) errors.push(`format must be what-happens-if|ten-facts, got ${sb.format}`);
  if (sb.style && !STYLES.includes(sb.style)) errors.push(`style must be one of ${STYLES.join("|")}, got ${sb.style}`);
  if (!Array.isArray(sb.shots) || !sb.shots.length) errors.push("shots must be a non-empty array");
  if (Array.isArray(sb.shots)) {
    sb.shots.forEach((s, i) => {
      if (typeof s.n !== "number") errors.push(`shots[${i}].n must be a number`);
      if (!SCENE_NAMES.includes(s.scene)) warnings.push(`shot ${s.n}: unknown scene "${s.scene}", using underwater`);
      if (!CAMERAS.includes(s.camera)) warnings.push(`shot ${s.n}: unknown camera "${s.camera}", using static`);
      if (!(Number(s.est_seconds) > 0)) warnings.push(`shot ${s.n}: est_seconds missing, using 2.5`);
    });
    if (sb.format === "what-happens-if" && (sb.shots.length < 4 || sb.shots.length > 7)) warnings.push(`what-happens-if expects 4-7 shots, got ${sb.shots.length}`);
    if (sb.format === "ten-facts" && sb.shots.length !== 12) warnings.push(`ten-facts expects 12 shots, got ${sb.shots.length}`);
  }
  if (Array.isArray(sb.lines)) {
    const ns = new Set((sb.shots || []).map((s) => s.n));
    sb.lines.forEach((l, i) => { if (!ns.has(l.shot)) warnings.push(`lines[${i}] points at missing shot ${l.shot}`); });
    const nw = sb.lines.reduce((a, l) => a + String(l.text).split(/\s+/).filter(Boolean).length, 0);
    if (nw < 60 || nw > 100) warnings.push(`narration is ${nw} words (bible: 75-90)`);
  } else errors.push("lines must be an array");
  return { errors, warnings };
}

// ---------------------------------------------------------------- subjects
const LURE_WORDS = [
  [/crank/, "crankbait"], [/spinner/, "spinnerbait"], [/\bjig/, "jig"], [/worm|senko|soft.?plastic|plastic/, "worm"],
];
function detectLure(text) {
  const t = String(text || "").toLowerCase();
  for (const [re, k] of LURE_WORDS) if (re.test(t)) return k;
  if (/\blure|\bbait\b/.test(t)) return "crankbait";
  return null;
}
function detectSpecies(text) {
  const t = String(text || "").toLowerCase();
  if (/smallmouth|bronze/.test(t)) return "smallmouth";
  if (/spotted bass|spotted|kentucky/.test(t)) return "spotted";
  return null;
}
const ORGANS = [[/bladder/, "bladder"], [/\bgills?\b/, "gills"], [/\beyes?\b/, "eye"], [/\bmouth\b|\bjaw/, "mouth"], [/lateral|stripe/, "stripe"], [/stomach|belly/, "bladder"]];

export function parseSubject(shot, sb) {
  const raw = String(shot.subject || "bass").toLowerCase().trim();
  const action = String(shot.action || "");
  const ctx = `${raw} ${action} ${sb.title || ""} ${sb.hook || ""}`;
  const tagged = raw.startsWith("bass:") ? raw.slice(5).split(/[\s,]/)[0] : null;
  const species = [shot.species, tagged].find((x) => SPECIES.includes(x)) || detectSpecies(`${raw} ${action}`) || detectSpecies(ctx) || "largemouth";
  if (raw.startsWith("lure")) {
    const kind = raw.split(":")[1] ? detectLure(raw.split(":")[1]) || "crankbait" : detectLure(action) || "crankbait";
    return { type: "lure", kind, key: `lure:${kind}`, species };
  }
  if (/^(angler|fisherman|person|you|man|woman)/.test(raw)) return { type: "angler", key: "angler", species };
  if (/^boat/.test(raw)) return { type: "boat", key: "boat", species };
  if (/minnow|shad|baitfish|bait fish|forage/.test(raw)) return { type: "minnow", key: "minnow", species };
  if (/bluegill|sunfish|pumpkinseed|bream|rock bass/.test(raw)) return { type: "bluegill", key: "bluegill", species };
  if (/descending|lure|hook\b|crank|worm|jig|spinner/.test(raw)) {
    const kind = detectLure(raw) || "jig";
    return { type: "lure", kind, key: `lure:${kind}`, species };
  }
  let focus = null;
  for (const [re, k] of ORGANS) if (re.test(raw)) { focus = k; break; }
  const nest = /nest|eggs?\b|fry\b|\bbed\b|spawn/.test(`${raw} ${action}`.toLowerCase());
  const known = !raw || /^(bass|fish|largemouth|smallmouth|spotted)/.test(raw);
  return { type: "bass", species, focus, nest, unknown: known ? null : raw, key: `bass:${species}${focus ? ":" + focus : ""}${nest ? ":nest" : ""}` };
}

// action keywords -> motion verbs
export function actionVerbs(action) {
  const a = String(action || "").toLowerCase();
  const v = new Set();
  if (/swim(s|ming)? (past|by|across)|past|across|cruis|glide/.test(a)) v.add("travel");
  if (/rise|rising|reel(ed|s|ing)? up|pulled up|surface|up from|ascend|float/.test(a)) v.add("rise");
  if (/dive|sink|sinks|down to|deeper|descend|drop/.test(a)) v.add("dive");
  if (/strike|strikes|bite|bites|eat|attack|hit|lunge|gulp|inhale|engulf|snap/.test(a)) v.add("strike");
  if (/inflat|swell|expand|balloon|bloat|baro|pressure|bulge/.test(a)) v.add("inflate");
  if (/turn|spin|rotate|flip/.test(a)) v.add("turn");
  if (/cast/.test(a)) v.add("cast");
  if (/hook ?set|set(s)? the hook|yank|pull/.test(a)) v.add("hookset");
  if (/wobble|retriev|crank|reel/.test(a)) v.add("wobble");
  if (/release|let go|return/.test(a)) v.add("release");
  return v;
}

function subjectMarkup(subj, style, id, xray) {
  if (subj.type === "lure") return { svg: lureSVG({ kind: subj.kind, style }), vb: LURE_VIEWBOX, scaleW: 0.6 };
  if (subj.type === "minnow") {
    const one = minnowSVG({ style });
    const vb = { x: -200, y: -120, w: 400, h: 240 };
    const school = [[-90, -50, 1], [60, 0, 0.9], [-40, 70, 0.8]]
      .map(([x, y, s]) => one.replace('width="100%" height="100%"', `x="${x - 80 * s}" y="${y - 40 * s}" width="${160 * s}" height="${80 * s}"`))
      .join("");
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" class="subject-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="100%" height="100%" overflow="visible">${school}</svg>`, vb, scaleW: 0.55 };
  }
  if (subj.type === "bluegill") return { svg: bluegillSVG({ style }), vb: BLUEGILL_VIEWBOX, scaleW: 0.8 };
  if (subj.type === "angler") return { svg: anglerSVG({ style, id }), vb: ANGLER_VIEWBOX, scaleW: 0.6 };
  if (subj.type === "boat") return { svg: boatSVG({ style }), vb: BOAT_VIEWBOX, scaleW: 0.95 };
  let callouts = null;
  if (xray) callouts = ["bladder", "gills"];
  else if (subj.focus) callouts = [subj.focus];
  else if (style === "blueprint") callouts = ["mouth", "stripe", "dorsal"];
  if (callouts && subj.focus && !callouts.includes(subj.focus)) callouts.push(subj.focus);
  return { svg: bassSVG({ id, species: subj.species, style, xray, callouts }), vb: BASS_VIEWBOX, scaleW: 1 };
}

// ---------------------------------------------------------------- timeline ops
class Ops {
  constructor() { this.ops = []; }
  set(sel, vars, pos) { this.ops.push(["set", sel, vars, round3(pos)]); }
  to(sel, vars, pos) { this.ops.push(["to", sel, clean(vars), round3(pos)]); }
  fromTo(sel, from, to, pos) { this.ops.push(["fromTo", sel, clean(from), clean(to), round3(pos)]); }
}
function clean(v) {
  const o = {};
  for (const [k, val] of Object.entries(v)) if (val !== undefined && val !== null) o[k] = typeof val === "number" ? round3(val) : val;
  return o;
}

function emitLoop(ops, L, start, dur) {
  const legs = Math.max(1, Math.ceil(dur / L.period));
  const to = { ...L.to, duration: L.period, ease: L.to.ease || L.ease, repeat: legs - 1, yoyo: L.yoyo };
  const from = { ...L.from };
  if (L.origin) { from.transformOrigin = L.origin; }
  if (L.svgOrigin) { from.svgOrigin = L.svgOrigin; to.svgOrigin = L.svgOrigin; }
  ops.fromTo(L.sel, from, to, start);
}

// ---------------------------------------------------------------- camera
const LAYER_F = { far: { t: 0.35, s: 0.45 }, mid: { t: 0.75, s: 0.85 }, subj: { t: 1, s: 1 }, near: { t: 1.35, s: 1.2 } };

function cameraTargets(cam, state, k) {
  const s = { ...state };
  const dir = k % 2 === 0 ? 1 : -1;
  switch (cam) {
    case "push-in": s.s = Math.min(state.s + 0.3, 1.9); s.y = state.y - 10; break;
    case "pull-out": s.s = Math.max(state.s - 0.32, 0.9); s.y = state.y + 10; break;
    case "pan": s.x = clamp(state.x - 120 * dir, -160, 160); break;
    case "orbit": s.x = clamp(state.x + 100 * dir, -140, 140); s.r = clamp(state.r + 3 * dir, -6, 6); s.s = state.s * 1.04; break;
    default: s.s = state.s * 1.035;
  }
  return s;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function camStart(cam) {
  if (cam === "pull-out") return { s: 1.35, x: 0, y: 0, r: 0 };
  if (cam === "orbit") return { s: 1.05, x: -60, y: 0, r: -2 };
  if (cam === "pan") return { s: 1.05, x: 110, y: 0, r: 0 };
  return { s: 1, x: 0, y: 0, r: 0 };
}
function layerVars(st, f) {
  return { scale: 1 + (st.s - 1) * f.s, x: st.x * f.t, y: st.y * f.t, rotation: st.r * f.t * 0.6 };
}

// ---------------------------------------------------------------- main build
export function buildProject(sb, opts = {}) {
  const style = opts.style || sb.style || "clay";
  const { errors, warnings } = validateStoryboard({ ...sb, style });
  if (errors.length) throw new Error("storyboard invalid:\n  - " + errors.join("\n  - "));
  const R = rng(sb.id || "bassboat");
  const pal = PALETTES[style];
  const timing = planTiming(sb, opts.timingWords || null, opts.voiceDuration || null);
  const total = timing.total;
  if (!opts.allowShort && (total < 25 || total > 32)) warnings.push(`total length ${total}s is outside 25-32 s`);

  // shots with resolved scene/camera/time
  const shots = sb.shots.map((s, i) => ({
    ...s,
    scene: SCENE_NAMES.includes(s.scene) ? s.scene : "underwater",
    camera: CAMERAS.includes(s.camera) ? s.camera : "static",
    start: timing.shots[i].start,
    end: timing.shots[i].end,
    subj: (() => { const p = parseSubject(s, sb); if (p.unknown) warnings.push(`shot ${s.n}: subject "${p.unknown}" has no drawing, showing a bass`); return p; })(),
    verbs: actionVerbs(s.action),
  }));

  // segments = runs of the same scene (continuous camera, no cut)
  const segs = [];
  for (const s of shots) {
    const last = segs[segs.length - 1];
    if (last && last.scene === s.scene) last.shots.push(s);
    else segs.push({ scene: s.scene, shots: [s] });
  }
  segs.forEach((g, i) => {
    g.i = i;
    g.start = g.shots[0].start;
    g.end = g.shots[g.shots.length - 1].end;
    g.trIn = i === 0 ? null : i <= MAX_HARD_CUTS ? "cut" : "dissolve";
  });
  const hardCuts = segs.filter((g) => g.trIn === "cut").length;
  const dissolves = segs.filter((g) => g.trIn === "dissolve").length;
  if (dissolves) warnings.push(`${segs.length - 1} scene changes: first ${MAX_HARD_CUTS} are hard cuts, ${dissolves} became ${DISSOLVE}s dissolves (bible: 0-3 cuts)`);

  const ops = new Ops();
  const segHtml = [];

  for (const g of segs) {
    const prefix = `s${g.i}`;
    const scene = SCENES[g.scene].build({ style, R, prefix });
    const xray = !!scene.xray;
    // visible window (dissolves overlap neighbours)
    const vStart = g.trIn === "dissolve" ? Math.max(0, g.start - DISSOLVE / 2) : g.start;
    const next = segs[g.i + 1];
    const vEnd = next && next.trIn === "dissolve" ? Math.min(total, g.end + DISSOLVE / 2) : g.end;
    g.vStart = round3(vStart); g.vEnd = round3(vEnd);

    // ---- subjects in this segment
    const subjMap = new Map();
    for (const s of g.shots) {
      // angler/boat in a scene that already draws them -> focus only
      if ((s.subj.type === "angler" && scene.anchors.angler) || (s.subj.type === "boat" && scene.anchors.boat)) {
        s.subjId = null; s.focus = s.subj.type === "angler" ? scene.anchors.angler : scene.anchors.boat;
        s.sceneActor = s.subj.type === "angler" ? `#${prefix}-angler-arms` : `#${prefix}-boat`;
        continue;
      }
      if (!subjMap.has(s.subj.key)) subjMap.set(s.subj.key, { subj: s.subj, id: `${prefix}-sub${subjMap.size}`, shots: [] });
      const e = subjMap.get(s.subj.key);
      e.shots.push(s);
      s.subjId = e.id;
    }
    // secondary props: a lure on a line when a bass shot mentions one; a bass when a lure shot mentions a fish
    const props = new Map();
    for (const s of g.shots) {
      const lureKind = detectLure(s.action);
      if (s.subj.type === "bass" && lureKind && !xray) {
        const key = `lure:${lureKind}`;
        if (!props.has(key)) props.set(key, { subj: { type: "lure", kind: lureKind, key }, id: `${prefix}-prop${props.size}`, shots: [] });
        props.get(key).shots.push(s);
      }
      if (s.subj.type === "lure" && /bass|fish/.test(String(s.action).toLowerCase())) {
        const key = `bass:${s.subj.species}`;
        if (!props.has(key)) props.set(key, { subj: { type: "bass", species: s.subj.species, key }, id: `${prefix}-prop${props.size}`, shots: [], secondaryBass: true });
        props.get(key).shots.push(s);
      }
    }

    let subjLayer = "";
    const placeEl = (entry, anchor, scaleW, extraClass = "") => {
      const m = subjectMarkup(entry.subj, style, entry.id, xray);
      const w = anchor.w * (scaleW ?? m.scaleW);
      const h = (w * m.vb.h) / m.vb.w;
      entry.w = w; entry.h = h; entry.anchor = anchor;
      return `<div class="subject ${extraClass}" id="${entry.id}" style="left:${r1(anchor.x - w / 2)}px;top:${r1(anchor.y - h / 2)}px;width:${r1(w)}px;height:${r1(h)}px"><div class="act" id="${entry.id}-act"><div class="bob" id="${entry.id}-bob">${m.svg}</div></div></div>`;
    };
    // fishing line for props (drawn in the subject layer, static)
    let lineSvg = "";
    for (const [key, e] of props) {
      if (e.secondaryBass) {
        subjLayer += placeEl(e, { x: scene.anchors.subject.x - 150, y: scene.anchors.subject.y + 210, w: scene.anchors.subject.w * 0.62 }, 1);
      } else {
        const a = scene.anchors.prop;
        subjLayer += placeEl(e, a, 1);
        // line tie of the lure, in frame coords
        const tie = lureTie(e.subj.kind, a);
        const from = scene.anchors.rodTip || { x: tie.x + 40, y: scene.anchors.lineTop ?? -600 };
        lineSvg += `<path id="${e.id}-line" d="M${r1(from.x)},${r1(from.y)} Q${r1((from.x + tie.x) / 2 + 30)},${r1((from.y + tie.y) / 2)} ${r1(tie.x)},${r1(tie.y)}" stroke="${style === "blueprint" ? pal.line : "rgba(255,255,255,0.85)"}" stroke-width="${style === "blueprint" ? 2 : 2.5}" fill="none"${style === "blueprint" ? ' stroke-dasharray="8 6"' : ""}/>`;
      }
    }
    for (const [, e] of subjMap) {
      let anchor = scene.anchors.subject;
      if (e.subj.type === "lure") anchor = { ...anchor, w: anchor.w };
      subjLayer += placeEl(e, anchor);
      if (e.subj.type === "lure" && scene.anchors.rodTip) {
        const tie = lureTie(e.subj.kind, { ...anchor, w: e.w });
        const from = scene.anchors.rodTip;
        lineSvg += `<path d="M${r1(from.x)},${r1(from.y)} Q${r1((from.x + tie.x) / 2 + 30)},${r1((from.y + tie.y) / 2)} ${r1(tie.x)},${r1(tie.y)}" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" fill="none"/>`;
      }
    }
    if (lineSvg) subjLayer = layerSvg(lineSvg, "lines") + subjLayer;
    // nest on the bottom for nest/egg/fry shots (drawn behind the fish)
    if (g.shots.some((s) => s.subj.nest) && g.scene !== "cutaway") {
      const nw = 620, nh = (nw * NEST_VIEWBOX.h) / NEST_VIEWBOX.w;
      const ny = g.scene === "studio" ? 1150 : 1560;
      subjLayer = `<div class="subject" id="${prefix}-nest" style="left:${r1(540 - nw / 2)}px;top:${r1(ny - nh / 2)}px;width:${nw}px;height:${r1(nh)}px">${nestSVG({ style })}</div>` + subjLayer;
    }

    segHtml.push(`<div class="clip seg seg-${g.scene}" id="seg${g.i}" data-start="${g.vStart}" data-duration="${round3(g.vEnd - g.vStart)}" data-track-index="0" style="z-index:${1 + g.i}">
  <div class="layer far" data-layout-allow-overflow id="${prefix}-far">${layerSvg(scene.far)}</div>
  <div class="layer mid" data-layout-allow-overflow id="${prefix}-mid">${layerSvg(scene.mid)}</div>
  <div class="layer subj" data-layout-allow-overflow id="${prefix}-subj">${subjLayer}</div>
  <div class="layer near" data-layout-allow-overflow id="${prefix}-near">${layerSvg(scene.near)}</div>
</div>`);

    // ---- dissolve in
    if (g.trIn === "dissolve") ops.fromTo(`#seg${g.i}`, { opacity: 0 }, { opacity: 1, duration: DISSOLVE, ease: "none" }, g.vStart);

    // ---- ambient loops for the whole visible window
    for (const L of scene.loops) emitLoop(ops, L, g.vStart, g.vEnd - g.vStart);

    // ---- camera: one continuous move per shot, origin fixed at the first focus
    const first = g.shots[0];
    const focus0 = first.focus || (first.subjId ? subjMap.get(first.subj.key).anchor : scene.anchors.subject);
    const origin = `${r1(focus0.x)}px ${r1(focus0.y)}px`;
    let cam = camStart(first.camera);
    // NOTE: never stack a set + tween on the same target at the same time:
    // HyperFrames may render same-time zero-duration tweens in either order.
    // Every camera leg is an explicit fromTo.
    g.shots.forEach((s, k) => {
      let target = cameraTargets(s.camera, cam, k);
      // shift focus toward a scene actor (angler/boat) that sits off-centre
      if (s.focus && s.focus !== focus0) {
        target = { ...target, x: clamp((focus0.x - s.focus.x) * 0.8, -260, 260), y: clamp((focus0.y - s.focus.y) * 0.8, -420, 420) };
      } else if (k > 0 && g.shots[k - 1].focus && g.shots[k - 1].focus !== focus0) {
        target = { ...target, x: 0, y: 0 };
      }
      // camera follows a travelling subject so it stays framed (background parallax sells the motion)
      if (s.subjId && s.verbs.has("travel") && !s.verbs.has("strike")) {
        const e = subjMap.get(s.subj.key);
        target = { ...target, x: clamp(-Math.min(120, e.w * 0.14) * target.s * 0.9, -260, 260) };
      }
      const t0 = k === 0 ? g.vStart : s.start;
      const dur = (k === g.shots.length - 1 ? g.vEnd : s.end) - t0;
      const ease = g.shots.length === 1 ? "sine.inOut" : k === 0 ? "sine.in" : k === g.shots.length - 1 ? "sine.out" : "none";
      for (const [ln, f] of Object.entries(LAYER_F)) {
        ops.fromTo(`#${prefix}-${ln}`, { ...layerVars(cam, f), transformOrigin: origin }, { ...layerVars(target, f), duration: dur, ease: ease === "none" ? "power1.inOut" : ease }, t0);
      }
      cam = target;
    });

    // ---- subject visibility + per-shot actions
    const allEntries = [...subjMap.values(), ...props.values()];
    for (const e of allEntries) {
      const ids = new Set(e.shots.map((s) => s.n));
      // visibility runs
      let visible = ids.has(g.shots[0].n);
      if (!visible) ops.set(`#${e.id}`, { autoAlpha: 0 }, g.vStart);
      g.shots.forEach((s, k) => {
        if (k === 0) return;
        const on = ids.has(s.n);
        if (on && !visible) ops.fromTo(`#${e.id}`, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.28, ease: "back.out(1.6)" }, s.start);
        if (!on && visible) ops.fromTo(`#${e.id}`, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 0.85, duration: 0.18, ease: "power1.in" }, Math.max(g.vStart + 0.01, s.start - 0.18));
        visible = on;
      });
      // idle life for the visible window
      const span = g.vEnd - g.vStart;
      if (e.subj.type === "bass") {
        emitLoop(ops, { sel: `#${e.id}-tail`, from: { rotation: -9 }, to: { rotation: 9 }, period: 0.42, yoyo: true, ease: "sine.inOut", svgOrigin: BASS_ORIGINS.tail }, g.vStart, span);
        emitLoop(ops, { sel: `#${e.id}-pec`, from: { rotation: -10 }, to: { rotation: 14 }, period: 0.55, yoyo: true, ease: "sine.inOut", svgOrigin: BASS_ORIGINS.pec }, g.vStart, span);
        emitLoop(ops, { sel: `#${e.id}-bob`, from: { y: -8, rotation: -0.8 }, to: { y: 8, rotation: 0.8 }, period: 1.3, yoyo: true, ease: "sine.inOut" }, g.vStart, span);
      } else if (e.subj.type === "lure") {
        emitLoop(ops, { sel: `#${e.id}-bob`, from: { rotation: -6, y: -4 }, to: { rotation: 6, y: 4 }, period: 0.5, yoyo: true, ease: "sine.inOut", origin: "20% 50%" }, g.vStart, span);
      } else if (e.subj.type === "minnow") {
        emitLoop(ops, { sel: `#${e.id}-bob`, from: { x: -14, y: -6 }, to: { x: 14, y: 6 }, period: 0.9, yoyo: true, ease: "sine.inOut" }, g.vStart, span);
      } else if (e.subj.type === "boat") {
        emitLoop(ops, { sel: `#${e.id}-bob`, from: { y: -6, rotation: -1 }, to: { y: 6, rotation: 1 }, period: 1.8, yoyo: true, ease: "sine.inOut" }, g.vStart, span);
      }
    }

    // actions: per shot, on the primary subject's .act wrapper. Each shot is
    // a chain of explicit fromTo legs carrying the full transform state.
    const actState = new Map();
    const legs = (sel, from, list, t) => {
      let cur = { ...from };
      for (const L of list) {
        const nxt = { ...cur, ...L.to };
        if (L.dur > 0.001) ops.fromTo(sel, { ...cur }, { ...nxt, duration: L.dur, ease: L.ease || "sine.inOut" }, t);
        t += L.dur;
        cur = nxt;
      }
      return cur;
    };
    for (const s of g.shots) {
      const dur = s.end - s.start;
      if (s.sceneActor) {
        const amp = s.verbs.has("cast") ? -35 : s.verbs.has("hookset") || s.verbs.has("rise") || s.verbs.has("wobble") ? -14 : 0;
        if (amp) ops.fromTo(s.sceneActor, { rotation: 0, transformOrigin: "20% 30%" }, { rotation: amp, duration: Math.min(0.5, dur / 2), ease: "power2.inOut", yoyo: true, repeat: 1 }, s.start + 0.05);
        continue;
      }
      if (!s.subjId) continue;
      const e = subjMap.get(s.subj.key);
      const sel = `#${e.id}-act`;
      // re-entering after being hidden: start fresh, centred
      const prevShot = g.shots[g.shots.indexOf(s) - 1];
      const fresh = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
      const st = prevShot && prevShot.subjId === e.id ? actState.get(e.id) || fresh : fresh;
      const v = s.verbs;
      let list = [];
      if (e.subj.type === "bass") {
        const prop = [...props.values()].find((p) => p.shots.includes(s) && p.subj.type === "lure");
        if (v.has("strike")) {
          let dx = 140, dy = 0;
          if (prop) {
            const mouthX = e.anchor.x + st.x + e.w * ((612 - BASS_VIEWBOX.x) / BASS_VIEWBOX.w - 0.5);
            const mouthY = e.anchor.y + st.y + e.h * ((160 - BASS_VIEWBOX.y) / BASS_VIEWBOX.h - 0.5);
            const tie = lureTie(prop.subj.kind, prop.anchor);
            dx = clamp(tie.x + prop.w * 0.15 - mouthX, 40, 320);
            dy = clamp(prop.anchor.y - mouthY, -300, 300);
          }
          const t0 = dur * 0.35;
          list = [{ to: { x: st.x - 30 }, dur: t0, ease: "sine.inOut" }, { to: { x: st.x + dx, y: st.y + dy, scaleX: 1.06, scaleY: 1.06 }, dur: 0.3, ease: "power3.in" }, { to: {}, dur: Math.max(0, dur - t0 - 0.3) }];
          ops.fromTo(`#${e.id}-jaw`, { rotation: 0, svgOrigin: BASS_ORIGINS.jaw(e.subj.species) }, { rotation: 24, svgOrigin: BASS_ORIGINS.jaw(e.subj.species), duration: 0.2, ease: "power2.out", yoyo: true, repeat: 1 }, s.start + t0 + 0.1);
          if (prop) ops.fromTo([`#${prop.id}`, `#${prop.id}-line`], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.06 }, s.start + t0 + 0.3);
        } else if (v.has("travel")) {
          const fromX = st.x > -100 ? -Math.min(160, e.w * 0.18) : st.x;
          const start = { ...st, x: fromX, rotation: 0 };
          actState.set(e.id, legs(sel, start, [{ to: { x: Math.min(120, e.w * 0.14) }, dur, ease: "sine.out" }], s.start));
          continue;
        } else if (v.has("rise")) {
          list = [{ to: { y: Math.max(-260, st.y - 220), rotation: -14 }, dur: dur * 0.8, ease: "power1.inOut" }, { to: { rotation: 0 }, dur: dur * 0.2 }];
        } else if (v.has("dive")) {
          list = [{ to: { y: Math.min(240, st.y + 240), rotation: 12 }, dur: dur * 0.8, ease: "power1.inOut" }, { to: { rotation: 0 }, dur: dur * 0.2 }];
        } else if (v.has("inflate")) {
          if (xray) {
            ops.fromTo(`#${e.id}-bladder`, { scale: 1, svgOrigin: BASS_ORIGINS.bladder }, { scale: 1.75, svgOrigin: BASS_ORIGINS.bladder, duration: dur * 0.9, ease: "power2.in" }, s.start);
            ops.fromTo(`#${e.id}-belly`, { scale: 1, svgOrigin: BASS_ORIGINS.belly }, { scale: 0.7, svgOrigin: BASS_ORIGINS.belly, duration: dur * 0.9 }, s.start);
          }
          list = [{ to: { scaleY: 1.1, scaleX: 1.03 }, dur: dur * 0.9, ease: "power2.in" }, { to: {}, dur: dur * 0.1 }];
        } else if (v.has("turn")) {
          list = [{ to: { rotation: -10 }, dur: dur * 0.3 }, { to: { rotation: 0 }, dur: dur * 0.3 }, { to: {}, dur: dur * 0.4 }];
        } else if (v.has("release")) {
          list = [{ to: { x: st.x + 120, y: Math.min(240, st.y + 160), rotation: 8 }, dur, ease: "power1.inOut" }];
        } else {
          // gentle hover drift toward centre so consecutive shots stay framed
          list = [{ to: { x: st.x * 0.4 + 30, y: st.y * 0.5, rotation: 0, scaleX: 1, scaleY: 1 }, dur, ease: "sine.inOut" }];
        }
      } else if (e.subj.type === "lure") {
        list = v.has("dive") ? [{ to: { y: Math.min(260, st.y + 220), rotation: 18 }, dur, ease: "power1.out" }] : [{ to: { x: st.x > 60 ? -60 : st.x - 90, rotation: -4 }, dur }];
      } else if (e.subj.type === "angler") {
        ops.fromTo(`#${e.id}-arms`, { rotation: 0, transformOrigin: "20% 30%" }, { rotation: v.has("cast") ? -35 : -12, duration: 0.35, yoyo: true, repeat: 1, ease: "power2.inOut" }, s.start + 0.2);
        list = [{ to: {}, dur }];
      } else {
        list = [{ to: { x: st.x + 60 }, dur }];
      }
      actState.set(e.id, legs(sel, st, list, s.start));
    }
  }
  // ---------------------------------------------------------- captions
  const capHtml = timing.cards
    .map((c, i) => {
      const len = c.text.length;
      const fs = len > 26 ? 72 : len > 20 ? 82 : 94;
      return `<div class="clip cap" id="cap${i}" data-start="${c.start}" data-duration="${round3(c.end - c.start)}" data-track-index="2"><span style="font-size:${fs}px">${esc(c.text)}</span></div>`;
    })
    .join("\n");
  timing.cards.forEach((c, i) => ops.fromTo(`#cap${i} span`, { scale: 0.86, y: 14 }, { scale: 1, y: 0, duration: 0.12, ease: "back.out(2)" }, c.start));

  // ---------------------------------------------------------- HUD (ten-facts + blueprint plate)
  let hud = "";
  let stopwatch = "";
  if (sb.format === "ten-facts") {
    shots.forEach((s) => {
      if (s.counter == null) return;
      const id = `ctr${s.n}`;
      hud += `<div class="clip counter" id="${id}" data-start="${s.start}" data-duration="${round3(s.end - s.start)}" data-track-index="3"><span class="num">${esc(s.counter)}</span><span class="of">/10</span></div>`;
      ops.fromTo(`#${id} .num`, { scale: 1.5 }, { scale: 1, duration: 0.22, ease: "back.out(2)" }, s.start);
    });
    hud += `<div class="clip watch" id="watch" data-start="0" data-duration="${total}" data-track-index="3"><svg viewBox="0 0 40 40" width="44" height="44"><circle cx="20" cy="22" r="15" fill="none" stroke="currentColor" stroke-width="4"/><path d="M20 22 L20 12 M15 3 L25 3" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg><span id="watch-t">0.0s</span></div>`;
    stopwatch = `const sw = { t: 0 }; const swEl = document.getElementById("watch-t");
      tl.to(sw, { t: ${total}, duration: ${total}, ease: "none", onUpdate: () => { swEl.textContent = sw.t.toFixed(1) + "s"; } }, 0);`;
  } else if (style === "blueprint") {
    const sp = shots[0].subj.species || "largemouth";
    const latin = { largemouth: "MICROPTERUS SALMOIDES", smallmouth: "MICROPTERUS DOLOMIEU", spotted: "MICROPTERUS PUNCTULATUS" }[sp];
    hud += `<div class="clip plate" id="plate" data-start="0" data-duration="${total}" data-track-index="3"><b>FIG. 1 · ${sp.toUpperCase()} BASS</b><span>${latin}</span></div>`;
  }

  // ---------------------------------------------------------- audio
  let audio = "";
  if (opts.voiceFile) {
    audio = `<audio id="vo" src="${opts.voiceFile}" data-start="0" data-duration="${total}" data-track-index="9" data-volume="1"></audio>`;
  }

  const vars = Object.entries(cssVars(style)).map(([k, v]) => `${k}:${v}`).join(";");
  const html = `<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>${esc(sb.title || sb.id)}</title>
<!-- generated by render/build.mjs from ${esc(sb.id)} (${esc(sb.format)}, ${style}); do not edit by hand -->
<script src="vendor/gsap.min.js"></script>
<style>
@font-face { font-family: "BB Inter"; src: url("vendor/fonts/inter-latin-900-normal.woff2") format("woff2"); font-weight: 900; }
@font-face { font-family: "BB Inter"; src: url("vendor/fonts/inter-latin-800-normal.woff2") format("woff2"); font-weight: 800; }
@font-face { font-family: "JetBrains Mono"; src: url("vendor/fonts/jetbrains-mono-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
@font-face { font-family: "JetBrains Mono"; src: url("vendor/fonts/jetbrains-mono-latin-500-normal.woff2") format("woff2"); font-weight: 500; }
:root { ${vars}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: var(--bg); }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: var(--bg); font-family: "BB Inter", Inter, "Helvetica Neue", Arial, sans-serif; }
.defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.seg { position: absolute; inset: 0; overflow: hidden; background: var(--bg); }
.layer { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; will-change: transform; }
.layer-svg { position: absolute; overflow: visible; }
.subject { position: absolute; }
.subject .act, .subject .bob { width: 100%; height: 100%; }
.subject-svg { display: block; overflow: visible; }
.cap { position: absolute; left: 70px; right: 70px; top: 1250px; height: 260px; display: flex; align-items: center; justify-content: center; text-align: center; z-index: 50; pointer-events: none; }
.cap span { display: inline-block; color: var(--cap-color); font-weight: 900; line-height: 1.04; letter-spacing: -0.01em; -webkit-text-stroke: 16px var(--cap-shadow); paint-order: stroke fill; text-shadow: 0 8px 18px rgba(0,0,0,0.45); }
.counter { position: absolute; left: 60px; top: 190px; height: 150px; padding: 0 34px; border-radius: 75px; background: var(--hud-bg); color: var(--hud-fg); display: flex; align-items: baseline; justify-content: center; gap: 6px; z-index: 40; }
.counter .num { display: inline-block; font-weight: 900; font-size: 120px; line-height: 150px; color: var(--hud-accent); }
.counter .of { font-weight: 800; font-size: 48px; opacity: 0.85; }
.watch { position: absolute; right: 60px; top: 205px; height: 120px; padding: 0 32px 0 26px; border-radius: 60px; background: var(--hud-bg); color: var(--hud-fg); display: flex; align-items: center; gap: 14px; z-index: 40; font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 700; font-size: 60px; }
.watch svg { color: var(--hud-accent); }
.watch span { min-width: 190px; text-align: right; }
.plate { position: absolute; left: 60px; top: 190px; padding: 18px 26px; border: 3px solid var(--hud-accent); background: var(--hud-bg); color: var(--hud-fg); font-family: "JetBrains Mono", monospace; z-index: 40; display: flex; flex-direction: column; gap: 6px; }
.plate b { font-size: 34px; font-weight: 700; letter-spacing: 0.04em; }
.plate span { font-size: 24px; font-weight: 500; color: var(--hud-accent); letter-spacing: 0.06em; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920" data-fps="30">
<svg class="defs" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">${globalDefs(style)}</svg>
${segHtml.join("\n")}
${hud}
${capHtml}
${audio}
<script>
(function () {
  const tl = gsap.timeline({ paused: true });
  const T = ${JSON.stringify(ops.ops)};
  for (const op of T) {
    if (op[0] === "set") tl.set(op[1], op[2], op[3]);
    else if (op[0] === "to") tl.to(op[1], op[2], op[3]);
    // immediateRender:false so a later tween's "from" never leaks into earlier frames
    else tl.fromTo(op[1], op[2], Object.assign({ immediateRender: false }, op[3]), op[4]);
  }
  ${stopwatch}
  tl.set({}, {}, ${total});
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);
})();
</script>
</div>
</body>
</html>
`;
  const report = {
    id: sb.id, format: sb.format, style, total,
    hardCuts, dissolves, segments: segs.map((g) => ({ scene: g.scene, start: g.vStart, end: g.vEnd, transition: g.trIn, shots: g.shots.map((s) => s.n) })),
    shots: shots.map((s) => ({ n: s.n, scene: s.scene, camera: s.camera, subject: s.subj.key, verbs: [...s.verbs], start: s.start, end: s.end })),
    cards: timing.cards, warnings, voice: !!opts.voiceFile,
  };
  return { html, report };
}

function lureTie(kind, a) {
  // line-tie point of each lure in its viewBox, mapped to frame coords
  const ties = { crankbait: [-92, 16], worm: [-130, -22], jig: [-92, -8], spinnerbait: [-122, 0] };
  const [tx, ty] = ties[kind] || ties.crankbait;
  const w = a.w, s = w / LURE_VIEWBOX.w;
  return { x: a.x + tx * s, y: a.y + ty * s };
}

// ---------------------------------------------------------------- write project
export function writeProject(sbPath, opts = {}) {
  const sb = JSON.parse(fs.readFileSync(sbPath, "utf8"));
  const outDir = path.resolve(opts.out || path.join(path.dirname(sbPath), "hf"));
  fs.mkdirSync(path.join(outDir, "vendor", "fonts"), { recursive: true });
  let timingWords = null, voiceDuration = null, voiceFile = null;
  if (opts.timings) {
    const t = JSON.parse(fs.readFileSync(opts.timings, "utf8"));
    timingWords = t.words || t;
    if (t.duration) voiceDuration = t.duration;
  }
  if (opts.voice) {
    const ext = path.extname(opts.voice) || ".mp3";
    voiceFile = `voice${ext}`;
    fs.copyFileSync(opts.voice, path.join(outDir, voiceFile));
    const d = probeDuration(opts.voice);
    if (d) voiceDuration = d;
  }
  const { html, report } = buildProject(sb, { ...opts, timingWords, voiceDuration, voiceFile });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  const vend = path.join(HERE, "vendor");
  fs.copyFileSync(path.join(vend, "gsap.min.js"), path.join(outDir, "vendor", "gsap.min.js"));
  for (const f of fs.readdirSync(path.join(vend, "fonts"))) if (f.endsWith(".woff2")) fs.copyFileSync(path.join(vend, "fonts", f), path.join(outDir, "vendor", "fonts", f));
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({ id: sb.id, name: sb.title || sb.id }, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: false } }, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "build.json"), JSON.stringify(report, null, 2) + "\n");
  return { outDir, report };
}

function probeDuration(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
    const d = parseFloat(out);
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (["allow-short", "quiet"].includes(k)) o[k] = true;
      else o[k] = argv[++i];
    } else o._.push(a);
  }
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2));
  if (!a._[0]) {
    console.error("usage: node render/build.mjs <storyboard.json> [--voice voice.mp3 --timings timings.json] [--out dir] [--style clay|blueprint|isometric]");
    process.exit(2);
  }
  try {
    const { outDir, report } = writeProject(a._[0], { voice: a.voice, timings: a.timings, out: a.out, style: a.style, allowShort: a["allow-short"] });
    if (!a.quiet) {
      console.log(`built ${outDir} (${report.total}s, ${report.segments.length} segments, ${report.hardCuts} hard cuts, ${report.cards.length} caption cards)`);
      for (const w of report.warnings) console.log(`  warn: ${w}`);
    }
  } catch (e) {
    console.error(`build failed: ${e.message}`);
    process.exit(1);
  }
}
