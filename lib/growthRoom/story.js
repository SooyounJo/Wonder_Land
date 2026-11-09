// 마지막 카드에 들어가는 이름·선택·댓가 문구. 순서는 화면(메인·아이패드)의 선택지 순서와 같음
// cost(댓가) 중 과자·시간대 문구는 초안 — 자유롭게 고쳐도 됨

// 꽃 (engine.js의 FLOWERS 순서). object: "무의식 속에서 ~을/를 키워내셨군요"에 쓰는 조사 포함 이름
export const FLOWERS = [
  { name: "나팔꽃", object: "나팔꽃을", card: "/growth-room/cards/morning-glory.webp" },
  { name: "데이지", object: "데이지를", card: "/growth-room/cards/daisy.webp" },
  { name: "장미", object: "장미를", card: "/growth-room/cards/rose.webp" },
  { name: "은방울꽃", object: "은방울꽃을", card: "/growth-room/cards/lily-of-the-valley.webp" },
  { name: "연꽃", object: "연꽃을", card: "/growth-room/cards/lotus.webp" },
  { name: "튤립", object: "튤립을", card: "/growth-room/cards/tulip.webp" },
];

export const TEAS = [
  { name: "캐모마일", cost: "이 순간을 위해 역경을 버티다" },
  { name: "자스민", cost: "쓴 웃음을 삼키고 오늘도 웃는다" },
  { name: "라벤더", cost: "기대에 호응 하기 위해 노력하다" },
];

export const OUTFITS = [
  { name: "정장", cost: "번듯하고 깐깐한척" },
  { name: "가디건", cost: "반듯하고 깨끗한척" },
  { name: "흰 옷", cost: "조용히 모르는척" },
];

export const SNACKS = [
  { name: "Cheerful", cost: "웃지 않는 날을 잃다" },
  { name: "Dreamy", cost: "발 딛은 오늘을 놓치다" },
  { name: "Brave", cost: "겁낼 시간을 빼앗기다" },
  { name: "Kind", cost: "거절하는 법을 잊다" },
  { name: "Free", cost: "기댈 곳을 내려놓다" },
  { name: "Lucky", cost: "노력의 이유를 잃다" },
];

// 다이얼 시간대 (dial.js의 DIAL_LABELS 순서)
export const TIMES = [
  { name: "아침", cost: "오지 않은 하루를 미리 짊어지다" },
  { name: "뉘엿", cost: "저무는 하루에 마음을 두고 오다" },
  { name: "저녁", cost: "돌아갈 곳을 찾느라 지치다" },
  { name: "밤", cost: "잠들지 못한 생각을 안고 가다" },
];

export const finaleLine = (flowerIdx) => [
  `무의식 속에서 ${FLOWERS[flowerIdx]?.object ?? "꽃을"} 키워내셨군요,`,
  "그 선택들은 어떤 당신의 모습을 만들어냈을까요?",
];
