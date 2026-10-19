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

// SSH ランダムアート (ssh-keygen の drunken bishop)。17x9 の盤面を 2bit ずつ斜めに歩いた訪問回数を文字にする
function sshart(r, [fg]) {
  const W = 17, H = 9, SYMBOLS = " .o+=*BOX@%&#/^";
  const board = Array.from({ length: H }, () => Array(W).fill(0));
  let x = W >> 1, y = H >> 1;
  const start = [x, y];
  for (let i = 0; i < 32; i++) {
    let byte = Math.floor(r() * 256);
    for (let k = 0; k < 4; k++, byte >>= 2) {
      x = Math.min(W - 1, Math.max(0, x + (byte & 1 ? 1 : -1)));
      y = Math.min(H - 1, Math.max(0, y + (byte & 2 ? 1 : -1)));
      board[y][x]++;
    }
  }
  board[start[1]][start[0]] = "S";
  board[y][x] = "E";

  const cw = 100 / (W + 2), ch = 8.4, top = (100 - ch * (H + 2)) / 2;
  let out = `<rect x="${f(cw / 2)}" y="${f(top + ch / 2)}" width="${f(cw * (W + 1))}" height="${f(ch * (H + 1))}" fill="none" stroke="${fg}" stroke-width="0.8"/>` +
    `<g fill="${fg}" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="7.6" font-weight="700" text-anchor="middle">`;
  board.forEach((row, j) => row.forEach((v, i) => {
    const c = typeof v === "string" ? v : SYMBOLS[Math.min(v, SYMBOLS.length - 1)];
    if (c !== " ") out += `<text x="${f(cw * (i + 1.5))}" y="${f(top + ch * (j + 1.5) + 2.6)}">${c}</text>`;
  }));
  return out + "</g>";
}

// ---------- 以降は他サービスの雰囲気を再現した自作スタイル ----------
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const INK = "#1f2328";

// Jdenticon 風: 外周(風車) / 四隅 / 中央 の 3 グループを 90 度ずつ回して回転対称に並べる
const J_SHAPES = [
  (u, c) => `<polygon points="0,0 ${u},0 0,${u}" fill="${c}"/>`,
  (u, c) => `<polygon points="${u / 2},0 ${u},${u} 0,${u}" fill="${c}"/>`,
  (u, c) => `<polygon points="${u / 2},0 ${u},${u / 2} ${u / 2},${u} 0,${u / 2}" fill="${c}"/>`,
  (u, c) => `<circle cx="${u / 2}" cy="${u / 2}" r="${u / 2}" fill="${c}"/>`,
  (u, c) => `<rect width="${u / 2}" height="${u}" fill="${c}"/>`,
  (u, c) => `<path d="M0 0H${u}A${u} ${u} 0 0 1 0 ${u}Z" fill="${c}"/>`,
];
function jdenticon(r, colors) {
  const pad = 8, u = 21;
  const groups = [
    [[1, 0], [3, 1], [2, 3], [0, 2]],
    [[0, 0], [3, 0], [3, 3], [0, 3]],
    [[1, 1], [2, 1], [2, 2], [1, 2]],
  ];
  let out = "";
  groups.forEach((cells, gi) => {
    const shape = J_SHAPES[rint(r, 0, J_SHAPES.length - 1)];
    const start = rint(r, 0, 3);
    cells.forEach(([cx, cy], i) => {
      out += `<g transform="translate(${pad + cx * u} ${pad + cy * u}) rotate(${((start + i) % 4) * 90} ${u / 2} ${u / 2})">${shape(u, colors[gi])}</g>`;
    });
  });
  return out;
}

// Jazzicon 風: 背景色の上に、回転・ずらした色付きの正方形を 3 枚重ねる
function jazzicon(r, colors) {
  let out = `<rect width="100" height="100" fill="${colors[0]}"/>`;
  for (let i = 1; i <= 3; i++) {
    const ang = r() * Math.PI * 2, dist = 18 + r() * 30, rot = r() * 360;
    out += `<rect width="100" height="100" fill="${colors[i]}" transform="translate(${f(Math.cos(ang) * dist)} ${f(Math.sin(ang) * dist)}) rotate(${f(rot)} 50 50)"/>`;
  }
  return out;
}

// Boring Avatars 風 (beam): 背景 + 傾いた丸みのある体 + 目と口
function beam(r, [c0, c1, c2]) {
  const rx = f(14 + r() * 36), rot = f((r() - 0.5) * 40), tx = f((r() - 0.5) * 10), ty = f((r() - 0.5) * 10);
  const fx = f((r() - 0.5) * 12), fy = f((r() - 0.5) * 8), frot = f((r() - 0.5) * 24);
  const s = f(10 + r() * 7), m = f(7 + r() * 4);
  const mouth = r() < 0.5
    ? `<path d="M${50 - m} 62Q50 ${f(62 + 6 + r() * 6)} ${50 + m} 62" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M${50 - m} 60H${50 + m}A${m} ${m} 0 0 1 ${50 - m} 60Z" fill="${INK}"/>`;
  return `<rect width="100" height="100" fill="${c0}"/>` +
    `<rect x="10" y="10" width="80" height="80" rx="${rx}" fill="${c1}" transform="translate(${tx} ${ty}) rotate(${rot} 50 50)"/>` +
    `<g transform="translate(${fx} ${fy}) rotate(${frot} 50 50)">` +
    `<circle cx="${f(50 - s * 1.4)}" cy="56" r="5" fill="${c2}" fill-opacity=".55"/><circle cx="${f(50 + s * 1.4)}" cy="56" r="5" fill="${c2}" fill-opacity=".55"/>` +
    `<circle cx="${f(50 - s)}" cy="46" r="3.6" fill="${INK}"/><circle cx="${f(50 + s)}" cy="46" r="3.6" fill="${INK}"/>${mouth}</g>`;
}

// Boring Avatars 風 (sunset): 上下 2 枚のグラデーションと太陽、水面の反射
function sunset(r, [c0, c1, c2, c3], uid) {
  let out = `<defs><linearGradient id="${uid}-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>` +
    `<linearGradient id="${uid}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>` +
    `<rect width="100" height="50" fill="url(#${uid}-a)"/><rect y="50" width="100" height="50" fill="url(#${uid}-b)"/>` +
    `<circle cx="${f(30 + r() * 40)}" cy="50" r="${f(12 + r() * 14)}" fill="${c1}" fill-opacity=".85"/>` +
    `<rect y="50" width="100" height="50" fill="url(#${uid}-b)" fill-opacity=".75"/>`;
  for (let i = 0; i < 4; i++) {
    const w = 14 + r() * 40;
    out += `<rect x="${f(50 - w / 2 + (r() - 0.5) * 20)}" y="${58 + i * 9}" width="${f(w)}" height="2.5" rx="1.2" fill="#fff" fill-opacity=".3"/>`;
  }
  return out;
}

// MonsterID 風: 体の形 / 角 / 腕 / 1〜3 個の目 / 口 をベクターで組み合わせる
function monster(r, [c0, c1, c2]) {
  const BODIES = [
    { top: 28, eyeY: 46, mouthY: 67, arm: 20, horn: [18, 34], path: (rx) => `<rect x="20" y="28" width="60" height="58" rx="${rx}"/>` },
    { top: 26, eyeY: 47, mouthY: 69, arm: 19, horn: [17, 38], path: () => `<ellipse cx="50" cy="56" rx="32" ry="30"/>` },
    { top: 18, eyeY: 49, mouthY: 70, arm: 18, horn: [20, 30], path: () => `<path d="M18 86V50A32 32 0 0 1 82 50V86Z"/>` },
    { top: 24, eyeY: 58, mouthY: 75, arm: 28, horn: [8, 38], path: () => `<path d="M50 24L84 84H16Z" stroke="${c0}" stroke-width="8" stroke-linejoin="round"/>` },
  ];
  const b = BODIES[rint(r, 0, 3)];
  let out = "";
  const ay = rint(r, 66, 78);
  for (const x of [b.arm, 100 - b.arm]) {
    out += `<path d="M${x} 64L${x < 50 ? x - 12 : x + 12} ${ay}" stroke="${c0}" stroke-width="7" stroke-linecap="round"/>`;
  }
  out += `<path d="M36 84V93M64 84V93" stroke="${c0}" stroke-width="8" stroke-linecap="round"/>`;
  const horns = rint(r, 0, 2);
  if (horns === 1) out += `<polygon points="44,${b.top + 4} 50,${b.top - 12} 56,${b.top + 4}" fill="${c1}"/>`;
  if (horns === 2) {
    const [hx, hy] = b.horn;
    out += `<polygon points="${50 - hx - 5},${hy} ${50 - hx - 9},${hy - 16} ${50 - hx + 4},${hy}" fill="${c1}"/>` +
      `<polygon points="${50 + hx + 5},${hy} ${50 + hx + 9},${hy - 16} ${50 + hx - 4},${hy}" fill="${c1}"/>`;
  }
  out += `<g fill="${c0}">${b.path(rint(r, 10, 28))}</g>`;

  const n = rint(r, 1, 3), rad = [0, 10, 7, 5][n], gap = n === 2 ? 11 : 14;
  const xs = n === 1 ? [50] : n === 2 ? [50 - gap, 50 + gap] : [50 - gap, 50, 50 + gap];
  for (const x of xs) {
    out += `<circle cx="${x}" cy="${b.eyeY}" r="${rad}" fill="#fff"/><circle cx="${f(x + (r() - 0.5) * rad * 0.6)}" cy="${f(b.eyeY + (r() - 0.5) * rad * 0.6)}" r="${f(rad * 0.5)}" fill="${INK}"/>`;
  }
  const my = b.mouthY, m = 10;
  const mouth = rint(r, 0, 3);
  if (mouth === 0) out += `<path d="M${50 - m} ${my}Q50 ${my + 8} ${50 + m} ${my}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  else if (mouth === 1) out += `<path d="M${50 - m} ${my}l${m / 2} 6l${m / 2} -6l${m / 2} 6l${m / 2} -6" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  else if (mouth === 2) out += `<ellipse cx="50" cy="${my}" rx="8" ry="6" fill="${INK}"/><ellipse cx="50" cy="${my + 3}" rx="4.5" ry="3" fill="${c2}"/>`;
  else out += `<circle cx="50" cy="${my}" r="4" fill="${INK}"/>`;
  return out;
}

// Wavatar 風: 淡い背景 + 髪 + 顔の形 + 目 / 口 / ほほ
function wavatar(r, [c0, c1, c2]) {
  let out = `<rect width="100" height="100" fill="${c0}" fill-opacity=".28"/>`;
  const hair = rint(r, 0, 2);
  if (hair === 1) out += `<path d="M30 40Q50 0 70 40Z" fill="${c2}"/>`;
  if (hair === 2) out += `<ellipse cx="50" cy="48" rx="38" ry="40" fill="${c2}"/>`;
  out += r() < 0.5
    ? `<ellipse cx="50" cy="56" rx="31" ry="33" fill="${c1}"/>`
    : `<rect x="19" y="24" width="62" height="64" rx="22" fill="${c1}"/>`;
  const eye = rint(r, 0, 3);
  for (const x of [38, 62]) {
    if (eye === 0) out += `<circle cx="${x}" cy="48" r="3.6" fill="${INK}"/>`;
    else if (eye === 1) out += `<ellipse cx="${x}" cy="48" rx="6" ry="7" fill="#fff"/><circle cx="${x}" cy="49" r="3" fill="${INK}"/>`;
    else if (eye === 2) out += `<path d="M${x - 6} 50Q${x} 41 ${x + 6} 50" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    else out += `<ellipse cx="${x}" cy="48" rx="4" ry="7" fill="${INK}"/><circle cx="${x + 1}" cy="45" r="1.5" fill="#fff"/>`;
  }
  if (r() < 0.5) out += `<circle cx="29" cy="60" r="5" fill="#ff7a93" fill-opacity=".4"/><circle cx="71" cy="60" r="5" fill="#ff7a93" fill-opacity=".4"/>`;
  const mouth = rint(r, 0, 3);
  if (mouth === 0) out += `<path d="M39 66Q50 76 61 66" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  else if (mouth === 1) out += `<path d="M40 65H60A10 10 0 0 1 40 65Z" fill="${INK}"/><ellipse cx="50" cy="69" rx="5" ry="2.6" fill="#ff7a93"/>`;
  else if (mouth === 2) out += `<path d="M42 68H58" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  else out += `<path d="M38 66Q44 73 50 66Q56 73 62 66" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  return out;
}

// Robohash 風: アンテナ / 頭 / 目 / 口 / 胸 / 腕 / 脚 を組み合わせたロボット
function robot(r, [c0, c1]) {
  const st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  let out = "";
  for (const [x1, x2] of [[22, 10], [78, 90]]) {
    out += `<path d="M${x1} 58L${x2} 72" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${x1} 58L${x2} 72" stroke="${c0}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="${x2}" cy="73" r="4" fill="${c0}" ${st}/>`;
  }
  out += `<rect x="32" y="82" width="12" height="11" rx="2" fill="${c0}" ${st}/><rect x="56" y="82" width="12" height="11" rx="2" fill="${c0}" ${st}/>` +
    `<rect x="22" y="50" width="56" height="32" rx="${rint(r, 3, 10)}" fill="${c1}" ${st}/><rect x="44" y="46" width="12" height="4" fill="${c1}" ${st}/>`;
  const chest = rint(r, 0, 2);
  if (chest === 0) out += `<circle cx="50" cy="66" r="7" fill="#fff" ${st}/>`;
  else if (chest === 1) out += [38, 50, 62].map((x) => `<circle cx="${x}" cy="62" r="3.2" fill="${c0}" ${st}/>`).join("") + `<path d="M36 72H64" ${st}/>`;
  else out += `<rect x="36" y="58" width="28" height="14" rx="2" fill="${c0}" ${st}/><path d="M36 65H64" ${st}/>`;

  const ant = rint(r, 0, 2);
  if (ant === 0) out += `<path d="M50 14V6" ${st}/><circle cx="50" cy="5" r="3.5" fill="${c1}" ${st}/>`;
  else if (ant === 1) out += `<path d="M36 14L32 6M64 14L68 6" ${st}/><circle cx="31.5" cy="5" r="3" fill="${c1}" ${st}/><circle cx="68.5" cy="5" r="3" fill="${c1}" ${st}/>`;
  else out += `<rect x="46" y="9" width="8" height="5" fill="${c1}" ${st}/>`;
  out += `<rect x="26" y="14" width="48" height="32" rx="${rint(r, 2, 12)}" fill="${c0}" ${st}/>`;
  const eye = rint(r, 0, 3);
  if (eye === 0) out += [36, 56].map((x) => `<rect x="${x}" y="22" width="8" height="8" fill="#fff" ${st}/><rect x="${x + 2.5}" y="24.5" width="3" height="3" fill="${INK}"/>`).join("");
  else if (eye === 1) out += `<rect x="32" y="23" width="36" height="9" rx="3" fill="${INK}"/><rect x="35" y="26.5" width="20" height="2" fill="${c1}"/>`;
  else if (eye === 2) out += [38, 62].map((x) => `<circle cx="${x}" cy="27" r="5.5" fill="#fff" ${st}/><circle cx="${x}" cy="27" r="2" fill="${INK}"/>`).join("");
  else out += `<circle cx="50" cy="28" r="8" fill="#fff" ${st}/><circle cx="50" cy="28" r="3" fill="${INK}"/>`;
  const mouth = rint(r, 0, 2);
  if (mouth === 0) out += `<path d="M43 37V43M48 37V43M52 37V43M57 37V43" ${st}/>`;
  else if (mouth === 1) out += `<rect x="40" y="38" width="20" height="4" rx="2" fill="${INK}"/>`;
  else out += [44, 50, 56].map((x) => `<circle cx="${x}" cy="40" r="1.6" fill="${INK}"/>`).join("");
  return out;
}

// モザイク: 8x8 の 1/4 を決めて上下左右に折り返した 16x16。値が小さいセルは空白
function mosaic(r, colors) {
  const cell = 100 / 16, quad = [];
  for (let y = 0; y < 8; y++) {
    quad.push(Array.from({ length: 8 }, () => {
      const v = r();
      return v < 0.25 ? -1 : Math.min(3, Math.floor(((v - 0.25) / 0.75) * 4));
    }));
  }
  let out = `<g shape-rendering="crispEdges">`;
  quad.forEach((row, y) => row.forEach((c, x) => {
    if (c < 0) return;
    for (const [px, py] of [[x, y], [15 - x, y], [x, 15 - y], [15 - x, 15 - y]]) {
      out += `<rect x="${f(px * cell)}" y="${f(py * cell)}" width="${f(cell)}" height="${f(cell)}" fill="${colors[c]}"/>`;
    }
  }));
  return out + "</g>";
}

// JSAB 風 (アニメ): ネオン色の図形がビートに合わせて脈打つ。t(0〜1) が 1 ループで、4 拍ぶんの動き。
// 回転は必ず「対称性の整数倍」だけ回すので、t=1 と t=0 が一致してループが途切れない。
function jsab(r, _colors, _uid, t, custom) {
  const NEON = ["#ff2d95", "#00e5ff", "#ffe14d", "#7cff4d", "#b36bff", "#ff6a3d"];
  const i0 = rint(r, 0, 5), i1 = (i0 + rint(r, 1, 5)) % 6;
  const ca = custom ?? NEON[i0], cb = NEON[i1], cw = "#ffffff";
  const ph = (t * 4) % 1, pulse = (1 - ph) ** 3;
  const poly = (n, rad) => Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return `${f(Math.cos(a) * rad)},${f(Math.sin(a) * rad)}`;
  }).join(" ");

  const sides = [3, 4, 5, 6, 0][rint(r, 0, 4)], baseR = 14 + r() * 6;
  const dir = r() < 0.5 ? -1 : 1, turns = rint(r, 1, 2), outline = r() < 0.4;
  const ringN = rint(r, 1, 2), cornerSize = 18 + r() * 14;
  const beams = Array.from({ length: rint(r, 0, 2) }, () => ({
    base: r() * 180, m: rint(r, 1, 2), d: r() < 0.5 ? -1 : 1, w: 1.4 + r() * 1.6,
  }));
  const orbN = rint(r, 2, 6), orbR = rint(r, 30, 38), orbType = rint(r, 0, 2), orbS = 3 + r() * 2;
  const orbDir = r() < 0.5 ? -1 : 1;

  const s = cornerSize, co = f(0.1 + 0.25 * pulse);
  let out = `<g fill="${cb}" fill-opacity="${co}"><polygon points="0,0 ${s},0 0,${s}"/><polygon points="100,0 ${100 - s},0 100,${s}"/>` +
    `<polygon points="0,100 ${s},100 0,${100 - s}"/><polygon points="100,100 ${100 - s},100 100,${100 - s}"/></g>`;
  for (const b of beams) {
    out += `<rect x="-20" y="${f(50 - b.w / 2)}" width="140" height="${f(b.w)}" fill="${ca}" fill-opacity="${f(0.35 + 0.4 * pulse)}" transform="rotate(${f(b.base + 180 * b.m * b.d * t)} 50 50)"/>`;
  }
  for (let k = 0; k < ringN; k++) {
    const p = (t * 2 + k / ringN) % 1;
    out += `<circle cx="50" cy="50" r="${f(8 + 46 * p)}" fill="none" stroke="${cb}" stroke-width="1.6" stroke-opacity="${f((1 - p) * 0.85)}"/>`;
  }
  for (let i = 0; i < orbN; i++) {
    const ang = (360 * i) / orbN + 360 * orbDir * t, rad = orbR + 3 * pulse, c = i % 2 ? cb : ca;
    const shape = orbType === 0 ? `<polygon points="${poly(3, f(orbS * 1.3))}" fill="${c}"/>`
      : orbType === 1 ? `<rect x="${-orbS}" y="${-orbS}" width="${orbS * 2}" height="${orbS * 2}" fill="${c}"/>`
      : `<circle r="${f(orbS)}" fill="${c}"/>`;
    out += `<g transform="rotate(${f(ang)} 50 50) translate(50 ${f(50 - rad)}) rotate(${f(360 * orbDir * t)})">${shape}</g>`;
  }

  const sc = f(1 + 0.22 * pulse);
  if (sides) {
    const step = 360 / sides;
    out += `<g transform="translate(50 50) rotate(${f(dir * step * turns * t)}) scale(${sc})" stroke-linejoin="round">` +
      `<polygon points="${poly(sides, f(baseR))}" fill="${outline ? "none" : ca}" stroke="${outline ? ca : cw}" stroke-width="2.4"/>` +
      `<polygon points="${poly(sides, f(baseR * 0.5))}" fill="${cb}" transform="rotate(${f(-dir * step * turns * t)})"/></g>`;
  } else {
    out += `<g transform="translate(50 50) scale(${sc})"><circle r="${f(baseR)}" fill="${outline ? "none" : ca}" stroke="${outline ? ca : cw}" stroke-width="2.4"/>` +
      `<circle r="${f(baseR * 0.55)}" fill="none" stroke="${cb}" stroke-width="2.6" stroke-dasharray="6 5" transform="rotate(${f(dir * 360 * t)})"/></g>`;
  }
  return out + `<circle cx="50" cy="50" r="${f(2 + 2 * pulse)}" fill="${cw}"/>`;
}

/** bg: 'auto' のときに使うスタイル別の既定背景。null は背景なし(自前描画) */
export const STYLES = [
  { id: "github", name: "GitHub風", bg: "#f0f0f0", colors: 1, draw: github,
    desc: "GitHub が、アイコン未設定のユーザーに自動で割り当てるアバター。5x5 の左右対称ドットが特徴です。" },
  { id: "invader", name: "インベーダー", bg: "#1f2328", colors: 1, draw: invader,
    desc: "オリジナル。ゲーム「スペースインベーダー」の敵キャラのような、目・触角・足を持つドット絵です。" },
  { id: "jsab", name: "JSAB風（動く）", bg: "#0b0b1a", colors: 1, draw: jsab, animated: true,
    desc: "ゲーム「Just Shapes & Beats」のような、ネオン色の図形がビートに合わせて脈打つ動くアイコン。2 秒でループし、GIF で保存できます。" },
  { id: "ssh", name: "SSH randomart", bg: "#1f2328", colors: 1, draw: sshart,
    desc: "ssh-keygen や接続時のホスト鍵確認で表示される、鍵の指紋（fingerprint）を絵にしたもの。通称 randomart です。" },
  { id: "pixel", name: "Blockies風", bg: "#fafafa", colors: 3, draw: pixel,
    desc: "Ethereum 系のウォレットやエクスプローラーなどで、アドレスの見分けに使われる 8x8 の左右対称ドット絵です。" },
  { id: "jdenticon", name: "Jdenticon風", bg: "#fafafa", colors: 3, draw: jdenticon,
    desc: "Jdenticon というライブラリ由来。Web アプリのユーザー既定アバターなどに使われる、図形を回転対称に並べた模様です。" },
  { id: "jazzicon", name: "Jazzicon風", bg: null, colors: 4, draw: jazzicon,
    desc: "MetaMask のアカウントアイコンで知られる Jazzicon 風。色付きの四角を重ねた模様で、形を「円」にすると本家に近くなります。" },
  { id: "beam", name: "Beam風", bg: null, colors: 3, draw: beam,
    desc: "Boring Avatars というライブラリの「beam」風。画像のない場面の仮アバターによく使われる、顔つきのアイコンです。" },
  { id: "sunset", name: "Sunset風", bg: null, colors: 4, draw: sunset,
    desc: "Boring Avatars の「sunset」風。夕焼けのようなグラデーションのアイコンで、仮アバターとして使われます。" },
  { id: "monster", name: "モンスター風", bg: "#fafafa", colors: 3, draw: monster,
    desc: "Gravatar / WordPress のコメント欄で選べる「MonsterID」風。名前やメールから決まる怪物のアバターです。" },
  { id: "wavatar", name: "Wavatar風", bg: "#fafafa", colors: 3, draw: wavatar,
    desc: "Gravatar / WordPress のコメント欄で選べる「Wavatar」風。目・口・髪などのパーツを組み合わせた顔のアイコンです。" },
  { id: "robot", name: "ロボット風", bg: "#fafafa", colors: 2, draw: robot,
    desc: "Robohash 風。任意の文字列から固有のロボット画像を返すサービスで、ダミーのアバターやテスト用によく使われます。" },
  { id: "mosaic", name: "モザイク", bg: "#fafafa", colors: 4, draw: mosaic,
    desc: "オリジナル。ハッシュ値を 16x16 の模様にして見比べやすくする、visual hash（ハッシュの可視化）の考え方です。" },
  { id: "rings", name: "リング", bg: "#fafafa", colors: 3, draw: rings,
    desc: "オリジナル。同心円の弧を組み合わせた、的のようなリング模様です。" },
  { id: "blocks", name: "ブロック", bg: "#fafafa", colors: 4, draw: blocks,
    desc: "オリジナル。四角・円・四分円などのタイルを 4x4 に敷き詰めた、バウハウス風の模様です。" },
  { id: "triangles", name: "トライアングル", bg: "#fafafa", colors: 4, draw: triangles,
    desc: "オリジナル。斜めに分割したタイルを左右対称に並べた、三角の幾何学模様です。" },
  { id: "blobs", name: "グラデーション", bg: null, colors: 4, draw: blobs,
    desc: "オリジナル。グラデーションの背景に、半透明の円を重ねた柔らかい模様です。" },
];

const BG_PRESETS = { white: "#ffffff", dark: "#1f2328" };
let uidCounter = 0;

/**
 * identicon を SVG 文字列で返す
 * opts: { style, shape: square|rounded|circle, bg: auto|transparent|white|dark, color: '#rrggbb'|null, size }
 */
export function render(seed, opts = {}) {
  // t: アニメーションの位相(0〜1)。静止スタイルでは無視される。既定値は動きが見える中間の位置
  const { style = "github", shape = "square", bg = "auto", color = null, size = 256, t = 0.1 } = opts;
  const def = STYLES.find((s) => s.id === style) ?? STYLES[0];
  const uid = `ic${++uidCounter}`;
  const r = createRng(`${def.id}:${seed}`);
  const colors = makePalette(r, def.colors, color);
  const body = def.draw(r, colors, uid, t, color);

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
