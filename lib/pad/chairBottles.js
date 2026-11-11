import * as THREE from 'three';
import * as sfx from './sfx';

// 분홍 구름 아래 잔디 언덕(사진) 위에 옷 입힌 의자가 든 유리병 세 개
// 병을 집으면 떠오르고 그림자가 햇빛 방향으로 밀려나며 흐려짐 → 가운데 흙자리에 놓으면 구덩이가 열리고 병이 빠지며 선택
// 좌표는 사진 픽셀 기준(1024×572, y는 아래로). 월드 좌표는 (x, -y)
const IMG = { w: 1024, h: 572, src: '/pad/chair-field.webp' };
const HOLE = { x: 510, y: 491, rx: 80, ry: 23 };
const PIT = 0.9;                                   // 흙자리 중 실제로 뚫리는 비율
const BOTTLE = { w: 176, h: 386, base: 377 };      // 병 이미지 크기 · 병 바닥(가운데)의 높이(위에서부터)
const VB = 1 - BOTTLE.base / BOTTLE.h;             // 이미지 아래에서 병 바닥까지(uv)
const PIVOT = 0.74;                                // 손가락이 잡는 높이(병 목 부근, 병 높이 비율)
const DEPTH = { horizon: 200, ref: 445, scale: 0.69 }; // 바닥이 y=ref일 때 이미지의 0.69배, 멀어질수록 작아짐
const K = HOLE.ry / HOLE.rx;                       // 땅의 깊이 방향이 화면에서 눌리는 비율
const SUN = { a: THREE.MathUtils.degToRad(15), len: 0.55 }; // 그림자: 오른쪽 조금 뒤로, 병 높이의 0.55배
const LIFT = { hold: 10, drag: 42 };
const SINK = { start: 1.3, dur: 2.6 };               // 놓은 뒤 머무는 시간 · 가라앉는 시간(초)
const GROUND = { top: 360, bottom: 560 };

// 그림자 축(병 높이 1 · 너비 1 당 화면 이동, 월드 y는 위쪽)
const SH_Y = new THREE.Vector2(SUN.len * Math.cos(SUN.a), SUN.len * Math.sin(SUN.a) * K);
const SH_X = new THREE.Vector2(-Math.sin(SUN.a), Math.cos(SUN.a) * K);

const scaleAt = (y) => DEPTH.scale * Math.max(0.4, (y - DEPTH.horizon) / (DEPTH.ref - DEPTH.horizon));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const loadTexture = (src) => new Promise((ok, fail) => {
  new THREE.TextureLoader().load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    ok(t);
  }, undefined, fail);
});

// 병 실루엣(유리는 옅게, 옷·코르크는 진하게)을 줄여서 흐린 그림자 텍스처로
const silhouette = (img, div) => {
  let src = img;
  let w = img.width;
  let h = img.height;
  // 한 번에 줄이면 계단이 생기므로 반씩 여러 번 줄여 부드럽게 흐림
  while (w / 2 >= img.width / div) {
    w = Math.max(2, Math.round(w / 2));
    h = Math.max(2, Math.round(h / 2));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    src = c;
  }
  const out = document.createElement('canvas');
  out.width = w + 4;
  out.height = h + 4;
  out.getContext('2d').drawImage(src, 2, 2, w, h);
  const t = new THREE.CanvasTexture(out);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
};

const ellipseTexture = (draw, w = 256, h = 128) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  draw(g, w / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// bottles: [{ src }] 왼쪽부터, home: 사진 속 병 바닥 가운데 위치
export function createChairBottles({ container, bottles, onHover = () => {}, onSelect = () => {}, onOver = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, IMG.w, 0, -IMG.h, 0.1, 100);
  camera.position.z = 10;
  const view = { x: 0, y: 0, w: IMG.w, h: IMG.h };

  const flat = (opts) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, ...opts });

  /* ---------- 사진 ---------- */
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(IMG.w, IMG.h), flat({ transparent: false, color: 0xffffff }));
  photo.position.set(IMG.w / 2, -IMG.h / 2, 0);
  photo.renderOrder = -10;
  scene.add(photo);

  /* ---------- 구덩이(흙자리가 깊게 열림) ---------- */
  const pitTex = ellipseTexture((g, r) => {
    // 위쪽은 빛 받는 뒤쪽 안벽, 아래로 갈수록 깊어서 어두움
    const wall = g.createLinearGradient(0, -r, 0, r);
    wall.addColorStop(0, 'rgba(96,64,38,1)');
    wall.addColorStop(0.3, 'rgba(52,33,19,1)');
    wall.addColorStop(0.62, 'rgba(12,7,4,1)');
    wall.addColorStop(1, 'rgba(20,12,7,1)');
    g.fillStyle = wall;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.globalCompositeOperation = 'destination-in';
    const edge = g.createRadialGradient(0, 0, 0, 0, 0, r);
    edge.addColorStop(0.8, 'rgba(0,0,0,1)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge;
    g.fillRect(-r, -r, r * 2, r * 2);
  });
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat({ map: pitTex, opacity: 0 }));
  pit.position.set(HOLE.x, -HOLE.y, 0);
  pit.renderOrder = -5;
  scene.add(pit);
  let pitOpen = 0;

  /* ---------- 그림자 ---------- */
  const shadowMat = (sharp, soft) => new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { sharp: { value: sharp }, soft: { value: soft }, uOpacity: { value: 0.5 }, uSoft: { value: 0 }, uColor: { value: new THREE.Color('#0c2410') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D sharp, soft;
      uniform float uOpacity, uSoft;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float v = clamp((vUv.y - ${VB.toFixed(4)}) / ${(1 - VB).toFixed(4)}, 0.0, 1.0); // 바닥 0 → 위 1
        float a = mix(texture2D(sharp, vUv).a, texture2D(soft, vUv).a, clamp(v * 1.3 + uSoft, 0.0, 1.0));
        a = pow(a, 0.75) * (1.0 - 0.5 * v);  // 멀어질수록 퍼지고 옅어짐
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
  });
  const contactTex = ellipseTexture((g, r) => {
    const d = g.createRadialGradient(0, 0, 0, 0, 0, r);
    d.addColorStop(0, 'rgba(255,255,255,1)');
    d.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d;
    g.fillRect(-r, -r, r * 2, r * 2);
  }, 128, 128);
  contactTex.colorSpace = THREE.NoColorSpace;

  /* ---------- 병 ---------- */
  const unitGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5 - VB, 0); // 원점 = 병 바닥 가운데
  const holeU = new THREE.Vector4(HOLE.x, -HOLE.y, HOLE.rx * PIT, HOLE.ry * PIT);
  const bottleMat = () => new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      map: { value: null }, uShade: { value: 1 }, uSink: { value: 0 }, uDepth: { value: 0 }, uH: { value: 1 }, uHole: { value: holeU },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vW;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xy;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uShade, uSink, uDepth, uH;
      uniform vec4 uHole;
      varying vec2 vUv;
      varying vec2 vW;
      void main() {
        vec4 c = texture2D(map, vUv);
        vec3 col = c.rgb * uShade;
        float a = c.a;
        if (uSink > 0.5) {
          // 땅 아래로 내려간 부분은 구덩이 입구 안쪽으로만 보이고, 깊을수록 어두워짐
          float below = uDepth - (vUv.y - ${VB.toFixed(4)}) * uH;
          if (below > 0.0) {
            vec2 d = (vW - uHole.xy) / uHole.zw;
            a *= 1.0 - smoothstep(0.88, 1.0, dot(d, d));
            col = mix(vec3(0.04, 0.025, 0.015), col, exp(-below / 38.0));
          }
        }
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });

  const items = bottles.map((b, i) => {
    const mat = bottleMat();
    const mesh = new THREE.Mesh(unitGeo, mat);
    const pivot = new THREE.Group();
    pivot.add(mesh);
    scene.add(pivot);

    const shadow = new THREE.Mesh(unitGeo, shadowMat(null, null));
    shadow.matrixAutoUpdate = false;
    shadow.renderOrder = -3;
    shadow.visible = false;
    scene.add(shadow);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat({ map: contactTex, color: 0x08180a, opacity: 0 }));
    contact.renderOrder = -2;
    scene.add(contact);
    // 유리병이 모아 준 햇빛(그림자 속 밝은 점)
    const caustic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat({ map: contactTex, color: 0xfff0c8, opacity: 0, blending: THREE.AdditiveBlending }));
    caustic.renderOrder = -1;
    scene.add(caustic);

    loadTexture(b.src).then((t) => {
      if (disposed) return t.dispose();
      mat.uniforms.map.value = t;
      shadow.material.uniforms.sharp.value = silhouette(t.image, 3);
      shadow.material.uniforms.soft.value = silhouette(t.image, 14);
      shadow.visible = true;
    }).catch(() => {});

    return {
      mesh, pivot, mat, shadow, contact, caustic,
      home: new THREE.Vector2(b.x, b.y), pos: new THREE.Vector2(b.x, b.y), target: new THREE.Vector2(b.x, b.y),
      lift: 0, liftTarget: 0, tilt: 0, tiltVel: 0, tiltTarget: 0, dim: 0,
      fall: null, gone: false,
    };
  });

  loadTexture(IMG.src).then((t) => {
    if (disposed) return t.dispose();
    photo.material.map = t;
    photo.material.needsUpdate = true;
  }).catch(() => {});

  /* ---------- 크기 맞춤(사진이 화면을 꽉 채우고, 아래 구덩이는 항상 보이게) ---------- */
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    if (aspect < IMG.w / IMG.h) {
      view.h = IMG.h;
      view.w = IMG.h * aspect;
      view.x = (IMG.w - view.w) / 2;
      view.y = 0;
    } else {
      view.w = IMG.w;
      view.h = IMG.w / aspect;
      view.x = 0;
      view.y = IMG.h - view.h;
    }
    Object.assign(camera, { left: view.x, right: view.x + view.w, top: -view.y, bottom: -(view.y + view.h) });
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- 집고 옮기기 ---------- */
  const photoAt = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: view.x + ((e.clientX - r.left) / r.width) * view.w, y: view.y + ((e.clientY - r.top) / r.height) * view.h };
  };
  // 구덩이 자체보다 훨씬 넓은 타원. 병 바닥이 이 안에 들어오고, 처음 서 있던 자리보다 구덩이에 가까우면 빠진 것으로 침
  const CATCH = { rx: HOLE.rx * 1.9, ry: HOLE.ry * 3.4 };
  const holeDist = (p) => Math.hypot((p.x - HOLE.x) / CATCH.rx, (p.y - HOLE.y) / CATCH.ry);
  const overHole = (p, home) => {
    const d = holeDist(p);
    if (d >= 1) return false;
    if (!home) return true;
    return d < holeDist(home) * 0.72;
  };

  let active = -1;
  let chosen = -1;
  let drag = null;
  let over = false;
  let nearFor = 0;
  let order = items.map((_, i) => i);

  const dropIn = (i) => {
    if (chosen >= 0) return;
    const it = items[i];
    chosen = i;
    drag = null;
    nearFor = 0;
    it.fall = { t: 0, landed: false };
    it.target.set(HOLE.x, HOLE.y);
    it.liftTarget = 0;
    items.forEach((o, k) => {
      if (k !== i) o.dim = 1;
    });
    sfx.glassSet(0.4);
    sfx.glassSink(SINK.start, SINK.dur);
    if (over) {
      over = false;
      onOver(false);
    }
  };

  const hitTest = (p) => {
    const front = items
      .map((it, i) => i)
      .filter((i) => !items[i].fall)
      .sort((a, b) => items[b].pos.y - items[a].pos.y);
    return front.find((i) => {
      const it = items[i];
      const s = scaleAt(it.pos.y);
      const by = it.pos.y - it.lift;
      return Math.abs(p.x - it.pos.x) < BOTTLE.w * s * 0.47 && p.y < by + 10 * s && p.y > by - BOTTLE.base * s;
    }) ?? -1;
  };

  const down = (e) => {
    if (chosen >= 0) return;
    const p = photoAt(e);
    const i = hitTest(p);
    if (i < 0) return;
    const it = items[i];
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    drag = { i, off: new THREE.Vector2(it.pos.x - p.x, it.pos.y - p.y), x0: e.clientX, y0: e.clientY, moved: false };
    order = order.filter((k) => k !== i).concat(i);
    it.liftTarget = LIFT.hold;
    // 집을 때마다 메인 화면에 그 옷 설명을 띄움
    active = i;
    onHover(i);
    sfx.glassPick();
  };
  const move = (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
    if (!drag.moved) return;
    const it = items[drag.i];
    const p = photoAt(e);
    it.liftTarget = LIFT.drag;
    // 병은 손에 들려 떠 있고, 그 아래 그림자 자리가 놓일 곳
    it.target.set(
      THREE.MathUtils.clamp(p.x + drag.off.x, view.x + 40, view.x + view.w - 40),
      THREE.MathUtils.clamp(p.y + drag.off.y, GROUND.top, GROUND.bottom)
    );
    const o = overHole(it.target, it.home);
    if (o !== over) {
      over = o;
      onOver(o);
    }
  };
  const up = (e) => {
    if (!drag) return;
    const { i, moved } = drag;
    const it = items[i];
    if (moved && e.type === 'pointerup' && overHole(it.target, it.home)) {
      dropIn(i);
      return;
    }
    drag = null;
    nearFor = 0;
    it.target.copy(it.home);
    it.liftTarget = 0;
    sfx.glassSet(moved ? 0.26 : 0.08);
    if (over) {
      over = false;
      onOver(false);
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* ---------- 그리기 ---------- */
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const m = new THREE.Matrix4();
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    // 구덩이 가까이 붙인 채로 잠깐 있으면 손을 떼지 않아도 빠짐
    if (drag && drag.moved && chosen < 0 && overHole(items[drag.i].target, items[drag.i].home)) {
      nearFor += dt;
      if (nearFor >= 0.22) dropIn(drag.i);
    } else nearFor = 0;

    // 햇빛: 구름이 지나가듯 천천히 강해졌다 약해짐(0~1)
    const sunL = THREE.MathUtils.clamp(0.55 + 0.3 * Math.sin(t * 0.38) + 0.15 * Math.sin(t * 0.91 + 1.3), 0, 1);
    photo.material.color.setRGB(0.93 + 0.09 * sunL, 0.93 + 0.08 * sunL, 0.94 + 0.05 * sunL);

    const opening = items.some((it) => it.fall);
    pitOpen += ((opening ? 1 : over ? 0.6 : 0) - pitOpen) * Math.min(1, dt * (opening ? 5 : 8));
    pit.material.opacity = Math.min(1, pitOpen * 1.2);
    const ps = 0.55 + 0.45 * pitOpen;
    pit.scale.set(HOLE.rx * 2 * PIT * ps, HOLE.ry * 2 * PIT * ps, 1);

    items.forEach((it, i) => {
      const dragging = drag && drag.i === i && drag.moved;
      const px = it.pos.x;
      if (it.fall) {
        const f = it.fall;
        f.t += dt;
        // 구덩이 입구에 살며시 내려앉음 → 잠깐 그대로 머묾 → 천천히 땅속으로 가라앉음
        it.pos.lerp(it.target, Math.min(1, dt * 8));
        const hpx = BOTTLE.h * scaleAt(it.pos.y);
        if (f.t < SINK.start) {
          it.lift += (0 - it.lift) * Math.min(1, dt * 6);
        } else {
          if (!f.landed) {
            f.landed = true;
            f.from = it.lift;
            onSelect(i);
          }
          const p = smooth(0, 1, (f.t - SINK.start) / SINK.dur);
          it.lift = f.from + (-hpx - 24 - f.from) * p;
          if (p >= 1) it.gone = true;
        }
        it.tiltTarget = 0;
      } else {
        it.pos.lerp(it.target, Math.min(1, dt * (dragging ? 16 : 7)));
        it.lift += (it.liftTarget - it.lift) * Math.min(1, dt * 10);
        // 옮기는 속도만큼 매달린 병이 흔들림(손가락이 목을 잡고 있는 진자)
        const vx = (it.pos.x - px) / Math.max(dt, 1e-3);
        it.tiltTarget = dragging ? THREE.MathUtils.clamp(-vx * 0.0008, -0.3, 0.3) : 0;
        if (!dragging && it.liftTarget === 0 && it.pos.distanceTo(it.home) < 1.5 && it.lift < 0.5) it.lift = 0;
      }
      it.tiltVel += ((it.tiltTarget - it.tilt) * 110 - it.tiltVel * 11) * dt;
      it.tilt += it.tiltVel * dt;

      const s = scaleAt(it.pos.y);
      const wpx = BOTTLE.w * s;
      const hpx = BOTTLE.h * s;
      const base = new THREE.Vector2(it.pos.x, -it.pos.y);
      const lift = it.lift;

      // 병: 목을 축으로 회전
      const ph = (BOTTLE.base - BOTTLE.h * (1 - PIVOT)) * s;
      it.pivot.position.set(base.x, base.y + lift + ph, 0);
      it.pivot.rotation.z = it.tilt;
      it.mesh.position.set(0, -ph, 0);
      it.mesh.scale.set(wpx, hpx, 1);
      it.pivot.visible = !it.gone;
      const u = it.mat.uniforms;
      u.uShade.value = (0.95 + 0.07 * sunL) * (1 - it.dim * 0.18);
      u.uSink.value = it.fall && lift < 0 ? 1 : 0;
      u.uDepth.value = Math.max(0, -lift);
      u.uH.value = hpx;

      // 그림자: 떠오른 만큼 햇빛 방향으로 밀려나고 흐려짐, 땅속으로 들어가면 사라짐
      const rise = Math.max(0, lift);
      const sunk = it.fall ? smooth(0, -50, lift) : 0;
      const sx = base.x + SH_Y.x * rise;
      const sy = base.y + SH_Y.y * rise;
      m.set(
        SH_X.x * wpx, SH_Y.x * hpx, 0, sx,
        SH_X.y * wpx, SH_Y.y * hpx, 0, sy,
        0, 0, 1, 0,
        0, 0, 0, 1
      );
      it.shadow.matrix.copy(m);
      const su = it.shadow.material.uniforms;
      su.uOpacity.value = (0.34 + 0.24 * sunL) * (1 - Math.min(0.45, rise / 140)) * (1 - sunk) * (it.gone ? 0 : 1);
      su.uSoft.value = Math.min(0.85, rise / 70);
      const cs = 1 + rise / 110;
      it.contact.position.set(base.x + 3 + SH_Y.x * rise * 0.5, base.y - 1, 0);
      it.contact.scale.set(wpx * 0.78 * cs, wpx * 0.78 * K * 1.35 * cs, 1);
      it.contact.material.opacity = (0.5 + 0.15 * sunL) * (0.35 + 0.65 * Math.exp(-rise / 18)) * (1 - sunk) * (it.gone ? 0 : 1);
      it.caustic.position.set(sx + SH_Y.x * hpx * 0.32, sy + SH_Y.y * hpx * 0.32, 0);
      it.caustic.scale.set(wpx * 0.42, wpx * 0.13, 1);
      it.caustic.material.opacity = 0.16 * sunL * (1 - Math.min(1, rise / 60)) * (1 - sunk) * (it.gone ? 0 : 1);
    });

    // 앞(아래)에 있는 병일수록 나중에 그림. 손에 든 병 · 빠지는 병은 맨 위
    const sorted = items
      .map((it, i) => i)
      .sort((a, b) => {
        const pa = items[a].fall || (drag && drag.i === a) ? 1e4 : items[a].pos.y;
        const pb = items[b].fall || (drag && drag.i === b) ? 1e4 : items[b].pos.y;
        return pa - pb || order.indexOf(a) - order.indexOf(b);
      });
    sorted.forEach((i, k) => {
      items[i].mesh.renderOrder = 10 + k;
    });

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const mt of [].concat(o.material || [])) {
        if (mt.map) mt.map.dispose();
        if (mt.uniforms) for (const k of ['map', 'sharp', 'soft']) mt.uniforms[k]?.value?.dispose?.();
        mt.dispose();
      }
    });
    renderer.dispose();
    canvas.remove();
  };
}
