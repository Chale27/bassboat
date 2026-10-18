// Code-drawn black bass, side view, facing right. Original art.
//
// Species variants:
//   largemouth  dark jagged lateral stripe, jaw hinge well past the eye,
//               deeply notched dorsal fin
//   smallmouth  bronze body, vertical dark bars, red eye, jaw ends under the eye
//   spotted     olive body, row of blotches + rows of small spots on the lower
//               flank, jaw ends at the back of the eye
//
// Animatable sub-groups (GSAP targets): #<id>-tail, #<id>-jaw, #<id>-pec,
// #<id>-bladder (xray only), #<id>-belly (xray only).
// Fish units: body spans x 20..610, y 10..265 inside viewBox -60 -90 760 480.

import { PALETTES, mix } from "./palettes.mjs";
import { esc } from "./lib.mjs";

export const BASS_VIEWBOX = { x: -60, y: -90, w: 760, h: 480 };

const BODY =
  "M612,142 C606,106 568,82 510,77 C444,67 364,57 284,70 C218,82 168,106 128,127 L128,173 C170,197 232,222 302,229 C392,237 474,227 538,206 C574,194 602,180 612,166 Z";
const TAIL =
  "M134,132 C112,118 82,92 38,64 C52,104 56,128 50,150 C56,172 52,196 38,236 C82,208 112,182 134,168 Z";
const SPINY_DORSAL = "M436,72 L424,26 L406,18 L386,14 L366,18 L346,24 L326,34 L304,52 L296,66 Z";
const SPINY_DORSAL_SMALL = "M436,72 L424,26 L406,18 L386,14 L366,18 L346,24 L326,32 L306,40 L292,46 L296,66 Z";
const SOFT_DORSAL = "M292,68 C290,46 276,30 250,28 C222,28 196,46 176,100 Z";
const PEC = "M470,168 C452,160 420,162 392,178 C418,186 448,186 470,178 Z";
const PELVIC = "M432,222 C420,236 404,252 384,262 C398,240 404,230 408,224 Z";
const ANAL = "M262,226 C250,246 232,258 206,260 C204,240 196,222 186,208 Z";
const GILL = "M480,90 C452,124 452,172 484,208";

function centerY(x) {
  return 146 + (470 - x) * 0.012;
}

function stripePath() {
  // irregular dark band (row of merged blotches) from the gill cover to the tail
  const jag = [2, 8, -1, 7, 1, 9, -2, 6, 2, 8, 0, 7, -1, 6, 3, 8, 0, 5];
  const top = [], bot = [];
  let i = 0;
  for (let x = 476; x >= 132; x -= 19, i++) {
    const c = centerY(x);
    const j = jag[i % jag.length];
    const taperHead = x > 440 ? (x - 440) / 3.2 : 0;
    const thick = 16 - (470 - x) * 0.012 - taperHead;
    top.push(`${x},${(c - thick - j * 0.8).toFixed(1)}`);
    bot.push(`${x - 9},${(c + thick + jag[(i + 3) % jag.length] * 0.7).toFixed(1)}`);
  }
  return `M${top.join(" L")} L${bot.reverse().join(" L")} Z`;
}

function barsPaths() {
  const out = [];
  for (let k = 0; k < 9; k++) {
    const x = 450 - k * 34;
    out.push(`M${x},60 C${x - 8},110 ${x - 6},150 ${x - 14},205 L${x - 34},205 C${x - 26},150 ${x - 28},110 ${x - 20},60 Z`);
  }
  return out;
}

function blotches() {
  const out = [];
  for (let k = 0; k < 10; k++) {
    const x = 455 - k * 33;
    const c = centerY(x);
    out.push(`M${x},${c - 15} L${x + 12},${c} L${x},${c + 15} L${x - 14},${c} Z`);
  }
  return out;
}

function spots() {
  const out = [];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 11; k++) {
      const x = 440 - k * 26 - (row % 2) * 13;
      const y = centerY(x) + 26 + row * 14;
      if (y < 222 - (440 - x) * 0.05) out.push([x, y]);
    }
  }
  return out;
}

const SPECIES_JAW = { largemouth: 500, smallmouth: 548, spotted: 532 };

export function bassSVG({ id, species = "largemouth", style = "clay", xray = false, callouts = null, mouthOpen = 0 }) {
  const p = PALETTES[style];
  const sp = SPECIES_JAW[species] ? species : "largemouth";
  const jawX = SPECIES_JAW[sp];
  const clip = `${id}-clip`;
  const vb = BASS_VIEWBOX;
  const parts = [];
  const isBP = style === "blueprint";
  const isIso = style === "isometric";
  const c = isBP ? null : p.fish[sp];
  const stroke = isBP ? p.line : p.stroke;
  const sw = isBP ? 3 : style === "clay" ? 3 : 0;
  const finFill = isBP ? p.fill : c.fin;
  const finOpacity = isBP ? 1 : 0.95;

  const finAttrs = `fill="${finFill}" fill-opacity="${finOpacity}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  const finRays = (pathD, from, to, n) => {
    if (!isBP && !isIso) return "";
    // fin rays: straight lines from base to edge
    let s = "";
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x1 = from[0] + (from[2] - from[0]) * t, y1 = from[1] + (from[3] - from[1]) * t;
      const x2 = to[0] + (to[2] - to[0]) * t, y2 = to[1] + (to[3] - to[1]) * t;
      s += `M${x1.toFixed(0)},${y1.toFixed(0)} L${x2.toFixed(0)},${y2.toFixed(0)} `;
    }
    const col = isBP ? p.line : mix(c.fin, "#000000", 0.25);
    return `<path d="${s}" stroke="${col}" stroke-opacity="${isBP ? 0.55 : 0.45}" stroke-width="${isBP ? 1.6 : 2}" fill="none"/>`;
  };

  // --- fins behind the body
  const dorsal = sp === "largemouth" ? SPINY_DORSAL : SPINY_DORSAL_SMALL;
  parts.push(`<g class="fins-back">
    <path d="${dorsal}" ${finAttrs}/>${finRays(dorsal, [430, 70, 300, 64], [424, 26, 306, 50], 9)}
    <path d="${SOFT_DORSAL}" ${finAttrs}/>${finRays(SOFT_DORSAL, [286, 68, 182, 98], [262, 30, 186, 70], 7)}
    <path d="${ANAL}" ${finAttrs}/>${finRays(ANAL, [256, 228, 192, 212], [222, 258, 200, 240], 5)}
    <path d="${PELVIC}" ${finAttrs}/>
  </g>`);

  // --- tail (own group so it can wag)
  parts.push(`<g id="${id}-tail"><path d="${TAIL}" ${finAttrs}/>${finRays(TAIL, [132, 134, 132, 166], [40, 66, 40, 234], 9)}</g>`);

  // --- body
  let bodyInner = "";
  if (style === "clay") {
    bodyInner += `<rect x="0" y="0" width="640" height="300" fill="url(#g-fish-${sp})"/>`;
  } else if (isIso) {
    // flat facet bands
    bodyInner += `<rect x="0" y="0" width="640" height="300" fill="${c.belly}"/>`;
    bodyInner += `<path d="M0,0 H640 V176 C520,190 400,196 300,192 C200,188 140,180 0,178 Z" fill="${c.side}"/>`;
    bodyInner += `<path d="M0,0 H640 V112 C540,112 420,106 300,110 C210,113 150,124 0,128 Z" fill="${c.back}"/>`;
    bodyInner += `<path d="M0,0 H640 V92 C540,92 420,84 300,88 C210,92 150,104 0,108 Z" fill="${mix(c.back, "#000000", 0.18)}"/>`;
  } else {
    bodyInner += `<rect x="0" y="0" width="640" height="300" fill="${p.fill}"/>`;
    bodyInner += `<rect x="0" y="0" width="640" height="300" fill="url(#p-scales)"/>`;
  }
  // markings
  if (sp === "largemouth") {
    bodyInner += isBP
      ? `<path d="${stripePath()}" fill="url(#p-hatch)" stroke="${p.accent}" stroke-width="2"/>`
      : `<path d="${stripePath()}" fill="${c.mark}" opacity="${isIso ? 1 : 0.9}"/>`;
  } else if (sp === "smallmouth") {
    for (const d of barsPaths()) bodyInner += isBP ? `<path d="${d}" fill="url(#p-hatch)" opacity="0.6"/>` : `<path d="${d}" fill="${c.mark}" opacity="${isIso ? 0.55 : 0.45}"/>`;
  } else {
    for (const d of blotches()) bodyInner += isBP ? `<path d="${d}" fill="url(#p-hatch)" stroke="${p.accent}" stroke-width="2"/>` : `<path d="${d}" fill="${c.mark}" opacity="0.92"/>`;
    for (const [x, y] of spots()) bodyInner += `<circle cx="${x}" cy="${y.toFixed(1)}" r="3.4" fill="${isBP ? p.accent : c.mark}" opacity="${isBP ? 0.8 : 0.7}"/>`;
  }
  // lateral line
  bodyInner += `<path d="M478,${centerY(478) - 22} Q300,${centerY(300) - 26} 134,${centerY(134) - 18}" fill="none" stroke="${isBP ? p.line : mix(isBP ? "#ffffff" : c.side, "#ffffff", 0.4)}" stroke-width="2" stroke-dasharray="${isBP ? "6 6" : "none"}" opacity="${isBP ? 0.6 : 0.5}"/>`;
  // clay: soft specular along the back
  if (style === "clay") {
    bodyInner += `<ellipse cx="360" cy="96" rx="170" ry="20" fill="url(#g-sheen)" opacity="0.7"/>`;
    bodyInner += `<ellipse cx="320" cy="232" rx="220" ry="30" fill="#000" opacity="0.10"/>`;
    bodyInner += `<path d="${BODY}" fill="none" stroke="#1b2a12" stroke-opacity="0.35" stroke-width="26" filter="url(#f-soft)"/>`;
  }
  // xray organs
  if (xray) {
    const oc = isBP ? p.accent : "#b33a3a";
    bodyInner += `<g class="xray">
      <path d="M470,104 C440,150 444,180 470,206" stroke="${oc}" stroke-width="10" fill="none" opacity="0.55" stroke-linecap="round"/>
      <path d="M455,108 C428,150 432,180 455,202" stroke="${oc}" stroke-width="8" fill="none" opacity="0.45" stroke-linecap="round"/>
      <path d="M470,100 Q300,96 140,140" stroke="${isBP ? p.line : "#f4efe6"}" stroke-width="8" fill="none" stroke-dasharray="12 7" opacity="${isBP ? 0.7 : 0.85}"/>
      <g id="${id}-belly"><ellipse cx="380" cy="190" rx="54" ry="24" fill="${isBP ? "none" : "#c9786a"}" stroke="${isBP ? p.line : "none"}" stroke-width="2" opacity="0.85"/></g>
      <g id="${id}-bladder"><ellipse cx="315" cy="145" rx="110" ry="30" fill="${isBP ? "url(#p-hatch-faint)" : style === "clay" ? "url(#g-bladder)" : "#e6edf2"}" stroke="${isBP ? p.accent : "#7d8c99"}" stroke-width="${isBP ? 3 : 2}"/></g>
    </g>`;
  }
  parts.push(`<defs><clipPath id="${clip}"><path d="${BODY}"/></clipPath></defs>`);
  parts.push(`<g class="body">
    <g clip-path="url(#${clip})">${bodyInner}</g>
    <path d="${BODY}" fill="none" stroke="${stroke}" stroke-width="${isBP ? 3.5 : sw}" stroke-linejoin="round"/>
    <path d="${GILL}" fill="none" stroke="${isBP ? p.line : mix(c.back, "#000000", 0.35)}" stroke-width="${isBP ? 2.5 : 4}" stroke-linecap="round" opacity="${isBP ? 0.8 : 0.55}"/>
  </g>`);

  // --- mouth cavity + jaw (big gape: hinge at jawX)
  const cavity = isBP ? "none" : "#3b1d1d";
  parts.push(`<path d="M614,141 L${jawX},163 L620,160 Z" fill="${cavity}" stroke="${isBP ? p.line : "none"}" stroke-width="2"/>`);
  const jawFill = isBP ? p.fill : c.belly;
  parts.push(`<g id="${id}-jaw"${mouthOpen ? ` transform="rotate(${mouthOpen} ${jawX} 163)"` : ""}>
    <path d="M622,147 C592,158 552,163 ${jawX},163 C${jawX + 10},178 ${jawX + 32},190 560,190 C592,188 612,176 622,156 Z" fill="${jawFill}" stroke="${isBP ? p.line : stroke}" stroke-width="${isBP ? 2.5 : sw}" stroke-linejoin="round"/>
    ${isBP ? "" : `<path d="M618,160 C596,172 570,180 548,182" fill="none" stroke="${mix(c.belly, "#000000", 0.25)}" stroke-width="2" opacity="0.6"/>`}
  </g>`);
  // upper jaw plate (maxilla) reaching back to the hinge: the bass "big mouth"
  const maxFill = isBP ? "none" : mix(c.back, "#000000", 0.2);
  parts.push(`<path d="M614,138 C588,144 548,150 ${jawX - 6},158 L${jawX + 4},166 C550,160 590,154 616,150 Z" fill="${maxFill}" stroke="${isBP ? p.line : mix(c.back, "#000000", 0.5)}" stroke-width="${isBP ? 2.5 : 2}" stroke-linejoin="round"/>`);

  // --- eye
  const eyeX = 548, eyeY = 121;
  if (isBP) {
    parts.push(`<circle cx="${eyeX}" cy="${eyeY}" r="15" fill="none" stroke="${p.line}" stroke-width="3"/><circle cx="${eyeX}" cy="${eyeY}" r="6" fill="${p.accent}"/>`);
  } else {
    parts.push(`<circle cx="${eyeX}" cy="${eyeY}" r="16" fill="${c.eye}" stroke="${mix(c.back, "#000000", 0.4)}" stroke-width="2.5"/>
      <circle cx="${eyeX + 1}" cy="${eyeY}" r="8.5" fill="#111"/>
      ${style === "clay" ? `<circle cx="${eyeX - 4}" cy="${eyeY - 5}" r="3.6" fill="#fff" opacity="0.95"/>` : `<rect x="${eyeX - 6}" y="${eyeY - 7}" width="4" height="4" fill="#fff"/>`}`);
  }

  // --- pectoral fin on top of body
  parts.push(`<g id="${id}-pec"><path d="${PEC}" ${finAttrs} fill-opacity="${isBP ? 1 : 0.85}"/>${finRays(PEC, [470, 170, 470, 176], [394, 178, 440, 186], 5)}</g>`);

  // --- blueprint callouts
  if (callouts && callouts.length) {
    const pts = {
      mouth: [614, 172, 530, 330, sp === "largemouth" ? "BIG MOUTH" : "MOUTH"],
      jaw: [jawX + 4, 166, 560, 330, sp === "largemouth" ? "JAW PAST EYE" : "JAW"],
      eye: [eyeX, eyeY - 10, 600, -40, "EYE"],
      stripe: [300, 150, 210, 330, sp === "largemouth" ? "LATERAL STRIPE" : sp === "smallmouth" ? "VERTICAL BARS" : "SPOT ROWS"],
      dorsal: [360, 20, 120, -45, "DORSAL FIN"],
      tail: [70, 110, 40, -40, "TAIL"],
      bladder: [300, 132, 250, -55, "SWIM BLADDER"],
      gills: [466, 168, 560, 330, "GILLS"],
    };
    const col = isBP ? p.accent : "#ffffff";
    const fsz = 26;
    let s = `<g class="callouts" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="${fsz}">`;
    for (const k of callouts) {
      const q = pts[k];
      if (!q) continue;
      const [x1, y1, x2, y2, label] = q;
      const tw = label.length * fsz * 0.6 + 24;
      const above = y2 < y1;
      const ly = above ? y2 + 22 : y2 - 22;
      const pill = isBP
        ? `<rect x="${x2 - tw / 2}" y="${ly - 20}" width="${tw}" height="40" fill="${p.bg}" stroke="${p.accent}" stroke-width="2"/>`
        : `<rect x="${x2 - tw / 2}" y="${ly - 20}" width="${tw}" height="40" rx="${style === "clay" ? 20 : 0}" fill="${style === "clay" ? "#2b2a33" : "#1d2a3a"}"/>`;
      s += `<path d="M${x1},${y1} L${x2},${above ? ly + 20 : ly - 20}" stroke="${isBP ? p.accent : "#ffffff"}" stroke-width="3" fill="none"/>
        <circle cx="${x1}" cy="${y1}" r="6" fill="${col}" stroke="${isBP ? "none" : "#1d2a3a"}" stroke-width="2"/>
        ${pill}<text x="${x2}" y="${ly + 9}" text-anchor="middle" fill="${isBP ? p.label : "#ffffff"}">${esc(label)}</text>`;
    }
    s += `</g>`;
    parts.push(s);
  }

  const shadow = style === "clay" ? ` filter="url(#f-clay)"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="subject-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="100%" height="100%" overflow="visible"><g${shadow}>${parts.join("")}</g></svg>`;
}

// GSAP transform origins in fish units (for svgOrigin).
export const BASS_ORIGINS = {
  tail: "134 150",
  pec: "470 172",
  jaw: (species) => `${SPECIES_JAW[species] || 500} 163`,
  bladder: "315 145",
  belly: "380 190",
};
