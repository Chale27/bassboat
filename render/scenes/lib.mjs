// Small helpers shared by the scene library. Everything here runs at BUILD
// time in Node; the generated composition only contains static SVG + a
// declarative GSAP timeline, so renders are deterministic.

// Seeded PRNG (mulberry32). Same storyboard id -> same bubbles/weeds.
export function rng(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hash(String(seed));
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export const r1 = (n) => Math.round(n * 10) / 10;

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Frame + overscan. Every layer SVG uses frame coordinates (0..1080, 0..1920)
// but extends OVER px beyond each edge so camera moves never reveal an edge.
export const W = 1080;
export const H = 1920;
export const OVER_X = 360;
export const OVER_Y = 480;

export function layerSvg(inner, cls = "") {
  const vx = -OVER_X, vy = -OVER_Y, vw = W + 2 * OVER_X, vh = H + 2 * OVER_Y;
  return `<svg class="layer-svg ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" style="left:${vx}px;top:${vy}px">${inner}</svg>`;
}

// Ambient (looping) animation descriptor consumed by build.mjs.
// period = one leg; yoyo loops back and forth for the whole segment.
export function loop(sel, from, to, period, opts = {}) {
  return { kind: "loop", sel, from, to, period, yoyo: opts.yoyo !== false, ease: opts.ease || "sine.inOut", origin: opts.origin || null };
}

// Place a standalone <svg ... viewBox="x y w h" width="100%" height="100%">
// inside a layer SVG at (x,y) with width w (height from aspect). Returns the
// nested markup wrapped in <g id> so GSAP can transform it.
export function nest(svg, x, y, w, id = "") {
  const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  const vw = +m[3], vh = +m[4];
  const h = (w * vh) / vw;
  const inner = svg.replace('width="100%" height="100%"', `x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"`);
  return `<g${id ? ` id="${id}"` : ""}>${inner}</g>`;
}

// Map a point given in a child viewBox to frame coords after nest().
export function mapPoint(vb, x, y, w, px, py) {
  const s = w / vb.w;
  return { x: x + (px - vb.x) * s, y: y + (py - vb.y) * s };
}
