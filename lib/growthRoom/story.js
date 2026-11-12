// 마지막 카드에 들어가는 이름·선택·댓가 문구. 순서는 화면(메인·아이패드)의 선택지 순서와 같음
// cost(댓가) 중 과자·시간대 문구는 초안 — 자유롭게 고쳐도 됨

// 꽃 (engine.js의 FLOWERS 순서). object: "무의식 속에서 ~을/를 키워내셨군요"에 쓰는 조사 포함 이름
export const FLOWERS = [
  {
    name: "나팔꽃",
    en: "Morning glory",
    phrase: "a morning glory",
    object: "나팔꽃을",
    card: "/growth-room/cards/face-morning-glory.png",
    front: "/growth-room/cards/front-morning-glory.png",
    letter: "M",
    meaning: "기쁜 소식",
    meaningEn: "Glad tidings",
    today: "오늘 당신 안에서 나팔꽃이 피었어요.",
    todayEn: "Today a morning glory bloomed in you.",
    body: "기다려온 소식은 어쩌면, 당신이 스스로 고른 것들 사이에서 이미 오고 있어요.",
    bodyEn: "The news you waited for may already be arriving among the things you chose yourself.",
    question: "지금 당신이 기다리는 것은, 정말 당신이 바라는 것인가요?",
    questionEn: "What you wait for now — is it really what you wish for?",
  },
  {
    name: "데이지",
    en: "Daisy",
    phrase: "a daisy",
    object: "데이지를",
    card: "/growth-room/cards/face-daisy.png",
    front: "/growth-room/cards/front-daisy.png",
    letter: "D",
    meaning: "희망",
    meaningEn: "Hope",
    today: "오늘 당신 안에서 데이지가 피었어요.",
    todayEn: "Today a daisy bloomed in you.",
    body: "누군가의 바람으로 시작된 길이었어도, 다시 피어난 건 당신이에요.",
    bodyEn: "Even if the path began as someone else's wish, what bloomed again is you.",
    question: "최근 당신이 오롯이 당신을 위해 고른 것은 무엇이었나요?",
    questionEn: "Among recent choices, what did you pick purely for yourself?",
  },
  {
    name: "장미",
    en: "Rose",
    phrase: "a rose",
    object: "장미를",
    card: "/growth-room/cards/face-rose.png",
    front: "/growth-room/cards/front-rose.png",
    letter: "R",
    meaning: "사랑",
    meaningEn: "Love",
    today: "오늘 당신 안에서 장미가 피었어요.",
    todayEn: "Today a rose bloomed in you.",
    body: "누군가를 위해 내려온 선택들 속에도, 당신을 아끼는 마음은 자라고 있었어요.",
    bodyEn: "Even in choices made for someone else, care for yourself was growing.",
    question: "그 많은 선택 중에, 당신의 몫은 얼마나 있었나요?",
    questionEn: "Among all those choices, how much was yours?",
  },
  {
    name: "은방울꽃",
    en: "Lily of the valley",
    phrase: "a lily of the valley",
    object: "은방울꽃을",
    card: "/growth-room/cards/face-lily-of-the-valley.png",
    front: "/growth-room/cards/front-lily-of-the-valley.png",
    letter: "V",
    meaning: "명확한 행복",
    meaningEn: "Clear happiness",
    today: "오늘 당신 안에서 은방울꽃이 피었어요.",
    todayEn: "Today a lily of the valley bloomed in you.",
    body: "행복이라 믿고 지나온 선택들이, 당신을 여기까지 데려왔어요.",
    bodyEn: "The choices you trusted as happiness brought you here.",
    question: "그 행복은 누구의 기준으로\n정한 것이었나요?",
    questionEn: "By whose measure\nwas that happiness decided?",
  },
  {
    name: "연꽃",
    en: "Lotus",
    phrase: "a lotus",
    object: "연꽃을",
    card: "/growth-room/cards/face-lotus.png",
    front: "/growth-room/cards/front-lotus.png",
    letter: "L",
    meaning: "청결",
    meaningEn: "Purity",
    today: "오늘 당신 안에서 연꽃이 피었어요.",
    todayEn: "Today a lotus bloomed in you.",
    body: "떠밀리듯 지나온 순간에도, 당신은 당신의 색을 잃지 않았어요.",
    bodyEn: "Even through moments that pushed you along, you did not lose your color.",
    question: "흔들리는 중에도 끝까지 지키고 싶은 당신의 선택은 무엇인가요?",
    questionEn: "Even while swaying, what choice do you still want to keep?",
  },
  {
    name: "튤립",
    en: "Tulip",
    phrase: "a tulip",
    object: "튤립을",
    card: "/growth-room/cards/face-tulip.png",
    front: "/growth-room/cards/front-tulip.png",
    letter: "T",
    meaning: "애정",
    meaningEn: "Affection",
    today: "오늘 당신 안에서 튤립이 피었어요.",
    todayEn: "Today a tulip bloomed in you.",
    body: "곁의 사람을 생각하며 고른 길이, 당신을 다정한 사람으로 키워왔어요.",
    bodyEn: "The path chosen with someone beside you grew you into someone tender.",
    question: "그 다정함 안에, 당신 자신도 함께 있었나요?",
    questionEn: "Inside that tenderness, were you there too?",
  },
];

// 오른쪽 HEIGHT 기록. 첫 차=항상 커짐, 이후 옷·과자·시간은 커지거나 줄어듦. 절대 키는 1 미만으로 안 내려감
export const BASE_HEIGHT = 165;
export const MIN_HEIGHT = 1;
export const TEA_HEIGHT = [201, 177, 189];
export const OUTFIT_HEIGHT = [44, 39, 35];
export const SNACK_DELTA = [36, -24, 24, -12, 18, -36];
export const TIME_DELTA = [36, -18, 24, -36];

function clampHeight(h) {
  return Math.max(MIN_HEIGHT, Math.round(h));
}

export function heightReadings(picks) {
  const lines = [];
  const push = (h) => lines.push(clampHeight(h));
  if (picks?.tea >= 0 && TEA_HEIGHT[picks.tea] != null) push(TEA_HEIGHT[picks.tea]);
  if (picks?.outfit >= 0 && OUTFIT_HEIGHT[picks.outfit] != null) push(OUTFIT_HEIGHT[picks.outfit]);
  const addDelta = (table, i) => {
    if (i >= 0 && table[i] != null) {
      const prev = lines.length ? lines[lines.length - 1] : BASE_HEIGHT;
      push(prev + table[i]);
    }
  };
  addDelta(SNACK_DELTA, picks?.snack);
  addDelta(TIME_DELTA, picks?.time);
  return lines;
}

export function formatHeightDelta(n) {
  if (!n) return "0";
  return `${n > 0 ? "+" : ""}${n}`;
}

export function heightDeltas(picks) {
  const deltas = [];
  let prev = BASE_HEIGHT;
  heightReadings(picks).forEach((h) => {
    deltas.push(h - prev);
    prev = h;
  });
  return deltas;
}

export function measuredHeight(picks) {
  const log = heightReadings(picks);
  return log.length ? log[log.length - 1] : null;
}

export const TEAS = [
  { name: "캐모마일", en: "Chamomile", cost: "이 순간을 위해 역경을 버티다", costEn: "Held on, for this moment", result: "버티는 사람이 되었다", resultEn: "You became someone who holds on" },
  { name: "자스민", en: "Jasmine", cost: "쓴 웃음을 삼키고 오늘도 웃는다", costEn: "Smiled through a bitter laugh", result: "웃음을 삼키는 사람이 되었다", resultEn: "You became someone who swallows the laugh" },
  { name: "라벤더", en: "Lavender", cost: "기대에 호응 하기 위해 노력하다", costEn: "Tried to meet what was hoped", result: "기대에 맞추는 사람이 되었다", resultEn: "You became someone who meets the hope" },
];

export const OUTFITS = [
  { name: "정장", en: "Suit", cost: "번듯하고 깐깐한척", costEn: "Proper, a little stern", result: "깐깐한 사람이 되었다", resultEn: "You became someone a little stern" },
  { name: "가디건", en: "Cardigan", cost: "반듯하고 깨끗한척", costEn: "Neat, a little spotless", result: "반듯한 사람이 되었다", resultEn: "You became someone who stays neat" },
  { name: "흰 옷", en: "White outfit", cost: "조용히 모르는척", costEn: "Quietly looking away", result: "모르는 척하는 사람이 되었다", resultEn: "You became someone who looks away" },
];

export const SNACKS = [
  { name: "Cheerful", en: "Cheerful", cost: "웃지 않는 날을 잃다", costEn: "Lost the days without a smile", result: "늘 웃어야 하는 사람이 되었다", resultEn: "You became someone who must keep smiling" },
  { name: "Dreamy", en: "Dreamy", cost: "발 딛은 오늘을 놓치다", costEn: "Missed the day underfoot", result: "오늘을 놓치는 사람이 되었다", resultEn: "You became someone who misses today" },
  { name: "Brave", en: "Brave", cost: "겁낼 시간을 빼앗기다", costEn: "Lost the time to be afraid", result: "겁낼 틈 없는 사람이 되었다", resultEn: "You became someone with no room to fear" },
  { name: "Kind", en: "Kind", cost: "거절하는 법을 잊다", costEn: "Forgot how to refuse", result: "거절하지 못하는 사람이 되었다", resultEn: "You became someone who cannot refuse" },
  { name: "Free", en: "Free", cost: "기댈 곳을 내려놓다", costEn: "Set down a place to lean", result: "기댈 곳 없는 사람이 되었다", resultEn: "You became someone with nowhere to lean" },
  { name: "Lucky", en: "Lucky", cost: "노력의 이유를 잃다", costEn: "Lost a reason to try", result: "노력의 이유를 잃은 사람이 되었다", resultEn: "You became someone who lost a reason to try" },
];

// 다이얼 시간대 (dial.js의 DIAL_LABELS 순서)
export const TIMES = [
  { name: "아침", en: "Morning", cost: "오지 않은 하루를 미리 짊어지다", costEn: "Carried a day not yet here", result: "오지 않은 하루를 짊어진 사람이 되었다", resultEn: "You became someone carrying a day not yet here" },
  { name: "뉘엿", en: "Dusk", cost: "저무는 하루에 마음을 두고 오다", costEn: "Left your heart in the fading day", result: "저무는 하루에 마음을 둔 사람이 되었다", resultEn: "You became someone who left a heart in the dusk" },
  { name: "저녁", en: "Evening", cost: "돌아갈 곳을 찾느라 지치다", costEn: "Tired from looking for home", result: "돌아갈 곳을 찾는 사람이 되었다", resultEn: "You became someone looking for a way home" },
  { name: "밤", en: "Night", cost: "잠들지 못한 생각을 안고 가다", costEn: "Carried thoughts that stayed up", result: "잠들지 못한 사람이 되었다", resultEn: "You became someone who could not sleep" },
];

export function localized(item, lang) {
  if (!item) return { name: "—", cost: "", result: "" };
  if (lang === "en") return { name: item.en || item.name, cost: item.costEn || item.cost, result: item.resultEn || item.result || "" };
  return { name: item.name, cost: item.cost, result: item.result || "" };
}

export const finaleLine = (flowerIdx, lang = "ko") => {
  const flower = FLOWERS[flowerIdx];
  if (lang === "en") {
    return [`From the unconscious, ${flower?.phrase ?? "a flower"}.`, "What did those choices make of you?"];
  }
  return [`무의식 속에서 ${flower?.object ?? "꽃을"} 키워내셨군요,`, "그 선택들은 어떤 당신의 모습을 만들어냈을까요?"];
};
