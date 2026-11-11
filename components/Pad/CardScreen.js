import { useEffect, useRef, useState } from "react";
import { padText } from "@/lib/growthRoom/copy";
import { FLOWERS, localized } from "@/lib/growthRoom/story";
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
export default function CardScreen({ picks, lang = "ko" }) {
  const canvasRef = useRef(null);
  const picksRef = useRef(picks);
  const langRef = useRef(lang);
  picksRef.current = picks;
  langRef.current = lang;
  const copy = padText(lang);
  const [qr, setQr] = useState("");
  const [note, setNote] = useState(copy.cardWait);
  const key = picks ? [picks.flower, picks.tea, picks.outfit, picks.snack, picks.time, lang].join(":") : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    const current = picksRef.current;
    const currentLang = langRef.current;
    const text = padText(currentLang);
    if (!canvas || !current) return undefined;
    let cancel = false;
    setQr("");
    setNote(text.cardWait);
    (async () => {
      const drawn = await drawCard(current, currentLang);
      if (cancel) return;
      canvas.width = drawn.width;
      canvas.height = drawn.height;
      canvas.getContext("2d").drawImage(drawn, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const name = localized(FLOWERS[current.flower], currentLang).name || "card";
      const saved = await fetch(`/api/card?name=${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      if (!saved.ok) throw new Error("save");
      const { id } = await saved.json();
      if (cancel) return;
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(`${await originForPhone()}/save/${id}?lang=${currentLang}`, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "Q",
        color: { dark: "#2a2622", light: "#f4efe4" },
      });
      if (cancel) return;
      setQr(url);
      setNote(text.cardSave);
    })().catch(() => {
      if (!cancel) setNote(text.cardFail);
    });
    return () => {
      cancel = true;
    };
  }, [key]);

  return (
    <div className={styles.cardScreen}>
      <div className={styles.slot} />
      <div className={styles.cardTrack}>
        <article className={styles.card} aria-label={copy.cardLabel}>
          <canvas ref={canvasRef} width={1000} height={1400} className={styles.cardCanvas} />
        </article>
      </div>
      <aside className={styles.saveStrip}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={copy.cardQr} draggable={false} />
        ) : (
          <span className={styles.saveWait} />
        )}
        <p>{note}</p>
      </aside>
    </div>
  );
}
