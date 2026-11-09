import { randomBytes } from "crypto";

// 발급된 카드 그림은 메모리에만 잠깐 둔다. 서버가 켜져 있는 동안, 받은 뒤 30분
const TTL = 30 * 60 * 1000;
const g = globalThis;
if (!g.__elleCards) g.__elleCards = new Map();

function sweep(now) {
  for (const [id, item] of g.__elleCards) {
    if (item.exp <= now) g.__elleCards.delete(id);
  }
}

export function saveCard(png, filename) {
  const now = Date.now();
  sweep(now);
  let id = randomBytes(4).toString("hex");
  while (g.__elleCards.has(id)) id = `${id}x`;
  g.__elleCards.set(id, { png, filename, exp: now + TTL });
  return id;
}

export function readCard(id) {
  const now = Date.now();
  sweep(now);
  const item = g.__elleCards.get(id);
  if (!item || item.exp <= now) return null;
  return item;
}
