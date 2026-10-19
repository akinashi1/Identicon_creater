// 文字列 -> 決定的な乱数列 (xmur3 でシード化し sfc32 で生成)
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** 同じ文字列からは常に同じ 0 <= x < 1 の列を返す関数を作る */
export function createRng(str) {
  const seed = xmur3(str);
  let a = seed(), b = seed(), c = seed(), d = seed();
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** ランダムな英数字文字列 */
export function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}
