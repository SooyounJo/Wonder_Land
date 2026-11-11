// 마지막에 발급되는 카드 그림. 화면과 저장 파일이 같은 캔버스를 씀
import { padText } from "../growthRoom/copy";
import { FLOWERS, localized, OUTFITS, SNACKS, TEAS, TIMES } from "../growthRoom/story";

export const CARD_W = 1000;
export const CARD_H = 1400;

const INK = "#2a2622";
const CLOTH = "#e4d9c8";
const LEAF = "#5c7a3c";
const PETAL = "#f6f3ec";
const GOLD = "#d4a23f";
const SPARK = "#c6de62";
const SPARK_L = "#f3ffc2";
const COST = "#6f5644";

const ROW_LISTS = [TEAS, OUTFITS, SNACKS, TIMES];
const ROW_KEYS = ["tea", "outfit", "snack", "time"];

// 모서리 숫자. 십자수 한 땀
const GLYPH = {
  0: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "00100", "00100", "00100"],
};

const DAISY = [
  "....w....",
  "..wwwww..",
  ".wwwwwww.",
  "www.y.www",
  ".wwyyyyw.",
  "www.y.www",
  ".wwwwwww.",
  "..wwwww..",
  "....g....",
  "...ggg...",
  "..gg.gg..",
];

const SPARKLE = [
  "....l....",
  "....s....",
  "....s....",
  ".s..l..s.",
  "lsss.sssl",
  ".s..l..s.",
  "....s....",
  "....s....",
  "....l....",
];

const STITCH = { w: PETAL, y: GOLD, g: LEAF, s: SPARK, l: SPARK_L };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintCloth(ctx) {
  ctx.fillStyle = CLOTH;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.42, 40, CARD_W / 2, CARD_H * 0.46, CARD_W * 0.72);
  glow.addColorStop(0, "rgba(255,252,245,0.45)");
  glow.addColorStop(1, "rgba(120,90,55,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let y = 0; y < CARD_H; y += 4) ctx.fillRect(0, y, CARD_W, 1);
  ctx.fillStyle = "rgba(90,70,45,0.045)";
  for (let x = 0; x < CARD_W; x += 4) ctx.fillRect(x, 0, 1, CARD_H);

  const rand = mulberry32(11);
  for (let i = 0; i < 3500; i += 1) {
    ctx.fillStyle = rand() > 0.55 ? "rgba(255,255,255,0.16)" : "rgba(70,50,30,0.07)";
    ctx.fillRect(rand() * CARD_W, rand() * CARD_H, 2, 2);
  }
}

function stitchBorder(ctx) {
  const x = 40;
  const y = 40;
  const w = CARD_W - 80;
  const h = CARD_H - 80;
  const r = 34;
  const step = 15;
  const size = 7;
  const pts = [];
  const pushEdge = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  const pushArc = (cx, cy, a0, a1) => {
    const len = r * Math.abs(a1 - a0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i += 1) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  pushEdge(x + r, y, x + w - r, y);
  pushArc(x + w - r, y + r, -Math.PI / 2, 0);
  pushEdge(x + w, y + r, x + w, y + h - r);
  pushArc(x + w - r, y + h - r, 0, Math.PI / 2);
  pushEdge(x + w - r, y + h, x + r, y + h);
  pushArc(x + r, y + h - r, Math.PI / 2, Math.PI);
  pushEdge(x, y + h - r, x, y + r);
  pushArc(x + r, y + r, Math.PI, Math.PI * 1.5);

  ctx.fillStyle = INK;
  for (const [px, py] of pts) ctx.fillRect(px - size / 2, py - size / 2, size, size);
}

function drawGlyph(ctx, rows, x, y, cell) {
  ctx.fillStyle = INK;
  rows.forEach((row, gy) => {
    [...row].forEach((bit, gx) => {
      if (bit === "1") ctx.fillRect(x + gx * cell, y + gy * cell, cell - 1.4, cell - 1.4);
    });
  });
}

function drawMotif(ctx, rows, x, y, cell) {
  rows.forEach((row, gy) => {
    [...row].forEach((ch, gx) => {
      const color = STITCH[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x + gx * cell, y + gy * cell, cell - 1.15, cell - 1.15);
    });
  });
}

function drawIndex(ctx, x, y) {
  const cell = 8;
  drawGlyph(ctx, GLYPH[0], x, y, cell);
  drawGlyph(ctx, GLYPH[7], x + cell * 6, y, cell);
  drawMotif(ctx, DAISY, x + 2, y + cell * 7 + 12, 4.4);
}

function drawIndices(ctx) {
  drawIndex(ctx, 86, 72);
  ctx.save();
  ctx.translate(CARD_W - 86, CARD_H - 72);
  ctx.rotate(Math.PI);
  drawIndex(ctx, 0, 0);
  ctx.restore();
  drawMotif(ctx, SPARKLE, 790, 118, 7);
  drawMotif(ctx, SPARKLE, 86, 560, 6.2);
}

function keyedFlower(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const corners = [0, (c.width - 1) * 4, (c.height - 1) * c.width * 4, d.length - 4];
  let br = 0;
  let bg = 0;
  let bb = 0;
  let opaque = 0;
  for (const i of corners) {
    br += d[i];
    bg += d[i + 1];
    bb += d[i + 2];
  }
  br /= 4;
  bg /= 4;
  bb /= 4;
  for (let i = 3; i < d.length; i += 16) if (d[i] > 250) opaque += 1;
  const solid = opaque > (d.length / 16) * 0.9;
  if (solid) {
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - br;
      const dg = d[i + 1] - bg;
      const db = d[i + 2] - bb;
      const dist = Math.hypot(dr, dg, db);
      const blueish = d[i + 2] > d[i] + 35 && d[i + 2] > d[i + 1] + 25 && d[i + 2] > 150;
      let a = 1;
      if (dist < 68 || (blueish && dist < 115)) a = 0;
      else if (dist < 118) a = (dist - 68) / 50;
      d[i + 3] = Math.round(d[i + 3] * a);
      if (a < 0.98) {
        const cap = Math.max(d[i], d[i + 1]);
        if (d[i + 2] > cap) d[i + 2] = cap;
      }
    }
    x.putImageData(im, 0, 0);
  }
  let minX = c.width;
  let minY = c.height;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  const out = solid ? x.getImageData(0, 0, c.width, c.height).data : d;
  for (let y = 0; y < c.height; y += 1) {
    for (let px = 0; px < c.width; px += 1) {
      if (out[(y * c.width + px) * 4 + 3] > 24) {
        any = true;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!any) return null;
  return { canvas: c, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function drawFlower(ctx, cut) {
  const box = { x: 170, y: 248, w: 660, h: 560 };
  const scale = Math.min(box.w / cut.w, box.h / cut.h);
  const dw = cut.w * scale;
  const dh = cut.h * scale;
  const dx = box.x + (box.w - dw) / 2;
  const dy = box.y + box.h - dh;
  ctx.save();
  ctx.fillStyle = "rgba(70,48,24,0.16)";
  ctx.filter = "blur(16px)";
  ctx.beginPath();
  ctx.ellipse(CARD_W / 2, dy + dh - 8, dw * 0.26, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(cut.canvas, cut.x, cut.y, cut.w, cut.h, dx, dy, dw, dh);
  return dy;
}

function drawCopy(ctx, picks, lang) {
  const flower = localized(FLOWERS[picks.flower] ?? FLOWERS[0], lang);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.font = '700 68px "Galmuri11", sans-serif';
  ctx.fillText(flower.name, CARD_W / 2, 868);

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.setLineDash([3, 8]);
  ctx.beginPath();
  ctx.moveTo(150, 924);
  ctx.lineTo(CARD_W - 150, 924);
  ctx.stroke();
  ctx.restore();

  const labels = padText(lang).row;
  labels.forEach((label, i) => {
    const item = localized(ROW_LISTS[i][picks[ROW_KEYS[i]]], lang);
    const y = 990 + i * 88;
    ctx.font = '700 24px "Galmuri11", sans-serif';
    const boxW = Math.max(92, ctx.measureText(label).width + 28);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(108, y - 20, boxW, 40, 7);
    ctx.fill();
    ctx.fillStyle = "#f4efe4";
    ctx.textAlign = "center";
    ctx.fillText(label, 108 + boxW / 2, y);

    const textX = 108 + boxW + 22;
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = '700 32px "Galmuri11", sans-serif';
    ctx.fillText(item.name, textX, y - 12);
    ctx.fillStyle = COST;
    ctx.font = '400 24px "Galmuri11", sans-serif';
    ctx.fillText(item.cost, textX, y + 24);
  });
}

export async function drawCard(picks, lang = "ko") {
  await Promise.all([
    document.fonts.load('700 68px "Galmuri11"', "나팔꽃"),
    document.fonts.load('400 24px "Galmuri11"', "기대에 호응"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintCloth(ctx);
  stitchBorder(ctx);
  drawIndices(ctx);
  const flower = FLOWERS[picks.flower] ?? FLOWERS[0];
  if (flower?.card) {
    try {
      const cut = keyedFlower(await loadImage(flower.card));
      if (cut) drawFlower(ctx, cut);
    } catch {
      /* 꽃 그림이 없으면 이름만 */
    }
  }
  drawCopy(ctx, picks, lang);
  return canvas;
}
