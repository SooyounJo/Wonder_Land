// 마지막 카드에 들어가는 이름·선택·댓가 문구. 순서는 화면(메인·아이패드)의 선택지 순서와 같음
// cost(댓가) 중 과자·시간대 문구는 초안 — 자유롭게 고쳐도 됨

// 꽃 (engine.js의 FLOWERS 순서). object: "무의식 속에서 ~을/를 키워내셨군요"에 쓰는 조사 포함 이름
export const FLOWERS = [
  { name: "나팔꽃", en: "Morning glory", phrase: "a morning glory", object: "나팔꽃을", card: "/growth-room/cards/face-morning-glory.png", front: "/growth-room/cards/front-morning-glory.png", letter: "H" },
  { name: "데이지", en: "Daisy", phrase: "a daisy", object: "데이지를", card: "/growth-room/cards/face-daisy.png", front: "/growth-room/cards/front-daisy.png", letter: "D" },
  { name: "장미", en: "Rose", phrase: "a rose", object: "장미를", card: "/growth-room/cards/face-rose.png", front: "/growth-room/cards/front-rose.png", letter: "R" },
  { name: "은방울꽃", en: "Lily of the valley", phrase: "a lily of the valley", object: "은방울꽃을", card: "/growth-room/cards/face-lily-of-the-valley.png", front: "/growth-room/cards/front-lily-of-the-valley.png", letter: "V" },
  { name: "연꽃", en: "Lotus", phrase: "a lotus", object: "연꽃을", card: "/growth-room/cards/face-lotus.png", front: "/growth-room/cards/front-lotus.png", letter: "L" },
  { name: "튤립", en: "Tulip", phrase: "a tulip", object: "튤립을", card: "/growth-room/cards/face-tulip.png", front: "/growth-room/cards/front-tulip.png", letter: "T" },
];

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
