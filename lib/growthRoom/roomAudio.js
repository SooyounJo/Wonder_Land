// 메인 BGM + 다이얼 4구간: 아침·morning / 뉘엿·evening / 저녁·night / 밤·deep night
const MAIN = "/main%20audio.mp3";
const TRACKS = {
  day: "/morning.mp3",
  eve: "/evening.mp3",
  night: "/night.mp3",
  deep: "/deep%20night.mp3",
};

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

  const step = () => {
    mainLevel += (mainTarget - mainLevel) * 0.06;
    main.volume = mainLevel;
    applyMix();
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
      [main, ...timeTracks].forEach((a) => {
        a.pause();
        a.src = "";
      });
    },
  };
}
