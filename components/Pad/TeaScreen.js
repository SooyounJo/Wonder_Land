import { useEffect, useRef, useState } from "react";
import { createTeaCards } from "@/lib/pad/teaCards";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 잔 순서와 같음: 캐모마일 · 자스민 · 라벤더. 접시 왼쪽 천 위에 부채꼴로 놓임(사진 좌표)
const CARDS = [
  { name: "캐모마일", src: "/pad/card-chamomile.webp", x: 230, y: 388, rot: 8 },
  { name: "자스민", src: "/pad/card-jasmine.webp", x: 323, y: 366, rot: -1 },
  { name: "라벤더", src: "/pad/card-lavender.webp", x: 416, y: 390, rot: -9 },
];

// 카드를 누르면 본화면에 그 차의 특성이 뜨고(hover), 집어서 접시 위에 내려놓으면 선택(select)
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
          ? `${CARDS[active].name} — 카드를 집어 접시 위에 올려주세요`
          : "카드를 눌러 살펴보세요";

  return (
    <div className={cx(styles.screen, styles.tea)}>
      <div ref={wrapRef} className={styles.canvasWrap} />
      <p className={cx(styles.question, styles.teaQuestion)}>마시고 싶은 tea는 무엇인가요?</p>
      <p className={styles.teaHint}>{hint}</p>
    </div>
  );
}
