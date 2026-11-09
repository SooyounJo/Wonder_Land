import { useEffect, useRef, useState } from "react";
import { createChairBottles } from "@/lib/pad/chairBottles";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 옷 순서와 같음: 왼쪽부터 정장 · 가디건 · 흰 옷
// x, y: 잔디 사진 위 병 바닥 가운데(사진 좌표 1024×572)
const BOTTLES = [
  { name: "정장", src: "/pad/bottle-suit.webp", x: 357, y: 445 },
  { name: "가디건", src: "/pad/bottle-cardigan.webp", x: 516, y: 445 },
  { name: "흰 옷", src: "/pad/bottle-white.webp", x: 685, y: 445 },
];

// 병을 집으면 본화면에 그 옷의 설명이 뜨고(hover), 가운데 흙자리에 놓으면 구덩이로 빠지며 선택(select)
export default function ChairScreen({ onHover, onSelect }) {
  const wrapRef = useRef(null);
  const handlers = useRef({ onHover, onSelect });
  handlers.current = { onHover, onSelect };
  const [active, setActive] = useState(-1);
  const [chosen, setChosen] = useState(-1);
  const [over, setOver] = useState(false);

  useEffect(
    () =>
      createChairBottles({
        container: wrapRef.current,
        bottles: BOTTLES,
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
      ? `${BOTTLES[chosen].name}을 골랐어요`
      : over
        ? "여기에 놓으면 선택돼요"
        : active >= 0
          ? `${BOTTLES[active].name} — 가운데 구덩이에 놓으면 선택돼요`
          : "병을 집으면 화면에 설명이 나와요";

  return (
    <div className={cx(styles.screen, styles.chairs)}>
      <div ref={wrapRef} className={styles.canvasWrap} />
      <p className={styles.question}>앉고 싶은 의자 병을 집어 가운데 구덩이에 놓아주세요</p>
      <p className={styles.teaHint}>{hint}</p>
    </div>
  );
}
