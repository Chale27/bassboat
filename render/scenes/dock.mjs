// Scene: dock. Sky, far shoreline, wooden dock on the left with a faceless
// angler, line running down into the water where the subject waits.
import { PALETTES, mix } from "./palettes.mjs";
import { waterLayers, isoBox, isoSky, ISO, blueprintPaper } from "./water.mjs";
import { nest, mapPoint, loop } from "./lib.mjs";
import { anglerSVG, ANGLER_VIEWBOX, ANGLER_ROD_TIP } from "./props.mjs";

export const name = "dock";
const SURF = 640;

export function build({ style, R, prefix }) {
  const p = PALETTES[style];
  const bp = style === "blueprint", iso = style === "isometric";
  let far = "", mid = "", near = "";
  const loops = [];
  if (iso) {
    const box = isoBox(R, prefix, SURF);
    far = box.far + isoSky(R, prefix);
    mid = box.mid;
    near = box.near;
    loops.push(...box.loops);
  } else {
    // sky + shoreline
    if (style === "clay") {
      far += `<rect x="-360" y="-480" width="1800" height="${SURF + 480}" fill="url(#g-sky)"/>`;
      far += `<circle cx="820" cy="230" r="90" fill="${p.sun}"/><circle cx="820" cy="230" r="150" fill="${p.sun}" opacity="0.25"/>`;
      far += `<path d="M-360,${SURF} C-200,${SURF - 140} 40,${SURF - 160} 220,${SURF - 80} C380,${SURF - 190} 640,${SURF - 200} 820,${SURF - 90} C980,${SURF - 160} 1200,${SURF - 150} 1440,${SURF - 60} L1440,${SURF} Z" fill="${p.hills[0]}"/>`;
      far += `<path d="M-360,${SURF} C0,${SURF - 70} 400,${SURF - 40} 700,${SURF - 60} C1000,${SURF - 80} 1200,${SURF - 30} 1440,${SURF - 40} L1440,${SURF} Z" fill="${p.hills[1]}"/>`;
    }
    const L = waterLayers(style, R, prefix, SURF, 1640, { label: false });
    far += L.far; mid += L.mid; near += L.near; loops.push(...L.loops);
    if (style === "clay") far += `<rect x="-360" y="${SURF - 6}" width="1800" height="14" fill="${p.surface}" opacity="0.8"/>`;
    if (bp) far += `<path d="M-360,${SURF - 260} C0,${SURF - 300} 300,${SURF - 240} 600,${SURF - 280} S1100,${SURF - 250} 1440,${SURF - 270}" stroke="${p.faint}" stroke-width="2" fill="none" stroke-dasharray="10 8"/><text x="600" y="${SURF - 300}" font-family="JetBrains Mono, monospace" font-size="24" fill="${p.label}">SHORELINE</text>`;
  }
  // dock: deck + posts (posts go into the water)
  const deckY = SURF - 70;
  const deckX1 = iso ? 420 : 470;
  const wood = iso ? p.wood : style === "clay" ? p.wood : null;
  const st = bp ? `stroke="${p.line}" stroke-width="3"` : "";
  for (const x of [-60, 150, deckX1 - 40]) {
    mid += `<rect x="${x}" y="${deckY}" width="34" height="${SURF + 300 - deckY}" fill="${bp ? p.bg : wood[1]}" ${st}/>`;
    if (bp) mid += `<rect x="${x}" y="${deckY}" width="34" height="${SURF + 300 - deckY}" fill="url(#p-hatch-faint)"/>`;
  }
  mid += `<rect x="-380" y="${deckY - 34}" width="${deckX1 + 380}" height="40" rx="${style === "clay" ? 10 : 0}" fill="${bp ? p.bg : style === "clay" ? "url(#g-wood)" : wood[0]}" ${st}/>`;
  if (iso) mid += `<path d="M-380,${deckY - 34} L${deckX1},${deckY - 34} L${deckX1 + 60},${deckY - 76} L-320,${deckY - 76} Z" fill="${mix(wood[0], "#ffffff", 0.18)}"/><path d="M${deckX1},${deckY - 34} L${deckX1 + 60},${deckY - 76} L${deckX1 + 60},${deckY - 36} L${deckX1},${deckY + 6} Z" fill="${wood[2]}"/>`;
  for (let x = -340; x < deckX1; x += 70) mid += `<path d="M${x},${deckY - 34} l0,40" stroke="${bp ? p.line : wood[1]}" stroke-width="3" opacity="0.6"/>`;
  // angler on the dock
  const aw = 470;
  const ax = 40, ay = deckY - 34 - (aw * ANGLER_VIEWBOX.h) / ANGLER_VIEWBOX.w + (aw * 20) / ANGLER_VIEWBOX.w;
  mid += nest(anglerSVG({ style, id: `${prefix}-angler` }), ax, ay, aw, `${prefix}-angler`);
  const tip = mapPoint(ANGLER_VIEWBOX, ax, ay, aw, ANGLER_ROD_TIP.x, ANGLER_ROD_TIP.y);
  const feet = mapPoint(ANGLER_VIEWBOX, ax, ay, aw, 0, 0);
  return {
    far, mid, near, loops,
    anchors: {
      subject: { x: 620, y: 1080, w: 680 },
      prop: { x: 800, y: 900, w: 240 },
      angler: { x: feet.x + 60, y: feet.y - 200 },
      rodTip: tip,
      lineTop: null,
    },
  };
}
