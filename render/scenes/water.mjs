// Shared water/background pieces for the scene library, per house style.
// All coordinates are frame coordinates (1080x1920) with overscan.

import { PALETTES, mix } from "./palettes.mjs";
import { loop, OVER_X, OVER_Y, W, H, r1 } from "./lib.mjs";

const X0 = -OVER_X, Y0 = -OVER_Y, XW = W + 2 * OVER_X, YH = H + 2 * OVER_Y;

// Isometric diorama geometry (front face + top face + right side face).
export const ISO = { x0: 30, x1: 880, bottom: 1600, dx: 170, dy: -118 };

export function fullRect(fill, extra = "") {
  return `<rect x="${X0}" y="${Y0}" width="${XW}" height="${YH}" fill="${fill}" ${extra}/>`;
}

// Blueprint paper: grid + major grid.
export function blueprintPaper() {
  const p = PALETTES.blueprint;
  return fullRect(p.bg) + fullRect("url(#p-grid)") + fullRect("url(#p-grid-major)");
}

// --- weeds -------------------------------------------------------------
export function weed(style, x, baseY, h, lean, id, shade = 0) {
  const p = PALETTES[style];
  if (style === "blueprint") {
    return `<path id="${id}" d="M${x},${baseY} C${x + lean * 0.3},${baseY - h * 0.35} ${x - lean * 0.4},${baseY - h * 0.65} ${x + lean},${baseY - h}" stroke="${p.line}" stroke-opacity="0.75" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  const col = p.weed[Math.min(shade, p.weed.length - 1)];
  const w = style === "clay" ? 26 : 22;
  const tipX = x + lean, tipY = baseY - h;
  if (style === "isometric") {
    return `<path id="${id}" d="M${x - w / 2},${baseY} L${x + lean * 0.5 - 4},${baseY - h * 0.55} L${tipX},${tipY} L${x + lean * 0.5 + 10},${baseY - h * 0.5} L${x + w / 2},${baseY} Z" fill="${col}"/>`;
  }
  return `<path id="${id}" d="M${x - w / 2},${baseY} C${x - w / 2 + lean * 0.2},${baseY - h * 0.4} ${tipX - 18},${tipY + h * 0.25} ${tipX},${tipY} C${tipX + 10},${tipY + h * 0.3} ${x + w / 2 + lean * 0.3},${baseY - h * 0.4} ${x + w / 2},${baseY} Z" fill="${col}"/>`;
}

// --- bubbles ------------------------------------------------------------
export function bubbles(style, R, prefix, n, area) {
  const p = PALETTES[style];
  let svg = "";
  const loops = [];
  for (let i = 0; i < n; i++) {
    const x = r1(area.x + R() * area.w);
    const y = r1(area.y + R() * area.h);
    const r = r1(5 + R() * 12);
    const id = `${prefix}-b${i}`;
    if (style === "blueprint") svg += `<circle id="${id}" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${p.line}" stroke-opacity="0.6" stroke-width="2"/>`;
    else if (style === "isometric") svg += `<rect id="${id}" x="${x - r / 2}" y="${y - r / 2}" width="${r}" height="${r}" fill="#ffffff" opacity="0.7" transform="rotate(45 ${x} ${y})"/>`;
    else svg += `<circle id="${id}" cx="${x}" cy="${y}" r="${r}" fill="url(#g-bubble)" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.5"/>`;
    const rise = 380 + R() * 420;
    loops.push(loop(`#${id}`, { y: 0, opacity: 0.0 }, { y: -rise, opacity: 0.9, ease: "none" }, 2.6 + R() * 2.4, { yoyo: false, ease: "none" }));
  }
  return { svg, loops };
}

// --- full-bleed water (clay / blueprint) ---------------------------------
// surfaceY: y of the water surface in frame coords (negative = surface off top)
export function waterLayers(style, R, prefix, surfaceY, floorY = 1560, opts = {}) {
  const p = PALETTES[style];
  const far = [], mid = [], near = [];
  const loops = [];
  if (style === "clay") {
    far.push(`<rect x="${X0}" y="${surfaceY}" width="${XW}" height="${Y0 + YH - surfaceY}" fill="url(#g-water)"/>`);
    // light rays
    for (let i = 0; i < 5; i++) {
      const x = -200 + i * 300 + R() * 80;
      const id = `${prefix}-ray${i}`;
      far.push(`<path id="${id}" d="M${x},${surfaceY} L${x + 120},${surfaceY} L${x + 360},${surfaceY + 1500} L${x + 140},${surfaceY + 1500} Z" fill="url(#g-ray)" opacity="0.55"/>`);
      loops.push(loop(`#${id}`, { opacity: 0.25 }, { opacity: 0.6 }, 2.2 + R() * 1.5));
    }
    // distant rocks + weeds (soft, low contrast)
    const farCol = mix(p.water[2], p.water[1], 0.35);
    far.push(`<g filter="url(#f-blur-far)" opacity="0.8">
      <path d="M-360,${floorY - 120} C-200,${floorY - 300} 0,${floorY - 260} 160,${floorY - 170} C300,${floorY - 300} 520,${floorY - 330} 700,${floorY - 180} C860,${floorY - 280} 1100,${floorY - 300} 1440,${floorY - 140} L1440,${floorY + 800} L-360,${floorY + 800} Z" fill="${farCol}"/>
    </g>`);
    // sand floor + rocks (mid)
    mid.push(`<path d="M-360,${floorY} C-100,${floorY - 40} 200,${floorY + 10} 540,${floorY - 20} C800,${floorY - 40} 1100,${floorY + 10} 1440,${floorY - 20} L1440,2400 L-360,2400 Z" fill="${p.sand}"/>`);
    mid.push(`<path d="M-360,${floorY + 70} C0,${floorY + 40} 500,${floorY + 90} 1440,${floorY + 50} L1440,2400 L-360,2400 Z" fill="${p.sandDark}" opacity="0.6"/>`);
    for (const [x, rx, ry, k] of [[60, 130, 80, 0], [930, 170, 100, 1], [700, 70, 44, 0]]) {
      mid.push(`<g filter="url(#f-clay)"><ellipse cx="${x}" cy="${floorY - ry * 0.35}" rx="${rx}" ry="${ry}" fill="${p.rock[k]}"/><ellipse cx="${x - rx * 0.25}" cy="${floorY - ry * 0.7}" rx="${rx * 0.4}" ry="${ry * 0.22}" fill="#fff" opacity="0.18"/></g>`);
    }
  } else if (style === "blueprint") {
    far.push(blueprintPaper());
    if (surfaceY > -200) {
      far.push(`<path d="M-360,${surfaceY} ${Array.from({ length: 30 }, (_, i) => `q30,-14 60,0 t60,0`).join(" ")}" stroke="${p.surface}" stroke-width="3" fill="none"/>`);
      if (opts.label !== false) far.push(`<text x="40" y="${surfaceY - 22}" font-family="JetBrains Mono, monospace" font-size="26" font-weight="700" fill="${p.label}">WATER SURFACE</text>`);
    }
    // depth ruler
    let ruler = `<path d="M24,${Math.max(surfaceY, 120)} L24,${floorY}" stroke="${p.line}" stroke-width="2.5"/>`;
    for (let y = Math.max(surfaceY, 120), k = 0; y <= floorY; y += 60, k++) ruler += `<path d="M24,${y} l${k % 5 === 0 ? 34 : 16},0" stroke="${p.line}" stroke-width="2"/>`;
    far.push(ruler);
    // bottom contour with hatch
    mid.push(`<path d="M-360,${floorY} C-100,${floorY - 40} 200,${floorY + 10} 540,${floorY - 20} C800,${floorY - 40} 1100,${floorY + 10} 1440,${floorY - 20} L1440,2400 L-360,2400 Z" fill="url(#p-hatch-faint)" stroke="${p.line}" stroke-width="3"/>`);
    for (const [x, w, h] of [[-40, 260, 120], [800, 300, 150]]) {
      const d = `M${x},${floorY + 20} L${x + w * 0.12},${floorY - h * 0.7} L${x + w * 0.42},${floorY - h} L${x + w * 0.8},${floorY - h * 0.8} L${x + w},${floorY + 20} Z`;
      mid.push(`<path d="${d}" fill="${p.bg}" stroke="${p.line}" stroke-width="3" stroke-linejoin="round"/><path d="${d}" fill="url(#p-hatch-faint)"/>`);
    }
  }
  // weeds (both styles)
  const ids = [], bases = [];
  const spots = [[-40, 520, 60], [120, 380, -40], [180, 300, 30], [860, 460, -50], [980, 560, 40], [1060, 340, -20]];
  spots.forEach(([x, h, lean], i) => {
    const id = `${prefix}-w${i}`;
    ids.push(id); bases.push(floorY);
    const wd = weed(style, x, floorY + 10, h, lean, id, i % 3);
    mid.push(style === "clay" ? `<g filter="url(#f-clay)">${wd}</g>` : wd);
  });
  ids.forEach((id, i) => loops.push(loop(`#${id}`, { rotation: -3 - R() * 3 }, { rotation: 3 + R() * 3 }, 1.8 + R() * 1.4, { origin: "50% 100%" })));
  // bubbles
  const b = bubbles(style, R, prefix, style === "clay" ? 14 : 10, { x: -100, y: 600, w: 1280, h: 1000 });
  near.push(b.svg);
  loops.push(...b.loops);
  // clay: big out-of-focus foreground weed at the edges
  if (style === "clay") {
    near.push(`<g filter="url(#f-soft)" opacity="0.7"><path d="M-160,2100 C-110,1700 -80,1450 -20,1300 C0,1500 -10,1800 0,2100 Z" fill="${p.weed[2]}"/><path d="M1240,2100 C1190,1750 1170,1500 1110,1380 C1090,1560 1090,1800 1090,2100 Z" fill="${p.weed[2]}"/></g>`);
  }
  return { far: far.join(""), mid: mid.join(""), near: near.join(""), loops };
}

// --- isometric diorama -----------------------------------------------------
export function isoBox(R, prefix, surfaceY) {
  const p = PALETTES.isometric;
  const { x0, x1, bottom, dx, dy } = ISO;
  const far = [], mid = [], near = [];
  const loops = [];
  far.push(fullRect(p.bg));
  // ground shadow under the box
  far.push(`<path d="M${x0 + 30},${bottom + 26} L${x1 + 30},${bottom + 26} L${x1 + dx + 30},${bottom + dy + 26} L${x1 + dx},${bottom + dy} L${x1},${bottom} L${x0},${bottom} Z" fill="#000" opacity="0.08"/>`);
  const sedH = 150;
  const waterH = bottom - sedH - surfaceY;
  const n = p.bands.length;
  // front face water bands
  for (let i = 0; i < n; i++) {
    const y = surfaceY + (waterH * i) / n;
    mid.push(`<rect x="${x0}" y="${r1(y)}" width="${x1 - x0}" height="${r1(waterH / n + 1)}" fill="${p.bands[i]}"/>`);
    // side face band
    mid.push(`<path d="M${x1},${r1(y)} L${x1 + dx},${r1(y + dy)} L${x1 + dx},${r1(y + dy + waterH / n + 1)} L${x1},${r1(y + waterH / n + 1)} Z" fill="${p.side[i]}"/>`);
    // depth tick on the front-left edge
    mid.push(`<rect x="${x0}" y="${r1(y)}" width="18" height="4" fill="#ffffff" opacity="0.6"/>`);
  }
  // sediment layers
  const sedCols = p.sediment;
  for (let i = 0; i < 3; i++) {
    const y = bottom - sedH + (sedH * i) / 3;
    mid.push(`<rect x="${x0}" y="${r1(y)}" width="${x1 - x0}" height="${r1(sedH / 3 + 1)}" fill="${sedCols[i]}"/>`);
    mid.push(`<path d="M${x1},${r1(y)} L${x1 + dx},${r1(y + dy)} L${x1 + dx},${r1(y + dy + sedH / 3 + 1)} L${x1},${r1(y + sedH / 3 + 1)} Z" fill="${mix(sedCols[i], "#000000", 0.18)}"/>`);
  }
  mid.push(`<rect x="${x0}" y="${bottom - sedH}" width="${x1 - x0}" height="${sedH}" fill="url(#p-iso-sand)"/>`);
  // top face (water surface)
  mid.push(`<path id="${prefix}-top" d="M${x0},${surfaceY} L${x1},${surfaceY} L${x1 + dx},${surfaceY + dy} L${x0 + dx},${surfaceY + dy} Z" fill="${p.top}"/>`);
  mid.push(`<path d="M${x0},${surfaceY} L${x1},${surfaceY} L${x1 + dx},${surfaceY + dy}" stroke="${p.topEdge}" stroke-width="5" fill="none"/>`);
  // ripples on top
  for (let i = 0; i < 4; i++) {
    const cx = x0 + 160 + i * 190 + R() * 40, cy = surfaceY + dy * (0.3 + R() * 0.4);
    mid.push(`<path id="${prefix}-rip${i}" d="M${r1(cx - 40)},${r1(cy)} l40,-14 l40,14" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.7"/>`);
    loops.push(loop(`#${prefix}-rip${i}`, { x: -16 }, { x: 16 }, 1.6 + R()));
  }
  // flat rocks + weeds on the sediment
  const floorY = bottom - sedH;
  for (const [x, w, h, k] of [[90, 150, 70, 0], [700, 190, 90, 1], [560, 80, 40, 0]]) {
    mid.push(`<path d="M${x},${floorY + 10} L${x + w * 0.15},${floorY - h} L${x + w * 0.7},${floorY - h - 10} L${x + w},${floorY + 10} Z" fill="${p.rock[k]}"/><path d="M${x + w * 0.15},${floorY - h} L${x + w * 0.7},${floorY - h - 10} L${x + w * 0.55},${floorY - h * 0.55} Z" fill="#ffffff" opacity="0.25"/>`);
  }
  const ids = [];
  [[70, 430, 40], [150, 300, -30], [770, 380, -40], [840, 260, 20], [470, 200, 30]].forEach(([x, h, lean], i) => {
    const id = `${prefix}-w${i}`;
    ids.push(id);
    mid.push(weed("isometric", x, floorY + 6, h, lean, id, i % 2));
  });
  ids.forEach((id) => loops.push(loop(`#${id}`, { rotation: -3 }, { rotation: 3 }, 1.8 + R() * 1.2, { origin: "50% 100%" })));
  const b = bubbles("isometric", R, prefix, 10, { x: x0 + 40, y: surfaceY + 300, w: x1 - x0 - 80, h: waterH - 300 });
  near.push(b.svg);
  loops.push(...b.loops);
  return { far: far.join(""), mid: mid.join(""), near: near.join(""), loops, floorY };
}

// Flat iso sky dressing (sun + clouds) above the diorama.
export function isoSky(R, prefix) {
  const p = PALETTES.isometric;
  return `<circle cx="860" cy="170" r="70" fill="${p.sun}"/>
    <g id="${prefix}-cl1"><rect x="120" y="150" width="210" height="54" rx="27" fill="#fff"/><rect x="180" y="118" width="110" height="60" rx="30" fill="#fff"/></g>
    <g id="${prefix}-cl2"><rect x="560" y="300" width="170" height="44" rx="22" fill="#fff"/></g>`;
}
