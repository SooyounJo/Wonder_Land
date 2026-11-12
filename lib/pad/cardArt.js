// 피그마에서 받은 꽃별 완성 카드 위에, 고른 네 선택 문구만 올림
import { FLOWERS, localized, OUTFITS, SNACKS, TEAS, TIMES } from "../growthRoom/story";

export const CARD_W = 900;
export const CARD_H = 1620;

const FIGMA_W = 4120;
const FIGMA_H = 7414;
const MINT = "#6fcfb4";
const PINK = "#ff7fbc";

const X = (n) => (n / FIGMA_W) * CARD_W;
const Y = (n) => (n / FIGMA_H) * CARD_H;

const imageCache = new Map();

function loadOnce(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function loadImage(src) {
  const hit = imageCache.get(src);
  if (hit) return hit;
  const pending = loadOnce(src).catch(async () => {
    await new Promise((r) => setTimeout(r, 80));
    return loadOnce(src);
  });
  imageCache.set(src, pending);
  pending.catch(() => {
    if (imageCache.get(src) === pending) imageCache.delete(src);
  });
  return pending;
}

function fitLine(ctx, text, maxW, want) {
  let size = want;
  ctx.font = `700 ${size}px "Noto Sans KR", "Galmuri11", sans-serif`;
  while (size > 22 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `700 ${size}px "Noto Sans KR", "Galmuri11", sans-serif`;
  }
  return size;
}

function drawCopy(ctx, picks, lang) {
  const tea = localized(TEAS[picks.tea], lang);
  const outfit = localized(OUTFITS[picks.outfit], lang);
  const snack = localized(SNACKS[picks.snack], lang);
  const time = localized(TIMES[picks.time], lang);
  const lines = [tea.cost, outfit.cost, snack.cost];
  const tops = [5051, 5408, 5765];
  const maxW = X(3300) - X(835);
  const want = Y(200);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = MINT;
  lines.forEach((line, i) => {
    fitLine(ctx, line, maxW, want);
    ctx.fillText(line, X(835), Y(tops[i]));
  });

  const quote = `“${time.cost}”`;
  ctx.fillStyle = PINK;
  fitLine(ctx, quote, X(3300) - X(872), want);
  ctx.fillText(quote, X(872), Y(6618));
}

export async function drawCard(picks, lang = "ko") {
  await document.fonts.load('700 44px "Noto Sans KR"', "기대에");
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  const flower = FLOWERS[picks.flower] ?? FLOWERS[0];
  const base = await loadImage(flower.front || flower.card);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, CARD_W, CARD_H);
  ctx.imageSmoothingEnabled = true;
  drawCopy(ctx, picks, lang);
  return canvas;
}
