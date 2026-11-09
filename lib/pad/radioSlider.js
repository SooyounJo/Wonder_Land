import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as sfx from './sfx';

// 라디오 패널: 사진(/pad/radio.webp, 손잡이·바늘을 지운 판)을 배경에 깔고
// 슬라이더 손잡이와 계기판 바늘만 입체로 올림. 좌표는 사진 픽셀 기준(2048×1146)
// 손잡이를 잡고 좌우로 밀면 바늘이 따라 움직이고, 놓으면 가장 가까운 시간(12·17·20·24시)에 딸깍 맞춰짐
const IMG = { w: 2048, h: 1146, bg: '/pad/radio.webp', knob: '/pad/radio-knob.png' };
const STOPS = [552, 878, 1184, 1511];                                   // 아침 · 뉘엿 · 저녁 · 밤
const TICKS = [552, 645, 721, 798, 878, 977, 1047, 1120, 1184, 1281, 1351, 1424, 1511];
const KNOB = { y: 745.5, w: 202, h: 129, d: 34, crop: { x: 953, y: 678, w: 210, h: 136 }, face: { x: 5, y: 3, w: 202, h: 129, r: 16 } };
const NEEDLE = { dx: 15, top: 80, bottom: 319, z: 5 };
const GO = { x: 1031, y: 985, w: 202, h: 129, d: 34, r: 16, hole: 14 };   // GO 버튼(슬라이더 손잡이와 같은 부품)
const GO_COLOR = '#b3361f';                                              // 계기판 바늘과 같은 빨강
const DIAL = { x0: 250, y0: 68, x1: 1750, y1: 338 };                    // 계기판 유리판(사진 좌표)
const GLOWS = ['#8fd6ff', '#ff9cc9', '#5d87ff', '#ffd860'];             // 하늘빛 · 핑크빛 · 푸른빛 · 노란빛
const FOV = 40;

const loadImage = (src) => new Promise((ok, fail) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = fail;
  im.src = src;
});
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 손잡이 위치(사진 x) ↔ 값(0~1): 눈금 네 개 사이를 각각 1/3씩
export const xToValue = (x) => {
  x = clamp(x, STOPS[0], STOPS[3]);
  for (let i = 0; i < 3; i++) if (x <= STOPS[i + 1]) return (i + (x - STOPS[i]) / (STOPS[i + 1] - STOPS[i])) / 3;
  return 1;
};
const valueToX = (v) => {
  const s = clamp(v, 0, 1) * 3;
  const i = Math.min(2, Math.floor(s));
  return STOPS[i] + (STOPS[i + 1] - STOPS[i]) * (s - i);
};

export function createRadioSlider({ container, value = 1, onChange = () => {}, onGo = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  let dist = 1000;
  scene.add(new THREE.HemisphereLight(0xf4fff8, 0x4d6b55, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(-0.3, 1, 0.9);
  scene.add(sun);

  const tex = (src) => {
    const t = new THREE.CanvasTexture(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  // 사진 좌표(x, y)·깊이 z → 쉬고 있을 때 사진과 같은 자리에 보이도록 원근 보정
  const kAt = (z) => (dist - z) / dist;
  const toWorldX = (x, z) => (x - IMG.w / 2) * kAt(z);
  const toWorldY = (y, z) => (IMG.h / 2 - y) * kAt(z);

  /* ---------- 상태 ---------- */
  let knobX = valueToX(value);       // 손잡이 위치(사진 x)
  let knobV = 0;                     // 스냅 애니메이션 속도
  let snapTo = null;
  let needleX = knobX + NEEDLE.dx;
  let needleV = 0;
  let grab = 0;                      // 잡고 있는 정도(0~1)
  let push = 0;                      // 선택해서 눌린 정도
  let dragging = null;
  let locked = false;
  let padDriven = false;             // 메인 화면에서 온 값을 따라갈 땐 되돌려 보내지 않음
  let lastTickIdx = TICKS.findIndex((t) => t >= knobX);

  /* ---------- 장면 ---------- */
  let knob = null;
  let knobShadow = null;
  let needle = null;
  let needleShadow = null;
  let dialGlow = null;
  let goBtn = null;
  let goShadow = null;
  let goHeld = false;                // 버튼을 누르고 있는 중
  let goPush = 0;
  let goV = 0;
  const glowColors = GLOWS.map((c) => new THREE.Color(c));
  const hit = [];
  let ready = false;
  let disposed = false;

  Promise.all([loadImage(IMG.bg), loadImage(IMG.knob)]).then(([bg, knobImg]) => {
    if (disposed) return;
    const bgTex = new THREE.Texture(bg);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    bgTex.anisotropy = maxAniso;
    bgTex.needsUpdate = true;
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(IMG.w, IMG.h), new THREE.MeshBasicMaterial({ map: bgTex }));
    scene.add(bgMesh);

    // 계기판 불빛: 사진의 호박색 빛만 골라 밝기는 두고 색만 바꿈(검은 글씨·초록 판은 그대로)
    const dw = DIAL.x1 - DIAL.x0;
    const dh = DIAL.y1 - DIAL.y0;
    const dialMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: bgTex },
        tint: { value: new THREE.Color(GLOWS[0]) },
        uvRect: { value: new THREE.Vector4(DIAL.x0 / IMG.w, 1 - DIAL.y1 / IMG.h, dw / IMG.w, dh / IMG.h) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 tint;
        uniform vec4 uvRect;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(map, uvRect.xy + vUv * uvRect.zw).rgb;
          float warm = smoothstep(0.12, 0.4, (c.r - c.b) / (c.r + 0.01));
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float lumT = dot(tint, vec3(0.2126, 0.7152, 0.0722));
          vec3 lit = tint * lum / max(lumT, 0.3);
          lit += vec3(max(0.0, lum - 0.55)) * 0.6;
          gl_FragColor = vec4(mix(c, lit, warm), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    dialGlow = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), dialMat);
    dialGlow.position.set((DIAL.x0 + DIAL.x1) / 2 - IMG.w / 2, IMG.h / 2 - (DIAL.y0 + DIAL.y1) / 2, 0.1);
    scene.add(dialGlow);

    // 바닥 그림자(손잡이 아래 판 위로 번짐)
    const sc = document.createElement('canvas');
    sc.width = 256;
    sc.height = 160;
    {
      const g = sc.getContext('2d');
      g.filter = 'blur(14px)';
      g.fillStyle = 'rgba(10,40,25,.75)';
      g.beginPath();
      g.roundRect(44, 34, 168, 92, 30);
      g.fill();
    }
    knobShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(KNOB.w * 1.35, KNOB.h * 1.35),
      new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true, depthWrite: false })
    );
    scene.add(knobShadow);

    // 손잡이: 둥근 상자 몸통 + 사진에서 오려낸 앞면
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(KNOB.w - 4, KNOB.h - 4, KNOB.d, 5, 14),
      new THREE.MeshStandardMaterial({ color: '#4c4a3c', roughness: 0.55, metalness: 0.05 })
    );
    body.position.z = -KNOB.d / 2;
    group.add(body);
    const fc = document.createElement('canvas');
    fc.width = KNOB.face.w * 2;
    fc.height = KNOB.face.h * 2;
    {
      const g = fc.getContext('2d');
      g.scale(2, 2);
      g.beginPath();
      g.roundRect(0, 0, KNOB.face.w, KNOB.face.h, KNOB.face.r);
      g.clip();
      g.drawImage(knobImg, KNOB.face.x, KNOB.face.y, KNOB.face.w, KNOB.face.h, 0, 0, KNOB.face.w, KNOB.face.h);
    }
    const faceMat = new THREE.MeshBasicMaterial({ map: tex(fc), transparent: true });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(KNOB.face.w, KNOB.face.h), faceMat);
    face.position.z = 0.3;
    group.add(face);
    scene.add(group);
    knob = { group, faceMat, body };
    hit.push(body, face);

    // GO 버튼이 박힌 홈: 어두운 구멍 + 아래쪽 밝은 턱
    {
      const W = GO.w + GO.hole * 2 + 40;
      const H = GO.h + GO.hole * 2 + 40;
      const hc = document.createElement('canvas');
      hc.width = W * 2;
      hc.height = H * 2;
      const g = hc.getContext('2d');
      g.scale(2, 2);
      const hx = 20;
      const hw = GO.w + GO.hole * 2;
      const hh = GO.h + GO.hole * 2;
      g.filter = 'blur(2px)';
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.beginPath();
      g.roundRect(hx - 2, hx + 2, hw + 4, hh + 3, GO.r + GO.hole);
      g.fill();
      g.fillStyle = 'rgba(40, 70, 55, 0.55)';
      g.beginPath();
      g.roundRect(hx - 3, hx - 4, hw + 6, hh + 4, GO.r + GO.hole);
      g.fill();
      g.filter = 'blur(1px)';
      const grd = g.createLinearGradient(0, hx, 0, hx + hh);
      grd.addColorStop(0, '#0d1a14');
      grd.addColorStop(1, '#25362d');
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(hx, hx, hw, hh, GO.r + GO.hole - 2);
      g.fill();
      const hole = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshBasicMaterial({ map: tex(hc), transparent: true, depthWrite: false })
      );
      hole.position.set(GO.x - IMG.w / 2, IMG.h / 2 - GO.y, 0.15);
      scene.add(hole);
    }

    // GO 버튼: 손잡이 사진의 흰 줄 없는 플라스틱 부분을 펼쳐 앞면으로 씀
    {
      goShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(GO.w * 1.25, GO.h * 1.4),
        new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true, depthWrite: false })
      );
      scene.add(goShadow);

      const bg2 = new THREE.Group();
      const body2 = new THREE.Mesh(
        new RoundedBoxGeometry(GO.w - 4, GO.h - 4, GO.d, 5, 14),
        new THREE.MeshStandardMaterial({ color: '#5c2519', roughness: 0.55, metalness: 0.05 })
      );
      body2.position.z = -GO.d / 2;
      bg2.add(body2);

      const S = 2;
      const gc = document.createElement('canvas');
      gc.width = GO.w * S;
      gc.height = GO.h * S;
      const g = gc.getContext('2d');
      g.scale(S, S);
      g.beginPath();
      g.roundRect(0, 0, GO.w, GO.h, GO.r);
      g.clip();
      const { x: fx, y: fy, w: fw, h: fh } = KNOB.face;
      g.drawImage(knobImg, fx, fy, fw, fh, 0, 0, GO.w, GO.h);
      // 가운데 흰 줄은 바로 왼쪽 결로 덮음
      g.drawImage(knobImg, fx + 62, fy, 26, fh, 86, 0, 26, GO.h);
      // 결과 명암은 사진 그대로, 색만 바늘 빨강으로
      g.globalCompositeOperation = 'color';
      g.fillStyle = GO_COLOR;
      g.fillRect(0, 0, GO.w, GO.h);
      g.globalCompositeOperation = 'source-over';
      // 음각 GO: 아래 턱에 빛 → 흰 도료를 채운 바닥 → 위쪽 안벽 그림자
      const layer = (paint) => {
        const c = document.createElement('canvas');
        c.width = gc.width;
        c.height = gc.height;
        const l = c.getContext('2d');
        l.scale(S, S);
        l.font = `500 58px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        l.textAlign = 'center';
        l.textBaseline = 'middle';
        l.letterSpacing = '8px';
        paint(l, (dy = 0) => l.fillText('GO', GO.w / 2 + 4, GO.h / 2 + 2 + dy));
        return c;
      };
      const draw = (c) => g.drawImage(c, 0, 0, GO.w, GO.h);
      draw(layer((l, text) => {
        l.fillStyle = 'rgba(255, 215, 200, 0.4)';
        text(1.6);
      }));
      draw(layer((l, text) => {
        const grd = l.createLinearGradient(0, GO.h / 2 - 24, 0, GO.h / 2 + 24);
        grd.addColorStop(0, '#d8d1bf');
        grd.addColorStop(1, '#f1ece0');
        l.fillStyle = grd;
        text();
      }));
      draw(layer((l, text) => {
        l.fillStyle = 'rgba(40, 8, 2, 0.7)';
        l.fillRect(0, 0, GO.w, GO.h);
        l.globalCompositeOperation = 'destination-out';
        l.filter = 'blur(1.2px)';
        text(2.4);
        l.filter = 'none';
        l.globalCompositeOperation = 'destination-in';
        text();
      }));
      const goFaceMat = new THREE.MeshBasicMaterial({ map: tex(gc), transparent: true });
      const face2 = new THREE.Mesh(new THREE.PlaneGeometry(GO.w, GO.h), goFaceMat);
      face2.position.z = 0.3;
      bg2.add(face2);
      scene.add(bg2);
      goBtn = { group: bg2, faceMat: goFaceMat, hit: [body2, face2] };
    }

    // 바늘: 위가 넓은 머리 + 가는 몸통(입체로 살짝 두께)
    const s = new THREE.Shape();
    const len = NEEDLE.bottom - NEEDLE.top;
    s.moveTo(-17, 0);
    s.lineTo(17, 0);
    s.lineTo(16, 6);
    s.lineTo(5, 26);
    s.lineTo(3.6, 34);
    s.lineTo(3.4, len - 26);
    s.lineTo(4.6, len - 18);
    s.lineTo(2.2, len);
    s.lineTo(-2.2, len);
    s.lineTo(-4.6, len - 18);
    s.lineTo(-3.4, len - 26);
    s.lineTo(-3.6, 34);
    s.lineTo(-5, 26);
    s.lineTo(-16, 6);
    s.closePath();
    const needleGeo = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.6, bevelSegments: 2 });
    needleGeo.scale(1, -1, 1);                // 위(0)에서 아래(len)로
    needle = new THREE.Mesh(needleGeo, new THREE.MeshStandardMaterial({ color: GO_COLOR, roughness: 0.45, emissive: '#5a0d02', emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    scene.add(needle);
    const nsc = document.createElement('canvas');
    nsc.width = 64;
    nsc.height = 512;
    {
      const g = nsc.getContext('2d');
      g.filter = 'blur(4px)';
      g.fillStyle = 'rgba(70,35,10,.55)';
      g.fillRect(22, 10, 20, 70);
      g.fillRect(28, 60, 8, 440);
    }
    needleShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(40, len + 20),
      new THREE.MeshBasicMaterial({ map: tex(nsc), transparent: true, depthWrite: false })
    );
    scene.add(needleShadow);

    ready = true;
    resize();
  }).catch(() => {});

  /* ---------- 크기 맞춤(cover) ---------- */
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const visH = camera.aspect < IMG.w / IMG.h ? IMG.h : IMG.w / camera.aspect;
    dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.near = dist * 0.1;
    camera.far = dist * 3;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- 소리: 잡을 때·눈금 지날 때·딸깍 맞춰질 때·미끄러지는 마찰음 ---------- */
  const scrape = sfx.createScrape();
  let prevKnobX = null;

  /* ---------- 잡고 밀기 ---------- */
  const ray = new THREE.Raycaster();
  const nd = new THREE.Vector2();
  const facePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const tmp = new THREE.Vector3();
  const setRay = (e) => {
    const r = canvas.getBoundingClientRect();
    nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(nd, camera);
  };
  // 손가락 위치 → 사진 x (손잡이 앞면 높이에서)
  const imgXAt = (e) => {
    setRay(e);
    facePlane.constant = -KNOB.d;
    if (!ray.ray.intersectPlane(facePlane, tmp)) return null;
    return tmp.x / kAt(KNOB.d) + IMG.w / 2;
  };
  const onTrack = (e) => {
    setRay(e);
    facePlane.constant = 0;
    if (!ray.ray.intersectPlane(facePlane, tmp)) return false;
    const y = IMG.h / 2 - tmp.y;
    const x = tmp.x + IMG.w / 2;
    return Math.abs(y - KNOB.y) < 90 && x > STOPS[0] - 120 && x < STOPS[3] + 120;
  };

  const down = (e) => {
    if (!ready || locked) return;
    setRay(e);
    if (ray.intersectObjects(goBtn.hit).length > 0) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      goHeld = true;
      sfx.goDown();
      return;
    }
    const onKnob = ray.intersectObjects(hit).length > 0;
    if (!onKnob && !onTrack(e)) return;
    const x = imgXAt(e);
    if (x == null) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    snapTo = null;
    padDriven = true;
    // 홈을 누르면 손잡이가 그 자리로 미끄러져 옴
    dragging = { off: onKnob ? knobX - x : 0, x0: e.clientX, moved: !onKnob, onKnob };
    if (!onKnob) snapTo = clamp(x, STOPS[0], STOPS[3]);
    sfx.click(0.8, 0.7);
  };
  const move = (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - dragging.x0) > 6) dragging.moved = true;
    if (!dragging.moved) return;
    const x = imgXAt(e);
    if (x == null) return;
    snapTo = null;
    knobX = clamp(x + dragging.off, STOPS[0], STOPS[3]);
    knobV = 0;
  };
  const up = (e) => {
    if (goHeld) {
      goHeld = false;
      setRay(e);
      // 손가락을 버튼 위에서 뗐을 때만 결정(밖으로 빼면 취소)
      if (e.type === 'pointerup' && ray.intersectObjects(goBtn.hit).length > 0) {
        snapTo = valueToX(Math.round(xToValue(snapTo ?? knobX) * 3) / 3);
        locked = true;
        sfx.goConfirm();
        onGo();
      } else {
        sfx.goCancel();
      }
      return;
    }
    const d = dragging;
    if (!d) return;
    dragging = null;
    const v = xToValue(snapTo ?? knobX);
    snapTo = valueToX(Math.round(v * 3) / 3);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* ---------- 그리기 ---------- */
  let raf = 0;
  let last = performance.now();
  let sentV = -1;
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (ready) {
      // 스냅: 스프링으로 미끄러져 멈춤
      if (snapTo != null && !(dragging && dragging.onKnob && dragging.moved)) {
        const steps = 4;
        for (let s = 0; s < steps; s++) {
          const h = dt / steps;
          knobV += (260 * (snapTo - knobX) - 26 * knobV) * h;
          knobX += knobV * h;
        }
        if (Math.abs(snapTo - knobX) < 0.3 && Math.abs(knobV) < 4) {
          knobX = snapTo;
          knobV = 0;
          if (STOPS.includes(snapTo) && !dragging) sfx.click(1, 0.55);   // 제자리에 딸깍
          snapTo = null;
          sentV = -1;                                                 // 멈춘 정확한 값을 한 번 더 보냄
        }
      }
      knobX = clamp(knobX, STOPS[0] - 6, STOPS[3] + 6);

      // 눈금을 지날 때마다 작게 딸각
      const ti = TICKS.findIndex((t) => t >= knobX);
      if (ti !== lastTickIdx) {
        if (padDriven) sfx.click(0.28, 1.4);
        lastTickIdx = ti;
      }
      // 손으로 밀 때만 마찰음(메인 화면에서 따라 움직일 땐 조용히)
      if (prevKnobX != null) scrape.set(padDriven ? Math.abs(knobX - prevKnobX) / Math.max(dt, 1e-3) : 0);
      prevKnobX = knobX;

      const v = xToValue(knobX);
      if (Math.abs(v - sentV) > 0.002) {
        sentV = v;
        onChange(v, padDriven);
      }

      // 바늘: 손잡이를 실에 매단 듯 살짝 늦게 따라오다 멈추며 흔들림
      const target = knobX + NEEDLE.dx;
      needleV += (90 * (target - needleX) - 11 * needleV) * dt;
      needleX += needleV * dt;

      grab += ((dragging ? 1 : 0) - grab) * Math.min(1, dt * 14);
      push += ((locked ? 1 : 0) - push) * Math.min(1, dt * 10);

      // 손잡이: 잡으면 살짝 들리고(그림자 넓어짐), 선택하면 눌려 들어감
      const z = KNOB.d + grab * 4 - push * 8;
      const k = kAt(KNOB.d);
      knob.group.position.set(toWorldX(knobX, KNOB.d), toWorldY(KNOB.y, KNOB.d), z);
      knob.group.scale.setScalar(k * (1 + grab * 0.015));
      knob.group.rotation.y = THREE.MathUtils.clamp(-knobV * 0.00025, -0.08, 0.08);
      const shade = 1 - push * 0.15 + grab * 0.04;
      knob.faceMat.color.setScalar(shade);
      knobShadow.position.set(toWorldX(knobX + 4 + grab * 4, 0.5), toWorldY(KNOB.y + 20 + grab * 8, 0.5), 0.5);
      knobShadow.material.opacity = 0.55 + grab * 0.25 - push * 0.3;
      knobShadow.scale.setScalar(1 + grab * 0.08);

      needle.position.set(toWorldX(needleX, NEEDLE.z), toWorldY(NEEDLE.top, NEEDLE.z), NEEDLE.z - 2.2);
      needle.scale.set(kAt(NEEDLE.z), kAt(NEEDLE.z), 1);
      needle.rotation.z = THREE.MathUtils.clamp((target - needleX) * 0.0016, -0.05, 0.05);
      needleShadow.position.set(toWorldX(needleX + 6, 0.4), toWorldY((NEEDLE.top + NEEDLE.bottom) / 2 + 4, 0.4), 0.4);

      // GO 버튼: 누르는 동안 깊이 들어가고, 결정되면 반쯤 눌린 채로 멈춤
      {
        const target = goHeld ? 1 : locked ? 0.6 : 0;
        const steps = 3;
        for (let i = 0; i < steps; i++) {
          const h = dt / steps;
          goV += (900 * (target - goPush) - 32 * goV) * h;
          goPush += goV * h;
        }
        const travel = GO.d * 0.62;
        const z = GO.d - goPush * travel;
        goBtn.group.position.set(toWorldX(GO.x, GO.d), toWorldY(GO.y, GO.d), z);
        goBtn.group.scale.setScalar(kAt(GO.d) * (1 - goPush * 0.03));
        goBtn.faceMat.color.setScalar(1 - goPush * 0.22);
        goShadow.position.set(toWorldX(GO.x + 5 - goPush * 3, 0.3), toWorldY(GO.y + 18 - goPush * 12, 0.3), 0.3);
        goShadow.material.opacity = 0.7 - goPush * 0.45;
        goShadow.scale.setScalar(1 - goPush * 0.1);
      }

      // 바늘이 가리키는 시간대 색으로, 사이에선 두 색이 섞임
      const s = xToValue(needleX - NEEDLE.dx) * 3;
      const gi = Math.min(2, Math.floor(s));
      dialGlow.material.uniforms.tint.value.copy(glowColors[gi]).lerp(glowColors[gi + 1], s - gi);
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    // 메인 화면에서 바뀐 값을 따라감(잡고 있을 땐 무시)
    setValue(v) {
      if (dragging || snapTo != null || locked) return;
      const x = valueToX(v);
      if (Math.abs(x - knobX) > 1) {
        padDriven = false;
        snapTo = x;
      }
    },
    lock() {
      locked = true;
      dragging = null;
      sfx.goConfirm();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      scrape.stop();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}
