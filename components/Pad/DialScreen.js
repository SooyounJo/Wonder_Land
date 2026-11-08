import { useEffect, useRef, useState } from "react";
import { DIAL_LABELS, DIAL_MAX, DIAL_MIN } from "@/lib/growthRoom/dial";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");
const lerp = (a, b, t) => a + (b - a) * t;
const STOPS = DIAL_LABELS.length - 1;

// 눈금·글자 (손잡이 바깥 둘레). 그림 영역은 손잡이의 1.8배, 손잡이 반지름 = 77.8
const C = 100;
const R = 86;
const toRad = (t) => ((lerp(DIAL_MIN, DIAL_MAX, t) - 90) * Math.PI) / 180;
const TICKS = Array.from({ length: 25 }, (_, i) => {
  const a = toRad(i / 24);
  const long = i % 8 === 0;
  const r2 = R + (long ? 10 : 5);
  return { x1: C + Math.cos(a) * R, y1: C + Math.sin(a) * R, x2: C + Math.cos(a) * r2, y2: C + Math.sin(a) * r2, long };
});
const LABELS = DIAL_LABELS.map((text, i) => {
  const a = toRad(i / STOPS);
  return { text, x: C + Math.cos(a) * (R + 24), y: C + Math.sin(a) * (R + 24) + 3.5 };
});

export default function DialScreen({ value, onChange, onSelect }) {
  const knobRef = useRef(null);
  const [v, setV] = useState(value);
  const [chosen, setChosen] = useState(false);
  const drag = useRef(null);
  const snapRaf = useRef(0);

  // 메인 화면에서 다이얼을 직접 돌린 경우 따라감 (아이패드에서 잡고 있을 땐 무시)
  useEffect(() => {
    if (!drag.current && !snapRaf.current) setV(value);
  }, [value]);
  useEffect(() => () => cancelAnimationFrame(snapRaf.current), []);

  const apply = (nv) => {
    setV(nv);
    onChange(nv);
  };
  const angleAt = (e) => {
    const r = knobRef.current.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const snap = (from) => {
    const to = Math.round(from * STOPS) / STOPS;
    const t0 = performance.now();
    const dur = 180 + Math.abs(to - from) * 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      apply(lerp(from, to, 1 - Math.pow(1 - k, 3)));
      snapRaf.current = k < 1 ? requestAnimationFrame(step) : 0;
    };
    snapRaf.current = requestAnimationFrame(step);
  };
  const select = () => {
    if (chosen) return;
    setChosen(true);
    onSelect();
  };

  const onPointerDown = (e) => {
    if (chosen) return;
    cancelAnimationFrame(snapRaf.current);
    snapRaf.current = 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 이미 끝난 포인터 */
    }
    drag.current = { a: angleAt(e), v, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    const a = angleAt(e);
    const delta = ((a - d.a + 540) % 360) - 180;
    d.a = a;
    d.v = Math.min(1, Math.max(0, d.v + delta / (DIAL_MAX - DIAL_MIN)));
    apply(d.v);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.type === "pointerup" && !d.moved && performance.now() - d.t < 400) select();
    else if (d.moved) snap(d.v);
  };

  const label = DIAL_LABELS[Math.round(v * STOPS)];

  return (
    <div className={cx(styles.screen, styles.dialScreen)}>
      <p className={styles.question}>라디오 주파수를 맞춰보세요</p>
      <div className={styles.dialWrap}>
        <svg className={styles.dialScale} viewBox="-40 -40 280 280">
          {TICKS.map(({ x1, y1, x2, y2, long }, i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e9f7ee" strokeOpacity={long ? 0.95 : 0.5} strokeWidth={long ? 1.8 : 1} strokeLinecap="round" />
          ))}
          {LABELS.map(({ text, x, y }) => (
            <text
              key={text}
              x={x}
              y={y}
              textAnchor="middle"
              fontFamily="Galmuri11, sans-serif"
              fontSize="12"
              fill="#e9f7ee"
              fillOpacity={text === label ? 1 : 0.55}
            >
              {text}
            </text>
          ))}
        </svg>
        <div
          ref={knobRef}
          className={styles.knob}
          data-drag={drag.current ? "true" : undefined}
          style={{ transform: `rotate(${lerp(DIAL_MIN, DIAL_MAX, v)}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={styles.knobPtr} />
        </div>
      </div>
      <p className={styles.dialHint}>돌려서 시간을 바꾸고, 다이얼을 톡 누르면 선택돼요</p>
      <button type="button" className={styles.dialBtn} onClick={select} disabled={chosen}>
        {label}으로 정하기
      </button>
    </div>
  );
}
