const BASE = "/growth-room";
const VIDEO = `${BASE}/video`;

export const ASSETS = {
  poster: `${BASE}/poster.webp`,
  snackImage: `${BASE}/snacks.webp`,
  bagMask: `${BASE}/masks/bag.png`,
  finale: `${BASE}/finale.webp`, // 마지막 꽃 장면 배경 (첫 화면 같은 들판, 가운데 작은 장미는 지움)
  video: {
    opening: `${VIDEO}/opening.mp4`, // 분홍 구름 길 (반복)
    intro: `${VIDEO}/intro.mp4`, // 분홍 구름 길 → 초록 벽 테이블
    table: `${VIDEO}/table.mp4`, // 씬 1: 테이블 위 세 잔 (반복)
    tableToRoom: `${VIDEO}/table-to-room.mp4`, // 차를 고른 뒤 방으로 줌아웃
    room: `${VIDEO}/room.mp4`, // 씬 2: 방 (반복)
    roomZoomOut: `${VIDEO}/room-zoom-out.mp4`, // 옷을 고른 뒤 자판기 쪽으로 줌아웃
    elevatorDown: `${VIDEO}/elevator-down.mp4`,
    elevatorUp: `${VIDEO}/elevator-up.mp4`,
    day: `${VIDEO}/day.mp4`, // 아침→뉘엿→저녁→밤 이어 붙임 (다이얼로 탐색)
    // 1 Cheerful · 2 Dreamy · 3 Brave / 4 Kind · 5 Free · 6 Lucky
    snacks: ["cheerful", "dreamy", "brave", "kind", "free", "lucky"].map(
      (name) => `${VIDEO}/snack-${name}.mp4`
    ),
    // 피어나는 방향으로 뒤집어 둔 블루 배경 꽃: 나팔꽃 · 데이지 · 장미 · 은방울꽃 · 연꽃 · 튤립
    flowers: ["morning-glory", "daisy", "rose", "lily-of-the-valley", "lotus", "tulip"].map(
      (name) => `${VIDEO}/flower-${name}.mp4`
    ),
  },
};
