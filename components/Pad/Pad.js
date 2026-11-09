import { useCallback, useEffect, useRef, useState } from "react";
import { ASSETS } from "@/lib/growthRoom/assets";
import { connectRemote } from "@/lib/remote/socket";
import TeaScreen from "./TeaScreen";
import ChairScreen from "./ChairScreen";
import SnackScreen from "./SnackScreen";
import DialScreen from "./DialScreen";
import CardScreen from "./CardScreen";
import Lookable from "./Lookable";
import Grain from "./Grain";
import styles from "./Pad.module.css";

// 메인 화면 장면 → 아이패드에 띄울 화면
const MODES = { loop: "start", scene1: "tea", scene2: "chairs", scene4: "snacks", dial: "dial" };
const LIVE = new Set(Object.values(MODES));
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

  // 기다리는 동안엔 방금까지 쓰던 화면을 그대로(고른 상태 그대로) 흐리게 깔아 둠
  const [held, setHeld] = useState(null);
  useEffect(() => {
    if (LIVE.has(mode)) setHeld({ mode, key: scene });
    else if (mode !== "wait") setHeld(null);
  }, [mode, scene]);
  const waiting = mode === "wait";
  const shown = LIVE.has(mode) ? { mode, key: scene } : waiting ? held : null;

  const renderLive = ({ mode: m, key }) => {
    if (m === "start")
      return (
        <div className={styles.startScreen}>
          <video
            className={styles.startVideo}
            src={ASSETS.video.opening}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={(e) => e.currentTarget.play().catch(() => {})}
          />
          <p className={styles.title}>GROWTH</p>
          <p className={styles.subtitle}>MEASUREMENT ROOM</p>
          <button type="button" className={styles.startBtn} onClick={() => send({ type: "start" })}>
            터치하여 시작
          </button>
        </div>
      );
    // key로 장면이 바뀔 때마다 새로 그려서, 이전 선택 상태가 남지 않게 함
    if (m === "tea") return <TeaScreen key={key} onHover={onHover} onSelect={onSelect} />;
    if (m === "chairs") return <ChairScreen key={key} onHover={onHover} onSelect={onSelect} />;
    if (m === "snacks") return <SnackScreen key={key} onHover={onHover} onSelect={onSelect} />;
    if (m === "dial")
      return (
        <DialScreen
          key={key}
          value={dial}
          onChange={(v) => send({ type: "dial", v })}
          onSelect={() => send({ type: "dialSelect" })}
        />
      );
    return null;
  };

  return (
    <div className={styles.pad}>
      {mode === "offline" && (
        <div className={styles.center}>
          <div className={styles.pulse} />
          <p className={styles.note}>{online ? "메인 화면을 기다리는 중" : "연결 중"}</p>
        </div>
      )}

      {(shown || waiting) && (
        <Lookable waiting={waiting} note={WAIT_TEXT[scene]}>
          {shown && renderLive(shown)}
        </Lookable>
      )}

      {mode === "card" && <CardScreen picks={picks} />}

      {connected && mode !== "start" && (
        <button type="button" className={styles.backBtn} onClick={() => send({ type: "back" })}>
          ← 처음으로
        </button>
      )}

      <Grain />
    </div>
  );
}
