import * as roomSfx from "./roomSfx";

// 메인 BGM + 다이얼 4구간: 아침·morning / 뉘엿·evening / 저녁·night / 밤·deep night
const MAIN = "/main%20audio.mp3";
const TRACKS = {
  day: "/morning.mp3",
  eve: "/evening.mp3",
  night: "/night.mp3",
  deep: "/deep%20night.mp3",
};

// 모든 장면 밑에 계속 깔리는 바람 소리(원본 Windy Forrest.mp3가 너무 작아 +32dB 키운 파일)
// 끝나기 FADE초 전에 같은 곡을 처음부터 하나 더 틀어 서로 교차해 이어짐
const BED = { src: "/wind-bed.mp3", level: 0.85, fade: 5, fadeIn: 4 };

const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// 다이얼 v(0~1) → 네 눈금(0, 1/3, 2/3, 1) 주변에서 겹치며 섞임
function mixFromDial(v) {
  const bell = (c) => smooth(1 - Math.abs(v - c) / 0.34);
  const day = bell(0);
  const eve = bell(1 / 3);
  const night = bell(2 / 3);
  const deep = bell(1);
  const sum = day + eve + night + deep || 1;
  const g = 0.58 / Math.max(1, sum * 0.85);
  return { day: day * g, eve: eve * g, night: night * g, deep: deep * g };
}

export function createRoomAudio() {
  const mk = (src) => {
    const a = new Audio(src);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    return a;
  };
  const main = mk(MAIN);
  const day = mk(TRACKS.day);
  const eve = mk(TRACKS.eve);
  const night = mk(TRACKS.night);
  const deep = mk(TRACKS.deep);
  const timeTracks = [day, eve, night, deep];
  const beds = [mk(BED.src), mk(BED.src)];
  beds.forEach((a) => {
    a.loop = false;
  });
  let bedCur = 0;
  let bedCrossing = false;
  let bedIn = 0;
  let bedLast = 0;

  let unlocked = false;
  let mainTarget = 0;
  let mainLevel = 0;
  let dialOn = false;
  let mix = { day: 0, eve: 0, night: 0, deep: 0 };
  let tick = 0;

  const tryPlay = (a) => {
    if (!unlocked) return;
    if (a.paused) a.play().catch(() => {});
  };

  const unlock = () => {
    roomSfx.unlock();
    if (unlocked) return;
    unlocked = true;
    if (mainTarget > 0.02) tryPlay(main);
    if (dialOn) timeTracks.forEach(tryPlay);
  };

  const applyMix = () => {
    if (!dialOn) {
      timeTracks.forEach((a) => {
        a.volume = 0;
      });
      return;
    }
    day.volume = mix.day;
    eve.volume = mix.eve;
    night.volume = mix.night;
    deep.volume = mix.deep;
  };

  const stepBed = (now) => {
    const dt = Math.min(0.1, (now - (bedLast || now)) / 1000);
    bedLast = now;
    if (!unlocked) return;
    bedIn = Math.min(1, bedIn + dt / BED.fadeIn);
    const a = beds[bedCur];
    const b = beds[1 - bedCur];
    // 탭이 가려져 교차를 놓치고 끝나버렸으면 바로 다음 것으로
    if (a.ended && !bedCrossing) {
      bedCur = 1 - bedCur;
      b.currentTime = 0;
      tryPlay(b);
      return;
    }
    tryPlay(a);
    const dur = a.duration;
    if (!bedCrossing && Number.isFinite(dur) && dur > BED.fade * 2 && a.currentTime > dur - BED.fade) {
      bedCrossing = true;
      b.currentTime = 0;
      b.volume = 0;
      tryPlay(b);
    }
    const level = BED.level * smooth(bedIn);
    if (bedCrossing) {
      // 같은 크기로 들리게 cos/sin 곡선으로 교차
      const p = Math.min(1, Math.max(0, (a.currentTime - (dur - BED.fade)) / BED.fade));
      a.volume = level * Math.cos((p * Math.PI) / 2);
      b.volume = level * Math.sin((p * Math.PI) / 2);
      if (p >= 1 || a.ended) {
        a.pause();
        bedCur = 1 - bedCur;
        bedCrossing = false;
      }
    } else {
      a.volume = level;
    }
  };

  const step = (now) => {
    mainLevel += (mainTarget - mainLevel) * 0.06;
    main.volume = mainLevel;
    applyMix();
    stepBed(now);
    tick = requestAnimationFrame(step);
  };
  tick = requestAnimationFrame(step);

  const startDialAudio = (v) => {
    dialOn = true;
    mix = mixFromDial(v);
    mainTarget = 0;
    timeTracks.forEach(tryPlay);
    applyMix();
  };

  const stopDialAudio = () => {
    dialOn = false;
    mix = { day: 0, eve: 0, night: 0, deep: 0 };
    timeTracks.forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    applyMix();
  };

  return {
    unlock,
    setScene(scene, dialV = 1) {
      const finale = scene === "approach" || scene === "bloom" || scene === "solo";
      if (scene === "dial") {
        startDialAudio(dialV);
        return;
      }
      // 고른 시간대 곡은 꽃이 피는 동안과 마지막 화면에서도 이어서 반복
      if (finale) {
        mainTarget = 0;
        const v = Math.min(1, Math.max(0, dialV));
        const stop = Math.round(v * 3) / 3;
        if (!dialOn) startDialAudio(stop);
        else {
          mix = mixFromDial(stop);
          timeTracks.forEach(tryPlay);
          applyMix();
        }
        return;
      }
      if (dialOn) stopDialAudio();
      mainTarget = 1;
      tryPlay(main);
    },
    setDial(v) {
      if (!dialOn) return;
      mix = mixFromDial(v);
      applyMix();
    },
    dispose() {
      cancelAnimationFrame(tick);
      [main, ...timeTracks, ...beds].forEach((a) => {
        a.pause();
        a.src = "";
      });
    },
  };
}
