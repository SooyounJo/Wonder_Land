import { useEffect, useRef, useState } from "react";
import { createTeaCards } from "@/lib/pad/teaCards";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 잔 순서와 같음: 캐모마일 · 자스민 · 라벤더
// 접시 왼쪽 천 위에 부채꼴로 겹쳐 놓임(사진 좌표, 뒤에서부터 자스민 · 라벤더 · 캐모마일)
const CARDS = [
  { name: "캐모마일", src: "/pad/card-chamomile.webp", x: 540, y: 530, rot: 6, layer: 2 },
  { name: "자스민", src: "/pad/card-jasmine.webp", x: 300, y: 615, rot: 24, layer: 0 },
  { name: "라벤더", src: "/pad/card-lavender.webp", x: 410, y: 572, rot: 15, layer: 1 },
];

// 카드를 집으면 본화면에 그 차의 특성이 뜨고(hover), 접시 위에 내려놓으면 선택(select)
export default function TeaScreen({ onHover, onSelect }) {
  const wrapRef = useRef(null);
  const handlers = useRef({ onHover, onSelect });
  handlers.current = { onHover, onSelect };
  const [active, setActive] = useState(-1);
  const [chosen, setChosen] = useState(-1);
  const [over, setOver] = useState(false);

  useEffect(
    () =>
      createTeaCards({
        container: wrapRef.current,
        cards: CARDS,
        onHover: (i) => {
          setActive(i);
          handlers.current.onHover(i);
        },
        onSelect: (i) => {
          setChosen(i);
          handlers.current.onSelect(i);
        },
        onOver: setOver,
      }),
    []
  );

  const hint =
    chosen >= 0
      ? `${CARDS[chosen].name} tea를 골랐어요`
      : over
        ? "여기에 놓으면 선택돼요"
        : active >= 0
          ? `${CARDS[active].name} — 접시 위에 올리면 선택돼요`
          : "카드를 집으면 화면에 차 설명이 나와요";

  return (
    <div className={cx(styles.screen, styles.tea)}>
      <div ref={wrapRef} className={styles.canvasWrap} />
      <p className={cx(styles.question, styles.teaQuestion)}>마시고 싶은 차 카드를 집어 접시에 올려주세요</p>
      <p className={styles.teaHint}>{hint}</p>
    </div>
  );
}
