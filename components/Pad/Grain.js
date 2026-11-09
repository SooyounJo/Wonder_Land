import { useEffect, useRef } from "react";
import styles from "./Pad.module.css";

// 메인 화면(engine.js 마지막 grade 패스)과 같은 질감: 화면 픽셀 단위의 거친 노이즈 ±3% + 엷은 주사선
// 노이즈 타일 한 장을 깔고 초당 12번 무작위 위치로 옮겨 매번 다른 노이즈처럼 보이게 함
const CELLS = 160;

export default function Grain() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const dpr = window.devicePixelRatio || 1;
    const cell = Math.max(2, Math.round(dpr * 1.5));    // 메인 화면과 같은 노이즈 알갱이 크기(기기 픽셀)
    const size = CELLS * cell;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    for (let y = 0; y < CELLS; y++) {
      const line = y % 2 ? 0.02 : 0;                     // 주사선: 한 줄 걸러 2% 어둡게
      for (let x = 0; x < CELLS; x++) {
        const n = Math.random() - 0.5;
        const a = Math.abs(n) * 0.075;
        g.fillStyle = n > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a + line})`;
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    el.style.backgroundImage = `url(${c.toDataURL()})`;
    el.style.backgroundSize = `${size / dpr}px ${size / dpr}px`;

    let raf = 0;
    let last = 0;
    const step = (now) => {
      if (now - last > 1000 / 12) {
        last = now;
        const ox = Math.floor(Math.random() * CELLS) * (cell / dpr);
        const oy = Math.floor(Math.random() * (CELLS / 2)) * 2 * (cell / dpr); // 주사선 줄이 흔들리지 않게 두 칸 단위
        el.style.backgroundPosition = `${ox}px ${oy}px`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className={styles.grain} aria-hidden />;
}
