import { createRng } from "./hash.js";

// すべてのスタイルは 100x100 の座標系で描画する
const SIZE = 100;
const f = (n) => +n.toFixed(2);
const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: s * 100, l: l * 100 };
}

/** 乱数から n 色のパレットを作る。customColor があれば基準色に使う */
function makePalette(r, n, customColor) {
  const hue = r() * 360, sat = 55 + r() * 25, lit = 45 + r() * 12, step = 35 + r() * 55;
  const base = customColor ? hexToHsl(customColor) : { h: hue, s: sat, l: lit };
  return Array.from({ length: n }, (_, i) =>
    hsl(base.h + i * step, base.s, Math.min(80, Math.max(25, base.l + (i % 2 ? 8 : -4) * (i ? 1 : 0)))));
}

/** 左半分(ceil(n/2) 列)を乱数で決め、左右対称なグリッドを返す */
function mirroredGrid(r, cols, rows, pick) {
  const half = Math.ceil(cols / 2);
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < half; x++) row[x] = pick();
    for (let x = half; x < cols; x++) row[x] = row[cols - 1 - x];
    grid.push(row);
  }
  return grid;
}

// ---------- 各スタイル: draw(r, colors) -> SVG 断片 ----------

function github(r, [fg]) {
  const n = 5, cell = 16, off = 10;
  const grid = mirroredGrid(r, n, n, () => r() < 0.5);
  let out = `<g fill="${fg}" shape-rendering="crispEdges">`;
  grid.forEach((row, y) => row.forEach((on, x) => {
    if (on) out += `<rect x="${off + x * cell}" y="${off + y * cell}" width="${cell}" height="${cell}"/>`;
  }));
  return out + "</g>";
}

function pixel(r, colors) {
  const n = 8, cell = 11, off = 6;
  const grid = mirroredGrid(r, n, n, () => {
    const v = r();
    return v < 0.4 ? -1 : v < 0.75 ? 0 : v < 0.93 ? 1 : 2;
  });
  let out = `<g shape-rendering="crispEdges">`;
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (c >= 0) out += `<rect x="${off + x * cell}" y="${off + y * cell}" width="${cell}" height="${cell}" fill="${colors[c]}"/>`;
  }));
  return out + "</g>";
}

function rings(r, colors) {
  const count = 4 + Math.floor(r() * 2);
  const width = 40 / count;
  let out = "";
  for (let i = 0; i < count; i++) {
    const radius = 46 - i * width - width / 2 + 1;
    const circ = 2 * Math.PI * radius;
    const segs = 1 + Math.floor(r() * 4);
    const fill = 0.45 + r() * 0.5;
    const rot = Math.floor(r() * 360);
    const color = colors[Math.floor(r() * colors.length)];
    const dash = (circ / segs) * fill, gap = circ / segs - dash;
    out += `<circle cx="50" cy="50" r="${f(radius)}" fill="none" stroke="${color}" stroke-width="${f(width - 1.5)}" stroke-dasharray="${f(dash)} ${f(gap)}" transform="rotate(${rot} 50 50)"/>`;
  }
  out += `<circle cx="50" cy="50" r="${f(4 + r() * 4)}" fill="${colors[0]}"/>`;
  return out;
}

const TILES = [
  (c) => `<rect width="25" height="25" fill="${c}"/>`,
  (c) => `<circle cx="12.5" cy="12.5" r="12.5" fill="${c}"/>`,
  (c) => `<path d="M0 0H25A25 25 0 0 1 0 25Z" fill="${c}"/>`,
  (c) => `<path d="M0 12.5H25A12.5 12.5 0 0 1 0 12.5Z" fill="${c}"/>`,
  (c) => `<path d="M0 0H25L0 25Z" fill="${c}"/>`,
  (c) => `<circle cx="12.5" cy="12.5" r="6" fill="${c}"/>`,
];

function blocks(r, colors) {
  let out = "";
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const rot = Math.floor(r() * 4) * 90;
      const tile = TILES[Math.floor(r() * TILES.length)];
      const fg = colors[Math.floor(r() * 3)];
      const hasBg = r() < 0.4;
      const bgc = colors[3];
      out += `<g transform="translate(${x * 25} ${y * 25}) rotate(${rot} 12.5 12.5)">`;
      if (hasBg) out += `<rect width="25" height="25" fill="${bgc}"/>`;
      out += tile(fg) + "</g>";
    }
  }
  return out;
}

function triangles(r, colors) {
  const n = 6, cell = SIZE / n;
  const corners = (x, y) => [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]];
  const half = n / 2;
  let left = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < half; x++) {
      const k = Math.floor(r() * 4);
      const c = corners(x * cell, y * cell);
      const poly = (idx, color) =>
        `<polygon points="${idx.map((i) => c[i].map(f).join(",")).join(" ")}" fill="${color}"/>`;
      const a = colors[Math.floor(r() * colors.length)];
      const b = r() < 0.3 ? null : colors[Math.floor(r() * colors.length)];
      left += poly([(k + 1) % 4, (k + 2) % 4, (k + 3) % 4], a);
      if (b) left += poly([k, (k + 1) % 4, (k + 3) % 4], b);
    }
  }
  return `<g>${left}</g><g transform="translate(${SIZE} 0) scale(-1 1)">${left}</g>`;
}

function blobs(r, colors, uid) {
  const angle = Math.floor(r() * 360);
  let out = `<defs><linearGradient id="${uid}-g" gradientTransform="rotate(${angle} .5 .5)">` +
    `<stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>` +
    `<rect width="100" height="100" fill="url(#${uid}-g)"/>`;
  const count = 3 + Math.floor(r() * 3);
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${f(15 + r() * 70)}" cy="${f(15 + r() * 70)}" r="${f(12 + r() * 26)}" ` +
      `fill="${colors[2 + (i % 2)]}" fill-opacity="${f(0.45 + r() * 0.35)}"/>`;
  }
  return out;
}

// インベーダー: 11x11 の左右対称グリッド。上=触角(行0-1) / 中=体と目(行2-8) / 下=足(行9-10)
function invader(r, [fg]) {
  const N = 11, C = 5, cell = 8, off = 6;
  const g = Array.from({ length: N }, () => Array(N).fill(false));
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const put = (x, y) => { g[y][x] = g[y][N - 1 - x] = true; };

  // 体: 行ごとに左右の削り幅(inset)を揺らして輪郭を作る
  const base = [2, 1, 0, 0, 0, 1, 2];
  base.forEach((b, i) => {
    const inset = Math.min(3, Math.max(0, b + (r() < 0.3 ? 1 : 0) - (r() < 0.3 ? 1 : 0)));
    for (let x = inset; x <= C; x++) put(x, 2 + i);
  });

  // 目: 1個=3x3の中央に点 / 2,3個=1〜4ブロック。他の目の周囲に入らないものだけ採用
  const SIDE = [[1, 1], [2, 1], [1, 2], [2, 2]];
  const touches = (a, b) =>
    b.x < a.x + a.w + 1 && b.x + b.w > a.x - 1 && b.y < a.y + a.h + 1 && b.y + b.h > a.y - 1;
  let eyes = [{ x: 4, y: ri(3, 5), w: 3, h: 3, big: true }];
  const n = ri(1, 3);
  for (let tries = 0; n > 1 && tries < 30; tries++) {
    const [w, h] = SIDE[ri(0, 3)];
    const x = ri(1, 4), y = ri(3, 8 - h);
    const list = [{ x, y, w, h }, { x: N - x - w, y, w, h }];
    if (n === 3) {
      const ch = ri(1, 2);
      list.push({ x: C, y: ri(3, 8 - ch), w: 1, h: ch });
    }
    const ok = list.every((a) => list.every((b) => a === b || !touches(a, b)));
    if (ok) { eyes = list; break; }
  }
  // 目の周囲 1 マスを必ず塗り、目のマスだけ抜く(大きい目は中央に点を残す)
  for (const e of eyes) {
    for (let y = e.y - 1; y <= e.y + e.h; y++) for (let x = e.x - 1; x <= e.x + e.w; x++) g[y][x] = true;
  }
  for (const e of eyes) {
    for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) g[y][x] = false;
    if (e.big) g[e.y + 1][C] = true;
  }

  // 触角: 1〜3本(中央 / 左右ペア / 両方)。2段のときは先端を外側へ曲げることがある
  const count = ri(1, 3);
  if (count !== 2) {
    for (let y = 2 - ri(1, 2); y < 2; y++) put(C, y);
  }
  if (count >= 2) {
    const first = g[2].findIndex(Boolean);
    const c = ri(Math.max(first, 1), count === 3 ? 3 : 4);
    const tall = r() < 0.5, bend = r() < 0.5;
    put(c, 1);
    if (tall) put(bend ? c - 1 : c, 0);
  }

  // 足: 体の下端から 2〜3 本。足先は真下 / 外側へずらす / 両方 からランダム
  const cand = [];
  for (let x = 0; x <= C; x++) if (g[8][x]) cand.push(x);
  for (let i = cand.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  const legs = [], want = ri(2, 3);
  for (const x of cand) {
    if (legs.length < want && legs.every((o) => Math.abs(o - x) > 1)) legs.push(x);
  }
  for (const x of legs) {
    put(x, 9);
    const t = x === C || x === 0 ? 0 : ri(0, 2);
    if (t !== 1) put(x, 10);
    if (t !== 0) put(x - 1, 10);
  }

  let out = `<g fill="${fg}" shape-rendering="crispEdges">`;
  g.forEach((row, y) => row.forEach((on, x) => {
    if (on) out += `<rect x="${off + x * cell}" y="${off + y * cell}" width="${cell}" height="${cell}"/>`;
  }));
  return out + "</g>";
}

/** bg: 'auto' のときに使うスタイル別の既定背景。null は背景なし(自前描画) */
export const STYLES = [
  { id: "github", name: "GitHub風", bg: "#f0f0f0", colors: 1, draw: github },
  { id: "invader", name: "インベーダー", bg: "#1f2328", colors: 1, draw: invader },
  { id: "pixel", name: "ピクセル", bg: "#fafafa", colors: 3, draw: pixel },
  { id: "rings", name: "リング", bg: "#fafafa", colors: 3, draw: rings },
  { id: "blocks", name: "ブロック", bg: "#fafafa", colors: 4, draw: blocks },
  { id: "triangles", name: "トライアングル", bg: "#fafafa", colors: 4, draw: triangles },
  { id: "blobs", name: "グラデーション", bg: null, colors: 4, draw: blobs },
];

const BG_PRESETS = { white: "#ffffff", dark: "#1f2328" };
let uidCounter = 0;

/**
 * identicon を SVG 文字列で返す
 * opts: { style, shape: square|rounded|circle, bg: auto|transparent|white|dark, color: '#rrggbb'|null, size }
 */
export function render(seed, opts = {}) {
  const { style = "github", shape = "square", bg = "auto", color = null, size = 256 } = opts;
  const def = STYLES.find((s) => s.id === style) ?? STYLES[0];
  const uid = `ic${++uidCounter}`;
  const r = createRng(`${def.id}:${seed}`);
  const colors = makePalette(r, def.colors, color);
  const body = def.draw(r, colors, uid);

  const bgColor = bg === "transparent" ? null : bg === "auto" ? def.bg : BG_PRESETS[bg];
  const bgRect = bgColor ? `<rect width="100" height="100" fill="${bgColor}"/>` : "";
  const clipShape = shape === "circle" ? `<circle cx="50" cy="50" r="50"/>`
    : shape === "rounded" ? `<rect width="100" height="100" rx="18"/>` : "";

  const inner = bgRect + body;
  const content = clipShape
    ? `<defs><clipPath id="${uid}-c">${clipShape}</clipPath></defs><g clip-path="url(#${uid}-c)">${inner}</g>`
    : inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${content}</svg>`;
}
