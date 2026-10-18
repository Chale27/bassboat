// Scene: cutaway. An x-ray / cross-section look at the subject: the bass is
// drawn with its swim bladder, gills, spine and stomach visible and
// labeled. Camera usually pushes in on the organ the narration is about.
import { PALETTES } from "./palettes.mjs";
import { blueprintPaper, fullRect } from "./water.mjs";

export const name = "cutaway";

export function build({ style, R, prefix }) {
  const p = PALETTES[style];
  let far = "", mid = "";
  if (style === "clay") {
    far += fullRect("#2e7f86");
    far += `<circle cx="540" cy="900" r="640" fill="#4fa8a6" opacity="0.6"/><circle cx="540" cy="900" r="420" fill="#7cc7bd" opacity="0.5"/>`;
  } else if (style === "blueprint") {
    far += blueprintPaper();
    far += `<circle cx="540" cy="900" r="520" fill="none" stroke="${p.faint}" stroke-width="2" stroke-dasharray="8 10"/><path d="M0,900 L1080,900 M540,300 L540,1500" stroke="${p.faint}" stroke-width="1.5"/>`;
  } else {
    far += fullRect(p.bg);
    // flat cross-section slab behind the fish
    far += `<path d="M60,520 L900,520 L1040,420 L1040,1180 L900,1280 L60,1280 Z" fill="${p.bands[1]}"/><path d="M900,520 L1040,420 L1040,1180 L900,1280 Z" fill="${p.side[1]}"/><path d="M60,520 L900,520 L1040,420 L200,420 Z" fill="${p.top}"/>`;
  }
  return {
    far, mid, near: "", loops: [],
    anchors: { subject: { x: style === "isometric" ? 480 : 540, y: 880, w: 960 }, prop: { x: 820, y: 520, w: 220 }, lineTop: null },
    xray: true,
  };
}
