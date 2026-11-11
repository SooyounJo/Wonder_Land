import { useEffect, useRef, useState } from "react";
import { connectRemote } from "@/lib/remote/socket";
import styles from "./Status.module.css";

const SCENES = {
  loop: "시작 전",
  next: "다음으로 넘어가는 중",
  scene1: "차",
  height: "차를 고른 뒤",
  scene2: "자리",
  tiny: "자리를 고른 뒤",
  scene3: "자판기",
  scene4: "과자",
  snackPlay: "과자를 고르는 중",
  snackPick: "과자를 고른 뒤",
  elevator: "엘리베이터",
  dial: "라디오",
  approach: "다가가는 중",
  bloom: "꽃이 피는 중",
  solo: "카드",
};

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}분 ${String(s % 60).padStart(2, "0")}초`;
};

export default function Status() {
  const remoteRef = useRef(null);
  const receivedAt = useRef(0);
  const [online, setOnline] = useState(false);
  const [snap, setSnap] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const remote = connectRemote("control", {
      onStatus: setOnline,
      onMessage: (msg) => {
        if (msg.type !== "status") return;
        receivedAt.current = Date.now();
        setSnap(msg);
        setNow(Date.now());
      },
    });
    remoteRef.current = remote;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      remote.close();
    };
  }, []);

  const idleMs = snap ? snap.idleMs + (now - receivedAt.current) : 0;
  const leftMs = snap ? Math.max(0, snap.limitMs - idleMs) : 0;
  const scene = snap?.scene ? SCENES[snap.scene] || snap.scene : "—";

  const reloadAll = () => {
    remoteRef.current?.send({ type: "reload" });
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <main className={styles.page}>
      <p className={styles.kicker}>GROWTH MEASUREMENT ROOM</p>
      <h1 className={styles.title}>상황 확인</h1>

      <dl className={styles.rows}>
        <div>
          <dt>메인 화면</dt>
          <dd>{snap?.displays ? `연결됨 ${snap.displays}` : "연결 안 됨"}</dd>
        </div>
        <div>
          <dt>패드</dt>
          <dd>{snap?.pads ? `${snap.pads}대` : "없음"}</dd>
        </div>
        <div>
          <dt>지금 장면</dt>
          <dd>{snap?.displays ? scene : "—"}</dd>
        </div>
        <div>
          <dt>마지막 조작</dt>
          <dd>{snap ? `${clock(idleMs)} 전` : "—"}</dd>
        </div>
        <div>
          <dt>자동 새로고침</dt>
          <dd>{snap ? `${clock(leftMs)} 뒤` : "—"}</dd>
        </div>
      </dl>

      <button type="button" className={styles.kill} disabled={!online} onClick={reloadAll}>
        {sent ? "새로고침을 보냈습니다" : "모든 화면 새로고침"}
      </button>
      <p className={styles.note}>
        {online
          ? "메인 화면과 패드를 처음부터 다시 엽니다. 조작이 5분 없어도 같이 다시 열립니다."
          : "서버에 연결하는 중입니다."}
      </p>
    </main>
  );
}
