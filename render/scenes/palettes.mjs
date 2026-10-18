// House-style palettes. Each style is a palette (used when drawing SVG at
// build time) plus CSS variables (used by the HTML chrome: captions, HUD,
// backgrounds) and shared SVG <defs> (gradients, filters, patterns).
//
//   clay      soft clay-like 3D, warm light, rounded shapes
//   blueprint navy background, white/cyan line art, labeled callouts
//   isometric isometric cross-section diorama, flat colors, depth layers

export const STYLES = ["clay", "blueprint", "isometric"];

export const SPECIES = ["largemouth", "smallmouth", "spotted"];

const fishColors = {
  largemouth: { back: "#3f6229", side: "#86b04f", belly: "#f1e9c9", mark: "#24391a", fin: "#6c9142", eye: "#e9b23a" },
  smallmouth: { back: "#5f4521", side: "#a8823e", belly: "#ecdcb2", mark: "#4a3417", fin: "#8b6a33", eye: "#c8352a" },
  spotted:    { back: "#43582a", side: "#93a653", belly: "#f0e8c8", mark: "#2c3a1a", fin: "#748a41", eye: "#d9a23a" },
};

export const PALETTES = {
  clay: {
    style: "clay",
    bg: "#f3d9b8",
    sky: ["#ffe2b8", "#ffc79a"],
    sun: "#fff1c9",
    hills: ["#d6a77f", "#b9875f"],
    water: ["#86d3c6", "#3f9da0", "#1d5f6b"],
    surface: "#c9f1e8",
    ray: "#fff6d8",
    sand: "#e9c99c",
    sandDark: "#cfa776",
    rock: ["#b78f70", "#94705a"],
    weed: ["#7fbf5e", "#5c9a49", "#3f7a3c"],
    wood: ["#c98b57", "#9c6236"],
    angler: "#2b3440",
    boatHull: "#d8483b",
    boatTrim: "#f6efe3",
    metal: "#3a4552",
    line: "rgba(255,255,255,0.75)",
    ink: "#2b2a33",
    stroke: "rgba(40,30,30,0.18)",
    strokeW: 3,
    label: "#2b2a33",
    fish: fishColors,
    lure: { crank: ["#d7ec3f", "#f6d63a"], crankBelly: "#fff7c8", worm: "#6a2f93", wormTip: "#c55bd6", jigHead: "#2e3238", skirt: ["#d9772e", "#7a4a26", "#e8b04a"], blade: "#f2f4f6", bladeGold: "#f3c745" },
  },
  blueprint: {
    style: "blueprint",
    bg: "#0c2a5c",
    sky: ["#0c2a5c", "#0c2a5c"],
    sun: "none",
    water: ["#0c2a5c", "#0c2a5c", "#0c2a5c"],
    surface: "#9fe9ff",
    line: "#e9f7ff",
    accent: "#5fe0ff",
    faint: "rgba(159,233,255,0.35)",
    fill: "rgba(120,210,255,0.09)",
    grid: "rgba(120,180,255,0.16)",
    gridMajor: "rgba(140,200,255,0.30)",
    ink: "#e9f7ff",
    stroke: "#e9f7ff",
    strokeW: 3,
    label: "#bff2ff",
  },
  isometric: {
    style: "isometric",
    bg: "#f3ead6",
    sky: ["#f3ead6", "#f3ead6"],
    sun: "#f6c453",
    cloud: "#ffffff",
    // water depth bands, top to bottom (flat)
    bands: ["#7fd0dc", "#56b4cc", "#3a92b6", "#2a729a", "#1f567c"],
    top: "#a9e6ee",
    topEdge: "#d6f6fa",
    side: ["#3f8fae", "#2f7393", "#245b78", "#1b4862", "#14374c"],
    sediment: ["#dcb67a", "#c39859", "#a67c44"],
    rock: ["#8f9aa6", "#6f7b88"],
    weed: ["#5cae6b", "#3f8f55"],
    wood: ["#c48a53", "#9a6638", "#7a4f2a"],
    angler: "#283447",
    boatHull: "#e0503f",
    boatSide: "#b23b2e",
    boatTrim: "#fbf5ea",
    metal: "#33404f",
    line: "rgba(255,255,255,0.9)",
    ink: "#1d2a3a",
    stroke: "none",
    strokeW: 0,
    label: "#1d2a3a",
    fish: fishColors,
    lure: { crank: ["#c9e33a", "#f1d23a"], crankBelly: "#fff3b8", worm: "#6a2f93", wormTip: "#c55bd6", jigHead: "#2e3238", skirt: ["#e07a2e", "#7a4a26", "#efb34a"], blade: "#eef1f4", bladeGold: "#f0c03e" },
  },
};

// CSS variables for the HTML chrome.
export function cssVars(style) {
  const p = PALETTES[style];
  const common = { "--cap-color": "#ffffff" };
  const by = {
    clay: { "--bg": p.bg, "--hud-bg": "rgba(43,42,51,0.82)", "--hud-fg": "#fff6e8", "--hud-accent": "#ffb347", "--cap-shadow": "rgba(30,20,20,0.9)", "--label": p.label },
    blueprint: { "--bg": p.bg, "--hud-bg": "rgba(12,42,92,0.85)", "--hud-fg": "#e9f7ff", "--hud-accent": "#5fe0ff", "--cap-shadow": "rgba(4,16,40,0.95)", "--label": p.label },
    isometric: { "--bg": p.bg, "--hud-bg": "rgba(29,42,58,0.88)", "--hud-fg": "#fbf5ea", "--hud-accent": "#f6c453", "--cap-shadow": "rgba(20,28,40,0.92)", "--label": p.label },
  };
  return { ...common, ...by[style] };
}

// Global <defs> placed once in the document (ids are shared by every layer).
export function globalDefs(style) {
  const p = PALETTES[style];
  if (style === "clay") {
    const fish = Object.entries(p.fish)
      .map(([k, c]) => `<linearGradient id="g-fish-${k}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.12" stop-color="${c.back}"/><stop offset="0.42" stop-color="${c.side}"/>
        <stop offset="0.62" stop-color="${mix(c.side, c.belly, 0.55)}"/><stop offset="0.80" stop-color="${c.belly}"/></linearGradient>`)
      .join("");
    return `<defs>
      <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>
      <linearGradient id="g-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.water[0]}"/><stop offset="0.45" stop-color="${p.water[1]}"/><stop offset="1" stop-color="${p.water[2]}"/></linearGradient>
      <linearGradient id="g-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.ray}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.ray}" stop-opacity="0"/></linearGradient>
      <radialGradient id="g-studio" cx="0.5" cy="0.38" r="0.75"><stop offset="0" stop-color="#ffe9cc"/><stop offset="0.6" stop-color="#f0c9a0"/><stop offset="1" stop-color="#c99872"/></radialGradient>
      <radialGradient id="g-spot" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8ea" stop-opacity="0.9"/><stop offset="1" stop-color="#fff8ea" stop-opacity="0"/></radialGradient>
      <radialGradient id="g-sheen" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
      <radialGradient id="g-bubble" cx="0.35" cy="0.35" r="0.65"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.5" stop-color="#e8fffb" stop-opacity="0.45"/><stop offset="1" stop-color="#e8fffb" stop-opacity="0.15"/></radialGradient>
      <radialGradient id="g-bladder" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#dfe7ee"/><stop offset="1" stop-color="#aebdca"/></radialGradient>
      <linearGradient id="g-crank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.lure.crank[0]}"/><stop offset="0.6" stop-color="${p.lure.crank[1]}"/><stop offset="1" stop-color="${p.lure.crankBelly}"/></linearGradient>
      <linearGradient id="g-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef6a55"/><stop offset="1" stop-color="#a8352b"/></linearGradient>
      <linearGradient id="g-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.wood[0]}"/><stop offset="1" stop-color="${p.wood[1]}"/></linearGradient>
      ${fish}
      <filter id="f-clay" x="-20%" y="-20%" width="140%" height="160%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur"/>
        <feSpecularLighting in="blur" surfaceScale="6" specularConstant="0.75" specularExponent="16" lighting-color="#fff4dc" result="spec"><fePointLight x="420" y="-500" z="380"/></feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
        <feDiffuseLighting in="blur" surfaceScale="4" diffuseConstant="1" lighting-color="#ffffff" result="diff"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting>
        <feComposite in="diff" in2="SourceAlpha" operator="in" result="diffIn"/>
        <feBlend in="SourceGraphic" in2="diffIn" mode="multiply" result="shaded"/>
        <feComposite in="shaded" in2="SourceGraphic" operator="arithmetic" k1="0" k2="0.55" k3="0.45" k4="0" result="lit"/>
        <feComposite in="lit" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="final"/>
        <feDropShadow in="final" dx="0" dy="16" stdDeviation="12" flood-color="#3a2418" flood-opacity="0.28"/>
      </filter>
      <filter id="f-clay-flat" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#3a2418" flood-opacity="0.25"/></filter>
      <filter id="f-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
      <filter id="f-blur-far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>`;
  }
  if (style === "blueprint") {
    return `<defs>
      <pattern id="p-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${p.grid}" stroke-width="1.5"/></pattern>
      <pattern id="p-grid-major" width="200" height="200" patternUnits="userSpaceOnUse"><path d="M200 0H0V200" fill="none" stroke="${p.gridMajor}" stroke-width="2"/></pattern>
      <pattern id="p-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V12" stroke="${p.accent}" stroke-width="3" stroke-opacity="0.75"/></pattern>
      <pattern id="p-hatch-faint" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V16" stroke="${p.line}" stroke-width="1.5" stroke-opacity="0.35"/></pattern>
      <pattern id="p-scales" width="26" height="18" patternUnits="userSpaceOnUse"><path d="M0 18 A13 13 0 0 1 26 18" fill="none" stroke="${p.line}" stroke-opacity="0.22" stroke-width="1.5"/></pattern>
      <marker id="m-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5"><circle cx="5" cy="5" r="4" fill="${p.accent}"/></marker>
    </defs>`;
  }
  // isometric: flat, no gradients except none
  return `<defs>
    <pattern id="p-iso-sand" width="28" height="16" patternUnits="userSpaceOnUse"><circle cx="6" cy="5" r="2.2" fill="${p.sediment[2]}" opacity="0.55"/><circle cx="20" cy="12" r="1.8" fill="${p.sediment[2]}" opacity="0.45"/></pattern>
  </defs>`;
}

export function mix(a, b, t) {
  const pa = hex(a), pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function hex(h) {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
