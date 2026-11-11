import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면을 봐야 하는 동안: 패드 화면은 그대로 두고 흐리게 + "화면을 바라보세요"
export default function Lookable({ waiting, note, title = "화면을 바라보세요", children }) {
  return (
    <>
      <div className={cx(styles.layer, waiting && styles.layerBlur)} inert={waiting} aria-hidden={waiting || undefined}>
        <div className={styles.drift}>{children}</div>
      </div>
      {waiting && (
        <div className={styles.lookOverlay}>
          <div className={styles.pulse} />
          <p className={styles.lookTitle}>{title}</p>
          {note && <p className={styles.note}>{note}</p>}
        </div>
      )}
    </>
  );
}
