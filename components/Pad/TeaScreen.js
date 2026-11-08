import { useRef, useState } from "react";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 잔 순서와 같음: 왼쪽부터 캐모마일 · 자스민 · 라벤더
// x·y·h는 테이블 사진 기준 비율(가로·세로·높이). 접시 왼쪽 빈 천 위에 놓임
const FLOWERS = [
  { name: "캐모마일", src: "/pad/chamomile.webp", x: 0.165, y: 0.36, h: 0.3, tilt: -6 },
  { name: "자스민", src: "/pad/jasmine.webp", x: 0.225, y: 0.7, h: 0.29, tilt: 4 },
  { name: "라벤더", src: "/pad/lavender.webp", x: 0.315, y: 0.4, h: 0.32, tilt: -3 },
];
// 사진 속 접시: 중심과 반지름(가로 비율)
const PLATE = { x: 0.5, y: 0.472, r: 0.122 };

// 꽃을 누르면 본화면에 그 차의 특성이 뜨고(hover), 접시 위로 끌어다 놓으면 선택(select)
export default function TeaScreen({ onHover, onSelect }) {
  const sceneRef = useRef(null);
  const drag = useRef(null);
  const [active, setActive] = useState(-1);
  const [dragging, setDragging] = useState(-1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [chosen, setChosen] = useState(-1);
  const [onPlate, setOnPlate] = useState(false);

  const plateOffset = (i) => {
    const r = sceneRef.current.getBoundingClientRect();
    return { x: (PLATE.x - FLOWERS[i].x) * r.width, y: (PLATE.y - FLOWERS[i].y) * r.height };
  };
  const overPlate = (e) => {
    const r = sceneRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + PLATE.x * r.width);
    const dy = e.clientY - (r.top + PLATE.y * r.height);
    return Math.hypot(dx, dy) < PLATE.r * r.width * 1.15;
  };

  const down = (i) => (e) => {
    if (chosen >= 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    drag.current = { i, x0: e.clientX, y0: e.clientY };
    setDragging(i);
    setOffset({ x: 0, y: 0 });
    if (active !== i) {
      setActive(i);
      onHover(i);
    }
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: e.clientX - d.x0, y: e.clientY - d.y0 });
    setOnPlate(overPlate(e));
  };
  const up = (e) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(-1);
    setOnPlate(false);
    if (e.type === "pointerup" && overPlate(e)) {
      setChosen(d.i);
      setOffset(plateOffset(d.i));
      onSelect(d.i);
    } else setOffset({ x: 0, y: 0 });
  };

  return (
    <div className={cx(styles.screen, styles.tea)}>
      <div ref={sceneRef} className={styles.teaTable}>
        <div className={cx(styles.plateGlow, onPlate && styles.plateGlowOn)} style={{ left: `${PLATE.x * 100}%`, top: `${PLATE.y * 100}%`, width: `${PLATE.r * 200}%` }} />
        {FLOWERS.map((f, i) => {
          const moving = dragging === i || chosen === i;
          const o = moving ? offset : { x: 0, y: 0 };
          const lift = dragging === i ? 1.08 : chosen === i ? 1.12 : active === i ? 1.05 : 1;
          const tilt = chosen === i ? -18 : f.tilt;
          return (
            <div
              key={f.name}
              className={cx(
                styles.teaFlower,
                dragging === i && styles.teaDragging,
                active === i && styles.teaActive,
                chosen >= 0 && chosen !== i && styles.faded
              )}
              style={{
                left: `${f.x * 100}%`,
                top: `${f.y * 100}%`,
                height: `${f.h * 100}%`,
                transform: `translate(-50%, -50%) translate(${o.x}px, ${o.y}px) rotate(${tilt}deg) scale(${lift})`,
                zIndex: moving ? 3 : 2,
              }}
              onPointerDown={down(i)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              <img src={f.src} alt={f.name} draggable={false} />
              {chosen !== i && <span className={styles.teaName}>{f.name}</span>}
            </div>
          );
        })}
      </div>
      <p className={cx(styles.question, styles.teaQuestion)}>마시고 싶은 tea는 무엇인가요?</p>
      <p className={styles.teaHint}>{chosen >= 0 ? `${FLOWERS[chosen].name} tea를 골랐어요` : active >= 0 ? "접시 위로 옮겨 놓으면 선택돼요" : "꽃을 눌러 살펴보세요"}</p>
    </div>
  );
}
