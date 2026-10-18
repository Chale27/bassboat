// Code-drawn props: lures (crankbait, worm, jig, spinnerbait), a small
// baitfish, a faceless angler silhouette and a bass boat. Original art.
// Each returns a standalone <svg> sized 100%x100% with its own viewBox; the
// builder positions it. Lure viewBoxes are 320x220 centered on the lure.

import { PALETTES, mix } from "./palettes.mjs";

export const LURE_VIEWBOX = { x: -160, y: -110, w: 320, h: 220 };
export const LURES = ["crankbait", "worm", "jig", "spinnerbait"];

function wrap(vb, inner, style, extra = "") {
  const shadow = style === "clay" ? ` filter="url(#f-clay)"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="subject-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="100%" height="100%" overflow="visible"${extra}><g${shadow}>${inner}</g></svg>`;
}

function hook(x, y, scale, col, sw) {
  // single J hook hanging down from (x,y)
  return `<path d="M${x},${y} l0,${30 * scale} a${12 * scale},${12 * scale} 0 0 1 ${-24 * scale},0 l0,${-8 * scale} l${6 * scale},${6 * scale}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function treble(x, y, col, sw) {
  return `<g><circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${col}" stroke-width="${sw * 0.7}"/>
    <path d="M${x},${y + 5} l0,22" stroke="${col}" stroke-width="${sw}" fill="none"/>
    <path d="M${x},${y + 27} q-16,6 -14,-12 M${x},${y + 27} q16,6 14,-12 M${x},${y + 27} q0,14 -4,16" stroke="${col}" stroke-width="${sw}" fill="none" stroke-linecap="round"/></g>`;
}

export function lureSVG({ kind = "crankbait", style = "clay" }) {
  const p = PALETTES[style];
  const bp = style === "blueprint";
  const iso = style === "isometric";
  const L = bp ? null : p.lure;
  const ink = bp ? p.line : "#2a2f36";
  const st = bp ? `stroke="${p.line}" stroke-width="3"` : style === "clay" ? `stroke="rgba(40,30,30,0.22)" stroke-width="2.5"` : "";
  const metal = bp ? p.line : "#59636e";
  let s = "";
  if (kind === "worm") {
    const col = bp ? p.fill : L.worm;
    const d = "M-130,-20 C-90,-70 -40,-60 -20,-10 C0,40 50,60 90,20 C110,0 125,-5 140,0";
    if (!bp) s += `<path d="${d}" stroke="${mix(col, "#000000", 0.3)}" stroke-width="30" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${d}" stroke="${bp ? p.line : col}" stroke-width="${bp ? 26 : 24}" fill="none" stroke-linecap="round"${bp ? ' stroke-opacity="0.95"' : ""}/>`;
    if (bp) s += `<path d="${d}" stroke="${p.bg}" stroke-width="20" fill="none" stroke-linecap="round"/><path d="${d}" stroke="url(#p-hatch-faint)" stroke-width="20" fill="none"/>`;
    s += `<path d="M90,20 C110,0 125,-5 140,0" stroke="${bp ? p.accent : L.wormTip}" stroke-width="${bp ? 4 : 14}" fill="none" stroke-linecap="round"/>`;
    // segment rings
    for (const [x, y, r] of [[-104, -52, 40], [-92, -60, 50], [-80, -63, 60]]) s += `<path d="M${x},${y - 12} l${4},24" stroke="${bp ? p.accent : mix(col, "#000000", 0.4)}" stroke-width="3" transform="rotate(${r - 40} ${x} ${y})"/>`;
    if (style === "clay") s += `<path d="M-120,-30 C-90,-66 -50,-60 -32,-26" stroke="#fff" stroke-opacity="0.35" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    s += hook(-126, -22, 1, metal, 4);
    return wrap(LURE_VIEWBOX, s, style);
  }
  if (kind === "jig") {
    // skirt strands flaring back from the collar
    const sk = bp ? [p.line, p.accent, p.line] : L.skirt;
    for (let i = 0; i < 14; i++) {
      const a = -26 + i * 4;
      const len = 120 + (i % 3) * 14;
      const ex = -40 + len * Math.cos((a * Math.PI) / 180);
      const ey = len * Math.sin((a * Math.PI) / 180);
      s += `<path d="M-40,0 Q${(-40 + ex) / 2 + 10},${ey / 2 - 6} ${ex.toFixed(0)},${ey.toFixed(0)}" stroke="${sk[i % 3]}" stroke-width="${bp ? 2 : 6}" fill="none" stroke-linecap="round"/>`;
    }
    // hook out the back, point up
    s += `<path d="M-60,0 L70,0 a22,22 0 0 0 0,-44 l-6,10" stroke="${metal}" stroke-width="5" fill="none" stroke-linecap="round" transform="translate(30,40)"/>`;
    // weed guard
    s += `<path d="M-50,-14 L40,-48" stroke="${bp ? p.accent : "#222"}" stroke-width="4" fill="none"/>`;
    // head
    s += `<circle cx="-62" cy="0" r="30" fill="${bp ? p.fill : L.jigHead}" ${st}/>`;
    if (style === "clay") s += `<circle cx="-72" cy="-10" r="9" fill="#fff" opacity="0.25"/>`;
    s += `<circle cx="-72" cy="-4" r="7" fill="${bp ? "none" : "#f2c14e"}" ${bp ? `stroke="${p.accent}" stroke-width="2.5"` : ""}/><circle cx="-72" cy="-4" r="3" fill="${bp ? p.accent : "#111"}"/>`;
    s += `<circle cx="-92" cy="-8" r="6" fill="none" stroke="${metal}" stroke-width="3"/>`;
    return wrap(LURE_VIEWBOX, s, style);
  }
  if (kind === "spinnerbait") {
    // R-bend wire: line tie at left, upper arm to blade, lower arm to head
    s += `<path d="M-120,0 L40,-70 M-120,0 L-30,30" stroke="${metal}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    s += `<circle cx="-122" cy="0" r="6" fill="none" stroke="${metal}" stroke-width="3"/>`;
    // willow-leaf blade
    s += `<g id="__BLADE__"><ellipse cx="80" cy="-78" rx="46" ry="18" transform="rotate(-12 80 -78)" fill="${bp ? p.fill : L.bladeGold}" ${st}/>`;
    if (!bp) s += `<ellipse cx="72" cy="-84" rx="22" ry="6" transform="rotate(-12 72 -84)" fill="#fff" opacity="0.55"/>`;
    s += `</g>`;
    // skirt
    const sk = bp ? [p.line, p.accent, p.line] : ["#f4f4f0", "#7fd36b", "#3f8f3f"];
    for (let i = 0; i < 12; i++) {
      const a = -18 + i * 3.5;
      const len = 110 + (i % 3) * 10;
      const ex = -10 + len * Math.cos((a * Math.PI) / 180);
      const ey = 34 + len * Math.sin((a * Math.PI) / 180);
      s += `<path d="M-10,34 Q${(ex - 10) / 2 + 8},${(ey + 34) / 2 - 4} ${ex.toFixed(0)},${ey.toFixed(0)}" stroke="${sk[i % 3]}" stroke-width="${bp ? 2 : 6}" fill="none" stroke-linecap="round"/>`;
    }
    s += `<path d="M-30,34 L90,40 a18,18 0 0 0 0,-36" stroke="${metal}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += `<ellipse cx="-30" cy="32" rx="22" ry="16" fill="${bp ? p.fill : "#f4f4f0"}" ${st}/>`;
    s += `<circle cx="-38" cy="28" r="4" fill="${bp ? p.accent : "#c0392b"}"/>`;
    return wrap(LURE_VIEWBOX, s.replace("__BLADE__", "blade"), style);
  }
  // crankbait (default): body facing left, diving lip at the nose
  const bodyFill = bp ? p.fill : style === "clay" ? "url(#g-crank)" : L.crank[0];
  s += `<path d="M-80,10 L-142,52 L-128,64 L-70,26 Z" fill="${bp ? "none" : "rgba(235,245,255,0.55)"}" stroke="${bp ? p.line : "rgba(255,255,255,0.9)"}" stroke-width="2.5"/>`;
  s += `<circle cx="-92" cy="16" r="5" fill="none" stroke="${metal}" stroke-width="3"/>`;
  s += treble(-20, 34, metal, 3.5);
  s += treble(64, 30, metal, 3.5);
  s += `<path d="M-96,0 C-96,-44 -40,-50 10,-46 C60,-42 100,-24 108,0 C100,24 60,38 10,40 C-40,42 -96,36 -96,0 Z" fill="${bodyFill}" ${st}/>`;
  if (iso) s += `<path d="M-96,0 C-96,-44 -40,-50 10,-46 C60,-42 100,-24 108,0 Z" fill="${L.crank[1]}" opacity="0.0"/><path d="M-90,14 C-60,30 40,36 100,8 C96,24 60,38 10,40 C-40,42 -96,36 -90,14 Z" fill="${L.crankBelly}"/><path d="M-80,-30 C-40,-46 40,-44 96,-14 C80,-32 40,-44 10,-46 C-40,-50 -80,-40 -80,-30 Z" fill="#3c5a2a"/>`;
  else if (!bp) s += `<path d="M-80,-30 C-40,-46 40,-44 96,-14 C80,-32 40,-44 10,-46 C-40,-50 -80,-40 -80,-30 Z" fill="#3c5a2a" opacity="0.8"/>`;
  if (bp) s += `<path d="M-60,-30 L-60,32 M-20,-42 L-20,40 M20,-44 L20,40 M60,-36 L60,32" stroke="${p.line}" stroke-opacity="0.35" stroke-width="1.5"/>`;
  // gill slash + eye
  s += `<path d="M-58,-22 Q-50,0 -58,24" stroke="${bp ? p.accent : "#d2382c"}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="-74" cy="-8" r="11" fill="${bp ? "none" : "#fff8d8"}" stroke="${bp ? p.line : "#222"}" stroke-width="2.5"/><circle cx="-76" cy="-8" r="5.5" fill="${bp ? p.accent : "#111"}"/>`;
  if (style === "clay") s += `<ellipse cx="0" cy="-28" rx="60" ry="8" fill="#fff" opacity="0.35"/>`;
  return wrap(LURE_VIEWBOX, s, style);
}

export const MINNOW_VIEWBOX = { x: -80, y: -40, w: 160, h: 80 };
export function minnowSVG({ style = "clay" }) {
  const p = PALETTES[style];
  const bp = style === "blueprint";
  const body = "M70,0 C60,-16 20,-22 -30,-14 C-46,-10 -56,-4 -60,0 C-56,4 -46,10 -30,14 C20,22 60,16 70,0 Z";
  const tail = "M-56,0 L-78,-18 L-72,0 L-78,18 Z";
  const f = bp ? p.fill : "#c9d6dc";
  const st = bp ? `stroke="${p.line}" stroke-width="2.5"` : style === "clay" ? `stroke="rgba(30,40,50,0.2)" stroke-width="2"` : "";
  let s = `<path d="${tail}" fill="${bp ? p.fill : "#9fb2bc"}" ${st}/><path d="${body}" fill="${f}" ${st}/>`;
  if (!bp) s += `<path d="M64,-4 C40,-14 0,-16 -50,-6 L-50,-2 C0,-6 40,-6 66,0 Z" fill="#6f8794"/><path d="M60,2 C30,4 -10,4 -50,2" stroke="#e9f3f6" stroke-width="3"/>`;
  s += `<circle cx="52" cy="-3" r="5" fill="${bp ? "none" : "#fff"}" ${bp ? `stroke="${p.accent}" stroke-width="2"` : ""}/><circle cx="53" cy="-3" r="2.5" fill="${bp ? p.accent : "#111"}"/>`;
  return wrap(MINNOW_VIEWBOX, s, style);
}

// Faceless angler silhouette, feet at (0,0), ~420 units tall, holding a rod
// that points up-right. Rod tip returned for the fishing line.
export const ANGLER_VIEWBOX = { x: -160, y: -440, w: 520, h: 460 };
export const ANGLER_ROD_TIP = { x: 330, y: -400 };
export function anglerSVG({ style = "clay", id = "angler" }) {
  const p = PALETTES[style];
  const bp = style === "blueprint";
  const fill = bp ? p.fill : p.angler;
  const st = bp ? `stroke="${p.line}" stroke-width="3" stroke-linejoin="round"` : "";
  const rod = bp ? p.accent : "#1a1f26";
  let s = "";
  // legs
  s += `<path d="M-38,-170 L-52,0 L-24,0 L-8,-120 L8,-120 L22,0 L50,0 L38,-170 Z" fill="${fill}" ${st}/>`;
  // torso (jacket)
  s += `<path d="M-52,-300 C-60,-250 -54,-200 -44,-160 L44,-160 C54,-200 60,-250 52,-300 C30,-318 -30,-318 -52,-300 Z" fill="${fill}" ${st}/>`;
  // head + cap (faceless)
  s += `<circle cx="0" cy="-350" r="36" fill="${fill}" ${st}/>`;
  s += `<path d="M-38,-362 C-34,-400 34,-402 38,-362 Z" fill="${bp ? "none" : mix(p.angler || "#283447", "#ffffff", 0.12)}" ${st}/><path d="M20,-366 L70,-360 L66,-352 L22,-356 Z" fill="${fill}" ${st}/>`;
  // arms + rod
  s += `<g id="${id}-arms"><path d="M40,-290 C80,-270 100,-250 118,-236 L108,-222 C86,-236 60,-250 34,-262 Z" fill="${fill}" ${st}/>
    <path d="M-40,-290 C-10,-250 40,-226 92,-214 L88,-200 C30,-208 -20,-232 -50,-266 Z" fill="${fill}" ${st}/>
    <path d="M70,-196 L${ANGLER_ROD_TIP.x},${ANGLER_ROD_TIP.y}" stroke="${rod}" stroke-width="7" stroke-linecap="round"/>
    <path d="M70,-196 L150,-276" stroke="${rod}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="112" cy="-226" r="13" fill="${bp ? "none" : "#55606c"}" ${bp ? st : ""}/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="subject-svg" viewBox="${ANGLER_VIEWBOX.x} ${ANGLER_VIEWBOX.y} ${ANGLER_VIEWBOX.w} ${ANGLER_VIEWBOX.h}" width="100%" height="100%" overflow="visible">${s}</svg>`;
}

// Bass boat, side view, bow to the right, waterline at y=0.
export const BOAT_VIEWBOX = { x: -460, y: -200, w: 940, h: 300 };
export function boatSVG({ style = "clay" }) {
  const p = PALETTES[style];
  const bp = style === "blueprint";
  const iso = style === "isometric";
  const st = bp ? `stroke="${p.line}" stroke-width="3" stroke-linejoin="round"` : style === "clay" ? `stroke="rgba(40,20,20,0.25)" stroke-width="3" stroke-linejoin="round"` : "";
  const hull = bp ? p.fill : style === "clay" ? "url(#g-hull)" : p.boatHull;
  let s = "";
  // outboard motor at the stern (left)
  s += `<path d="M-430,-150 L-380,-150 L-372,-70 L-392,30 L-410,30 L-414,-70 Z" fill="${bp ? p.fill : p.metal}" ${st}/>`;
  s += `<rect x="-446" y="-196" width="80" height="58" rx="18" fill="${bp ? p.fill : p.metal}" ${st}/>`;
  if (!bp) s += `<rect x="-440" y="-184" width="60" height="10" rx="5" fill="${p.boatHull}"/>`;
  // hull
  s += `<path d="M-380,-80 L330,-80 C380,-80 420,-70 450,-60 C420,-30 380,-6 330,10 L-360,10 C-376,-20 -380,-50 -380,-80 Z" fill="${hull}" ${st}/>`;
  if (iso) s += `<path d="M-370,-20 L380,-20 C360,-6 340,4 330,10 L-360,10 Z" fill="${p.boatSide}"/>`;
  // trim stripe
  s += `<path d="M-372,-46 L410,-46 C400,-40 392,-34 384,-30 L-368,-30 Z" fill="${bp ? "none" : p.boatTrim}" ${bp ? `stroke="${p.accent}" stroke-width="2.5"` : ""}/>`;
  // deck, console, seats, trolling motor at bow
  s += `<path d="M-120,-80 L-110,-140 L-40,-140 L-30,-80 Z" fill="${bp ? p.fill : p.boatTrim}" ${st}/>`;
  s += `<path d="M-104,-136 L-80,-176 L-46,-176" fill="none" stroke="${bp ? p.line : "#9fd6e8"}" stroke-width="6" stroke-linecap="round"/>`;
  s += `<rect x="-280" y="-108" width="70" height="28" rx="10" fill="${bp ? p.fill : "#33404f"}" ${st}/>`;
  s += `<path d="M380,-78 L404,-120 M392,-100 L392,40" stroke="${bp ? p.line : p.metal}" stroke-width="6" stroke-linecap="round"/><ellipse cx="392" cy="44" rx="20" ry="9" fill="${bp ? p.fill : p.metal}" ${st}/>`;
  if (style === "clay") s += `<path d="M-340,-70 L320,-70" stroke="#fff" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>`;
  return wrap(BOAT_VIEWBOX, s, style);
}

// Bluegill (sunfish): deep round body, dark "ear" flap, faint vertical bars.
export const BLUEGILL_VIEWBOX = { x: -60, y: -90, w: 760, h: 480 };
export function bluegillSVG({ style = "clay" }) {
  const p = PALETTES[style];
  const bp = style === "blueprint";
  const body = "M560,150 C556,70 470,20 360,22 C250,24 180,80 150,130 L150,170 C180,222 250,280 360,280 C470,280 556,230 560,150 Z";
  const tail = "M156,134 C120,110 90,80 70,60 C80,110 82,130 78,150 C82,170 80,190 70,240 C90,220 120,190 156,166 Z";
  const dorsal = "M470,40 C420,0 300,-10 200,60 L240,70 C300,40 400,30 460,60 Z";
  const anal = "M420,270 C380,310 300,320 240,250 L280,250 C320,270 380,270 420,262 Z";
  const st = bp ? `stroke="${p.line}" stroke-width="3" stroke-linejoin="round"` : style === "clay" ? `stroke="rgba(30,30,40,0.2)" stroke-width="3"` : "";
  const fill = bp ? p.fill : "#7f9a7a";
  const fin = bp ? p.fill : "#5f7a5c";
  let s = `<path d="${tail}" fill="${fin}" ${st}/><path d="${dorsal}" fill="${fin}" ${st}/><path d="${anal}" fill="${fin}" ${st}/>`;
  s += `<defs><clipPath id="bg-clip-${style}"><path d="${body}"/></clipPath></defs>`;
  s += `<path d="${body}" fill="${fill}" ${st}/>`;
  s += `<g clip-path="url(#bg-clip-${style})">`;
  if (!bp) s += `<path d="M150,190 C250,230 450,240 560,170 L560,300 L150,300 Z" fill="#e8b45a" opacity="0.85"/>`;
  for (let k = 0; k < 6; k++) { const x = 470 - k * 50; s += `<rect x="${x - 14}" y="0" width="22" height="300" fill="${bp ? p.accent : "#3d5240"}" opacity="${bp ? 0.25 : 0.35}"/>`; }
  s += `</g>`;
  s += `<path d="M470,120 C452,110 430,118 428,140 C428,160 452,168 470,158 Z" fill="${bp ? p.accent : "#1d2433"}"/>`;
  s += `<circle cx="512" cy="112" r="14" fill="${bp ? "none" : "#e7c25a"}" ${bp ? `stroke="${p.line}" stroke-width="3"` : ""}/><circle cx="514" cy="112" r="7" fill="${bp ? p.accent : "#111"}"/>`;
  s += `<path d="M560,150 C548,156 534,158 522,156" stroke="${bp ? p.line : "#3d5240"}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  return wrap(BLUEGILL_VIEWBOX, s, style);
}

// Bass nest: a fanned-out depression on the bottom with eggs.
export const NEST_VIEWBOX = { x: -320, y: -80, w: 640, h: 160 };
export function nestSVG({ style = "clay" }) {
  const p = PALETTES[style];
  const bp = style === "blueprint";
  let s = `<ellipse cx="0" cy="10" rx="300" ry="62" fill="${bp ? "none" : style === "isometric" ? p.sediment[0] : p.sandDark}" ${bp ? `stroke="${p.line}" stroke-width="3" stroke-dasharray="10 8"` : ""}/>`;
  s += `<ellipse cx="0" cy="18" rx="230" ry="40" fill="${bp ? "url(#p-hatch-faint)" : style === "isometric" ? p.sediment[1] : "#b98f5f"}"/>`;
  for (let i = 0; i < 26; i++) {
    const a = (i * 137.5 * Math.PI) / 180, r = 22 + (i % 7) * 26;
    const x = Math.cos(a) * r * 0.9, y = 18 + Math.sin(a) * r * 0.16;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="7" fill="${bp ? p.accent : "#f3d77a"}" ${bp ? "" : `stroke="#c9a23f" stroke-width="1.5"`}/>`;
  }
  return wrap(NEST_VIEWBOX, s, style);
}
