// 메인 화면 효과음: 엘리베이터(문 · 운행 웅웅 · 덜컹 · 도착 딩동)와 자판기(웅 하는 기계음 · 삑 · 나선 모터 · 털썩)
// 패드 효과음과 같은 Web Audio 합성 도구를 씀. 영상 속 시점(초)에 맞춰 engine.js가 불러 줌
import { audio, ensure, noise, play, ring, route, tone } from "@/lib/pad/sfx";

export const unlock = () => {
  ensure();
};

// 계속 이어지는 소리(켜고 끌 때 서서히)
const drone = (build) => {
  let g = null;
  let srcs = [];
  return {
    start(level, fadeIn = 1) {
      if (g || !ensure()) return;
      const { ctx } = audio();
      g = ctx.createGain();
      g.gain.value = 0.0001;
      route(g, 0.3);
      srcs = build(ctx, g);
      srcs.forEach((s) => s.start());
      g.gain.setTargetAtTime(level, ctx.currentTime, fadeIn / 3);
    },
    stop(fade = 1) {
      if (!g) return;
      const { ctx } = audio();
      const gg = g;
      const ss = srcs;
      g = null;
      srcs = [];
      gg.gain.cancelScheduledValues(ctx.currentTime);
      gg.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 3);
      setTimeout(() => {
        ss.forEach((s) => {
          try {
            s.stop();
          } catch {}
        });
        gg.disconnect();
      }, fade * 1000 + 400);
    },
  };
};

const osc = (ctx, type, freq, to, gain) => {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g).connect(to);
  return o;
};
const loopNoise = (ctx, to, type, freq, gain, q = 0.7) => {
  const { noiseBuf } = audio();
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(f).connect(g).connect(to);
  return s;
};

/* ---------- 엘리베이터 ---------- */
// 운행 중 낮은 모터 웅웅 + 케이블 바람, 아주 느리게 출렁임
const elevatorHum = drone((ctx, out) => {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 170;
  lp.connect(out);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.7;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 20;
  lfo.connect(lfoG).connect(lp.frequency);
  return [
    osc(ctx, "sawtooth", 47, lp, 0.6),
    osc(ctx, "sine", 94, out, 0.22),
    loopNoise(ctx, out, "lowpass", 420, 0.55),
    lfo,
  ];
});

const doorSlide = (delay, dur, open) => {
  noise({ delay, dur, gain: 0.13, freq: open ? 480 : 820, sweep: open ? 820 : 480, q: 0.8, attack: 0.15, hold: dur - 0.35, send: 0.4 });
  noise({ delay, dur, gain: 0.12, type: "lowpass", freq: 160, q: 0.7, attack: 0.12, hold: dur - 0.3, send: 0.2 });
  if (!open) {
    noise({ delay: delay + dur - 0.05, dur: 0.16, gain: 0.32, type: "lowpass", freq: 320, q: 1, send: 0.5 });   // 문 맞닿는 '쿵'
    tone({ delay: delay + dur - 0.05, freq: 92, to: 50, dur: 0.14, gain: 0.22, send: 0.2 });
  }
};
const clunk = (delay, k = 1) => {
  noise({ delay, dur: 0.22, gain: 0.34 * k, type: "lowpass", freq: 280, q: 1, send: 0.5 });
  tone({ delay, freq: 74, to: 42, dur: 0.2, gain: 0.3 * k, send: 0.2 });
  for (let i = 0; i < 4; i++) noise({ delay: delay + 0.02 + i * 0.045, dur: 0.04, gain: 0.05 * k, freq: 2300 + i * 400, q: 2, send: 0.4 }); // 쇠 덜그럭
};
const DING = [[1, 0.05, 1.6], [2.0, 0.012, 0.9], [2.76, 0.008, 0.6]];

// 내려가는 영상(5초): 방에서 엘리베이터 밖 복도로 빠져나온 뒤 3.4초쯤 문이 닫힘 → 운행 시작
export const elevatorDownCues = [
  { t: 3.35, fn: play(() => doorSlide(0, 0.6, false)) },
  { t: 3.95, fn: () => elevatorHum.start(0.22, 1.2) },
];
// 영상 사이 3초 덜컹덜컹(engine applyShake의 덜컹 시점과 같음: 0.24 · 1.19 · 2.14초)
export const elevatorShake = play(() => {
  elevatorHum.start(0.22, 0.6);
  [0.24, 1.19, 2.14].forEach((d, i) => clunk(d, i === 1 ? 1 : 0.8));
  for (let i = 0; i < 10; i++) noise({ delay: 0.1 + i * 0.29 + Math.random() * 0.1, dur: 0.05, gain: 0.03, freq: 1800 + Math.random() * 1500, q: 2, send: 0.4 });
});
// 올라가는 영상(5초): 도착 '딩동' → 0.55초부터 문 열림 → 방으로 들어가며 운행음 사라짐
export const elevatorUpCues = [
  { t: 0.02, fn: play(() => {
    ring(DING.map(([m, g, d]) => [1318.5 * m, g, d]), { send: 1 });
    ring(DING.map(([m, g, d]) => [1046.5 * m, g, d]), { delay: 0.42, send: 1 });
  }) },
  { t: 0.55, fn: play(() => doorSlide(0, 0.95, true)) },
  { t: 1.3, fn: () => elevatorHum.stop(2.5) },
];

/* ---------- 자판기 ---------- */
// 냉장 자판기의 낮은 웅 + 형광등 지직
const vendHum = drone((ctx, out) => [
  osc(ctx, "sine", 60, out, 0.5),
  osc(ctx, "sine", 120, out, 0.28),
  osc(ctx, "triangle", 180, out, 0.06),
  loopNoise(ctx, out, "highpass", 6500, 0.05),
]);
export const vendHumOn = () => vendHum.start(0.07, 1.5);
export const vendHumOff = (fade = 1.5) => vendHum.stop(fade);

// 과자를 고르면 삑삑
export const vendBeep = play(() => {
  tone({ freq: 1568, dur: 0.08, gain: 0.035, type: "square", hold: 0.05, send: 0.3 });
  tone({ delay: 0.12, freq: 2093, dur: 0.1, gain: 0.035, type: "square", hold: 0.06, send: 0.3 });
});

// 나선 모터가 돌며 봉지를 밀어냄(웅 + 나선이 한 칸씩 걸리는 딸깍)
const motor = (dur) => {
  const { ctx } = audio();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(92, t + 0.2);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.12);
  g.gain.setValueAtTime(0.09, t + dur - 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g);
  route(g, 0.3);
  o.start(t);
  o.stop(t + dur + 0.05);
  for (let d = 0.12; d < dur - 0.05; d += 0.17) noise({ delay: d, dur: 0.025, gain: 0.07, freq: 1300, q: 1.8, send: 0.3 });
  noise({ delay: dur - 0.02, dur: 0.04, gain: 0.12, freq: 900, q: 1.5, send: 0.3 });
};
// 털썩: 봉지가 꺼내는 칸 바닥에 떨어짐(묵직한 둔탁 + 봉지 바스락 + 작게 한 번 더 튐)
const thud = () => {
  noise({ dur: 0.3, gain: 0.6, type: "lowpass", freq: 240, q: 0.9, attack: 0.004, send: 0.5 });
  tone({ freq: 80, to: 40, dur: 0.24, gain: 0.4, send: 0.2 });
  noise({ dur: 0.18, gain: 0.1, freq: 2800, q: 0.6, attack: 0.004, send: 0.3 });
  noise({ delay: 0.05, dur: 0.16, gain: 0.06, freq: 4300, q: 0.7, send: 0.3 });
  noise({ delay: 0.15, dur: 0.12, gain: 0.16, type: "lowpass", freq: 320, q: 0.8, send: 0.4 });
  noise({ delay: 0.15, dur: 0.1, gain: 0.04, freq: 3400, q: 0.7, send: 0.3 });
};
// 과자 영상(4초)마다 봉지가 아래로 빠져나가는 시점(초): Cheerful · Dreamy · Brave · Kind · Free · Lucky
const SNACK_DROP = [3.62, 3.36, 3.45, 2.72, 3.05, 3.7];
export const snackCues = SNACK_DROP.map((d) => [
  { t: 0.3, fn: play(() => motor(d - 0.3 - 0.45)) },
  { t: d, fn: play(thud) },
]);

export const stopAll = () => {
  elevatorHum.stop(0.6);
  vendHum.stop(0.6);
};
