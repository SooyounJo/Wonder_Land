import usePick from "./usePick";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 옷 순서와 같음: 왼쪽부터 정장 · 가디건 · 흰 옷 (방석 색으로 구분)
const CHAIRS = [
  { x: 300, cushion: "#2d3a5c", trim: "#1d2740" },
  { x: 600, cushion: "#efe2b8", trim: "#cdbb86" },
  { x: 900, cushion: "#f6f4ef", trim: "#d6d2c8" },
];

export default function ChairScreen({ onHover, onSelect }) {
  const { bind, stateOf } = usePick({ onHover, onSelect });
  return (
    <div className={cx(styles.screen, styles.chairs)}>
      <p className={styles.question}>앉고 싶은 자리를 골라보세요</p>
      <svg className={styles.art} viewBox="0 0 1200 800">
        {CHAIRS.map(({ x, cushion, trim }, i) => {
          const state = stateOf(i);
          return (
            <g key={x} transform={`translate(${x} 470)`}>
              <ellipse cx="6" cy="232" rx="120" ry="20" fill="rgba(0,40,0,.28)" />
              <g className={cx(styles.pick, state && styles[state])} {...bind(i)}>
                <rect x="-150" y="-260" width="300" height="500" fill="transparent" />
                <Chair cushion={cushion} trim={trim} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Chair({ cushion, trim }) {
  const wood = "#c98f3c";
  const woodDark = "#8a5a22";
  return (
    <g strokeLinejoin="round">
      {/* 뒷다리 */}
      <rect x="-78" y="-10" width="16" height="230" rx="6" fill={woodDark} />
      <rect x="62" y="-10" width="16" height="230" rx="6" fill={woodDark} />
      {/* 등받이 */}
      <rect x="-82" y="-240" width="22" height="250" rx="9" fill={wood} stroke={woodDark} strokeWidth="4" />
      <rect x="60" y="-240" width="22" height="250" rx="9" fill={wood} stroke={woodDark} strokeWidth="4" />
      <rect x="-80" y="-236" width="160" height="34" rx="14" fill={wood} stroke={woodDark} strokeWidth="4" />
      <rect x="-60" y="-170" width="120" height="14" rx="7" fill={wood} stroke={woodDark} strokeWidth="3" />
      <rect x="-60" y="-120" width="120" height="14" rx="7" fill={wood} stroke={woodDark} strokeWidth="3" />
      {/* 앉는 판 + 방석 */}
      <path d="M-112 10 L112 10 L96 -24 L-96 -24 Z" fill={wood} stroke={woodDark} strokeWidth="4" />
      <path d="M-100 -12 Q0 -46 100 -12 L90 -30 Q0 -58 -90 -30 Z" fill={cushion} stroke={trim} strokeWidth="4" />
      <rect x="-112" y="8" width="224" height="20" rx="8" fill={wood} stroke={woodDark} strokeWidth="4" />
      {/* 앞다리 */}
      <rect x="-104" y="26" width="18" height="206" rx="7" fill={wood} stroke={woodDark} strokeWidth="4" />
      <rect x="86" y="26" width="18" height="206" rx="7" fill={wood} stroke={woodDark} strokeWidth="4" />
      <rect x="-90" y="150" width="180" height="10" rx="5" fill={woodDark} />
    </g>
  );
}
