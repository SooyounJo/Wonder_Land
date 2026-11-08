import { DIAL_LABELS, DIAL_MAX, DIAL_MIN } from "@/lib/growthRoom/dial";

const CX = 100;
const CY = 100;
const R = 78;
const TICKS = 24;

const toRad = (t) => ((DIAL_MIN + (DIAL_MAX - DIAL_MIN) * t - 90) * Math.PI) / 180;

const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
  const a = toRad(i / TICKS);
  const long = i % 8 === 0;
  const r2 = R - (long ? 11 : 6);
  return {
    x1: CX + Math.cos(a) * R,
    y1: CY + Math.sin(a) * R,
    x2: CX + Math.cos(a) * r2,
    y2: CY + Math.sin(a) * r2,
    long,
  };
});

const labels = DIAL_LABELS.map((text, i) => {
  const a = toRad(i / (DIAL_LABELS.length - 1));
  return { text, x: CX + Math.cos(a) * (R + 13), y: CY + Math.sin(a) * (R + 13) + 4 };
});

export default function DialScale({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 115">
      {ticks.map(({ x1, y1, x2, y2, long }, i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`rgba(255,255,255,${long ? 0.95 : 0.6})`}
          strokeWidth={long ? 2.2 : 1.2}
          strokeLinecap="round"
        />
      ))}
      {labels.map(({ text, x, y }) => (
        <text
          key={text}
          x={x}
          y={y}
          textAnchor="middle"
          fontFamily="Galmuri11, sans-serif"
          fontSize="11"
          fill="#fff"
          style={{ paintOrder: "stroke" }}
          stroke="rgba(40,25,70,.55)"
          strokeWidth="2.5"
        >
          {text}
        </text>
      ))}
    </svg>
  );
}
