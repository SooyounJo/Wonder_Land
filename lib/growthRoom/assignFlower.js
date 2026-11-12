// 꽃은 랜덤이 아니라, 앞선 선택(차·옷·과자·시간)이 가리키는 쪽으로 고른다.
// 과자 6종이 꽃 6종과 하나씩 맞물려 골고루 나가고, 시간대는 그 안에서 기울기만 준다.
// 이미 준 꽃은 한 바퀴 돌 때까지 빼 둔다.
// 인덱스: 0 나팔꽃, 1 데이지, 2 장미, 3 은방울꽃, 4 연꽃, 5 튤립

export const FLOWER_COUNT = 6;
const STORE = "elle-assigned-flowers";

// 아침=나팔꽃·데이지, 뉘엿=튤립·데이지, 저녁=장미·은방울꽃, 밤=연꽃·은방울꽃
const TIME = [
  [2, 2, 0, 0, 0, 0],
  [0, 2, 0, 0, 0, 2],
  [0, 0, 2, 2, 0, 0],
  [0, 0, 0, 2, 2, 0],
];

// 캐모마일=버티며 기다림, 자스민=삼키고 웃음, 라벤더=기대에 맞춤
const TEA = [
  [2, 0, 0, 2, 0, 0],
  [0, 0, 2, 0, 0, 2],
  [0, 2, 0, 0, 2, 0],
];

// 정장=기준, 가디건=단정, 흰 옷=모른 척 속의 마음
const OUTFIT = [
  [0, 0, 1, 2, 1, 0],
  [0, 2, 0, 0, 2, 0],
  [2, 0, 0, 0, 0, 2],
];

// 과자 하나당 꽃 하나. Cheerful=튤립, Dreamy=데이지, Brave=장미, Kind=은방울꽃, Free=연꽃, Lucky=나팔꽃
const SNACK = [
  [0, 0, 0, 0, 0, 4],
  [0, 4, 0, 0, 0, 0],
  [0, 0, 4, 0, 0, 0],
  [0, 0, 0, 4, 0, 0],
  [0, 0, 0, 0, 4, 0],
  [4, 0, 0, 0, 0, 0],
];

const W_SNACK = 5;
const W_TIME = 2;
const W_TEA = 2;
const W_OUTFIT = 1;

let memory = null;

function add(scores, row, weight) {
  if (!row) return;
  for (let i = 0; i < FLOWER_COUNT; i += 1) scores[i] += (row[i] || 0) * weight;
}

export function flowerScores(picks) {
  const scores = [0, 0, 0, 0, 0, 0];
  add(scores, TEA[picks?.tea], W_TEA);
  add(scores, OUTFIT[picks?.outfit], W_OUTFIT);
  add(scores, SNACK[picks?.snack], W_SNACK);
  add(scores, TIME[picks?.time], W_TIME);
  return scores;
}

export function readAssigned() {
  if (memory) return memory.slice();
  if (typeof localStorage === "undefined") {
    memory = [];
    return [];
  }
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "[]");
    memory = Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n) && n >= 0 && n < FLOWER_COUNT) : [];
  } catch {
    memory = [];
  }
  return memory.slice();
}

export function rememberAssigned(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= FLOWER_COUNT) return readAssigned();
  const used = readAssigned();
  if (!used.includes(idx)) used.push(idx);
  memory = used.length >= FLOWER_COUNT ? [] : used;
  try {
    localStorage.setItem(STORE, JSON.stringify(memory));
  } catch {
    /* 저장 못 해도 이번 브라우저 세션 기억은 유지 */
  }
  return memory.slice();
}

export function chooseFlower(picks, used = readAssigned()) {
  const taken = new Set(used);
  let pool = [];
  for (let i = 0; i < FLOWER_COUNT; i += 1) if (!taken.has(i)) pool.push(i);
  if (!pool.length) pool = [0, 1, 2, 3, 4, 5];
  const scores = flowerScores(picks);
  const timeRow = TIME[picks?.time];
  let best = pool[0];
  for (const i of pool) {
    if (scores[i] > scores[best]) {
      best = i;
      continue;
    }
    if (scores[i] < scores[best]) continue;
    const ti = timeRow ? timeRow[i] : 0;
    const tb = timeRow ? timeRow[best] : 0;
    if (ti > tb || (ti === tb && i < best)) best = i;
  }
  return best;
}
