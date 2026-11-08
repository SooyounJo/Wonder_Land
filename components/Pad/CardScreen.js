import { FLOWERS, OUTFITS, SNACKS, TEAS, TIMES } from "@/lib/growthRoom/story";
import styles from "./Pad.module.css";

const ROWS = [
  { key: "tea", label: "차", list: TEAS },
  { key: "outfit", label: "자리", list: OUTFITS },
  { key: "snack", label: "과자", list: SNACKS },
  { key: "time", label: "시간", list: TIMES },
];

// 위쪽 투입구에서 카드가 밀려 나옴 (세로로 긴 트럼프 카드: 꽃 이름 · 꽃 · 선택과 댓가)
export default function CardScreen({ picks }) {
  const flower = FLOWERS[picks.flower] ?? FLOWERS[0];
  return (
    <div className={styles.cardScreen}>
      <div className={styles.slot} />
      <div className={styles.cardTrack}>
        <article className={styles.card}>
          <Corner />
          <Corner flip />
          <header className={styles.cardHead}>
            <p className={styles.cardKicker}>GROWTH MEASUREMENT ROOM</p>
            <h1 className={styles.cardName}>{flower.name}</h1>
          </header>
          <div className={styles.cardFlower}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flower.card} alt={flower.name} draggable={false} />
          </div>
          <ul className={styles.cardRows}>
            {ROWS.map(({ key, label, list }) => {
              const item = list[picks[key]];
              return (
                <li key={key} className={styles.cardRow}>
                  <span className={styles.cardLabel}>{label}</span>
                  <span className={styles.cardPick}>{item?.name ?? "—"}</span>
                  <span className={styles.cardCost}>{item?.cost ?? ""}</span>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </div>
  );
}

function Corner({ flip }) {
  return (
    <div className={flip ? `${styles.corner} ${styles.cornerFlip}` : styles.corner}>
      <span>07</span>
      <span>✿</span>
    </div>
  );
}
