import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { padText } from "@/lib/growthRoom/copy";
import styles from "./save.module.css";

export default function SaveCard() {
  const { id, lang: langQuery } = useRouter().query;
  const copy = padText(langQuery === "en" ? "en" : "ko");
  const [state, setState] = useState("loading");
  const [jpeg, setJpeg] = useState("");

  useEffect(() => {
    if (!id) return undefined;
    let cancel = false;
    setState("loading");
    setJpeg("");
    const img = new Image();
    img.onload = () => {
      if (cancel) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#e4d9c8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setJpeg(canvas.toDataURL("image/jpeg", 0.92));
      setState("ready");
    };
    img.onerror = () => {
      if (!cancel) setState("gone");
    };
    img.src = `/api/card/${id}`;
    return () => {
      cancel = true;
    };
  }, [id]);

  return (
    <main className={styles.page}>
      <Head>
        <title>{copy.saveTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <p className={styles.kicker}>GROWTH MEASUREMENT ROOM</p>
      {state === "ready" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.card} src={`/api/card/${id}`} alt={copy.saveTitle} />
          <div className={styles.actions}>
            <a href={`/api/card/${id}`} download>
              {copy.savePng}
            </a>
            <a href={jpeg} download={langQuery === "en" ? "growth-card.jpg" : "성장측정실.jpg"}>
              {copy.saveJpg}
            </a>
          </div>
          <p className={styles.note}>{copy.saveHint}</p>
        </>
      )}
      {state === "loading" && <p className={styles.note}>{copy.saveLoading}</p>}
      {state === "gone" && <p className={styles.note}>{copy.saveGone}</p>}
    </main>
  );
}
