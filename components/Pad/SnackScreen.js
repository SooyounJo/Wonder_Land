import { useEffect, useRef } from "react";
import { padText } from "@/lib/growthRoom/copy";
import { createSnackButtons } from "@/lib/pad/snackButtons";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 과자 순서와 같음: 위 줄 Cheerful·Dreamy·Brave / 아래 줄 Kind·Free·Lucky
const SNACKS = ["Cheerful", "Dreamy", "Brave", "Kind", "Free", "Lucky"];

export default function SnackScreen({ onHover, onSelect, lang = "ko" }) {
  const wrapRef = useRef(null);
  const handlers = useRef({ onHover, onSelect });
  handlers.current = { onHover, onSelect };

  useEffect(() => {
    return createSnackButtons({
      container: wrapRef.current,
      labels: SNACKS,
      onHover: (i) => handlers.current.onHover(i),
      onSelect: (i) => handlers.current.onSelect(i),
    });
  }, []);

  return (
    <div className={cx(styles.screen, styles.snacks)}>
      <div ref={wrapRef} className={styles.canvasWrap} />
      <p className={styles.question}>{padText(lang).snackQ}</p>
    </div>
  );
}
