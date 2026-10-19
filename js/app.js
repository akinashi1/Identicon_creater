import { randomString } from "./hash.js";
import { STYLES, render } from "./identicons.js";
import { encodeGif } from "./gif.js";

const $ = (sel) => document.querySelector(sel);
const el = {
  seed: $("#seed"), random: $("#random"), shape: $("#shape"), bg: $("#bg"), size: $("#size"),
  useColor: $("#useColor"), color: $("#color"), preview: $("#preview"), gallery: $("#gallery"),
  styleName: $("#styleName"), styleDesc: $("#styleDesc"), batch: $("#batch"), roll: $("#roll"), status: $("#status"), dlSvg: $("#dlSvg"), dlPng: $("#dlPng"), dlGif: $("#dlGif"), copySvg: $("#copySvg"), share: $("#share"),
};

const state = { seed: "", style: "github" };

// ---- URL ハッシュとの同期 (#seed=...&style=...&shape=...) ----
function loadFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  state.seed = p.get("seed") ?? randomString();
  if (STYLES.some((s) => s.id === p.get("style"))) state.style = p.get("style");
  for (const key of ["shape", "bg", "size"]) {
    const v = p.get(key);
    if (v && [...el[key].options].some((o) => o.value === v)) el[key].value = v;
  }
  const color = p.get("color");
  if (/^#[0-9a-f]{6}$/i.test(color ?? "")) {
    el.useColor.checked = true;
    el.color.value = color;
  }
  el.color.disabled = !el.useColor.checked;
  el.seed.value = state.seed;
}

function shareUrl() {
  const p = new URLSearchParams({
    seed: state.seed, style: state.style, shape: el.shape.value, bg: el.bg.value, size: el.size.value,
  });
  if (el.useColor.checked) p.set("color", el.color.value);
  return `${location.origin}${location.pathname}#${p}`;
}

const options = (style, size, t) => ({
  style, size, t,
  shape: el.shape.value,
  bg: el.bg.value,
  color: el.useColor.checked ? el.color.value : null,
});

// ---- 描画 ----
function buildGallery() {
  el.gallery.replaceChildren(...STYLES.map((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    btn.dataset.style = s.id;
    btn.innerHTML = `<div></div><span>${s.name}</span>`;
    btn.addEventListener("click", () => { state.style = s.id; update(); });
    return btn;
  }));
}

// 10連ランダム: 引いた文字列を保持し、設定が変わったら同じ文字列で描き直す
let batchSeeds = [];

function roll() {
  batchSeeds = Array.from({ length: 10 }, () => randomString());
  renderBatch();
}

function renderBatch() {
  el.batch.replaceChildren(...batchSeeds.map((seed) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    btn.title = seed;
    btn.innerHTML = `<div>${render(seed, options(state.style, 128))}</div><span></span>`;
    btn.lastChild.textContent = seed;
    btn.addEventListener("click", () => {
      state.seed = seed;
      el.seed.value = seed;
      update();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return btn;
  }));
}

function update() {
  const size = +el.size.value;
  el.preview.innerHTML = render(state.seed, options(state.style, size));
  for (const tile of el.gallery.children) {
    const id = tile.dataset.style;
    tile.firstChild.innerHTML = render(state.seed, options(id, 128));
    tile.setAttribute("aria-pressed", String(id === state.style));
  }
  const info = STYLES.find((s) => s.id === state.style);
  el.styleName.textContent = info.name;
  el.styleDesc.textContent = info.desc;
  el.dlGif.hidden = !info.animated;
  renderBatch();
  history.replaceState(null, "", shareUrl());
}

// ---- 書き出し ----
const fileBase = () => `identicon-${state.style}-${state.seed.replace(/[^\w-]+/g, "_").slice(0, 32) || "empty"}`;
const currentSvg = () => render(state.seed, options(state.style, +el.size.value));

function say(msg) {
  el.status.textContent = msg;
  clearTimeout(say.t);
  say.t = setTimeout(() => (el.status.textContent = ""), 2500);
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    say(okMsg);
  } catch {
    say("コピーできませんでした");
  }
}

el.dlSvg.addEventListener("click", () => {
  download(new Blob([currentSvg()], { type: "image/svg+xml" }), `${fileBase()}.svg`);
});

el.dlPng.addEventListener("click", () => {
  const size = +el.size.value;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").drawImage(img, 0, 0, size, size);
    canvas.toBlob((blob) => download(blob, `${fileBase()}.png`), "image/png");
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(currentSvg())}`;
});

// ---- アニメーション (プレビューと 10連ランダムだけ動かす) ----
const LOOP_MS = 2000, GIF_FRAMES = 40, GIF_MAX_SIZE = 512;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastFrame = 0;

function tick(now) {
  requestAnimationFrame(tick);
  if (!STYLES.find((s) => s.id === state.style).animated || now - lastFrame < 33) return;
  lastFrame = now;
  const t = (now % LOOP_MS) / LOOP_MS;
  el.preview.innerHTML = render(state.seed, options(state.style, +el.size.value, t));
  for (const tile of el.batch.children) {
    tile.firstChild.innerHTML = render(tile.title, options(state.style, 128, t));
  }
}
if (!reducedMotion) requestAnimationFrame(tick);

// ---- GIF 書き出し: 1 ループぶんのフレームを描いて 1 枚の GIF にまとめる ----
const loadImage = (svg) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});

el.dlGif.addEventListener("click", async () => {
  const size = Math.min(+el.size.value, GIF_MAX_SIZE);
  el.dlGif.disabled = true;
  say("GIF を作成中…");
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const frames = [];
    for (let i = 0; i < GIF_FRAMES; i++) {
      const img = await loadImage(render(state.seed, options(state.style, size, i / GIF_FRAMES)));
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      frames.push(ctx.getImageData(0, 0, size, size));
    }
    const bytes = encodeGif(frames, size, size, Math.round(LOOP_MS / GIF_FRAMES / 10));
    download(new Blob([bytes], { type: "image/gif" }), `${fileBase()}.gif`);
    say(size < +el.size.value ? `GIF を保存しました（${GIF_MAX_SIZE}px に縮小）` : "GIF を保存しました");
  } catch {
    say("GIF を作成できませんでした");
  } finally {
    el.dlGif.disabled = false;
  }
});

el.copySvg.addEventListener("click", () => copy(currentSvg(), "SVG をコピーしました"));
el.share.addEventListener("click", () => copy(shareUrl(), "URL をコピーしました"));

// ---- 入力 ----
el.seed.addEventListener("input", () => { state.seed = el.seed.value; update(); });
el.random.addEventListener("click", () => {
  state.seed = randomString();
  el.seed.value = state.seed;
  update();
});
el.useColor.addEventListener("change", () => { el.color.disabled = !el.useColor.checked; update(); });
for (const key of ["shape", "bg", "size", "color"]) el[key].addEventListener("input", update);

el.roll.addEventListener("click", roll);

loadFromHash();
buildGallery();
roll();
update();
