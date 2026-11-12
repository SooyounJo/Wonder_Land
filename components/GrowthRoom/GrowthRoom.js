import { useEffect, useRef } from "react";
import { createGrowthRoom } from "@/lib/growthRoom/engine";
import { createRoomAudio } from "@/lib/growthRoom/roomAudio";
import { ensure, playSfx } from "@/lib/pad/sfx";
import { connectRemote } from "@/lib/remote/socket";
import DialScale from "./DialScale";
import styles from "./GrowthRoom.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

export default function GrowthRoom() {
  const stageRef = useRef(null);
  const dialRef = useRef(null);
  const knobRef = useRef(null);
  const reasonRef = useRef(null);
  const engineRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = createRoomAudio();
    audioRef.current = audio;
    const unlock = () => audio.unlock();
    const onVis = () => {
      if (!document.hidden) audio.unlock();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("visibilitychange", onVis);

    let remote = null;
    let current = "loop";
    // 엔진은 만들어지는 도중에도 onSceneChange를 부르므로 그때는 아직 없음
    let engine = null;
    const sendState = () =>
      engine &&
      remote?.send({
        type: "state",
        scene: current,
        dial: engine.getDial(),
        picks: current === "solo" ? engine.getPicks() : null,
      });

    engine = createGrowthRoom({
      stage: stageRef.current,
      dialEl: dialRef.current,
      knob: knobRef.current,
      reasonEl: reasonRef.current,
      onSceneChange: (s) => {
        if (current === "loop" && s !== "loop") audio.unlock();
        current = s;
        audio.setScene(s, engine ? engine.getDial() : 1);
        sendState();
      },
      onDialChange: (v) => {
        audio.setDial(v);
        remote?.send({ type: "dial", v });
      },
    });
    engineRef.current = engine;
    audio.setScene("loop");

    remote = connectRemote("display", {
      onStatus: (up) => up && sendState(),
      onMessage: (msg) => {
        switch (msg.type) {
          case "start":
            audio.unlock();
            engine.start();
            break;
          case "back":
            engine.back();
            break;
          case "hover":
            engine.hover(msg.i);
            break;
          case "select":
            engine.select(msg.i);
            break;
          case "dial":
            engine.dial(msg.v);
            audio.setDial(msg.v);
            break;
          case "dialSelect":
            engine.dialSelect();
            break;
          case "lang":
            engine.setLang(msg.lang);
            break;
          case "sfx": {
            audio.unlock();
            const ctx = ensure();
            const run = () => playSfx(msg.name, msg.args);
            if (ctx && ctx.state !== "running") ctx.resume().then(run).catch(run);
            else run();
            break;
          }
          case "peers":
            if (msg.pads) sendState();
            break;
        }
      },
    });

    return () => {
      remote.close();
      engine.dispose();
      engineRef.current = null;
      audio.dispose();
      audioRef.current = null;
      window.removeEventListener("pointerdown", unlock);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return (
    <div ref={stageRef} className={styles.stage}>
      {/* 시간대는 패드 라디오 슬라이더로 고르므로 메인 다이얼은 늘 숨김(엔진이 바늘 위치를 계속 쓰므로 요소는 남겨 둠) */}
      <div ref={dialRef} className={cx(styles.dial, styles.hide)} aria-hidden>
        <DialScale className={styles.scale} />
        <div ref={knobRef} className={styles.knob}>
          <div className={styles.ptr} />
        </div>
      </div>
      <p ref={reasonRef} className={styles.heightReason} aria-live="polite" />
    </div>
  );
}
