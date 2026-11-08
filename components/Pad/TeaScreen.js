import usePick from "./usePick";
import styles from "./Pad.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

// 메인 화면 잔 순서와 같음: 왼쪽부터 캐모마일 · 자스민 · 라벤더
const FLOWERS = [
  { name: "캐모마일", x: 300, Art: Chamomile },
  { name: "자스민", x: 600, Art: Jasmine },
  { name: "라벤더", x: 900, Art: Lavender },
];

export default function TeaScreen({ onHover, onSelect }) {
  const { bind, stateOf } = usePick({ onHover, onSelect });
  return (
    <div className={cx(styles.screen, styles.tea)}>
      <p className={styles.question}>마시고 싶은 tea는 무엇인가요?</p>
      <svg className={styles.art} viewBox="0 0 1200 800">
        <defs>
          <radialGradient id="saucer" cx="50%" cy="40%" r="60%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9e4dc" />
          </radialGradient>
          <linearGradient id="spoon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f6f5" />
            <stop offset="1" stopColor="#a9b4ae" />
          </linearGradient>
        </defs>

        {/* 접시와 티스푼 */}
        <ellipse cx="600" cy="712" rx="330" ry="58" fill="rgba(0,40,10,.25)" />
        <ellipse cx="600" cy="690" rx="320" ry="72" fill="url(#saucer)" />
        <ellipse cx="600" cy="684" rx="210" ry="44" fill="none" stroke="#c9d6cd" strokeWidth="4" />
        <g transform="translate(600 676) rotate(-12)">
          <ellipse cx="-150" cy="0" rx="56" ry="26" fill="url(#spoon)" stroke="#9aa59f" strokeWidth="3" />
          <rect x="-96" y="-7" width="290" height="14" rx="7" fill="url(#spoon)" stroke="#9aa59f" strokeWidth="3" />
        </g>

        {FLOWERS.map(({ name, x, Art }, i) => {
          const state = stateOf(i);
          return (
            <g key={name} transform={`translate(${x} 350)`}>
              <g className={styles.float} style={{ animationDelay: `${-i * 1.1}s` }}>
                <g className={cx(styles.pick, state && styles[state])} {...bind(i)}>
                  <circle r="170" cy="10" fill="transparent" />
                  <Art />
                  <text className={styles.label} y="205">
                    {name}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Stem({ to = -40, from = 150 }) {
  return (
    <>
      <path d={`M0 ${from} C 8 ${from - 60}, -10 ${to + 60}, 0 ${to}`} stroke="#3f7d2c" strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="-26" cy={from - 50} rx="26" ry="10" fill="#4f9a38" transform={`rotate(-30 -26 ${from - 50})`} />
    </>
  );
}

function Chamomile() {
  const petals = Array.from({ length: 16 }, (_, k) => k * (360 / 16));
  return (
    <g>
      <Stem to={-30} />
      <g transform="translate(0 -60)">
        {petals.map((a) => (
          <ellipse key={a} cx="0" cy="-52" rx="15" ry="40" fill="#fffdf6" stroke="#e8e2cf" strokeWidth="2" transform={`rotate(${a})`} />
        ))}
        <circle r="34" fill="#f5b81f" />
        <circle r="34" fill="none" stroke="#d99410" strokeWidth="4" />
        <circle cx="-9" cy="-10" r="9" fill="#ffd45a" />
      </g>
    </g>
  );
}

function JasmineBloom({ x, y, s = 1 }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {petals.map((a) => (
        <ellipse key={a} cx="0" cy="-30" rx="17" ry="32" fill="#ffffff" stroke="#e6e9e2" strokeWidth="2" transform={`rotate(${a})`} />
      ))}
      <circle r="11" fill="#f7e27a" />
    </g>
  );
}

function Jasmine() {
  return (
    <g>
      <Stem to={-20} />
      <path d="M0 -20 C -20 -50, -50 -60, -70 -80" stroke="#3f7d2c" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M0 -20 C 20 -50, 50 -55, 72 -70" stroke="#3f7d2c" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="30" cy="10" rx="30" ry="11" fill="#4f9a38" transform="rotate(25 30 10)" />
      <JasmineBloom x={-72} y={-88} s={0.8} />
      <JasmineBloom x={74} y={-78} s={0.72} />
      <JasmineBloom x={0} y={-62} s={1.05} />
    </g>
  );
}

function Lavender() {
  const buds = Array.from({ length: 11 }, (_, k) => {
    const t = k / 10;
    return { y: -20 - t * 160, r: 21 - t * 10 };
  });
  return (
    <g>
      <Stem to={-180} />
      {buds.map(({ y, r }, k) => (
        <g key={k}>
          <ellipse cx={-r * 0.55} cy={y} rx={r * 0.62} ry={r} fill={k % 2 ? "#9a7fd6" : "#8a6cc9"} transform={`rotate(-22 ${-r * 0.55} ${y})`} />
          <ellipse cx={r * 0.55} cy={y - 6} rx={r * 0.62} ry={r} fill={k % 2 ? "#8a6cc9" : "#a88de0"} transform={`rotate(22 ${r * 0.55} ${y - 6})`} />
        </g>
      ))}
    </g>
  );
}
