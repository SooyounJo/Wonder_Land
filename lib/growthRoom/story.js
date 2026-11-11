// 마지막 카드에 들어가는 이름·선택·댓가 문구. 순서는 화면(메인·아이패드)의 선택지 순서와 같음
// cost(댓가) 중 과자·시간대 문구는 초안 — 자유롭게 고쳐도 됨

// 꽃 (engine.js의 FLOWERS 순서). object: "무의식 속에서 ~을/를 키워내셨군요"에 쓰는 조사 포함 이름
export const FLOWERS = [
  { name: "나팔꽃", en: "Morning glory", phrase: "a morning glory", object: "나팔꽃을", card: "/growth-room/cards/morning-glory.webp" },
  { name: "데이지", en: "Daisy", phrase: "a daisy", object: "데이지를", card: "/growth-room/cards/daisy.webp" },
  { name: "장미", en: "Rose", phrase: "a rose", object: "장미를", card: "/growth-room/cards/rose.webp" },
  { name: "은방울꽃", en: "Lily of the valley", phrase: "a lily of the valley", object: "은방울꽃을", card: "/growth-room/cards/lily-of-the-valley.webp" },
  { name: "연꽃", en: "Lotus", phrase: "a lotus", object: "연꽃을", card: "/growth-room/cards/lotus.webp" },
  { name: "튤립", en: "Tulip", phrase: "a tulip", object: "튤립을", card: "/growth-room/cards/tulip.webp" },
];

export const TEAS = [
  { name: "캐모마일", en: "Chamomile", cost: "이 순간을 위해 역경을 버티다", costEn: "Held on, for this moment" },
  { name: "자스민", en: "Jasmine", cost: "쓴 웃음을 삼키고 오늘도 웃는다", costEn: "Smiled through a bitter laugh" },
  { name: "라벤더", en: "Lavender", cost: "기대에 호응 하기 위해 노력하다", costEn: "Tried to meet what was hoped" },
];

export const OUTFITS = [
  { name: "정장", en: "Suit", cost: "번듯하고 깐깐한척", costEn: "Proper, a little stern" },
  { name: "가디건", en: "Cardigan", cost: "반듯하고 깨끗한척", costEn: "Neat, a little spotless" },
  { name: "흰 옷", en: "White outfit", cost: "조용히 모르는척", costEn: "Quietly looking away" },
];

export const SNACKS = [
  { name: "Cheerful", en: "Cheerful", cost: "웃지 않는 날을 잃다", costEn: "Lost the days without a smile" },
  { name: "Dreamy", en: "Dreamy", cost: "발 딛은 오늘을 놓치다", costEn: "Missed the day underfoot" },
  { name: "Brave", en: "Brave", cost: "겁낼 시간을 빼앗기다", costEn: "Lost the time to be afraid" },
  { name: "Kind", en: "Kind", cost: "거절하는 법을 잊다", costEn: "Forgot how to refuse" },
  { name: "Free", en: "Free", cost: "기댈 곳을 내려놓다", costEn: "Set down a place to lean" },
  { name: "Lucky", en: "Lucky", cost: "노력의 이유를 잃다", costEn: "Lost a reason to try" },
];

// 다이얼 시간대 (dial.js의 DIAL_LABELS 순서)
export const TIMES = [
  { name: "아침", en: "Morning", cost: "오지 않은 하루를 미리 짊어지다", costEn: "Carried a day not yet here" },
  { name: "뉘엿", en: "Dusk", cost: "저무는 하루에 마음을 두고 오다", costEn: "Left your heart in the fading day" },
  { name: "저녁", en: "Evening", cost: "돌아갈 곳을 찾느라 지치다", costEn: "Tired from looking for home" },
  { name: "밤", en: "Night", cost: "잠들지 못한 생각을 안고 가다", costEn: "Carried thoughts that stayed up" },
];

export function localized(item, lang) {
  if (!item) return { name: "—", cost: "" };
  if (lang === "en") return { name: item.en || item.name, cost: item.costEn || item.cost };
  return { name: item.name, cost: item.cost };
}

export const finaleLine = (flowerIdx, lang = "ko") => {
  const flower = FLOWERS[flowerIdx];
  if (lang === "en") {
    return [`From the unconscious, ${flower?.phrase ?? "a flower"}.`, "What did those choices make of you?"];
  }
  return [`무의식 속에서 ${flower?.object ?? "꽃을"} 키워내셨군요,`, "그 선택들은 어떤 당신의 모습을 만들어냈을까요?"];
};
