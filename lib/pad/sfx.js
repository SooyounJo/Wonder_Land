// 아이패드 효과음: 파일 없이 Web Audio로 합성(종이 · 도자기 · 유리 · 흙 · 플라스틱 버튼 · 모터)
// 오디오 컨텍스트는 하나만 만들어 모든 장면이 같이 씀. iOS는 첫 터치 안에서 만들어져야 하므로
// 모든 소리는 pointerdown 등 손가락 이벤트 안에서 처음 불리게 됨. delay(초)로 조금 뒤에 나게 예약 가능
let ctx = null;
let out = null;
let wet = null;
let noiseBuf = null;

// 메인 화면 효과음(lib/growthRoom/roomSfx.js)도 같은 합성 도구를 씀
export const audio = () => ({ ctx, out, noiseBuf });

export const ensure = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 1.6;
    comp.knee.value = 8;
    out = ctx.createGain();
    out.gain.value = 2.3;
    out.connect(comp).connect(ctx.destination);
    // 작은 방 울림(소리가 공간에 놓인 느낌만 살짝)
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 0.9);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.16;
    wet.connect(conv).connect(out);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

export const route = (node, send = 0.5) => {
  node.connect(out);
  if (send > 0) {
    const s = ctx.createGain();
    s.gain.value = send;
    node.connect(s).connect(wet);
  }
};

// 엔벨로프: attack까지 올라갔다가 hold 동안 유지, 그 뒤 dur까지 사라짐
export const envelope = (param, t, gain, { attack = 0.002, hold = 0, dur = 0.1 }) => {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(gain, t + attack);
  if (hold > 0) param.setValueAtTime(gain, t + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, t + dur);
};

export const noise = ({ delay = 0, dur = 0.1, gain = 0.2, type = 'bandpass', freq = 1500, q = 1, attack, hold, send, sweep }) => {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  envelope(g.gain, t, gain, { attack, hold, dur });
  src.connect(f).connect(g);
  route(g, send);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
};

export const tone = ({ delay = 0, freq = 440, to, dur = 0.2, gain = 0.1, type = 'sine', attack = 0.002, hold, send }) => {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  envelope(g.gain, t, gain, { attack, hold, dur });
  o.connect(g);
  route(g, send);
  o.start(t);
  o.stop(t + dur + 0.05);
};

export const play = (fn) => (...args) => {
  try {
    if (ensure()) fn(...args);
  } catch {}
};

// 패드에서 난 소리를 메인 화면에도 같은 타이밍에 재생. 메인이 받아 다시 보내진 않게 이름표만 붙임
let relay = null;
let lastScrapeAt = 0;
let lastScrapeSpeed = 0;
const table = {};
export const setSfxRelay = (fn) => {
  relay = fn;
};
const announce = (name, args) => {
  if (!relay) return;
  if (name === "scrape") {
    const speed = args[0] || 0;
    const now = performance.now();
    if (speed < 1 && lastScrapeSpeed < 1) return;
    if (speed >= 1 && now - lastScrapeAt < 70 && Math.abs(speed - lastScrapeSpeed) < 80) return;
    lastScrapeAt = now;
    lastScrapeSpeed = speed;
  }
  relay(name, args);
};
const fx = (name, fn) => {
  const run = play(fn);
  table[name] = run;
  return (...args) => {
    run(...args);
    announce(name, args);
  };
};
export const playSfx = (name, args) => {
  const run = table[name];
  if (typeof run !== "function") return;
  run(...(Array.isArray(args) ? args.slice(0, 4) : []));
};

// 비화음 배음(유리 · 도자기 울림). 매번 조금씩 다르게
export const ring = (partials, { delay = 0, gain = 1, pitch = 1, send = 0.8 } = {}) => {
  const j = 1 + (Math.random() - 0.5) * 0.03;
  partials.forEach(([f, g, d]) => tone({ delay, freq: f * pitch * j, dur: d, gain: g * gain, send }));
};
const GLASS = [[1870, 0.05, 0.9], [3260, 0.034, 0.6], [4720, 0.024, 0.4], [6930, 0.014, 0.25]];
const CERAMIC = [[2630, 0.026, 0.45], [4210, 0.016, 0.3], [6150, 0.009, 0.2]];

/* ---------- 공통 딸깍(기존 라디오 · 자판기 소리) ---------- */
export const click = fx("click", (strength = 1, pitch = 1, center = 1800) => {
  noise({ dur: 0.032, gain: 1.25 * strength, freq: center * pitch, q: 1.4, send: 0.3 });
});

/* ---------- 1. 차 카드 ---------- */
export const cardPick = fx("cardPick", () => {
  noise({ dur: 0.06, gain: 0.72, type: 'highpass', freq: 2600, q: 0.7, send: 0.28 });           // 종이가 튕기는 소리
  noise({ dur: 0.22, gain: 0.24, freq: 1300, q: 0.6, attack: 0.04, sweep: 2600, send: 0.35 });   // 들어 올리며 스치는 바람
  tone({ freq: 190, to: 120, dur: 0.06, gain: 0.18, send: 0 });
});
export const cardDrop = fx("cardDrop", (onPlate, delay = 0) => {
  if (onPlate) {
    noise({ delay, dur: 0.08, gain: 0.9, freq: 950, q: 1, send: 0.4 });
    tone({ delay, freq: 150, to: 95, dur: 0.08, gain: 0.34, send: 0 });
    ring(CERAMIC, { delay, gain: 2.4 });                                                        // 접시에 닿는 사기 울림
  } else {
    noise({ delay, dur: 0.1, gain: 0.58, type: 'lowpass', freq: 700, q: 0.7, send: 0.28 });     // 천 위에 툭
    noise({ delay, dur: 0.07, gain: 0.16, type: 'highpass', freq: 3000, q: 0.7, send: 0.15 });
  }
});

/* ---------- 2. 의자 유리병 ---------- */
export const glassPick = fx("glassPick", () => {
  noise({ dur: 0.02, gain: 0.1, type: 'highpass', freq: 4200, q: 0.7, send: 0.2 });
  ring(GLASS, { gain: 0.9 });                                                                    // 손에 쥘 때 '팅'
  noise({ delay: 0.02, dur: 0.18, gain: 0.05, freq: 3200, q: 0.5, attack: 0.03, send: 0.2 });   // 잔디에서 떨어지는 사각
});
export const glassSet = fx("glassSet", (delay = 0) => {
  noise({ delay, dur: 0.14, gain: 0.28, type: 'lowpass', freq: 380, q: 0.8, send: 0.3 });      // 잔디 위에 '툭'
  tone({ delay, freq: 96, to: 58, dur: 0.12, gain: 0.18, send: 0 });
  ring(GLASS, { delay: delay + 0.005, gain: 0.45, pitch: 0.92 });
  noise({ delay, dur: 0.12, gain: 0.04, freq: 3000, q: 0.5, send: 0.1 });
});
export const glassSink = fx("glassSink", (delay = 0, dur = 2.6) => {
  // 흙 속으로 가라앉는 낮은 울림 + 사르륵 흙 부서지는 소리, 처음에 유리가 흙에 스치는 먹먹한 울림
  noise({ delay, dur, gain: 0.32, type: 'lowpass', freq: 170, q: 0.7, attack: dur * 0.35, hold: dur * 0.2, send: 0.4 });
  noise({ delay, dur: dur * 0.9, gain: 0.035, freq: 1100, q: 0.6, attack: dur * 0.3, hold: dur * 0.15, sweep: 500, send: 0.3 });
  ring(GLASS, { delay: delay + 0.05, gain: 0.25, pitch: 0.6, send: 1 });
});

/* ---------- 3. 과자 자판기 ---------- */
export const buttonDown = fx("buttonDown", (pitch = 1, strength = 1) => {
  noise({ dur: 0.035, gain: 1.4 * strength, freq: 2400 * pitch, q: 1.2, send: 0.3 });
  tone({ freq: 190 * pitch, to: 70, dur: 0.08, gain: 0.95 * strength, send: 0 });
});
export const buttonUp = fx("buttonUp", (strength = 0.45) => {
  noise({ dur: 0.035, gain: 1.4 * strength, freq: 3100, q: 1.2, send: 0.3 });
  tone({ freq: 250, to: 90, dur: 0.07, gain: 0.95 * strength, send: 0 });
});
// 카드가 투입구로 덜컥덜컥 빨려 들어감(모터 웅 + 종이 마찰 + 걸림 딸깍 steps번 + 끝에 철컥)
export const cardInsert = fx("cardInsert", (delay = 0, dur = 1.6, steps = 7) => {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(62, t);
  o.frequency.linearRampToValueAtTime(78, t + dur * 0.3);
  o.frequency.linearRampToValueAtTime(70, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ctx.createGain();
  envelope(g.gain, t, 0.07, { attack: 0.08, hold: dur - 0.2, dur: dur + 0.05 });
  o.connect(lp).connect(g);
  route(g, 0.3);
  o.start(t);
  o.stop(t + dur + 0.1);
  noise({ delay, dur, gain: 0.045, freq: 2300, q: 0.8, attack: 0.1, hold: dur - 0.3, send: 0.2 });
  for (let k = 0; k < steps; k++) {
    noise({ delay: delay + ((k + 0.5) / steps) * dur, dur: 0.025, gain: 0.16, freq: 1500, q: 1.6, send: 0.2 });
  }
  noise({ delay: delay + dur, dur: 0.12, gain: 0.3, type: 'lowpass', freq: 650, q: 1, send: 0.4 });
  tone({ delay: delay + dur, freq: 120, to: 55, dur: 0.14, gain: 0.2, send: 0.1 });
});

/* ---------- 4. 라디오 ---------- */
export const goDown = fx("goDown", () => {
  noise({ dur: 0.035, gain: 1.25, freq: 1100, q: 1.4, send: 0.3 });
  tone({ freq: 160, to: 85, dur: 0.08, gain: 0.55, send: 0 });
});
export const goConfirm = fx("goConfirm", () => {
  noise({ dur: 0.04, gain: 1.45, freq: 820, q: 1.3, send: 0.4 });
  tone({ freq: 120, to: 52, dur: 0.15, gain: 0.8, send: 0.15 });
  tone({ delay: 0.01, freq: 2350, dur: 0.24, gain: 0.04, send: 0.6 });                         // 스프링 여운
});
export const goCancel = fx("goCancel", () => {
  noise({ dur: 0.03, gain: 0.85, freq: 1600, q: 1.4, send: 0.25 });
});

// 손잡이가 홈을 따라 미끄러지는 마찰음(속도에 따라 커지고 높아짐). 계속 켜 두고 set(px/s)로 조절
const makeScrape = () => {
  let src = null;
  let f = null;
  let g = null;
  const start = () => {
    if (src || !ensure()) return;
    src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.value = 900;
    g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g);
    route(g, 0.2);
    src.start();
  };
  return {
    set(speed) {
      try {
        if (!src) {
          if (speed < 1) return;
          start();
          if (!src) return;
        }
        const t = ctx.currentTime;
        const k = Math.min(1, speed / 900);
        g.gain.setTargetAtTime(0.58 * k * k, t, 0.04);
        f.frequency.setTargetAtTime(700 + 900 * k, t, 0.05);
      } catch {}
    },
    stop() {
      try {
        src?.stop();
      } catch {}
      src = null;
    },
  };
};
let remoteScrape = null;
table.scrape = (speed) => {
  if (!remoteScrape) remoteScrape = makeScrape();
  remoteScrape.set(speed);
};
table.scrapeStop = () => {
  remoteScrape?.stop();
  remoteScrape = null;
};
export const createScrape = () => {
  const scrape = makeScrape();
  return {
    set(speed) {
      scrape.set(speed);
      announce("scrape", [speed]);
    },
    stop() {
      scrape.stop();
      announce("scrapeStop", []);
    },
  };
};
