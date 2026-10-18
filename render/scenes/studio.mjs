// Scene: studio. A clean presentation stage (turntable / specimen board /
// iso plinth) for showing one subject at a time. Good for ten-facts.
import { PALETTES } from "./palettes.mjs";
import { blueprintPaper, fullRect } from "./water.mjs";
import { loop } from "./lib.mjs";

export const name = "studio";

export function build({ style, R, prefix }) {
  const p = PALETTES[style];
  let far = "", mid = "", near = "";
  const loops = [];
  if (style === "clay") {
    far += fullRect("url(#g-studio)");
    far += `<ellipse cx="540" cy="1250" rx="900" ry="200" fill="#d9a77c" opacity="0.6"/>`;
    mid += `<g filter="url(#f-clay)"><ellipse cx="540" cy="1215" rx="420" ry="74" fill="#c98f68"/><rect x="120" y="1150" width="840" height="66" fill="#c98f68"/><ellipse cx="540" cy="1150" rx="420" ry="74" fill="#e8bb92"/></g>`;
    mid += `<ellipse cx="540" cy="1150" rx="300" ry="40" fill="#5a3a28" opacity="0.18"/>`;
    far += `<path d="M300,-480 L780,-480 L1060,1250 L20,1250 Z" fill="url(#g-spot)" opacity="0.35"/>`;
  } else if (style === "blueprint") {
    far += blueprintPaper();
    // specimen crop marks + scale bar
    const c = p.line;
    mid += `<path d="M90,420 l0,-60 l60,0 M990,420 l0,-60 l-60,0 M90,1180 l0,60 l60,0 M990,1180 l0,60 l-60,0" stroke="${c}" stroke-width="4" fill="none"/>`;
    mid += `<path d="M240,1290 L840,1290 M240,1270 L240,1310 M840,1270 L840,1310 M540,1280 L540,1300" stroke="${p.accent}" stroke-width="3"/>`;
    mid += `<text x="540" y="1270" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="24" font-weight="700" fill="${p.label}">SCALE  1:4</text>`;
  } else {
    far += fullRect(p.bg);
    // iso plinth
    const cx = 540, cy = 1140, a = 380, b = 220, h = 120;
    mid += `<path d="M${cx},${cy - b / 2} L${cx + a},${cy} L${cx},${cy + b / 2} L${cx - a},${cy} Z" fill="#e7dcc4"/>`;
    mid += `<path d="M${cx - a},${cy} L${cx},${cy + b / 2} L${cx},${cy + b / 2 + h} L${cx - a},${cy + h} Z" fill="#cdbf9f"/>`;
    mid += `<path d="M${cx + a},${cy} L${cx},${cy + b / 2} L${cx},${cy + b / 2 + h} L${cx + a},${cy + h} Z" fill="#b5a682"/>`;
    mid += `<ellipse cx="${cx}" cy="${cy}" rx="260" ry="50" fill="#000" opacity="0.08"/>`;
    // flat background shapes
    far += `<circle cx="880" cy="380" r="120" fill="#f6c453" opacity="0.5"/><rect x="80" y="520" width="220" height="220" fill="#7fd0dc" opacity="0.35" transform="rotate(45 190 630)"/>`;
  }
  return {
    far, mid, near, loops,
    anchors: { subject: { x: 540, y: 860, w: 780 }, prop: { x: 800, y: 560, w: 240 }, lineTop: null },
  };
}
