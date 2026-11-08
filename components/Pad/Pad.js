import { useCallback, useEffect, useRef, useState } from "react";
import { connectRemote } from "@/lib/remote/socket";
import TeaScreen from "./TeaScreen";
import ChairScreen from "./ChairScreen";
import SnackScreen from "./SnackScreen";
import DialScreen from "./DialScreen";
import CardScreen from "./CardScreen";
import styles from "./Pad.module.css";

// 메인 화면 장면 → 아이패드에 띄울 화면
const MODES = { loop: "start", scene1: "tea", scene2: "chairs", scene4: "snacks", dial: "dial" };
const WAIT_TEXT = {
  approach: "꽃이 피어나고 있어요",
  bloom: "꽃이 피어나고 있어요",
};

export default function Pad() {
  const remoteRef = useRef(null);
  const [online, setOnline] = useState(false);
  const [displays, setDisplays] = useState(0);
  const [scene, setScene] = useState(null);
  const [dial, setDial] = useState(1);
  const [picks, setPicks] = useState(null);

  useEffect(() => {
    const remote = connectRemote("pad", {
      onStatus: setOnline,
      onMessage: (msg) => {
        if (msg.type === "state") {
          setScene(msg.scene);
          setPicks(msg.picks ?? null);
          if (typeof msg.dial === "number") setDial(msg.dial);
        } else if (msg.type === "dial") setDial(msg.v);
        else if (msg.type === "peers") setDisplays(msg.displays);
      },
    });
    remoteRef.current = remote;
    return () => remote.close();
  }, []);

  const send = useCallback((msg) => remoteRef.current?.send(msg), []);
  const onHover = useCallback((i) => send({ type: "hover", i }), [send]);
  const onSelect = useCallback((i) => send({ type: "select", i }), [send]);

  const connected = online && displays > 0;
  const mode = !connected ? "offline" : scene === "solo" && picks ? "card" : MODES[scene] ?? "wait";

  return (
    <div className={styles.pad}>
      {mode === "offline" && (
        <div className={styles.center}>
          <div className={styles.pulse} />
          <p className={styles.note}>{online ? "메인 화면을 기다리는 중" : "연결 중"}</p>
        </div>
      )}

      {mode === "start" && (
        <div className={styles.startScreen}>
          <p className={styles.title}>GROWTH</p>
          <p className={styles.subtitle}>MEASUREMENT ROOM</p>
          <button type="button" className={styles.startBtn} onClick={() => send({ type: "start" })}>
            터치하여 시작
          </button>
        </div>
      )}

      {/* key로 장면이 바뀔 때마다 새로 그려서, 이전 선택 상태가 남지 않게 함 */}
      {mode === "tea" && <TeaScreen key={scene} onHover={onHover} onSelect={onSelect} />}
      {mode === "chairs" && <ChairScreen key={scene} onHover={onHover} onSelect={onSelect} />}
      {mode === "snacks" && <SnackScreen key={scene} onHover={onHover} onSelect={onSelect} />}
      {mode === "dial" && (
        <DialScreen
          key={scene}
          value={dial}
          onChange={(v) => send({ type: "dial", v })}
          onSelect={() => send({ type: "dialSelect" })}
        />
      )}

      {mode === "card" && <CardScreen picks={picks} />}

      {mode === "wait" && (
        <div className={styles.center}>
          <div className={styles.pulse} />
          <p className={styles.note}>{WAIT_TEXT[scene] ?? "화면을 바라봐 주세요"}</p>
        </div>
      )}

      {connected && mode !== "start" && (
        <button type="button" className={styles.backBtn} onClick={() => send({ type: "back" })}>
          ← 처음으로
        </button>
      )}
    </div>
  );
}
