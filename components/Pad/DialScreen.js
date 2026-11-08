import { useEffect, useRef } from "react";
import { createRadioSlider } from "@/lib/pad/radioSlider";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 라디오 패널 사진 위의 슬라이더(three.js)를 잡고 밀어 시간을 고르고, 패널의 GO 버튼으로 선택
export default function DialScreen({ value, onChange, onSelect }) {
  const wrapRef = useRef(null);
  const sliderRef = useRef(null);
  const handlers = useRef({ onChange, onSelect });
  handlers.current = { onChange, onSelect };

  useEffect(() => {
    const slider = createRadioSlider({
      container: wrapRef.current,
      value,
      onChange: (nv, fromPad) => {
        if (fromPad) handlers.current.onChange(nv);
      },
      onGo: () => handlers.current.onSelect(),
    });
    sliderRef.current = slider;
    return () => {
      slider.dispose();
      sliderRef.current = null;
    };
    // 값은 아래 effect에서 따라가므로 처음 한 번만 만듦
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 메인 화면에서 다이얼을 직접 돌린 경우 따라감
  useEffect(() => {
    sliderRef.current?.setValue(value);
  }, [value]);

  return (
    <div className={cx(styles.screen, styles.dialScreen)}>
      <div ref={wrapRef} className={styles.canvasWrap} />
      <p className={cx(styles.question, styles.radioQuestion)}>라디오 주파수를 맞춰보세요</p>
    </div>
  );
}
