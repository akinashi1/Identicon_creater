// 依存なしの最小 GIF89a エンコーダ。全フレーム共通の 256 色パレット、アルファは 0/1 の透過のみ。

const key12 = (r, g, b) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);

/** 全フレームの色を 12bit に丸めて集計し、よく使われる色を平均色でパレット化する */
function buildPalette(frames) {
  const buckets = new Map();
  let hasAlpha = false;
  for (const { data } of frames) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) { hasAlpha = true; continue; }
      const k = key12(data[i], data[i + 1], data[i + 2]);
      const b = buckets.get(k);
      if (b) { b[0]++; b[1] += data[i]; b[2] += data[i + 1]; b[3] += data[i + 2]; }
      else buckets.set(k, [1, data[i], data[i + 1], data[i + 2]]);
    }
  }
  const reserve = hasAlpha ? 1 : 0;
  const top = [...buckets.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 256 - reserve);
  const table = new Uint8Array(256 * 3);
  const colors = [];
  const indexOf = new Map();
  top.forEach(([k, [n, r, g, b]], i) => {
    const idx = i + reserve;
    const rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    table.set(rgb, idx * 3);
    colors.push([idx, ...rgb]);
    indexOf.set(k, idx);
  });
  return { table, colors, indexOf, hasAlpha };
}

function nearest(colors, r, g, b) {
  let best = colors[0][0], bestD = Infinity;
  for (const [idx, cr, cg, cb] of colors) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = idx; }
  }
  return best;
}

function toIndices({ data }, width, height, pal, cache) {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 128) { out[p] = 0; continue; }
    const k = key12(data[i], data[i + 1], data[i + 2]);
    let idx = pal.indexOf.get(k) ?? cache.get(k);
    if (idx === undefined) {
      idx = nearest(pal.colors, data[i], data[i + 1], data[i + 2]);
      cache.set(k, idx);
    }
    out[p] = idx;
  }
  return out;
}

/** GIF 用の可変長コード LZW (最小コードサイズ 8)。戻り値は 255 バイトずつのサブブロックに分割済み */
function lzwBlocks(indices) {
  const MIN = 8, CLEAR = 1 << MIN, EOI = CLEAR + 1;
  const bytes = [];
  let cur = 0, shift = 0, size = MIN + 1, next = EOI + 1, table = new Map();
  const emit = (code) => {
    cur |= code << shift;
    shift += size;
    while (shift >= 8) { bytes.push(cur & 255); cur >>>= 8; shift -= 8; }
  };
  emit(CLEAR);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k, found = table.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next === 4096) {
      emit(CLEAR);
      table = new Map();
      next = EOI + 1;
      size = MIN + 1;
    } else {
      if (next >= 1 << size) size++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(EOI);
  if (shift > 0) bytes.push(cur & 255);

  const out = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
  return out;
}

/**
 * frames: ImageData の配列 / delayCs: 1 フレームの表示時間(1/100 秒)
 * 戻り値: GIF のバイト列 (Uint8Array)。無限ループ。
 */
export function encodeGif(frames, width, height, delayCs) {
  const pal = buildPalette(frames);
  const cache = new Map();
  const out = [];
  const u16 = (n) => out.push(n & 255, (n >> 8) & 255);
  const str = (s) => { for (const c of s) out.push(c.charCodeAt(0)); };

  str("GIF89a");
  u16(width); u16(height);
  out.push(0xf7, 0, 0);
  out.push(...pal.table);
  out.push(0x21, 0xff, 0x0b); str("NETSCAPE2.0"); out.push(3, 1, 0, 0, 0);

  for (const frame of frames) {
    out.push(0x21, 0xf9, 4, (pal.hasAlpha ? 2 : 1) << 2 | (pal.hasAlpha ? 1 : 0)); u16(delayCs); out.push(0, 0);
    out.push(0x2c); u16(0); u16(0); u16(width); u16(height); out.push(0);
    out.push(8);
    for (const b of lzwBlocks(toIndices(frame, width, height, pal, cache))) out.push(b);
  }
  out.push(0x3b);
  return new Uint8Array(out);
}
