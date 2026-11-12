// 피그마 최종 카드(244:44) 위에 꽃·키·과자 한 줄과 본문·질문을 올림
import { FLOWERS, localized, measuredHeight, SNACKS } from "../growthRoom/story";

export const CARD_W = 900;
export const CARD_H = 1620;

const FIGMA_W = 4120;
const FIGMA_H = 7414;
const MINT = "#6fcfb4";
const PINK = "#ff7fbc";
const FLOWER_ICON = "/growth-room/cards/deco-daisy.png?v=2";
const SHIRT_ICON = "/growth-room/cards/icon-shirt.png";
const SNACK_ICON = "/growth-room/cards/icon-snack.png";

const X = (n) => (n / FIGMA_W) * CARD_W;
const Y = (n) => (n / FIGMA_H) * CARD_H;
const FONT = 33;
const LINE_H = 44;
const LINE_STROKE = Y(51);
const TAG_LINE_1 = Y(4683);
const TAG_LINE_2 = Y(5187);
const BODY_TOP = Y(5480);
const QUOTE_GAP = Y(176);

const imageCache = new Map();
const iconCut = new Map();

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

function isIconBg(r, g, b, a) {
  if (a < 12) return true;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 28) return true;
  return mx > 198 && mx - mn < 36;
}

function punchIcon(img) {
  const src = document.createElement("canvas");
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const x = src.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const im = x.getImageData(0, 0, src.width, src.height);
  const d = im.data;
  let minX = src.width;
  let minY = src.height;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (isIconBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
      d[i + 3] = 0;
      continue;
    }
    const px = (i / 4) % src.width;
    const py = ((i / 4) / src.width) | 0;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  x.putImageData(im, 0, 0);
  if (maxX <= minX || maxY <= minY) return { canvas: src, x: 0, y: 0, w: src.width, h: src.height };
  const pad = 2;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(src.width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(src.height - sy, maxY - minY + 1 + pad * 2);
  return { canvas: src, x: sx, y: sy, w: sw, h: sh };
}

async function iconFor(src) {
  const hit = iconCut.get(src);
  if (hit) return hit;
  const cut = punchIcon(await loadImage(src));
  iconCut.set(src, cut);
  return cut;
}

function fillPaper(ctx, base, dx, dy, dw, dh) {
  const u = base.naturalWidth / CARD_W;
  const v = base.naturalHeight / CARD_H;
  const tileW = 220;
  const tileH = 160;
  const sx = X(1200) * u;
  const sy = Y(5600) * v;
  const sw = tileW * u;
  const sh = tileH * v;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  for (let y = dy; y < dy + dh; y += tileH) {
    for (let x = dx; x < dx + dw; x += tileW) {
      ctx.drawImage(base, sx, sy, sw, sh, x, y, tileW, tileH);
    }
  }
  ctx.restore();
}

function drawIcon(ctx, cut, x, y, s) {
  const scale = Math.min(s / cut.w, s / cut.h);
  const dw = cut.w * scale;
  const dh = cut.h * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cut.canvas, cut.x, cut.y, cut.w, cut.h, x + (s - dw) / 2, y + (s - dh) / 2, dw, dh);
  ctx.imageSmoothingEnabled = true;
}

function setFont(ctx) {
  ctx.font = `700 ${FONT}px "Galmuri11", sans-serif`;
}

function greedyWrap(ctx, text, maxW) {
  const chars = [...text];
  const lines = [];
  let cur = "";
  const canBreak = (ch) => " \n,，".includes(ch);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = cur + ch;
    if (ctx.measureText(next).width > maxW && cur) {
      let cut = cur.length;
      for (let k = cur.length - 1; k > cur.length * 0.35; k -= 1) {
        if (canBreak(cur[k])) {
          cut = k + 1;
          break;
        }
      }
      lines.push(cur.slice(0, cut).trim());
      cur = (cur.slice(cut) + ch).trimStart();
    } else {
      cur = next;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function wrapText(ctx, text, maxW) {
  setFont(ctx);
  if (text.includes("\n")) {
    return text.split("\n").flatMap((part) => wrapText(ctx, part.trim(), maxW));
  }
  if (ctx.measureText(text).width <= maxW) return [text];
  const parts = text.split(/(?<=,|，)/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && parts.every((p) => ctx.measureText(p).width <= maxW)) return parts;
  let width = maxW;
  let lines = greedyWrap(ctx, text, width);
  for (let i = 0; i < 8; i += 1) {
    const last = lines[lines.length - 1] || "";
    const short = ctx.measureText(last).width < maxW * 0.5;
    if (lines.length <= 3 && !short) return lines;
    width *= 0.9;
    if (width < maxW * 0.64) break;
    lines = greedyWrap(ctx, text, width);
  }
  return lines;
}

function pickCopy(flower, lang) {
  const en = lang === "en";
  return {
    tag: `${en ? flower.en : flower.name}, ${en ? flower.meaningEn || flower.meaning : flower.meaning}`,
    today: en ? flower.todayEn || flower.today : flower.today,
    body: en ? flower.bodyEn || flower.body : flower.body,
    question: en ? flower.questionEn || flower.question : flower.question,
  };
}

function drawMintLine(ctx, cy) {
  ctx.fillStyle = MINT;
  ctx.fillRect(X(404), cy - LINE_STROKE / 2, X(3303), LINE_STROKE);
}

async function drawFinale(ctx, base, picks, lang) {
  const flower = FLOWERS[picks.flower] ?? FLOWERS[0];
  const height = measuredHeight(picks);
  const snack = localized(SNACKS[picks.snack], lang);
  const copy = pickCopy(flower, lang);
  const [flowerIcon, shirtIcon, snackIcon] = await Promise.all([
    iconFor(FLOWER_ICON),
    iconFor(SHIRT_ICON),
    iconFor(SNACK_ICON),
  ]);

  fillPaper(ctx, base, X(250), Y(4540), X(3620), Y(2580));
  drawMintLine(ctx, TAG_LINE_1);
  drawMintLine(ctx, TAG_LINE_2);

  setFont(ctx);
  const innerL = X(430);
  const innerR = X(3707);
  const innerW = innerR - innerL;
  const iconGap = X(40);
  const cols = [
    { cut: flowerIcon, s: X(291), label: copy.tag },
    { cut: shirtIcon, s: X(314), label: height == null ? "---" : `${height}cm` },
    { cut: snackIcon, s: X(292), label: snack.name },
  ];
  const outfitW = cols[1].s + iconGap + ctx.measureText(cols[1].label).width;
  const snackW = cols[2].s + iconGap + ctx.measureText(cols[2].label).width;
  const flowerTextMax = Math.max(80, innerW - outfitW - snackW - X(72) - cols[0].s - iconGap);
  const flowerLines = wrapText(ctx, cols[0].label, flowerTextMax);
  setFont(ctx);
  const flowerTextW = Math.max(...flowerLines.map((line) => ctx.measureText(line).width));
  const flowerW = cols[0].s + iconGap + flowerTextW;
  const extra = Math.max(0, innerW - flowerW - outfitW - snackW);
  const gutter = extra / 2;
  const boxes = [
    { cut: cols[0].cut, s: cols[0].s, lines: flowerLines, x: innerL },
    { cut: cols[1].cut, s: cols[1].s, lines: [cols[1].label], x: innerL + flowerW + gutter },
    { cut: cols[2].cut, s: cols[2].s, lines: [cols[2].label], x: innerL + flowerW + gutter + outfitW + gutter },
  ];
  const innerTop = TAG_LINE_1 + LINE_STROKE / 2;
  const innerBot = TAG_LINE_2 - LINE_STROKE / 2;
  const midY = (innerTop + innerBot) / 2;
  const tagLh = Math.min(LINE_H, (innerBot - innerTop) / Math.max(flowerLines.length, 1));
  ctx.fillStyle = MINT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  boxes.forEach((box) => {
    drawIcon(ctx, box.cut, box.x, midY - box.s / 2, box.s);
    const textX = box.x + box.s + iconGap;
    const top = midY - ((box.lines.length - 1) * tagLh) / 2;
    setFont(ctx);
    box.lines.forEach((line, j) => ctx.fillText(line, textX, top + j * tagLh));
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const today = wrapText(ctx, copy.today, X(3000));
  const body = wrapText(ctx, copy.body, X(3000));
  const quote = wrapText(ctx, `“${copy.question}”`, X(2800));
  let ty = BODY_TOP;
  ctx.fillStyle = MINT;
  setFont(ctx);
  today.forEach((line) => {
    ctx.fillText(line, X(2039.5), ty);
    ty += LINE_H;
  });
  body.forEach((line) => {
    ctx.fillText(line, X(2039.5), ty);
    ty += LINE_H;
  });
  ty += QUOTE_GAP;
  ctx.fillStyle = PINK;
  quote.forEach((line) => {
    ctx.fillText(line, X(2060), ty);
    ty += LINE_H;
  });
}

export async function drawCard(picks, lang = "ko") {
  await document.fonts.load('700 44px "Galmuri11"', "데이지");
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  const flower = FLOWERS[picks.flower] ?? FLOWERS[0];
  const base = await loadImage(flower.front || flower.card);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, CARD_W, CARD_H);
  ctx.imageSmoothingEnabled = true;
  await drawFinale(ctx, base, picks, lang);
  return canvas;
}
