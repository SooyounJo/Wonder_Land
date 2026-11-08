import Link from "next/link";
import { useState } from "react";
import TeaScreen from "./TeaScreen";
import SnackScreen from "./SnackScreen";
import DialScreen from "./DialScreen";
import styles from "./Pad.module.css";

// 아이패드 화면만 따로 띄워 보는 테스트(웹소켓 없이). 메인 화면으로 보낼 신호는 오른쪽 위 기록에만 남음
const SCREENS = {
  tea: { title: "1. 차(꽃 → 접시)", Screen: TeaScreen },
  snack: { title: "3. 과자 자판기", Screen: SnackScreen },
  radio: { title: "4. 라디오 슬라이더", Screen: DialScreen },
};

export default function PadTest({ screen }) {
  const { Screen } = SCREENS[screen];
  const [run, setRun] = useState(0);
  const [log, setLog] = useState([]);
  const [dial, setDial] = useState(1);
  const add = (text) => setLog((l) => [text, ...l].slice(0, 6));

  return (
    <div className={styles.pad}>
      <Screen
        key={run}
        value={dial}
        onHover={(i) => add(`hover ${i}`)}
        onSelect={(i) => add(i === undefined ? "select" : `select ${i}`)}
        onChange={(v) => add(`dial ${v.toFixed(3)}`)}
      />
      <div className={styles.testBar}>
        {Object.entries(SCREENS).map(([k, s]) => (
          <Link key={k} href={`/test/${k}`} className={k === screen ? styles.testOn : undefined}>
            {s.title}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            setLog([]);
            setDial(1);
            setRun((n) => n + 1);
          }}
        >
          다시 하기
        </button>
      </div>
      <ol className={styles.testLog}>
        {log.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
