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

// 주신 픽셀 카드가 세로로 나온 뒤 뒤집히면, 꽃·반짝과 네 선택의 결과가 보임. QR은 왼쪽 문장과 같은 높이의 오른쪽 아래
export default function CardScreen({ picks, lang = "ko" }) {
  const canvasRef = useRef(null);
  const picksRef = useRef(picks);
  const langRef = useRef(lang);
  picksRef.current = picks;
  langRef.current = lang;
  const copy = padText(lang);
  const [qr, setQr] = useState("");
  const [note, setNote] = useState(copy.cardWait);
  const [ready, setReady] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const sceneRef = useRef(null);
  const key = picks ? [picks.flower, picks.tea, picks.outfit, picks.snack, picks.time, lang].join(":") : "";
  const flower = FLOWERS[picks?.flower] ?? FLOWERS[0];

  useEffect(() => {
    setReady(false);
    setFlipped(false);
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
      setReady(true);
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
        color: { dark: "#ffffff", light: "#00000000" },
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

  useEffect(() => {
    if (!ready) return undefined;
    const scene = sceneRef.current;
    let cancelled = false;
    const restMs = 380;
    const startFlip = () => {
      if (cancelled) return;
      window.setTimeout(() => {
        if (!cancelled) setFlipped(true);
      }, restMs);
    };
    const anim = scene?.getAnimations?.()[0];
    if (anim && anim.playState !== "finished") {
      anim.finished.then(startFlip).catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    const fallback = window.setTimeout(startFlip, anim ? restMs : 2600 + restMs);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [ready, key]);

  return (
    <div className={styles.cardScreen}>
      <div className={styles.slot} />
      <div className={styles.cardTrack}>
        <div className={styles.cardScene} ref={sceneRef}>
          <div className={`${styles.cardFlip}${flipped ? ` ${styles.cardFlipOn}` : ""}`}>
            <div className={`${styles.cardFace} ${styles.cardBack}`} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flower?.card} alt="" draggable={false} />
            </div>
            <article className={`${styles.cardFace} ${styles.cardFront}`} aria-label={copy.cardLabel}>
              <canvas ref={canvasRef} width={900} height={1620} className={styles.cardCanvas} />
            </article>
          </div>
        </div>
      </div>
      <p className={`${styles.cardEssay}${flipped ? ` ${styles.cardEssayOn}` : ""}`}>{copy.cardEssay}</p>
      <aside className={`${styles.qrModal}${qr ? ` ${styles.qrModalOn}` : ""}`}>
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
