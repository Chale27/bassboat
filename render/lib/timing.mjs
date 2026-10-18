// Timing helpers: storyboard -> shot times, caption cards, and ElevenLabs
// character alignment -> word timings. Pure functions (unit-tested).

export function words(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

export function norm(w) {
  return String(w).toLowerCase().replace(/[^a-z0-9']/g, "").replace(/'/g, "");
}

// ElevenLabs /with-timestamps returns
//   alignment: { characters: [...], character_start_times_seconds: [...], character_end_times_seconds: [...] }
// Convert to [{text, start, end}] words (split on whitespace).
export function alignmentToWords(alignment) {
  if (!alignment) return [];
  const chars = alignment.characters || alignment.chars || [];
  const st = alignment.character_start_times_seconds || alignment.charStartTimesMs?.map((v) => v / 1000) || [];
  const en = alignment.character_end_times_seconds || alignment.charDurationsMs?.map((d, i) => st[i] + d / 1000) || [];
  const out = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      if (cur) { out.push(cur); cur = null; }
      continue;
    }
    if (!cur) cur = { text: "", start: st[i], end: en[i] };
    cur.text += ch;
    cur.end = en[i];
  }
  if (cur) out.push(cur);
  return out.map((w) => ({ text: w.text, start: round3(w.start), end: round3(w.end) }));
}

export function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Split a caption line into cards of 2-4 words (a 1-word line stays 1 card).
export function chunkLine(text) {
  const ws = words(text);
  if (ws.length <= 4) return [ws];
  const n = Math.ceil(ws.length / 4);
  const base = Math.floor(ws.length / n);
  let extra = ws.length % n;
  const out = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const size = base + (extra-- > 0 ? 1 : 0);
    out.push(ws.slice(i, i + size));
    i += size;
  }
  return out;
}

// Map timing words onto the storyboard's line words in order. Returns an
// array (same length as lineWords) of {start,end} or null when unmatched.
export function matchWords(lineWords, timingWords) {
  const res = new Array(lineWords.length).fill(null);
  let j = 0;
  for (let i = 0; i < lineWords.length; i++) {
    const target = norm(lineWords[i]);
    // look ahead a few timing words for a match (tolerate punctuation/number drift)
    let found = -1;
    for (let k = j; k < Math.min(timingWords.length, j + 4); k++) {
      if (norm(timingWords[k].text) === target) { found = k; break; }
    }
    if (found === -1 && j < timingWords.length && lineWords.length === timingWords.length) found = j;
    if (found !== -1) {
      res[i] = { start: timingWords[found].start, end: timingWords[found].end };
      j = found + 1;
    }
  }
  // fill gaps by interpolation between known neighbours
  for (let i = 0; i < res.length; i++) {
    if (res[i]) continue;
    let a = i - 1; while (a >= 0 && !res[a]) a--;
    let b = i + 1; while (b < res.length && !res[b]) b++;
    const t0 = a >= 0 ? res[a].end : 0;
    const t1 = b < res.length ? res[b].start : (timingWords.length ? timingWords[timingWords.length - 1].end : t0 + 0.4);
    const span = b - a - 1;
    const k = i - a;
    const s = t0 + ((t1 - t0) * (k - 1)) / span;
    const e = t0 + ((t1 - t0) * k) / span;
    res[i] = { start: round3(s), end: round3(e) };
  }
  return res;
}

// Main timing plan.
//  sb: storyboard; timingWords: [{text,start,end}] | null; voiceDuration: seconds | null
// Returns { total, shots: [{n, start, end}], cards: [{text, start, end, shot}] }
export function planTiming(sb, timingWords = null, voiceDuration = null) {
  const shots = sb.shots.map((s) => ({ n: s.n, est: Math.max(0.5, Number(s.est_seconds) || 2.5) }));
  const lines = (sb.lines && sb.lines.length ? sb.lines : [{ text: sb.script || "", shot: shots[0].n }]).map((l) => ({
    text: l.text,
    shot: shots.some((s) => s.n === l.shot) ? l.shot : shots[0].n,
  }));
  const allWords = [];
  lines.forEach((l, li) => words(l.text).forEach((w) => allWords.push({ w, li })));

  let total, shotTimes, wordTimes;
  if (timingWords && timingWords.length) {
    wordTimes = matchWords(allWords.map((x) => x.w), timingWords);
    const lastEnd = wordTimes.length ? wordTimes[wordTimes.length - 1].end : 0;
    total = round3(lastEnd + 0.35);
    if (voiceDuration) total = round3(Math.min(total, Math.max(voiceDuration, lastEnd + 0.05)));
    // shot start = first word of its first line
    const firstWordOfLine = [];
    let k = 0;
    lines.forEach((l, li) => { firstWordOfLine[li] = k; k += words(l.text).length; });
    const starts = shots.map((s) => {
      const li = lines.findIndex((l) => l.shot === s.n && words(l.text).length);
      return li === -1 ? null : wordTimes[firstWordOfLine[li]]?.start ?? null;
    });
    starts[0] = 0;
    shotTimes = fillShotStarts(shots, starts, total);
  } else {
    const estTotal = shots.reduce((a, s) => a + s.est, 0);
    total = round3(voiceDuration || estTotal);
    const scale = total / estTotal;
    let t = 0;
    shotTimes = shots.map((s) => { const st = t; t += s.est * scale; return { n: s.n, start: round3(st), end: round3(t) }; });
    shotTimes[shotTimes.length - 1].end = total;
    // spread words evenly: each shot's lines share its time by word count
    wordTimes = new Array(allWords.length);
    let wi = 0;
    lines.forEach((l, li) => { l._first = wi; wi += words(l.text).length; });
    for (const st of shotTimes) {
      const ls = lines.filter((l) => l.shot === st.n);
      const nw = ls.reduce((a, l) => a + words(l.text).length, 0);
      if (!nw) continue;
      const per = (st.end - st.start) / nw;
      let i = 0;
      for (const l of ls) {
        for (let q = 0; q < words(l.text).length; q++, i++) {
          wordTimes[l._first + q] = { start: round3(st.start + per * i), end: round3(st.start + per * (i + 1)) };
        }
      }
    }
  }

  // caption cards
  const cards = [];
  let wi = 0;
  lines.forEach((l) => {
    for (const chunk of chunkLine(l.text)) {
      const a = wordTimes[wi], b = wordTimes[wi + chunk.length - 1];
      cards.push({ text: chunk.join(" "), start: a ? a.start : 0, lastEnd: b ? b.end : 0, shot: l.shot });
      wi += chunk.length;
    }
  });
  cards.sort((x, y) => x.start - y.start);
  if (cards.length) cards[0].start = 0;
  for (let i = 0; i < cards.length; i++) {
    const next = cards[i + 1];
    let end = next ? next.start : total;
    // don't hold a card through a long pause
    if (timingWords && next && end - cards[i].lastEnd > 0.7) end = cards[i].lastEnd + 0.35;
    cards[i].end = round3(Math.min(end, total));
    if (cards[i].end - cards[i].start < 0.12) cards[i].end = round3(Math.min(total, cards[i].start + 0.12));
    delete cards[i].lastEnd;
  }
  return { total, shots: shotTimes, cards: cards.filter((c) => c.end > c.start) };
}

function fillShotStarts(shots, starts, total) {
  const n = shots.length;
  const est = shots.map((s) => s.est);
  // enforce monotonic; interpolate nulls by est proportion between known anchors
  const known = starts.map((v, i) => (v == null ? null : v));
  known[0] = 0;
  for (let i = 1; i < n; i++) {
    if (known[i] == null) continue;
    let p = i - 1; while (known[p] == null) p--;
    if (known[i] <= known[p]) known[i] = null; // out of order -> treat as unknown
  }
  for (let i = 1; i < n; i++) {
    if (known[i] != null) continue;
    let a = i - 1; while (known[a] == null) a--;
    let b = i + 1; while (b < n && known[b] == null) b++;
    const tb = b < n ? known[b] : total;
    const sumEst = est.slice(a, b).reduce((x, y) => x + y, 0);
    const before = est.slice(a, i).reduce((x, y) => x + y, 0);
    known[i] = known[a] + ((tb - known[a]) * before) / sumEst;
  }
  return shots.map((s, i) => ({ n: s.n, start: round3(known[i]), end: round3(i + 1 < n ? known[i + 1] : total) }));
}
