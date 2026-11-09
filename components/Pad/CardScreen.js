import { useEffect, useRef, useState } from "react";
import { FLOWERS } from "@/lib/growthRoom/story";
import { drawCard } from "@/lib/pad/cardArt";
import styles from "./Pad.module.css";

let lanIp;

async function originForPhone() {
  const { protocol, hostname, port } = location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return location.origin;
  if (lanIp === undefined) {
    try {
      const res = await fetch("/api/lan");
      lanIp = (await res.json()).ip || null;
    } catch {
      lanIp = null;
    }
  }
  if (!lanIp) return location.origin;
  return `${protocol}//${lanIp}${port ? `:${port}` : ""}`;
}

// 위쪽 투입구에서 카드가 밀려 나오고, 휴대폰으로 찍으면 그림 파일을 받을 수 있다
export default function CardScreen({ picks }) {
  const canvasRef = useRef(null);
  const picksRef = useRef(picks);
  picksRef.current = picks;
  const [qr, setQr] = useState("");
  const [note, setNote] = useState("저장 링크를 만드는 중");
  const key = picks ? [picks.flower, picks.tea, picks.outfit, picks.snack, picks.time].join(":") : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    const current = picksRef.current;
    if (!canvas || !current) return undefined;
    let cancel = false;
    setQr("");
    setNote("저장 링크를 만드는 중");
    (async () => {
      const drawn = await drawCard(current);
      if (cancel) return;
      canvas.width = drawn.width;
      canvas.height = drawn.height;
      canvas.getContext("2d").drawImage(drawn, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const name = FLOWERS[current.flower]?.name || "카드";
      const saved = await fetch(`/api/card?name=${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      if (!saved.ok) throw new Error("save");
      const { id } = await saved.json();
      if (cancel) return;
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(`${await originForPhone()}/save/${id}`, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "Q",
        color: { dark: "#2a2622", light: "#f4efe4" },
      });
      if (cancel) return;
      setQr(url);
      setNote("휴대폰으로 찍어\n카드를 저장하세요");
    })().catch(() => {
      if (!cancel) setNote("저장 링크를 만들지 못했어요");
    });
    return () => {
      cancel = true;
    };
  }, [key]);

  return (
    <div className={styles.cardScreen}>
      <div className={styles.slot} />
      <div className={styles.cardTrack}>
        <article className={styles.card} aria-label="성장 카드">
          <canvas ref={canvasRef} width={1000} height={1400} className={styles.cardCanvas} />
        </article>
      </div>
      <aside className={styles.saveStrip}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="카드 저장 QR" draggable={false} />
        ) : (
          <span className={styles.saveWait} />
        )}
        <p>{note}</p>
      </aside>
    </div>
  );
}
