import { useCallback, useEffect, useRef, useState } from "react";
import { ASSETS } from "@/lib/growthRoom/assets";
import { padText } from "@/lib/growthRoom/copy";
import { setSfxRelay } from "@/lib/pad/sfx";
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
const WAIT_SCENES = new Set(["approach", "bloom"]);

export default function Pad() {
  const remoteRef = useRef(null);
  const [online, setOnline] = useState(false);
  const [displays, setDisplays] = useState(0);
  const [scene, setScene] = useState(null);
  const [dial, setDial] = useState(1);
  const [picks, setPicks] = useState(null);
  const [lang, setLang] = useState("ko");

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
    setSfxRelay((name, args) => remoteRef.current?.send({ type: "sfx", name, args }));
    return () => {
      setSfxRelay(null);
      remote.close();
    };
  }, []);

  const send = useCallback((msg) => remoteRef.current?.send(msg), []);
  const chooseLang = useCallback(
    (next) => {
      setLang(next);
      send({ type: "lang", lang: next });
    },
    [send]
  );
  const onHover = useCallback((i) => send({ type: "hover", i }), [send]);
  const onSelect = useCallback((i) => send({ type: "select", i }), [send]);

  const connected = online && displays > 0;
  useEffect(() => {
    if (connected) send({ type: "lang", lang });
  }, [connected, lang, send]);
  const mode = !connected ? "offline" : scene === "solo" && picks ? "card" : MODES[scene] ?? "wait";

  // 기다리는 동안엔 방금까지 쓰던 화면을 그대로(고른 상태 그대로) 흐리게 깔아 둠
  const [held, setHeld] = useState(null);
  useEffect(() => {
    if (LIVE.has(mode)) setHeld({ mode, key: scene });
    else if (mode !== "wait") setHeld(null);
  }, [mode, scene]);
  const waiting = mode === "wait";
  const shown = LIVE.has(mode) ? { mode, key: scene } : waiting ? held : null;

  const copy = padText(lang);
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
          <div className={styles.lang} role="group" aria-label="Language">
            <button type="button" className={lang === "ko" ? styles.langOn : undefined} aria-pressed={lang === "ko"} onClick={() => chooseLang("ko")}>
              한국어
            </button>
            <button type="button" className={lang === "en" ? styles.langOn : undefined} aria-pressed={lang === "en"} onClick={() => chooseLang("en")}>
              English
            </button>
          </div>
          <button type="button" className={styles.startBtn} onClick={() => send({ type: "start" })}>
            {copy.start}
          </button>
        </div>
      );
    // key로 장면이 바뀔 때마다 새로 그려서, 이전 선택 상태가 남지 않게 함
    if (m === "tea") return <TeaScreen key={key} lang={lang} onHover={onHover} onSelect={onSelect} />;
    if (m === "chairs") return <ChairScreen key={key} lang={lang} onHover={onHover} onSelect={onSelect} />;
    if (m === "snacks") return <SnackScreen key={key} lang={lang} onHover={onHover} onSelect={onSelect} />;
    if (m === "dial")
      return (
        <DialScreen
          key={key}
          lang={lang}
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
          <p className={styles.note}>{online ? copy.waitingMain : copy.connecting}</p>
        </div>
      )}

      {(shown || waiting) && (
        <Lookable waiting={waiting} title={copy.look} note={WAIT_SCENES.has(scene) ? copy.blooming : undefined}>
          {shown && renderLive(shown)}
        </Lookable>
      )}

      {mode === "card" && <CardScreen picks={picks} lang={lang} />}

      {connected && mode !== "start" && (
        <button type="button" className={styles.backBtn} onClick={() => send({ type: "back" })}>
          {copy.back}
        </button>
      )}

      <Grain />
    </div>
  );
}
