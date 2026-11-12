import Link from "next/link";
import { useState } from "react";
import { FLOWERS } from "@/lib/growthRoom/story";
import TeaScreen from "./TeaScreen";
import ChairScreen from "./ChairScreen";
import SnackScreen from "./SnackScreen";
import DialScreen from "./DialScreen";
import CardScreen from "./CardScreen";
import Lookable from "./Lookable";
import Grain from "./Grain";
import styles from "./Pad.module.css";

// 아이패드 화면만 따로 띄워 보는 테스트(웹소켓 없이). 메인 화면으로 보낼 신호는 오른쪽 위 기록에만 남음
const SCREENS = {
  tea: { title: "1. 차(카드 → 접시)", Screen: TeaScreen },
  chair: { title: "2. 의자", Screen: ChairScreen },
  snack: { title: "3. 과자 자판기", Screen: SnackScreen },
  radio: { title: "4. 라디오 슬라이더", Screen: DialScreen },
  card: { title: "5. 마지막 카드", Screen: CardScreen },
};

const SAMPLE_PICKS = { flower: 0, tea: 2, outfit: 1, snack: 4, time: 0 };

export default function PadTest({ screen }) {
  const { Screen } = SCREENS[screen];
  const [run, setRun] = useState(0);
  const [log, setLog] = useState([]);
  const [dial, setDial] = useState(1);
  const [look, setLook] = useState(false);
  const [picks, setPicks] = useState(SAMPLE_PICKS);
  const add = (text) => setLog((l) => [text, ...l].slice(0, 6));

  return (
    <div className={styles.pad}>
      <Lookable waiting={look}>
        <Screen
          key={run}
          picks={picks}
          value={dial}
          onHover={(i) => add(`hover ${i}`)}
          onSelect={(i) => add(i === undefined ? "select" : `select ${i}`)}
          onChange={(v) => add(`dial ${v.toFixed(3)}`)}
        />
      </Lookable>
      <Grain />
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
        <button type="button" onClick={() => setLook((v) => !v)}>
          {look ? "바라보기 끄기" : "화면 바라보기"}
        </button>
      </div>
      {screen === "card" && (
        <div className={styles.testFlowers} aria-label="꽃 카드">
          {FLOWERS.map((flower, i) => (
            <button
              key={flower.name}
              type="button"
              className={picks.flower === i ? styles.testFlowerOn : undefined}
              onClick={() => {
                setPicks((p) => ({ ...p, flower: i }));
                setRun((n) => n + 1);
              }}
            >
              <span className={styles.testFlowerNum}>{i + 1}</span>
              <span className={styles.testFlowerName}>{flower.name}</span>
            </button>
          ))}
        </div>
      )}
      <ol className={styles.testLog}>
        {log.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
