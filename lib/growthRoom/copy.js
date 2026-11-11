import { finaleLine } from "./story";

// 패드에서 고른 언어. 바닥 문구와 패드 안내가 같이 바뀐다
export function floorPack(lang) {
  if (lang === "en") {
    return {
      intro: ["Follow where your thoughts lead"],
      teaDefault: ["Which tea on the table", "would you like?"],
      teas: [
        ["Chamomile", "Held on, for this moment"],
        ["Jasmine", "Smiled through a bitter laugh"],
        ["Lavender", "Tried to meet what was hoped"],
      ],
      room: ["Which seat will you take?"],
      outfits: [
        ["Proper, a little stern"],
        ["Neat, a little spotless"],
        ["Quietly looking away"],
      ],
      dial: ["Tune the radio and pick a space"],
    };
  }
  return {
    intro: ["의식의 흐름대로 탐험해보세요"],
    teaDefault: ["테이블 위에 놓인 tea 중", "어떤 것을 드시겠습니까?"],
    teas: [
      ["'캐모마일'", "이 순간을 위해 역경을 버티다"],
      ["'자스민'", "쓴 웃음을 삼키고 오늘도 웃는다"],
      ["'라벤더'", "기대에 호응 하기 위해 노력하다"],
    ],
    room: ["어떤 자리에 앉으시겠어요?"],
    outfits: [["번듯하고 깐깐한척"], ["반듯하고 깨끗한척"], ["조용히 모르는척"]],
    dial: ["라디오 주파수를 맞춰 공간을 골라보세요"],
  };
}

export function allFloorLines() {
  const lines = [];
  for (const lang of ["ko", "en"]) {
    const pack = floorPack(lang);
    lines.push(...pack.intro, ...pack.teaDefault, ...pack.teas.flat(), ...pack.room, ...pack.outfits.flat(), ...pack.dial);
    for (let i = 0; i < 6; i += 1) lines.push(...finaleLine(i, lang));
  }
  return lines;
}

export function padText(lang) {
  const en = lang === "en";
  return {
    start: en ? "Touch to begin" : "터치하여 시작",
    connecting: en ? "Connecting" : "연결 중",
    waitingMain: en ? "Waiting for the main screen" : "메인 화면을 기다리는 중",
    look: en ? "Look at the screen" : "화면을 바라보세요",
    blooming: en ? "A flower is blooming" : "꽃이 피어나고 있어요",
    back: en ? "← Start over" : "← 처음으로",
    teaQ: en ? "Pick up a tea card and place it on the saucer" : "마시고 싶은 차 카드를 집어 접시에 올려주세요",
    teaOver: en ? "Place it here to choose" : "여기에 놓으면 선택돼요",
    teaIdle: en ? "Pick up a card to see it on the screen" : "카드를 집으면 화면에 차 설명이 나와요",
    teaChose: (name) => (en ? `You chose ${name}` : `${name} tea를 골랐어요`),
    teaHold: (name) => (en ? `${name} — place it on the saucer to choose` : `${name} — 접시 위에 올리면 선택돼요`),
    chairQ: en ? "Pick up a chair bottle and bring it near the hollow" : "앉고 싶은 의자 병을 집어 구덩이 가까이 가져가 주세요",
    chairOver: en ? "Close enough — it will drop in" : "이 정도면 빠져요",
    chairIdle: en ? "Pick up a bottle to see it on the screen" : "병을 집으면 화면에 설명이 나와요",
    chairChose: (name) => (en ? `You chose ${name}` : `${name}을 골랐어요`),
    chairHold: (name) => (en ? `${name} — bring it near the hollow` : `${name} — 구덩이 가까이 가져가면 빠져요`),
    snackQ: en ? "Choose a snack you'd like" : "먹고 싶은 과자를 선택해보세요",
    radioQ: en ? "Slide to a frequency, then press Go" : "슬라이더를 밀어 원하는 주파수에서 Go를 눌러주세요",
    cardWait: en ? "Preparing your card" : "저장 링크를 만드는 중",
    cardSave: en ? "Scan with your phone\nto save the card" : "휴대폰으로 찍어\n카드를 저장하세요",
    cardFail: en ? "Couldn't make a save link" : "저장 링크를 만들지 못했어요",
    cardLabel: en ? "Growth card" : "성장 카드",
    cardQr: en ? "QR code to save the card" : "카드 저장 QR",
    row: en ? ["Tea", "Seat", "Snack", "Time"] : ["차", "자리", "과자", "시간"],
    saveTitle: en ? "Growth Measurement Room card" : "성장 측정실 카드",
    savePng: en ? "Save PNG" : "PNG로 저장",
    saveJpg: en ? "Save JPG" : "JPG로 저장",
    saveHint: en ? "If the button doesn't save it, press and hold the card." : "버튼으로 받아지지 않으면 카드를 길게 눌러 사진에 저장하세요.",
    saveLoading: en ? "Loading the card" : "카드를 불러오는 중",
    saveGone: en
      ? "This card was only kept for a little while, so it can't be opened now. Please issue it again from the pad."
      : "이 카드는 잠시만 보관되어 있어서 지금은 받을 수 없어요. 패드에서 카드를 다시 발급해 주세요.",
  };
}
