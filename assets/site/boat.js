/* Bass Boat stage: a 3D bass boat on the lake (three.js r128, vendored) and the pixel-art deck aboard.
   Modeled on Agent Ramen's ramen stand: drag to look around outside, click the boat to climb aboard,
   tap a crew member for their station, tap the Captain to give the crew an order.
   All art is original and built from primitives; textures are drawn on canvases. Text from JSON is
   only ever set with textContent / attributes, never innerHTML. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const scene = $("scene"); if (!scene) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TZ = "America/Chicago";
  const BB = window.BassBoat || {};
  const GH_REPO = BB.GH_REPO || "Chale27/bassboat";
  const FOOT = BB.FOOT || "\n\n---\nOpened from the Bass Boat dashboard. Anchor picks this up within 15 minutes (8 AM-11 PM) and closes the ticket. Only tickets opened by @Chale27 are honored.";
  const issueUrl = BB.issueUrl || ((title, body) => "https://github.com/" + GH_REPO + "/issues/new?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body));
  const runBody = name => (BB.bodies && BB.bodies.run ? BB.bodies.run(name) : "Start " + name + " now." + FOOT);
  const str = v => (v == null ? "" : String(v));
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const arr = v => (Array.isArray(v) ? v : []);
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else if (k === "text") e.textContent = String(v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c instanceof Node ? c : String(c)); }
    return e;
  }
  function when(s) {
    if (!s) return "never";
    const d = new Date(s); if (isNaN(d)) return str(s);
    return d.toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  /* ================= crew data (from the dashboard's crew.json / ?data= load) ================= */
  const ORDER = ["scale", "sonar", "jig", "spinner", "cast", "anchor"];
  const DEFAULTS = {
    scale: { name: "Scale", role: "Analyst" }, sonar: { name: "Sonar", role: "Scout" }, jig: { name: "Jig", role: "Writer & checker" },
    spinner: { name: "Spinner", role: "Render" }, cast: { name: "Cast", role: "Poster" }, anchor: { name: "Anchor", role: "Courier" },
  };
  const STATES = { ok: "OK", needs_you: "Needs you", running: "Running", idle: "Idle" };
  let CREW = {}, TICKETS = {};
  const crewOf = id => Object.assign({}, DEFAULTS[id], obj(CREW[id]));
  const stateOf = id => { const s = str(obj(CREW[id]).state); return STATES[s] ? s : "idle"; };
  const nameOf = id => (id === "captain" ? "Captain" : str(crewOf(id).name) || id);

  /* ================= sound: synthesized with WebAudio only, off by default ================= */
  const soundBtn = $("st-sound");
  let actx = null, master = null, lapGain = null, rainGain = null, soundOn = false;
  function noiseBuf(c, secs, brown) {
    const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w * .35; }
    return b;
  }
  function bed(buf, freq) { const s = actx.createBufferSource(); s.buffer = buf; s.loop = true; const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; const g = actx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(master); s.start(); return g; }
  function tone(freq, start, len, vol, type, glideTo) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, start); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + len * .7);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(vol, start + .01); g.gain.exponentialRampToValueAtTime(.0001, start + len);
    o.connect(g).connect(master); o.start(start); o.stop(start + len + .05);
  }
  function startAudio() {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = .9; master.connect(actx.destination);
    lapGain = bed(noiseBuf(actx, 4, true), 700);   // water lapping on the hull
    rainGain = bed(noiseBuf(actx, 3, false), 4200); // rain hiss
    (function lap() { // slow swell so the water breathes
      if (soundOn && lapGain) { const t = actx.currentTime; lapGain.gain.setTargetAtTime(.18 + Math.random() * .16, t, .9); }
      setTimeout(lap, 1400 + Math.random() * 1600);
    })();
    (function birds() { // an occasional far-off bird call on the lake
      if (soundOn && Math.random() < .5) { const t = actx.currentTime + .05, f = 1300 + Math.random() * 500; tone(f, t, .35, .025, "sine", f * 1.35); tone(f * 1.2, t + .4, .5, .02, "sine", f * .9); }
      setTimeout(birds, 6000 + Math.random() * 9000);
    })();
  }
  function mix() { if (!actx) return; const t = actx.currentTime; if (!soundOn) lapGain.gain.setTargetAtTime(0, t, .3); rainGain.gain.setTargetAtTime(soundOn && weather.rain ? .12 : 0, t, .5); }
  function sfx(kind) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime + .01;
    if (kind === "plop") { tone(520, t, .25, .12, "sine", 140); return; }                 // climbing aboard
    if (kind === "reel") { for (let i = 0; i < 7; i++) tone(2600, t + i * .045, .03, .03, "square"); return; } // reel click
    if (kind === "bell") { [[880, .1], [1320, .06]].forEach(([f, v]) => tone(f, t, 1.4, v, "sine")); return; } // order in
    tone(1175, t, .45, .08, "sine"); tone(1760, t + .06, .35, .04, "sine");              // ding
  }
  soundBtn.addEventListener("click", () => {
    if (!actx) { try { startAudio(); } catch (e) { soundBtn.disabled = true; return; } }
    soundOn = !soundOn; if (actx.state !== "running") actx.resume();
    soundBtn.setAttribute("aria-pressed", String(soundOn)); soundBtn.textContent = soundOn ? "\u{1F50A} Sound on" : "\u{1F508} Sound off";
    mix(); if (soundOn) sfx("ding");
  });
  document.addEventListener("visibilitychange", () => { if (actx && soundOn && !document.hidden && actx.state !== "running") actx.resume(); });
  const weather = { day: true, fog: false, rain: false };

  /* ================= aboard: the pixel-art deck ================= */
  const W = 320, H = 240;
  const cv = $("deck"), ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const overlay = $("st-overlay");
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w, h); };
  const CY = 124, HH = 66, D0 = CY - HH, D1 = CY + HH, TX = 28, SIDE = 11;
  const rightAt = y => { const d = (y - CY) / HH; return Math.abs(d) > 1 ? -1 : Math.round(200 + 104 * Math.sqrt(1 - d * d)); };
  const leftAt = y => { const d = Math.abs(y - CY) / HH; return TX + (d > .93 ? Math.round((d - .93) * 60) : 0); };
  const inDeck = (x, y) => y >= D0 && y <= D1 && x >= leftAt(y) && x <= rightAt(y);
  const mask = new Uint8Array(W * H); // 1 = deck, 2 = hull side, 3 = motor
  const sidePx = [], waterPx = [];

  // where everyone stands (feet), and the props you can tap for them
  const SPOTS = {
    spinner: { x: 96, y: 98, box: [102, 74, 132, 98] },
    jig: { x: 196, y: 98, box: [202, 80, 230, 98] },
    anchor: { x: 50, y: 146, box: [28, 130, 70, 178] },
    captain: { x: 144, y: 152, box: [148, 126, 178, 158] },
    cast: { x: 284, y: 142, box: [276, 110, 306, 146] },
    scale: { x: 100, y: 186, box: [76, 156, 126, 186] },
    sonar: { x: 238, y: 178, box: [208, 148, 232, 178], tagDx: 10 },
  };
  const LOOKS = {
    captain: { skin: "#f0c39a", vest: "#23345a", vest2: "#1a2744", shirt: "#f4f4f0", pants: "#2b2f3a", hat: "captain", ph: 0 },
    scale: { skin: "#d9a47a", vest: "#3f8f4f", vest2: "#2f6f3c", shirt: "#e9e2cf", pants: "#4a4a52", hat: "scale", ph: .3 },
    sonar: { skin: "#8d5a3b", vest: "#2aa198", vest2: "#1f7a73", shirt: "#20323a", pants: "#3a3f4a", hat: "sonar", ph: .6 },
    jig: { skin: "#f2c79e", vest: "#e8b730", vest2: "#b98d1c", shirt: "#3a5a8a", pants: "#3e4c66", hat: "jig", ph: .9 },
    spinner: { skin: "#c58b5e", vest: "#7b4bb3", vest2: "#5c3690", shirt: "#e8e0d0", pants: "#33303c", hat: "spinner", ph: .2 },
    cast: { skin: "#f0c39a", vest: "#d8452f", vest2: "#a83424", shirt: "#f0ead8", pants: "#556048", hat: "cast", ph: .5 },
    anchor: { skin: "#e0b08a", vest: "#2f6fb3", vest2: "#245890", shirt: "#d9d4c4", pants: "#2c3442", hat: "anchor", ph: .8 },
  };

  const bg = document.createElement("canvas"); bg.width = W; bg.height = H; const b = bg.getContext("2d");
  (function paintBackground() {
    // the lake
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const band = Math.sin(y * .55 + Math.sin(x * .05) * 2) > .82;
      R(b, x, y, 1, 1, band ? "#3a7d9a" : (rnd() < .05 ? "#296380" : "#2c6a87"));
    }
    // a little shore in the top-left corner, with reeds and a lily pad or two
    for (let y = 0; y < 26; y++) { const r = 38 - y * 1.5 + Math.sin(y * .9) * 2; for (let x = 0; x < r; x++) R(b, x, y, 1, 1, x > r - 3 ? "#c9b48a" : (rnd() < .2 ? "#3f6b35" : "#4b7a3c")); }
    for (let i = 0; i < 9; i++) { const x = 30 + i * 3 + (rnd() * 3 | 0), y = 6 + (rnd() * 18 | 0); R(b, x, y - 6, 1, 6, "#6f8a3a"); R(b, x, y - 7, 1, 2, "#8a5a2a"); }
    [[56, 22], [64, 16], [20, 222], [30, 230], [286, 222]].forEach(([x, y]) => { R(b, x - 3, y - 1, 7, 3, "#3f7a3a"); R(b, x - 2, y - 2, 5, 5, "#3f7a3a"); R(b, x, y - 2, 1, 2, "#2c6a87"); });
    R(b, 34, 226, 2, 2, "#f2c6d8");
    // hull mask
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (inDeck(x, y)) mask[y * W + x] = 1;
      else { for (let j = 1; j <= SIDE; j++) if (inDeck(x, y - j)) { mask[y * W + x] = 2; break; } }
    }
    // shadow of the boat on the water
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!mask[y * W + x] && (mask[(y - 3) * W + x - 3] || (y > 2 && mask[(y - 2) * W + x]))) R(b, x, y, 1, 1, "#1f4f66");
    // hull side: rub rail, metal-flake red, pinstripe, silver lower hull
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (mask[y * W + x] !== 2) continue;
      let k = 1; while (k <= SIDE && !inDeck(x, y - k)) k++;
      let col;
      if (k <= 1) col = "#15191c";
      else if (k <= 6) { const r = rnd(); col = r < .07 ? "#ff8f8f" : r < .2 ? "#d8323f" : r < .3 ? "#8f1724" : "#b3202f"; if (k === 2) col = "#e05058"; sidePx.push([x, y]); }
      else if (k === 7) col = "#f4f1e8";
      else if (k < SIDE) { const r = rnd(); col = r < .08 ? "#ffffff" : r < .25 ? "#a9b0b8" : "#c8ccd2"; sidePx.push([x, y]); }
      else col = "#59636d";
      R(b, x, y, 1, 1, col);
    }
    // deck: rub rail, gunwale cap, carpet, raised casting decks at bow and stern
    for (let y = D0; y <= D1; y++) for (let x = 0; x < W; x++) {
      if (!inDeck(x, y)) continue;
      const edge1 = !inDeck(x - 1, y) || !inDeck(x + 1, y) || !inDeck(x, y - 1) || !inDeck(x, y + 1);
      const edge4 = !inDeck(x - 4, y) || !inDeck(x + 4, y) || !inDeck(x, y - 4) || !inDeck(x, y + 4);
      const edge5 = !inDeck(x - 5, y) || !inDeck(x + 5, y) || !inDeck(x, y - 5) || !inDeck(x, y + 5);
      let col;
      if (edge1) col = "#1b2024";
      else if (edge4) col = rnd() < .1 ? "#c3c9cf" : "#d7dbdf";
      else if (edge5) col = "#8e969e";
      else if (x === 218 || x === 75) col = "#353c44";
      else if (x === 219 || x === 74) col = "#8b97a3";
      else { const raised = x > 218 || x < 75, r = rnd(); col = raised ? (r < .12 ? "#66717d" : r < .17 ? "#727e8a" : "#6c7884") : (r < .12 ? "#505a64" : r < .17 ? "#5c6772" : "#56616c"); }
      R(b, x, y, 1, 1, col);
    }
    // rod locker: rods laid along the port gunwale
    [["#2b2b2b", 64], ["#c8382c", 66], ["#2f6fb3", 68]].forEach(([c, y], i) => { R(b, 90 + i * 6, y, 104 - i * 10, 1, c); R(b, 182 - i * 8, y - 1, 3, 3, "#9aa3ab"); R(b, 90 + i * 6, y, 6, 1, "#7a5232"); });
    // hatches and livewell
    const hatch = (x, y, w, h) => { R(b, x, y, w, h, "#3c444c"); R(b, x + 1, y + 1, w - 2, h - 2, "#66717c"); R(b, x + (w >> 1) - 2, y + h - 3, 4, 1, "#c9ced3"); };
    hatch(232, 70, 22, 12); hatch(34, 100, 24, 12); hatch(238, 112, 12, 26);
    // seats on pedestals: rear, driver, passenger, bow
    const seat = (x, y) => { R(b, x + 3, y + 9, 4, 2, "#2a3036"); R(b, x, y - 4, 10, 5, "#24282c"); R(b, x, y - 4, 10, 1, "#b8352a"); R(b, x, y + 1, 10, 7, "#2f343a"); R(b, x, y + 1, 10, 1, "#b8352a"); R(b, x + 1, y + 2, 8, 1, "#454c54"); };
    seat(36, 84); seat(124, 138); seat(150, 90); seat(256, 96);
    // outboard motor hanging off the transom
    for (let y = 104; y <= 142; y++) for (let x = 6; x <= 27; x++) {
      const dx = Math.max(0, Math.abs(y - 123) - 13), dl = Math.max(0, 12 - x);
      if (dx * dx + dl * dl > 64) continue;
      mask[y * W + x] = 3;
      R(b, x, y, 1, 1, x > 24 ? "#2a2e32" : y < 108 || y > 138 ? "#121416" : (x < 11 ? "#24282c" : "#1b1e21"));
    }
    R(b, 12, 116, 10, 1, "#c8382c"); R(b, 12, 130, 10, 1, "#c8382c"); R(b, 10, 110, 4, 3, "#3e454c"); R(b, 14, 121, 6, 4, "#e9e4d8");
    R(b, 26, 118, 3, 10, "#3b4249");
    // anchor rope coil, the anchor, and the mailbag of tickets
    for (let r = 6; r >= 2; r -= 2) for (let a = 0; a < 40; a++) { const x = 36 + Math.round(Math.cos(a / 40 * 6.283) * r), y = 168 + Math.round(Math.sin(a / 40 * 6.283) * r * .7); R(b, x, y, 1, 1, r % 4 ? "#c9a46a" : "#a8824a"); }
    R(b, 44, 168, 6, 1, "#a8824a");
    R(b, 51, 164, 2, 9, "#8d969e"); R(b, 49, 165, 6, 1, "#8d969e"); R(b, 47, 171, 2, 2, "#8d969e"); R(b, 53, 171, 2, 2, "#8d969e"); R(b, 49, 173, 6, 1, "#8d969e"); R(b, 51, 162, 2, 2, "#5f676e");
    // Spinner's editing table (reel + film), Jig's tackle-box desk, Sonar's fish-finder post, Scale's hanging scale and chart
    R(b, 104, 82, 28, 10, "#8a5a32"); R(b, 104, 82, 28, 1, "#b07a48"); R(b, 105, 92, 2, 5, "#5e3820"); R(b, 129, 92, 2, 5, "#5e3820");
    R(b, 202, 84, 28, 12, "#2c3a42"); R(b, 203, 85, 26, 10, "#3b4b55"); R(b, 203, 96, 2, 2, "#1d262b"); R(b, 227, 96, 2, 2, "#1d262b");
    R(b, 218, 164, 3, 13, "#30363c"); R(b, 215, 176, 9, 2, "#30363c");
    R(b, 121, 156, 1, 28, "#6b4a2a"); R(b, 114, 156, 9, 2, "#6b4a2a"); R(b, 118, 184, 7, 2, "#4a3420");
    R(b, 78, 168, 14, 12, "#5e3820"); R(b, 79, 169, 12, 10, "#fff8ea"); R(b, 80, 180, 1, 5, "#5e3820"); R(b, 89, 180, 1, 5, "#5e3820"); R(b, 82, 166, 6, 3, "#9aa3ab");
    // console with windscreen and wheel
    R(b, 150, 130, 23, 18, "#e3e6ea"); R(b, 150, 130, 23, 1, "#ffffff"); R(b, 150, 148, 23, 9, "#9aa2aa"); R(b, 150, 156, 23, 1, "#6c747c");
    R(b, 173, 126, 4, 28, "#8fd0f0"); R(b, 174, 128, 1, 22, "#e6f7ff"); R(b, 172, 126, 1, 28, "#3c444c");
    for (let a = 0; a < 24; a++) R(b, 155 + Math.round(Math.cos(a / 24 * 6.283) * 3), 138 + Math.round(Math.sin(a / 24 * 6.283) * 3), 1, 1, "#1b2024");
    R(b, 155, 138, 1, 1, "#1b2024"); R(b, 162, 134, 8, 5, "#0b2a3a"); R(b, 163, 135, 4, 1, "#5fd3a0"); R(b, 162, 142, 2, 2, "#1b2024"); R(b, 166, 142, 2, 2, "#1b2024"); R(b, 152, 151, 6, 2, "#c8382c");
    // trolling motor at the bow: mount, stowed shaft, head; and its foot pedal
    R(b, 288, 114, 10, 6, "#24282c"); R(b, 289, 115, 8, 1, "#454c54");
    for (let i = 0; i < 14; i++) R(b, 296 + i, 116 - Math.round(i * .6), 1, 1, "#9aa3ab");
    R(b, 308, 104, 6, 5, "#1b1e21"); R(b, 309, 105, 3, 1, "#5f676e"); R(b, 266, 138, 7, 4, "#24282c"); R(b, 267, 139, 5, 1, "#454c54");
    // water pixels for sparkles
    for (let i = 0; i < 500; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; if (!mask[y * W + x] && !(y < 26 && x < 40)) waterPx.push([x, y, rnd() * 6.28]); }
  })();

  // a tiny pixel line
  function line(x0, y0, x1, y1, col) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0;
    ctx.fillStyle = col;
    while (n++ < 600) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  const P = (x, y, w, h, col) => R(ctx, x, y, w, h, col);
  function zGlyph(x, y, col) { P(x, y, 3, 1, col); P(x + 1, y + 1, 1, 1, col); P(x, y + 2, 3, 1, col); }

  function person(id, x, y, st, t) {
    const L = LOOKS[id], sleeping = st === "idle", busy = st === "running";
    const beat = reduce ? 0 : Math.floor(t * 1.6 + L.ph * 2) % 2;
    const dy = sleeping ? 1 : (st === "ok" && beat ? -1 : 0);
    P(x - 4, y, 9, 1, "rgba(0,0,0,.28)");
    P(x - 3, y - 4, 2, 4, L.pants); P(x + 1, y - 4, 2, 4, L.pants); P(x - 3, y - 1, 2, 1, "#2a211a"); P(x + 1, y - 1, 2, 1, "#2a211a");
    const by = y - 11 + dy;
    P(x - 4, by, 8, 7, L.vest); P(x - 4, by, 8, 1, L.vest2); P(x - 1, by + 1, 2, 6, L.shirt); P(x - 1, by + 1, 2, 1, L.vest2);
    const armUp = busy && !reduce && Math.floor(t * 4) % 2;
    P(x - 5, by + 1, 1, 5, L.vest2); P(x - 5, by + 6, 1, 1, L.skin);
    if (armUp) { P(x + 4, by - 1, 1, 4, L.vest2); P(x + 4, by - 2, 1, 1, L.skin); } else { P(x + 4, by + 1, 1, 5, L.vest2); P(x + 4, by + 6, 1, 1, L.skin); }
    const hy = by - 6 + (sleeping ? 1 : 0);
    P(x - 3, hy, 6, 6, L.skin); P(x - 3, hy + 5, 6, 1, "rgba(0,0,0,.12)");
    if (sleeping) { P(x - 2, hy + 3, 2, 1, "#3a2a20"); P(x + 1, hy + 3, 2, 1, "#3a2a20"); }
    else { P(x - 2, hy + 2, 1, 2, "#1b1510"); P(x + 1, hy + 2, 1, 2, "#1b1510"); }
    switch (L.hat) {
      case "captain": P(x - 4, hy - 1, 8, 1, "#1b1b1b"); P(x - 3, hy - 3, 6, 2, "#f4f4f0"); P(x - 1, hy - 3, 2, 1, "#d4a017"); break;
      case "scale": P(x - 3, hy - 2, 6, 2, "#3a5f8a"); P(x + 2, hy - 1, 3, 1, "#2c4a6c"); if (!sleeping) { P(x - 3, hy + 2, 6, 1, "#1b1510"); P(x - 2, hy + 2, 2, 2, "#1b1510"); P(x + 1, hy + 2, 2, 2, "#1b1510"); } break;
      case "sonar": P(x - 3, hy - 1, 6, 2, "#2a1a10"); P(x - 4, hy - 2, 8, 1, "#222"); P(x - 4, hy + 1, 1, 3, "#222"); P(x + 3, hy + 1, 1, 3, "#222"); break;
      case "jig": P(x - 3, hy - 2, 6, 3, "#e2672b"); P(x - 3, hy, 6, 1, "#c4501c"); P(x - 1, hy - 3, 2, 1, "#f5d0a0"); break;
      case "spinner": P(x - 3, hy - 2, 6, 2, "#c03a3a"); P(x - 5, hy - 1, 2, 1, "#9a2a2a"); P(x - 3, hy, 1, 2, "#2a1a10"); break;
      case "cast": P(x - 4, hy - 1, 8, 1, "#b49a5e"); P(x - 3, hy - 3, 6, 2, "#c7b07a"); if (!sleeping) P(x - 3, hy + 2, 6, 1, "#111"); break;
      case "anchor": P(x - 3, hy - 2, 6, 2, "#1d2a44"); P(x - 3, hy - 1, 6, 1, "#2b3d63"); P(x - 3, hy + 4, 6, 2, "#7a4a26"); P(x - 1, hy + 4, 2, 1, "#a06a3a"); break;
    }
    return { by, hy };
  }
  function bubbles(id, x, hy, st, t) {
    if (st === "needs_you" && (reduce || (t % 1) < .78)) {
      const bx = x + 5, byy = hy - 5;
      P(bx, byy, 9, 10, "#1b1510"); P(bx + 1, byy + 1, 7, 8, "#fffdf5"); P(bx + 4, byy + 2, 1, 4, "#d7261e"); P(bx + 4, byy + 7, 1, 1, "#d7261e"); P(bx, byy + 10, 2, 1, "#1b1510"); P(bx, byy + 9, 1, 1, "#1b1510");
    }
    if (st === "idle") {
      if (reduce) { zGlyph(x + 5, hy, "#eaf3f8"); zGlyph(x + 9, hy - 5, "#eaf3f8"); }
      else for (let k = 0; k < 2; k++) { const p = ((t * .45) + k * .5) % 1; zGlyph(x + 5 + Math.round(p * 6), hy + 1 - Math.round(p * 7), p > .8 ? "rgba(234,243,248,.5)" : "#eaf3f8"); }
    }
    if (flash[id] && clock < flash[id]) { // a fresh order ticket from the Captain
      const bx = x - 4, byy = hy - 14 + (reduce ? 0 : Math.round(Math.sin(t * 5)));
      P(bx, byy, 8, 6, "#1b1510"); P(bx + 1, byy + 1, 6, 4, "#fffaf0"); P(bx + 1, byy + 1, 6, 1, "#c8382c"); P(bx + 2, byy + 3, 4, 1, "#9a9284");
    }
  }

  /* station props that move */
  function sonarScreen(st, t) {
    const sx = 210, sy = 150, w = 20, hh = 15, sp = st === "running" ? 3 : 1;
    P(sx - 1, sy - 1, w + 2, hh + 2, "#1b2024"); P(sx, sy, w, hh, "#08203a");
    const scroll = reduce ? 0 : Math.floor(t * 6 * sp);
    for (let c = 0; c < w; c++) { const d = 9 + Math.round(Math.sin((c + scroll) * .35) * 2 + Math.sin((c + scroll) * .11) * 1.5); P(sx + c, sy + d, 1, hh - d, "#a8743a"); P(sx + c, sy + d, 1, 1, "#ffcf6a"); }
    const n = st === "running" ? 4 : 2;
    for (let i = 0; i < n; i++) { const fx = (w - 1 - ((scroll + i * 9) % (w + 6))) + 3, fy = 3 + ((i * 5 + 2) % 5); if (fx >= 0 && fx < w - 1) { P(sx + fx, sy + fy, 2, 1, "#ffe14a"); P(sx + fx - 1 < sx ? sx : sx + fx - 1, sy + fy + 1, 1, 1, "#ffe14a"); } }
    const sweep = reduce ? w - 2 : Math.floor(t * 8 * sp) % w; P(sx + sweep, sy, 1, hh, "rgba(120,255,200,.35)");
    P(sx, sy, w, 1, "#2a6a8a");
  }
  function spinnerStation(st, t) {
    const busy = st === "running" && !reduce, cx = 112, cy = 87;
    for (let a = 0; a < 20; a++) P(cx + Math.round(Math.cos(a / 20 * 6.283) * 4), cy + Math.round(Math.sin(a / 20 * 6.283) * 3), 1, 1, "#c9ced3");
    P(cx - 1, cy - 1, 3, 3, "#3e454c"); P(cx, cy, 1, 1, "#ffd45a");
    const ang = busy ? t * 9 : .7; line(cx, cy, cx + Math.round(Math.cos(ang) * 5), cy + Math.round(Math.sin(ang) * 4), "#1b2024");
    P(cx + Math.round(Math.cos(ang) * 5), cy + Math.round(Math.sin(ang) * 4), 1, 1, "#c8382c");
    P(118, 74, 13, 10, "#1b2024"); // monitor with the edit
    const f = busy ? Math.floor(t * 3) % 3 : 0, pal = [["#5a9ad0", "#e8742c"], ["#3f7a3a", "#f6b25c"], ["#123a4d", "#ffd45a"]][f];
    P(119, 75, 11, 6, pal[0]); P(121 + f * 2, 77, 3, 3, pal[1]); P(119, 82, 11, 1, "#3e454c"); P(119, 82, busy ? 1 + Math.floor((t * 2) % 11) : 4, 1, "#ffd45a");
    P(124, 84, 1, 0, "#1b2024");
    const off = busy ? Math.floor(t * 6) % 4 : 0; // film strip hanging off the table
    P(106, 92, 12, 5, "#1b1510"); for (let i = 0; i < 4; i++) { P(106 + ((i * 4 + off) % 12), 92, 2, 1, "#eae2d0"); P(106 + ((i * 4 + off) % 12), 96, 2, 1, "#eae2d0"); P(107 + ((i * 4 + off + 1) % 11), 93, 2, 3, i % 2 ? "#5a9ad0" : "#e8742c"); }
  }
  function tackleBox(st, t) {
    P(206, 86, 20, 8, "#2f7a4a"); P(206, 86, 20, 1, "#4fa06a"); P(206, 94, 20, 1, "#1f5a34");
    const lures = ["#ffd45a", "#c8382c", "#5a9ad0", "#f0ead8", "#e8742c", "#9a5ad0"];
    for (let i = 0; i < 6; i++) { P(207 + i * 3, 88, 2, 2, "#1f5a34"); P(207 + i * 3, 88, 1, 1, lures[i]); P(208 + i * 3, 89, 1, 1, lures[(i + 2) % 6]); }
    P(214, 82, 4, 2, "#9aa3ab");
  }
  function clipboard(x, by, st, t) {
    const busy = st === "running" && !reduce;
    P(x - 3, by + 1, 6, 7, "#b8894e"); P(x - 2, by + 2, 4, 5, "#fffaf0"); P(x - 1, by, 2, 2, "#9aa3ab");
    const lines = busy ? Math.floor(t * 2) % 4 : (st === "needs_you" ? 3 : 2);
    for (let i = 0; i < lines; i++) P(x - 2, by + 3 + i, i % 2 ? 3 : 4, 1, "#6a7a8a");
    if (busy) { const px = x - 2 + Math.floor(t * 8) % 4; P(px, by + 3 + lines, 1, 1, "#c8382c"); P(px + 1, by + 2 + lines, 1, 1, "#1b2024"); }
  }
  function castLine(x, by, st, t) {
    const hx = x + 4, hy = by + 3;
    let tip, bob = [306, 36], land = 1;
    const busy = st === "running" && !reduce;
    if (busy) {
      const p = (t / 2.6) % 1;
      if (p < .25) tip = [hx - 7, hy - 13]; else if (p < .38) tip = [hx + 3, hy - 16]; else tip = [hx + 11, hy - 12];
      if (p < .38) { bob = [tip[0], tip[1] + 3]; land = 0; }
      else if (p < .7) { const k = (p - .38) / .32; bob = [tip[0] + (306 - tip[0]) * k, tip[1] + (36 - tip[1]) * k - Math.sin(k * Math.PI) * 26]; land = 0; }
      else land = (p - .7) / .3;
    } else tip = st === "idle" ? [hx + 7, hy - 15] : [hx + 11, hy - 12];
    line(hx, hy, tip[0], tip[1], "#3a2a20"); P(tip[0], tip[1], 1, 1, "#c8382c"); P(hx, hy - 1, 2, 2, "#9aa3ab");
    line(tip[0], tip[1], bob[0], bob[1], "rgba(235,240,245,.75)");
    const by2 = bob[1] + (land >= 1 && !reduce ? Math.round(Math.sin(t * 2.4)) : 0);
    if (land > 0) { const r = Math.round(2 + land * 6); for (let a = 0; a < 16; a++) P(bob[0] + Math.round(Math.cos(a / 16 * 6.283) * r), bob[1] + 2 + Math.round(Math.sin(a / 16 * 6.283) * r * .4), 1, 1, land < 1 ? "rgba(220,240,255,.6)" : "rgba(220,240,255,.35)"); }
    P(bob[0] - 1, by2 - 1, 3, 2, "#d7261e"); P(bob[0] - 1, by2 + 1, 3, 1, "#fffaf0");
  }
  function fishScale(st, t) {
    const busy = st === "running" && !reduce, sw = busy ? Math.round(Math.sin(t * 4) * 1.5) : 0;
    P(115, 158, 4, 6, "#c9ced3"); P(116, 159, 2, 2, "#1b2024"); P(117, 164, 1, 2, "#6c747c");
    const fx = 114 + sw;
    // a largemouth hung by the jaw: mouth up, tail down
    P(fx + 2, 165, 2, 1, "#9aa3ab"); P(fx + 1, 166, 4, 2, "#5f8a3a"); P(fx, 168, 6, 5, "#5f8a3a"); P(fx + 1, 173, 4, 1, "#5f8a3a"); P(fx + 2, 174, 2, 1, "#4a6e2c");
    P(fx, 175, 2, 2, "#4a6e2c"); P(fx + 4, 175, 2, 2, "#4a6e2c"); P(fx + 4, 168, 1, 5, "#d9d2a0"); P(fx + 1, 168, 1, 5, "#2f4a20"); P(fx + 3, 167, 1, 1, "#1b1510"); P(fx - 1, 170, 1, 2, "#4a6e2c");
    const hts = busy ? [3 + Math.floor(t * 2) % 5, 6, 4 + Math.floor(t * 2 + 2) % 4] : [4, 7, 5];
    hts.forEach((hh, i) => P(81 + i * 3, 178 - hh, 2, hh, ["#2f6fb3", "#3f8f4f", "#e8742c"][i]));
  }
  function mailbag(st, t) {
    P(58, 130, 11, 13, "#7a5232"); P(59, 131, 9, 11, "#8f643c"); P(58, 133, 11, 1, "#5e3820");
    const open = Object.values(TICKETS).filter(x => x && (x.status === "waiting" || x.status === "started")).length;
    const n = Math.max(1, Math.min(4, open || 2));
    for (let i = 0; i < n; i++) { P(59 + i * 2, 127 - (i % 2), 4, 4, "#fffaf0"); P(59 + i * 2, 127 - (i % 2), 4, 1, "#c8382c"); }
    if (st === "running" && !reduce) { const p = (t * .8) % 1, ex = 63 - Math.round(p * 8), ey = 126 - Math.round(Math.sin(p * Math.PI) * 10); P(ex, ey, 5, 4, "#fffaf0"); P(ex, ey, 5, 1, "#2f6fb3"); }
  }

  const flash = {};
  let clock = 0, lastDraw = -1;
  function drawDeck(t) {
    clock = t;
    ctx.drawImage(bg, 0, 0);
    // water glints and a lazy fish shadow
    for (let i = 0; i < waterPx.length; i += 3) { const [x, y, ph] = waterPx[i]; const v = reduce ? .6 : Math.sin(t * 1.6 + ph); if (v > .55) P(x, y, v > .85 ? 3 : 2, 1, "#6aa9c6"); }
    const fx = reduce ? 180 : ((t * 6) % 380) - 30; if (!reduce) { P(fx, 216, 9, 3, "#245a73"); P(fx - 3, 215, 3, 5, "#245a73"); }
    // metal flake glitter on the hull side
    const nG = reduce ? 0 : 10;
    for (let i = 0; i < nG; i++) { const p = sidePx[(Math.floor(t * 7) * 131 + i * 977) % sidePx.length]; P(p[0], p[1], 1, 1, "#ffffff"); if (i % 3 === 0) { P(p[0] - 1, p[1], 3, 1, "rgba(255,255,255,.55)"); } }
    const S = {}; ORDER.forEach(id => S[id] = stateOf(id));
    sonarScreen(S.sonar, t); spinnerStation(S.spinner, t); tackleBox(S.jig, t); fishScale(S.scale, t); mailbag(S.anchor, t);
    // crew, back to front
    const drawOrder = ["spinner", "jig", "anchor", "captain", "cast", "sonar", "scale"].sort((a, c) => SPOTS[a].y - SPOTS[c].y);
    const heads = {};
    drawOrder.forEach(id => {
      const s = SPOTS[id], st = id === "captain" ? "ok" : S[id];
      const r = person(id, s.x, s.y, st, t); heads[id] = r;
      if (id === "jig") clipboard(s.x, r.by, st, t);
      if (id === "cast") castLine(s.x, r.by, st, t);
      if (id === "captain") { P(s.x + 4, r.by + 2, 4, 1, "#1b2024"); } // hands on the wheel
    });
    drawOrder.forEach(id => bubbles(id, SPOTS[id].x, heads[id].hy, id === "captain" ? "ok" : S[id], t));
  }

  // name tags (buttons, so they work with touch and keyboard)
  const tags = {};
  ["captain"].concat(ORDER).forEach(id => {
    const s = SPOTS[id];
    const btn = el("button", { type: "button", class: "st-tag" + (id === "captain" ? " captain" : ""), "data-id": id, onclick: () => (id === "captain" ? openOrder(btn) : openCrew(id, btn)) });
    btn.style.left = ((s.x + (s.tagDx || 0)) / W * 100) + "%"; btn.style.top = ((s.y - 22) / H * 100) + "%";
    overlay.append(btn); tags[id] = btn;
  });
  function refreshTags() {
    Object.entries(tags).forEach(([id, btn]) => {
      btn.textContent = nameOf(id);
      if (id === "captain") { btn.title = "Give the crew an order"; return; }
      const st = stateOf(id); btn.dataset.state = st; btn.title = nameOf(id) + " · " + STATES[st];
      btn.setAttribute("aria-label", nameOf(id) + ", " + str(crewOf(id).role) + ", " + STATES[st]);
    });
    lastDraw = -1;
  }
  function hitAt(e) {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    for (const id of Object.keys(SPOTS)) { const s = SPOTS[id]; if (Math.abs(x - s.x) <= 7 && y <= s.y + 3 && y >= s.y - 22) return id; }
    for (const id of Object.keys(SPOTS)) { const bx = SPOTS[id].box; if (x >= bx[0] && x <= bx[2] && y >= bx[1] && y <= bx[3]) return id; }
    return null;
  }
  cv.addEventListener("click", e => { const id = hitAt(e); if (!id) return; if (id === "captain") openOrder(tags.captain); else openCrew(id, tags[id]); });
  cv.addEventListener("mousemove", e => { cv.style.cursor = hitAt(e) ? "pointer" : "default"; });

  let aboard = false, t0 = performance.now();
  function deckLoop(now) {
    if (!aboard) return;
    const t = (now - t0) / 1000, step = reduce ? 0 : Math.floor(t * 12);
    if (step !== lastDraw) { lastDraw = step; drawDeck(reduce ? 0 : t); }
    requestAnimationFrame(deckLoop);
  }
  function startDeck() { aboard = true; lastDraw = -1; requestAnimationFrame(deckLoop); }
  function stopDeck() { aboard = false; }

  /* ================= dialogs ================= */
  const crewDlg = $("st-crew"), crewBody = $("st-crew-body"), crewTitle = $("st-crew-title");
  const orderEl = $("st-order"), orderForm = $("st-order-form"), orderText = $("st-order-text"), orderOut = $("st-order-out"), orderTitle = $("st-order-title");
  let viewingCrew = null, returnFocus = null;
  function closeAll(keepFocus) { crewDlg.hidden = true; orderEl.hidden = true; viewingCrew = null; if (!keepFocus && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true }); returnFocus = null; }
  $("st-crew-close").addEventListener("click", () => closeAll());
  $("st-order-close").addEventListener("click", () => closeAll());

  function openCrew(id, from) {
    closeAll(true); returnFocus = from || null; viewingCrew = id;
    renderCrew(id); crewDlg.hidden = false; sfx(id === "spinner" ? "reel" : "ding");
    setTimeout(() => $("st-crew-close").focus({ preventScroll: true }), 30);
  }
  function renderCrew(id) {
    const c = crewOf(id), st = stateOf(id), name = nameOf(id);
    crewTitle.textContent = name + " · " + (str(c.role) || "Crew");
    const log = arr(c.log).filter(x => x && x.note).slice().sort((a, b2) => str(b2.at).localeCompare(str(a.at))).slice(0, 3);
    const tk = obj(TICKETS[id]);
    crewBody.replaceChildren(
      el("p", { class: "st-role", text: STATION_BLURB[id] || "" }),
      el("dl", { class: "st-dl" },
        el("dt", { text: "Role" }), el("dd", { text: str(c.role) || "–" }),
        el("dt", { text: "Schedule" }), el("dd", { text: str(c.schedule) || "–" }),
        el("dt", { text: "State" }), el("dd", null, el("span", { class: "st-pill " + st, text: STATES[st] })),
        el("dt", { text: "Last run" }), el("dd", { text: when(c.lastRunAt) }),
        el("dt", { text: "Last summary" }), el("dd", { text: str(c.lastSummary) || "No summary yet." }),
        tk.status ? [el("dt", { text: "Ticket" }), el("dd", { text: str(tk.status) + (tk.issue ? " · #" + str(tk.issue) : "") + (tk.at ? " · " + when(tk.at) : "") })] : null),
      log.length ? el("ul", { class: "st-log", style: "margin-top:10px" }, log.map(x => el("li", null, el("time", { text: when(x.at) }), str(x.note)))) : null,
      el("div", { class: "st-row", style: "margin-top:14px" },
        el("a", { class: "st-btn", href: issueUrl("run: " + id, runBody(name)), target: "_blank", rel: "noopener", title: "run: " + id, text: "▶ Run now" }),
        el("button", { class: "st-btn ghost", type: "button", text: "Close", onclick: () => closeAll() })),
      el("p", { class: "st-note", style: "margin-top:8px", text: "Run now opens a prefilled “run: " + id + "” ticket on " + GH_REPO + ". Tap Submit there; Anchor starts " + name + " within 15 minutes (8 AM-11 PM)." }));
  }
  const STATION_BLURB = {
    scale: "Weighs every catch: pulls the numbers and keeps the scorecard chart.",
    sonar: "Watches the fish finder: scouts ideas and sources for the week.",
    jig: "At the tackle-box desk: writes and fact-checks every script.",
    spinner: "At the reel and the edit: renders the finished videos.",
    cast: "Up on the bow: casts each approved video out to TikTok and Instagram.",
    anchor: "At the stern with the mailbag: carries your GitHub tickets and syncs the dashboard.",
  };

  /* ---- Captain's orders: mirrors Head Chef Claude's order card in Agent Ramen ---- */
  function openOrder(from) {
    closeAll(true); returnFocus = from || null;
    orderTitle.textContent = "Order for the Captain";
    orderEl.hidden = false; orderForm.hidden = false; orderOut.hidden = true; orderOut.replaceChildren();
    setTimeout(() => orderText.focus({ preventScroll: true }), 30);
  }
  orderText.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) orderForm.requestSubmit(); });
  const TASKS = { sonar: "Scout ideas with sources", jig: "Write and fact-check the script", spinner: "Render the video", cast: "Post it once approved", scale: "Pull the numbers", anchor: "Sync tickets and the dashboard", captain: "Handle it directly" };
  function localPlan(req) {
    const r = req.toLowerCase(), tasks = [], has = (...w) => w.some(x => r.includes(x));
    if (has("idea", "scout", "find", "research", "topic", "source", "trend", "look up", "compare")) tasks.push({ who: "sonar", task: TASKS.sonar });
    if (has("script", "write", "rewrite", "draft", "hook", "fact", "check", "storyboard", "caption", "notes")) tasks.push({ who: "jig", task: TASKS.jig });
    if (has("render", "video", "edit", "cut", "voice", "music", "clip", "style", "make a")) tasks.push({ who: "spinner", task: TASKS.spinner });
    if (has("post", "publish", "schedule", "tiktok", "instagram", "upload")) tasks.push({ who: "cast", task: TASKS.cast });
    if (has("stats", "numbers", "views", "scorecard", "analy", "how did", "retention", "report", "week")) tasks.push({ who: "scale", task: TASKS.scale });
    if (has("ticket", "sync", "dashboard", "issue", "github")) tasks.push({ who: "anchor", task: TASKS.anchor });
    if (!tasks.length) tasks.push({ who: "captain", task: TASKS.captain });
    const names = [...new Set(tasks.map(t => t.who).filter(w => w !== "captain"))].map(nameOf);
    return { summary: req.length > 60 ? req.slice(0, 57) + "…" : req, tasks, order: "Captain's order: " + req + (/[.!?]$/.test(req) ? "" : ".") + (names.length ? " Use " + names.join(", ") + " where they fit." : "") + " Report back as Done / Needs you / Next." };
  }
  const orderPrompt = o => o.order + "\n\n(Boat order " + o.id + ": as you work, record progress in crew.json tickets[\"" + o.id + "\"] so the deck shows it.)";
  const orderTicket = o => ({
    title: "order: " + o.summary,
    body: orderPrompt(o) + "\n\nCrew:\n" + o.tasks.map(t => "- " + nameOf(t.who) + ": " + t.task).join("\n") + FOOT,
  });
  function renderPlan(o) {
    const tk = orderTicket(o), prompt = orderPrompt(o);
    const pre = el("code", { text: prompt });
    const copy = el("button", { type: "button", class: "st-btn ghost", text: "Copy order" });
    copy.addEventListener("click", () => {
      const sel = () => { const rg = document.createRange(); rg.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); copy.textContent = "Selected, press Copy"; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt).then(() => { copy.textContent = "Copied"; }, sel); else sel();
    });
    orderOut.replaceChildren(
      el("p", { class: "st-sum", text: o.summary || "Order" }),
      el("p", { class: "st-req", text: "“" + o.text + "”" }),
      el("ul", null, o.tasks.map(t => el("li", null, el("b", { text: nameOf(t.who) }), el("span", { text: " " + t.task }), el("span", { class: "st-pill", text: "Queued" })))),
      pre,
      el("div", { class: "st-row" },
        el("a", { class: "st-btn", href: issueUrl(tk.title, tk.body), target: "_blank", rel: "noopener", title: tk.title, text: "Open GitHub ticket" }),
        copy,
        el("button", { type: "button", class: "st-btn ghost", text: "New order", onclick: () => openOrder(returnFocus) })),
      el("p", { class: "st-note", text: "Opens a prefilled issue “" + tk.title + "” on " + GH_REPO + ". Tap Submit there, or paste the order into Claude Code to run it now." }));
    orderForm.hidden = true; orderOut.hidden = false;
  }
  orderForm.addEventListener("submit", e => {
    e.preventDefault();
    const req = orderText.value.trim().slice(0, 1200); if (!req) { orderText.focus(); return; }
    const o = Object.assign({ id: "o" + Date.now().toString(36), text: req.slice(0, 600), createdAt: new Date().toISOString() }, localPlan(req));
    orderText.value = ""; orderTitle.textContent = "Order ticket"; renderPlan(o);
    sfx("bell");
    o.tasks.forEach((t, i) => { flash[t.who] = clock + 4 + i * .6; });
    lastDraw = -1;
  });

  addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!crewDlg.hidden || !orderEl.hidden) { closeAll(); return; }
    if (aboard && !backBtn.hidden && scene.contains(document.activeElement)) backBtn.click();
  });

  /* ================= data wiring ================= */
  function setData(d) {
    d = obj(d); CREW = obj(d.crew); TICKETS = obj(d.tickets); refreshTags();
    if (viewingCrew && !crewDlg.hidden) renderCrew(viewingCrew);
    if (!aboard) drawDeck(0);
  }
  addEventListener("bassboat:data", e => setData(e.detail));
  setData(window.BB_DATA || {});

  /* ================= outside: the 3D bass boat on the lake ================= */
  const outside = $("outside"), fade = $("st-fade"), hint = $("st-hint"), loading = $("st-loading"), backBtn = $("st-back");
  function climbAboardDirect(note) {
    outside.hidden = true; backBtn.hidden = true; startDeck();
    if (note) scene.append(el("div", { class: "st-nogl", text: note }));
  }
  let renderer = null;
  try { if (window.THREE) renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { renderer = null; }
  if (!renderer) { climbAboardDirect(window.THREE ? "3D view needs WebGL; showing the deck." : "3D view didn't load; showing the deck."); return; }
  outsideView(renderer);

  function outsideView(renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    outside.prepend(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "3D bass boat on a lake. Drag to look around; click the boat to climb aboard.");
    const sc = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 500);
    const HOME = { p: new THREE.Vector3(8.4, 3.6, 9.4), t: new THREE.Vector3(0, .75, 0) };
    camera.position.copy(HOME.p);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(HOME.t); controls.enableDamping = true; controls.dampingFactor = .08;
    controls.enablePan = false; controls.enableZoom = false; controls.enableKeys = false;
    controls.minDistance = 8; controls.maxDistance = 20; controls.minPolarAngle = .35; controls.maxPolarAngle = 1.36; // keeps the camera above the water
    controls.rotateSpeed = .7;

    let s3 = 41; const r3 = () => (s3 = (s3 * 16807) % 2147483647) / 2147483647;
    function tex(w, h, draw, rx, ry) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4; return t; }
    const flake = (base, hi, lo) => tex(256, 256, (c, w, h) => {
      c.fillStyle = base; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5200; i++) { const r = r3(); c.fillStyle = r < .35 ? hi : r < .7 ? lo : (r < .78 ? "#ffffff" : base); c.globalAlpha = .35 + r3() * .65; c.fillRect(r3() * w, r3() * h, 1 + (r3() < .2 ? 1 : 0), 1); }
      c.globalAlpha = 1;
    }, 3, 2);
    const redFlake = flake("#c41c34", "#ff6a7a", "#6a0a18"), silverFlake = flake("#b9c0c8", "#ffffff", "#7d8690");
    const carpet = tex(128, 128, (c, w, h) => { c.fillStyle = "#3f4852"; c.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { c.fillStyle = r3() < .5 ? "#4d5864" : "#333b44"; c.fillRect(r3() * w, r3() * h, 1, 1); } }, 4, 2);
    const planks = tex(256, 64, (c, w, h) => { for (let x = 0; x < w; x += 32) { const v = 120 + r3() * 40 | 0; c.fillStyle = `rgb(${v},${v * .72 | 0},${v * .5 | 0})`; c.fillRect(x, 0, 32, h); c.fillStyle = "rgba(30,18,8,.6)"; c.fillRect(x + 30, 0, 2, h); for (let k = 0; k < 6; k++) { c.fillStyle = "rgba(60,36,18,.3)"; c.fillRect(x + r3() * 28, 0, 1, h); } } }, 1, 4);
    const decalTex = tex(512, 96, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = "#f4f1e8"; c.beginPath(); c.moveTo(0, 70); c.quadraticCurveTo(w * .5, 40, w, 20); c.lineTo(w, 30); c.quadraticCurveTo(w * .5, 54, 0, 82); c.fill();
      c.fillStyle = "#ffd45a"; c.beginPath(); c.moveTo(0, 86); c.quadraticCurveTo(w * .5, 60, w, 36); c.lineTo(w, 40); c.quadraticCurveTo(w * .5, 66, 0, 92); c.fill();
      c.font = "italic 900 46px Arial Black, Arial, sans-serif"; c.fillStyle = "#f4f1e8"; c.strokeStyle = "#1b1510"; c.lineWidth = 5; c.textBaseline = "middle";
      c.strokeText("BASS BOAT", 34, 34); c.fillText("BASS BOAT", 34, 34);
    });
    decalTex.wrapS = decalTex.wrapT = THREE.ClampToEdgeWrapping; decalTex.repeat.set(1, 1);
    const glowTex = tex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,240,210,.8)"); g.addColorStop(1, "rgba(255,220,160,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;

    const M = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: .8 }, o));
    function add(mesh, parent, shadow) { if (shadow !== false) { mesh.castShadow = true; mesh.receiveShadow = true; } (parent || sc).add(mesh); return mesh; }
    function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, parent); }
    function cyl(rt, rb, h, mat, x, y, z, parent, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat); m.position.set(x, y, z); return add(m, parent); }

    /* ---- the boat ---- */
    const boat = new THREE.Group(); sc.add(boat);
    const L0 = -3.2, L1 = 3.2;
    const halfW = x => (x <= .8 ? 1.15 : 1.15 * Math.sqrt(Math.max(0, 1 - Math.pow((x - .8) / 2.4, 2))));
    const topY = x => .62 + .08 * Math.pow(Math.max(0, (x - 1) / 2.2), 2);
    const botY = x => -.2 + (x > 1.1 ? .55 * Math.pow((x - 1.1) / 2.1, 2) : 0);
    const NS = 44;
    const ring = x => { const w = halfW(x), t = topY(x), bb = botY(x), ch = bb + .26 + (t - bb) * .12; return [[x, t, -w], [x, ch, -w * .9], [x, bb, 0], [x, ch, w * .9], [x, t, w]]; };
    const rings = []; for (let i = 0; i <= NS; i++) { const k = i / NS, x = L0 + (L1 - L0) * (1 - Math.pow(1 - k, 1.4)); rings.push(ring(x)); }
    function strip(jA, jB) {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= NS; i++) for (let j = jA; j <= jB; j++) { const p = rings[i][j]; pos.push(p[0], p[1], p[2]); uv.push(p[0] / 2.2, p[1] * 2 + j * .3); }
      const cols = jB - jA + 1;
      for (let i = 0; i < NS; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b2 = a + cols; idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    const hullRed = M({ map: redFlake, color: "#ffffff", metalness: .35, roughness: .3, side: THREE.DoubleSide });
    const hullSilver = M({ map: silverFlake, metalness: .5, roughness: .35, side: THREE.DoubleSide });
    add(new THREE.Mesh(strip(0, 1), hullRed), boat); add(new THREE.Mesh(strip(3, 4), hullRed), boat);
    add(new THREE.Mesh(strip(1, 3), hullSilver), boat);
    { // transom
      const r = rings[0], pos = []; [[0, 1, 2], [0, 2, 3], [0, 3, 4]].forEach(tri => tri.forEach(j => pos.push(...r[j])));
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      add(new THREE.Mesh(g, M({ color: "#8f1424", metalness: .4, roughness: .35, side: THREE.DoubleSide })), boat);
    }
    // rub rail along the gunwale
    { const pts = []; for (let i = 0; i <= NS; i++) pts.push(new THREE.Vector3(...rings[i][4])); for (let i = NS - 1; i >= 0; i--) pts.push(new THREE.Vector3(...rings[i][0]));
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false), 160, .045, 6, false), M({ color: "#15191c", roughness: .5 })); add(rail, boat); }
    // decks: main cockpit floor, raised casting deck at the bow, rear deck
    function deckShape(xa, xb, inset) { const s = new THREE.Shape(), n = 24; for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; s[i ? "lineTo" : "moveTo"](x, Math.max(.02, halfW(x) - inset)); } for (let i = n; i >= 0; i--) { const x = xa + (xb - xa) * i / n; s.lineTo(x, -Math.max(.02, halfW(x) - inset)); } return s; }
    function deck(xa, xb, inset, y, depth, mat) { const g = new THREE.ExtrudeGeometry(deckShape(xa, xb, inset), { depth, bevelEnabled: false }); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = y; return add(m, boat); }
    const carpetMat = M({ map: carpet, roughness: 1 }), deckEdge = M({ color: "#d7dbdf", roughness: .5 });
    deck(-3.18, 3.0, .06, .3, .3, carpetMat);
    deck(.95, 3.06, .07, .58, .22, [carpetMat, deckEdge]);
    deck(-3.18, -2.05, .06, .56, .22, [carpetMat, deckEdge]);
    // decal on both sides
    [1, -1].forEach(sd => { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .42), new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: .4, metalness: .2, depthWrite: false }));
      p.position.set(-.9, .4, sd * 1.112); p.rotation.y = sd > 0 ? 0 : Math.PI; p.rotation.x = sd * .25; boat.add(p); });
    // console with windscreen, wheel, gauges, and a fish finder
    const white = M({ color: "#e9ecef", roughness: .45 }), dark = M({ color: "#1d2125", roughness: .5 }), seatMat = M({ color: "#2a2e33", roughness: .7 }), red = M({ color: "#b8202f", roughness: .5 });
    const con = new THREE.Group(); con.position.set(-.35, .6, .55); boat.add(con);
    box(.7, .72, .72, white, 0, .36, 0, con);
    const dash = box(.5, .08, .72, dark, -.05, .76, 0, con); dash.rotation.z = .5;
    const ws = new THREE.Mesh(new THREE.BoxGeometry(.03, .38, .78), new THREE.MeshStandardMaterial({ color: "#9fdcff", transparent: true, opacity: .42, roughness: .05, metalness: .3 })); ws.position.set(.28, .92, 0); ws.rotation.z = .55; con.add(ws);
    const wheelG = new THREE.Group(); wheelG.position.set(-.3, .8, -.12); wheelG.rotation.y = Math.PI / 2; con.add(wheelG);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.14, .022, 8, 20), dark); wheel.rotation.x = .5; add(wheel, wheelG);
    const screenMat = new THREE.MeshBasicMaterial({ color: "#2fc4a0" });
    const scr = box(.02, .13, .22, screenMat, -.12, .82, .16, con); scr.rotation.z = .5;
    box(.04, .52, .52, red, -.36, .36, 0, con);
    // fish finder on the bow deck
    const ff = new THREE.Group(); ff.position.set(2.35, .8, .45); boat.add(ff);
    cyl(.03, .03, .2, dark, 0, .1, 0, ff); box(.06, .2, .3, dark, 0, .28, 0, ff);
    const ffs = new THREE.Mesh(new THREE.PlaneGeometry(.26, .16), screenMat); ffs.position.set(-.035, .28, 0); ffs.rotation.y = -Math.PI / 2; ff.add(ffs);
    // pedestal seats
    function seat(x, z, y, ry) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; boat.add(g);
      cyl(.045, .045, .42, M({ color: "#9aa3ab", metalness: .7, roughness: .3 }), 0, .21, 0, g); cyl(.14, .16, .03, dark, 0, .01, 0, g);
      box(.46, .1, .46, seatMat, 0, .47, 0, g); box(.46, .02, .46, red, 0, .53, 0, g); const back = box(.08, .38, .46, seatMat, -.22, .7, 0, g); back.rotation.z = .12; return g; }
    seat(-1.15, .5, .6); seat(-1.15, -.5, .6); seat(2.1, 0, .8); seat(-2.6, .35, .78);
    // outboard motor at the stern
    const ob = new THREE.Group(); ob.position.set(-3.38, 0, 0); boat.add(ob);
    const obMat = M({ color: "#141618", metalness: .4, roughness: .35 }), obGray = M({ color: "#5f676e", metalness: .6, roughness: .35 });
    box(.18, .32, .3, obGray, .14, .5, 0, ob);
    box(.62, .62, .5, obMat, -.12, 1.0, 0, ob);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.34, 18, 12), obMat); cap.scale.set(1, .42, .78); cap.position.set(-.12, 1.32, 0); add(cap, ob);
    box(.64, .05, .52, red, -.12, .9, 0, ob);
    box(.2, 1.2, .2, obMat, -.02, .1, 0, ob);
    box(.4, .04, .32, obGray, -.02, -.12, 0, ob);
    const gear = cyl(.08, .06, .38, obMat, -.02, -.5, 0, ob); gear.rotation.z = Math.PI / 2;
    const prop = new THREE.Group(); prop.position.set(-.24, -.5, 0); ob.add(prop);
    for (let k = 0; k < 3; k++) { const bl = box(.02, .26, .08, obGray, 0, 0, 0, prop); bl.rotation.x = k * 2.094; bl.position.set(0, Math.cos(k * 2.094) * .12, Math.sin(k * 2.094) * .12); }
    // trolling motor at the bow
    // stowed on the casting deck: shaft along the deck, motor pod hanging just past the bow
    const tm = new THREE.Group(); tm.position.set(2.75, .8, -.28); boat.add(tm);
    box(.36, .07, .24, dark, .2, .035, 0, tm); box(.12, .16, .12, dark, .3, .12, 0, tm);
    const shaft = cyl(.028, .028, 1.7, M({ color: "#9aa3ab", metalness: .7, roughness: .3 }), -.3, .2, 0, tm); shaft.rotation.z = Math.PI / 2;
    box(.2, .14, .18, dark, -1.15, .22, 0, tm); box(.16, .03, .14, M({ color: "#c8382c" }), -1.15, .3, 0, tm);
    const pod = cyl(.075, .075, .38, dark, .62, .2, 0, tm); pod.rotation.z = Math.PI / 2;
    box(.02, .22, .05, obGray, .83, .2, 0, tm);
    // rods in holders at the stern, nav lights
    [[.85, .35], [-.85, -.35]].forEach(([z, tilt]) => { const rod = cyl(.012, .022, 2.1, M({ color: "#222" }), -2.35, 1.6, z, boat, 6); rod.rotation.z = .55; rod.rotation.x = tilt; });
    const navR = new THREE.MeshStandardMaterial({ color: "#ff3b3b", emissive: "#ff2020", emissiveIntensity: .2 }), navG = new THREE.MeshStandardMaterial({ color: "#3bff6b", emissive: "#20ff50", emissiveIntensity: .2 });
    box(.08, .06, .06, navR, 3.05, .76, -.06, boat); box(.08, .06, .06, navG, 3.05, .76, .06, boat);
    cyl(.018, .018, .9, M({ color: "#9aa3ab", metalness: .7 }), -3.0, 1.05, -.55, boat);
    const sternLamp = new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff3c0", emissiveIntensity: .1 });
    add(new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), sternLamp), boat).position.set(-3.0, 1.52, -.55);
    // glitter: tiny twinkling points on the hull sides
    const GN = 320, gpos = new Float32Array(GN * 3), gcol = new Float32Array(GN * 3);
    for (let i = 0; i < GN; i++) { const x = L0 + .15 + r3() * 5.6, sd = r3() < .5 ? -1 : 1, k = r3(), r = ring(x), a = r[sd > 0 ? 4 : 0], c = r[sd > 0 ? 3 : 1];
      gpos.set([x, a[1] + (c[1] - a[1]) * k, (a[2] + (c[2] - a[2]) * k) * 1.012 + sd * .006], i * 3); }
    const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.BufferAttribute(gpos, 3)); gGeo.setAttribute("color", new THREE.BufferAttribute(gcol, 3));
    const glitter = new THREE.Points(gGeo, new THREE.PointsMaterial({ size: .09, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    boat.add(glitter);
    // a generous invisible hit box so the boat is easy to tap on a phone
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2, 2.8), new THREE.MeshBasicMaterial({ visible: false })); hitBox.position.set(-.1, .55, 0); boat.add(hitBox);
    const clickables = [hitBox];

    /* ---- the lake, the shore, the dock, the sky ---- */
    const WS = 96, SEG = reduce ? 40 : 80;
    const waterGeo = new THREE.PlaneGeometry(WS, WS, SEG, SEG); waterGeo.rotateX(-Math.PI / 2);
    const wbase = waterGeo.attributes.position.array.slice();
    const waterMat = M({ color: "#2b6a88", roughness: .12, metalness: .35 });
    const water = new THREE.Mesh(waterGeo, waterMat); water.receiveShadow = true; sc.add(water);
    function waves(t) {
      const a = waterGeo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const x = wbase[i], z = wbase[i + 2]; a[i + 1] = .055 * Math.sin(.62 * x + t * 1.1) + .04 * Math.sin(.8 * z - t * .9 + 1) + .022 * Math.sin(1.7 * (x + z) + t * 1.7); }
      waterGeo.attributes.position.needsUpdate = true; waterGeo.computeVertexNormals();
    }
    waves(0);
    const shoreR = th => 34 + 2.5 * Math.sin(3 * th + .5) + 1.6 * Math.sin(7 * th) + .8 * Math.sin(13 * th + 2);
    function ringShape(rIn, outer) { const s = new THREE.Shape(); s.absarc(0, 0, outer, 0, Math.PI * 2, false); const hole = new THREE.Path(); const n = 160; for (let i = 0; i <= n; i++) { const th = i / n * Math.PI * 2, r = rIn(th); hole[i ? "lineTo" : "moveTo"](Math.cos(th) * r, Math.sin(th) * r); } s.holes.push(hole); return s; }
    { const g = new THREE.ShapeGeometry(ringShape(th => shoreR(th) - 1.8, 46), 48); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, M({ color: "#c9b48a", roughness: 1 })); m.position.y = .09; m.receiveShadow = true; sc.add(m); }
    { const g = new THREE.ShapeGeometry(ringShape(th => shoreR(th), 260), 64); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, M({ color: "#4a7a3a", roughness: 1 })); m.position.y = .2; m.receiveShadow = true; sc.add(m); }
    // trees, instanced
    const TN = 190, trunkG = new THREE.CylinderGeometry(.12, .18, 1.2, 6), coneG = new THREE.ConeGeometry(1, 2.2, 7);
    const trunks = new THREE.InstancedMesh(trunkG, M({ color: "#5a3a22" }), TN), cones1 = new THREE.InstancedMesh(coneG, M({ color: "#ffffff", roughness: .9 }), TN), cones2 = new THREE.InstancedMesh(coneG, M({ color: "#ffffff", roughness: .9 }), TN);
    const dm = new THREE.Object3D(), tc = new THREE.Color(), dockTh = -2.2;
    for (let i = 0; i < TN; i++) {
      let th = r3() * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(th - dockTh), Math.cos(th - dockTh))) < .12) th += .25;
      const r = shoreR(th) + 2.2 + Math.pow(r3(), 1.6) * 34, s = .8 + r3() * 1.1, x = Math.cos(th) * r, z = Math.sin(th) * r;
      dm.position.set(x, .2 + .6 * s, z); dm.scale.set(s, s, s); dm.rotation.set(0, r3() * 6, 0); dm.updateMatrix(); trunks.setMatrixAt(i, dm.matrix);
      dm.position.set(x, .2 + 1.9 * s, z); dm.scale.set(s * 1.25, s, s * 1.25); dm.updateMatrix(); cones1.setMatrixAt(i, dm.matrix);
      dm.position.set(x, .2 + 2.9 * s, z); dm.scale.set(s * .85, s * .8, s * .85); dm.updateMatrix(); cones2.setMatrixAt(i, dm.matrix);
      tc.setHSL(.27 + r3() * .08, .45 + r3() * .2, .16 + r3() * .1); cones1.setColorAt(i, tc); tc.offsetHSL(0, 0, .04); cones2.setColorAt(i, tc);
    }
    [trunks, cones1, cones2].forEach(m => { m.castShadow = false; m.receiveShadow = false; sc.add(m); });
    // far hills
    const hillMat = M({ color: "#2f5a3a", roughness: 1 });
    for (let i = 0; i < 9; i++) { const th = i / 9 * Math.PI * 2 + r3() * .4, r = 95 + r3() * 40, h = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), hillMat); h.scale.set(28 + r3() * 22, 8 + r3() * 10, 22 + r3() * 10); h.position.set(Math.cos(th) * r, -1, Math.sin(th) * r); sc.add(h); }
    // reeds and lily pads near the shore
    const RN0 = 140, reeds = new THREE.InstancedMesh(new THREE.CylinderGeometry(.015, .03, 1.3, 4), M({ color: "#7a8f3a" }), RN0);
    for (let i = 0; i < RN0; i++) { const th = r3() * Math.PI * 2, r = shoreR(th) - 2.2 + r3() * 2.4; dm.position.set(Math.cos(th) * r, .45, Math.sin(th) * r); dm.scale.set(1, .6 + r3() * .8, 1); dm.rotation.set((r3() - .5) * .25, 0, (r3() - .5) * .25); dm.updateMatrix(); reeds.setMatrixAt(i, dm.matrix); }
    sc.add(reeds);
    const padMat = M({ color: "#3f7a3a", roughness: .7 });
    for (let i = 0; i < 26; i++) { const th = r3() * Math.PI * 2, r = shoreR(th) - 3 - r3() * 3, p = new THREE.Mesh(new THREE.CylinderGeometry(.3 + r3() * .25, .3, .02, 10, 1, false, 0, Math.PI * 1.8), padMat); p.position.set(Math.cos(th) * r, .07, Math.sin(th) * r); p.rotation.y = r3() * 6; sc.add(p); }
    // the dock
    const dock = new THREE.Group(); const dR = shoreR(dockTh); dock.position.set(Math.cos(dockTh) * (dR + 1.5), 0, Math.sin(dockTh) * (dR + 1.5)); dock.rotation.y = Math.atan2(-Math.cos(dockTh), -Math.sin(dockTh)); sc.add(dock);
    // local +z points toward the lake
    const plankMat = M({ map: planks, roughness: .95 }), pileMat = M({ color: "#4a3420", roughness: 1 });
    box(1.9, .12, 11, plankMat, 0, .55, 5.5, dock);
    for (let z = 0; z <= 11; z += 2.2) [-1, 1].forEach(sd => cyl(.11, .11, 1.8, pileMat, sd * .98, .1, z, dock, 8));
    box(4.2, .12, 1.8, plankMat, 0, .55, 11.6, dock);
    [-2, 2].forEach(sx => cyl(.11, .11, 1.8, pileMat, sx, .1, 12.3, dock, 8));
    cyl(.05, .05, 1.6, pileMat, 1.7, 1.4, 12.2, dock, 6);
    const dockLampMat = new THREE.MeshStandardMaterial({ color: "#fff1c8", emissive: "#ffcc70", emissiveIntensity: .1 });
    add(new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), dockLampMat), dock).position.set(1.7, 2.25, 12.2);
    const dockGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#ffc670", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); dockGlow.scale.set(2.4, 2.4, 1); dockGlow.position.set(1.7, 2.25, 12.2); dock.add(dockGlow);
    const ringBuoy = new THREE.Mesh(new THREE.TorusGeometry(.32, .08, 8, 18), M({ color: "#e8742c" })); ringBuoy.position.set(-.98, 1.0, 9); ringBuoy.rotation.y = Math.PI / 2; dock.add(ringBuoy);
    // a red-and-white marker buoy out on the water
    const buoy = new THREE.Group(); buoy.position.set(-9, 0, 5); sc.add(buoy);
    cyl(.22, .3, .6, M({ color: "#f4f1e8" }), 0, .2, 0, buoy); cyl(.16, .22, .3, M({ color: "#c8382c" }), 0, .62, 0, buoy);

    // sky dome, sun, stars
    const skyCanvas = document.createElement("canvas"); skyCanvas.width = 4; skyCanvas.height = 256;
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sc.add(sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#fff6dc", fog: false, depthWrite: false, transparent: true })); sun.scale.set(44, 44, 1); sc.add(sun);
    const starGeo = new THREE.BufferGeometry(), sp = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) { const th = r3() * Math.PI * 2, ph = .12 + r3() * 1.3, r = 280; sp.set([Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r], i * 3); }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#fff", size: 1.2, sizeAttenuation: false, fog: false, transparent: true, opacity: .8 })); sc.add(stars);
    // lights
    const hemi = new THREE.HemisphereLight("#dbe9ff", "#4a5a3a", .75); sc.add(hemi);
    const key = new THREE.DirectionalLight("#fff2dc", 1.1); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 60 }); key.shadow.bias = -.0015;
    key.target = boat; sc.add(key);
    // rain
    const RNn = 800, rainGeo = new THREE.BufferGeometry(), rp = new Float32Array(RNn * 6);
    for (let i = 0; i < RNn; i++) { const x = -18 + r3() * 36, y = r3() * 16, z = -18 + r3() * 36; rp.set([x, y, z, x - .05, y - .6, z + .03], i * 6); }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#c8d4e6", transparent: true, opacity: .5 })); rainLines.visible = false; rainLines.frustumCulled = false; sc.add(rainLines);

    const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
    function paintSky(stops) { const c = skyCanvas.getContext("2d"), g = c.createLinearGradient(0, 0, 0, 256); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true; }
    const dayBtn = $("st-day"), fogBtn = $("st-fog"), rainBtn = $("st-rain");
    function applySky() {
      const { day, fog, rain } = weather;
      const grey = rain || fog;
      if (day) paintSky(grey ? [[0, "#7f8b98"], [.45, "#aab4bd"], [.5, "#c3cbd1"], [1, "#9aa5ae"]] : [[0, "#2f6fc0"], [.38, "#7fb4e6"], [.5, "#d8ecf7"], [1, "#9fc4d8"]]);
      else paintSky(grey ? [[0, "#2a2d42"], [.42, "#5a5368"], [.5, "#8a6f72"], [1, "#3a3a4a"]] : [[0, "#1d2350"], [.3, "#5a3f7a"], [.44, "#d0607a"], [.5, "#f6a25a"], [1, "#3a2a40"]]);
      const horizon = day ? (grey ? "#bcc5cc" : "#cfe4f0") : (grey ? "#77646c" : "#e08a68");
      const sunDir = day ? new THREE.Vector3(.35, .78, -.52) : new THREE.Vector3(-.42, .07, -.9);
      sunDir.normalize(); sun.position.copy(sunDir).multiplyScalar(240); sun.material.color.set(day ? "#fff6dc" : "#ffb070"); sun.material.opacity = grey ? .25 : 1; sun.scale.setScalar(day ? 40 : 60);
      key.position.copy(sunDir).multiplyScalar(30); key.color.set(day ? "#fff2dc" : "#ffb07a"); key.intensity = (day ? 1.15 : .95) * (grey ? .55 : 1);
      hemi.color.set(day ? "#dbe9ff" : "#c0a8d8"); hemi.groundColor.set(day ? "#4a5a3a" : "#5a4048"); hemi.intensity = day ? .78 : .85;
      waterMat.color.set(day ? (grey ? "#3e6070" : "#2b6a88") : (grey ? "#34404c" : "#34476a"));
      stars.visible = !day && !grey;
      [navR, navG].forEach(m => m.emissiveIntensity = day ? .2 : 1.4); sternLamp.emissiveIntensity = day ? .1 : 1.6; dockLampMat.emissiveIntensity = day ? .1 : 1.4; dockGlow.material.opacity = day ? 0 : .9;
      screenMat.color.set(day ? "#2fc4a0" : "#59ffd0");
      sc.fog = fog ? new THREE.Fog(horizon, 6, 48) : rain ? new THREE.Fog(horizon, 14, 90) : new THREE.Fog(horizon, 70, 260);
      sc.background = new THREE.Color(horizon); outside.style.background = horizon;
      rainLines.visible = rain;
      // reflections for the metal-flake hull and the water
      try { const env = new THREE.Scene(); env.add(new THREE.Mesh(sky.geometry, sky.material)); if (!grey) env.add(sun.clone()); const nrt = pmrem.fromScene(env, .02); if (envRT) envRT.dispose(); envRT = nrt; sc.environment = envRT.texture; } catch (e) { /* no reflections */ }
      dayBtn.setAttribute("aria-pressed", String(day)); dayBtn.textContent = day ? "☀ Day" : "☾ Dusk";
      fogBtn.setAttribute("aria-pressed", String(fog)); rainBtn.setAttribute("aria-pressed", String(rain));
      mix(); dirty = true;
    }
    dayBtn.addEventListener("click", () => { weather.day = !weather.day; applySky(); });
    fogBtn.addEventListener("click", () => { weather.fog = !weather.fog; applySky(); });
    rainBtn.addEventListener("click", () => { weather.rain = !weather.rain; applySky(); });
    let dirty = true;
    const qs = new URLSearchParams(location.search);
    if (qs.get("sky") === "dusk") weather.day = false; // handy for previews: ?sky=dusk
    applySky();

    // hover + click (or tap) the boat to climb aboard
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    let hover = false, zoom = null, downAt = null;
    const pick = e => { const r = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, camera); return ray.intersectObjects(clickables, false).length > 0; };
    renderer.domElement.addEventListener("pointermove", e => { if (e.pointerType === "mouse") { hover = pick(e); renderer.domElement.style.cursor = hover ? "pointer" : "grab"; } });
    renderer.domElement.addEventListener("pointerdown", e => { downAt = [e.clientX, e.clientY]; dirty = true; });
    renderer.domElement.addEventListener("pointerup", e => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8 && pick(e)) goAboard(); downAt = null; });
    controls.addEventListener("change", () => { dirty = true; });
    hint.addEventListener("click", () => goAboard());

    function goAboard() {
      if (aboard || zoom) return;
      zoom = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(1.6, 3.4, 2.6), t1: new THREE.Vector3(-.2, .7, 0), k: reduce ? 1 : 0, start: performance.now() };
      sfx("plop");
    }
    function finishAboard() {
      fade.style.opacity = 1;
      setTimeout(() => { outside.hidden = true; startDeck(); fade.style.opacity = 0; backBtn.focus({ preventScroll: true }); }, reduce ? 0 : 380);
    }
    backBtn.addEventListener("click", () => {
      closeAll(true); fade.style.opacity = 1;
      setTimeout(() => { stopDeck(); outside.hidden = false; zoom = null; camera.position.copy(HOME.p); controls.target.copy(HOME.t); controls.update(); fade.style.opacity = 0; dirty = true; kick(); hint.focus({ preventScroll: true }); }, reduce ? 0 : 380);
    });
    window.bassBoatView = () => (aboard ? "aboard" : "outside");
    window.bassBoatAboard = goAboard;
    window.bassBoatPoint = () => { const p = new THREE.Vector3(0, .5, 0).applyMatrix4(boat.matrixWorld).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; };

    function resize() { const w = outside.clientWidth || 1, h = outside.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? Math.min(58, 32 / Math.pow(w / h, .7)) : 32; camera.updateProjectionMatrix(); dirty = true; }
    new ResizeObserver(resize).observe(outside); resize();
    let visible = true;
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(scene);

    const v = new THREE.Vector3(), clock3 = new THREE.Clock();
    let running = false, lastNow = 0;
    function kick() { if (!running) { running = true; clock3.getDelta(); requestAnimationFrame(loop); } }
    function loop(now) {
      if (aboard || !visible || document.hidden) { running = false; return; }
      if (now && now - lastNow < 15) { requestAnimationFrame(loop); return; } lastNow = now || 0;
      const dt = Math.min(.05, clock3.getDelta()), t = clock3.elapsedTime;
      if (!reduce) {
        waves(t);
        boat.position.y = .035 * Math.sin(t * 1.3); boat.rotation.z = .016 * Math.sin(t * 1.05); boat.rotation.x = .012 * Math.sin(t * .85 + 1);
        buoy.position.y = .06 * Math.sin(t * 1.6 + 2); buoy.rotation.z = .08 * Math.sin(t * 1.2);
        const c = gGeo.attributes.color.array; for (let i = 0; i < GN; i++) { const on = Math.random() < .045 ? .6 + Math.random() * .4 : c[i * 3] * .82; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = on; } gGeo.attributes.color.needsUpdate = true;
        if (weather.rain) { const a = rainGeo.attributes.position.array; for (let i = 0; i < RNn; i++) { const k = i * 6; a[k + 1] -= dt * 20; a[k + 4] -= dt * 20; if (a[k + 4] < 0) { a[k + 1] += 16; a[k + 4] += 16; } } rainGeo.attributes.position.needsUpdate = true; }
      } else if (dirty) {
        const c = gGeo.attributes.color.array; for (let i = 0; i < GN; i += 5) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = .8; gGeo.attributes.color.needsUpdate = true;
      }
      if (zoom) {
        zoom.k = reduce ? 1 : Math.min(1, (performance.now() - zoom.start) / 1100); const e = zoom.k < .5 ? 4 * zoom.k ** 3 : 1 - (-2 * zoom.k + 2) ** 3 / 2;
        camera.position.lerpVectors(zoom.p0, zoom.p1, e); controls.target.lerpVectors(zoom.t0, zoom.t1, e);
        if (zoom.k >= .8 && !zoom.faded) { zoom.faded = true; finishAboard(); }
        if (zoom.k >= 1) zoom = null;
        dirty = true;
      }
      controls.update();
      v.set(0, 2.1, 0).applyMatrix4(boat.matrixWorld).project(camera);
      hint.style.left = (v.x + 1) / 2 * outside.clientWidth + "px"; hint.style.top = (1 - v.y) / 2 * outside.clientHeight + "px";
      hint.hidden = !!zoom || v.z > 1;
      hint.style.filter = hover ? "brightness(1.08)" : "";
      if (!reduce || dirty) renderer.render(sc, camera);
      dirty = false;
      if (!loop.drawn) { loop.drawn = true; loading.style.opacity = 0; setTimeout(() => { loading.hidden = true; }, reduce ? 0 : 450); }
      requestAnimationFrame(loop);
    }
    kick();
  }
})();
