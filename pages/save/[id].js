import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import styles from "./save.module.css";

export default function SaveCard() {
  const { id } = useRouter().query;
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
        <title>성장 측정실 카드</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <p className={styles.kicker}>GROWTH MEASUREMENT ROOM</p>
      {state === "ready" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.card} src={`/api/card/${id}`} alt="성장 측정실 카드" />
          <div className={styles.actions}>
            <a href={`/api/card/${id}`} download>
              PNG로 저장
            </a>
            <a href={jpeg} download="성장측정실.jpg">
              JPG로 저장
            </a>
          </div>
          <p className={styles.note}>버튼으로 받아지지 않으면 카드를 길게 눌러 사진에 저장하세요.</p>
        </>
      )}
      {state === "loading" && <p className={styles.note}>카드를 불러오는 중</p>}
      {state === "gone" && (
        <p className={styles.note}>
          이 카드는 잠시만 보관되어 있어서 지금은 받을 수 없어요.
          <br />
          패드에서 카드를 다시 발급해 주세요.
        </p>
      )}
    </main>
  );
}
