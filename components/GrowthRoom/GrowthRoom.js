import { useEffect, useRef, useState } from "react";
import { createGrowthRoom } from "@/lib/growthRoom/engine";
import { createRoomAudio } from "@/lib/growthRoom/roomAudio";
import { connectRemote } from "@/lib/remote/socket";
import DialScale from "./DialScale";
import styles from "./GrowthRoom.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

export default function GrowthRoom() {
  const stageRef = useRef(null);
  const dialRef = useRef(null);
  const knobRef = useRef(null);
  const engineRef = useRef(null);
  const audioRef = useRef(null);
  const [scene, setScene] = useState("loop");

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
      onSceneChange: (s) => {
        if (current === "loop" && s !== "loop") audio.unlock();
        current = s;
        setScene(s);
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

  const handleBack = (e) => {
    e.stopPropagation();
    engineRef.current?.back();
  };

  return (
    <div ref={stageRef} className={styles.stage}>
      <div
        ref={dialRef}
        className={cx(styles.dial, scene !== "dial" && styles.hide)}
        aria-label="시간 다이얼"
      >
        <DialScale className={styles.scale} />
        <div ref={knobRef} className={styles.knob}>
          <div className={styles.ptr} />
        </div>
      </div>
      <button
        type="button"
        className={cx(styles.backBtn, scene === "loop" && styles.hide)}
        aria-label="뒤로가기"
        onClick={handleBack}
      >
        <span className={styles.arr}>←</span>뒤로
      </button>
    </div>
  );
}
