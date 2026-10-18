// Scene: boat. A bass boat on the surface with a faceless angler; the
// water column below holds the subject.
import { PALETTES } from "./palettes.mjs";
import { waterLayers, isoBox, isoSky } from "./water.mjs";
import { nest, mapPoint, loop } from "./lib.mjs";
import { anglerSVG, ANGLER_VIEWBOX, ANGLER_ROD_TIP, boatSVG, BOAT_VIEWBOX } from "./props.mjs";

export const name = "boat";
const SURF = 700;

export function build({ style, R, prefix }) {
  const p = PALETTES[style];
  const iso = style === "isometric", bp = style === "blueprint";
  let far = "", mid = "", near = "";
  const loops = [];
  if (iso) {
    const box = isoBox(R, prefix, SURF);
    far = box.far + isoSky(R, prefix);
    mid = box.mid; near = box.near; loops.push(...box.loops);
  } else {
    if (style === "clay") {
      far += `<rect x="-360" y="-480" width="1800" height="${SURF + 480}" fill="url(#g-sky)"/>`;
      far += `<circle cx="230" cy="260" r="80" fill="${p.sun}"/><circle cx="230" cy="260" r="140" fill="${p.sun}" opacity="0.25"/>`;
      far += `<path d="M-360,${SURF} C-100,${SURF - 120} 200,${SURF - 110} 420,${SURF - 60} C640,${SURF - 150} 900,${SURF - 160} 1440,${SURF - 50} L1440,${SURF} Z" fill="${p.hills[0]}"/>`;
    }
    const L = waterLayers(style, R, prefix, SURF, 1660, { label: false });
    far += L.far; mid += L.mid; near += L.near; loops.push(...L.loops);
    if (style === "clay") far += `<rect x="-360" y="${SURF - 6}" width="1800" height="14" fill="${p.surface}" opacity="0.8"/>`;
  }
  // boat (bobbing group: hull + angler)
  const bw = 820, bx = (iso ? 455 : 540) - bw / 2 - 10;
  const by = SURF - (200 * bw) / BOAT_VIEWBOX.w; // waterline (y=0) lands on SURF
  const aw = 360;
  const deck = { x: bx + ((120 - BOAT_VIEWBOX.x) * bw) / BOAT_VIEWBOX.w, y: by + ((-80 - BOAT_VIEWBOX.y) * bw) / BOAT_VIEWBOX.w };
  const ax = deck.x - (160 * aw) / ANGLER_VIEWBOX.w * 1.0 - 0, ay = deck.y - ((440 - 0) * aw) / ANGLER_VIEWBOX.w;
  let grp = nest(anglerSVG({ style, id: `${prefix}-angler` }), ax, ay, aw, `${prefix}-angler`);
  grp += nest(boatSVG({ style }), bx, by, bw);
  mid += `<g id="${prefix}-boat">${grp}</g>`;
  loops.push(loop(`#${prefix}-boat`, { y: -6, rotation: -1 }, { y: 6, rotation: 1 }, 1.9, { origin: "50% 80%" }));
  const tip = mapPoint(ANGLER_VIEWBOX, ax, ay, aw, ANGLER_ROD_TIP.x, ANGLER_ROD_TIP.y);
  return {
    far, mid, near, loops,
    anchors: {
      subject: { x: iso ? 470 : 560, y: 1160, w: 640 },
      prop: { x: 760, y: 1000, w: 230 },
      angler: { x: ax + 160 * aw / ANGLER_VIEWBOX.w, y: ay + 200 },
      boat: { x: bx + bw / 2, y: SURF - 60 },
      rodTip: tip,
      lineTop: null,
    },
  };
}
