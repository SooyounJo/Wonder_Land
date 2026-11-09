import * as THREE from 'three';
import * as sfx from './sfx';

// 과자 자판기: 렌더 사진(/pad/vending.webp)을 배경에 깔고, 그 위에 키 12개 · 카드 · LCD만 입체로 겹쳐 올림
// 좌표는 모두 사진 픽셀 기준(1344×752). 쉬고 있을 땐 사진과 똑같이 보이도록 원근만큼 위치·크기를 보정함
// 숫자 1~6이 과자 6개. 누르고 있으면 onHover(i), 그대로 떼면 onSelect(i) → 카드가 투입구로 빨려 들어감
const IMG = { w: 1344, h: 752, bg: '/pad/vending.webp', card: '/pad/card.png' };
const COLS = [[800, 893], [899, 993], [997, 1088]];
const ROWS = [[204, 300], [307, 402], [409, 503], [513, 607]];
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'I', 'II', 'III'];
const CAP_R = 37;
const LCD = { x0: 798, y0: 78, x1: 1095, y1: 141 };
const SLOT_Y = 203;                                  // 카드가 나오는 틈(아래 가장자리)
const CARD = { x: 262, y: 204, w: 220, h: 234 };
const LEDS = [[275, 148], [373, 148], [466, 148]];
const BASE_D = 14;                                   // 키 받침 두께
const CAP_H = 9;                                     // 동그란 버튼이 받침 위로 튀어나온 높이
const FOV = 40;

const loadImage = (src) => new Promise((ok, fail) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = fail;
  im.src = src;
});

export function createSnackButtons({ container, labels, onHover = () => {}, onSelect = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;        // 사진 색 그대로
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  let dist = 1000;

  const tex = (src) => {
    const t = new THREE.CanvasTexture(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const crop = (img, x, y, w, h, paint) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * 2);
    c.height = Math.round(h * 2);
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.drawImage(img, x, y, w, h, 0, 0, w, h);
    paint?.(g, w, h);
    return c;
  };
  // 사진 좌표(x, y, 깊이 z) → 화면에서 사진과 같은 자리에 보이도록 보정한 위치와 배율
  const fitted = [];
  const place = (obj, x, y, z) => {
    fitted.push({ obj, x, y, z });
    applyPlace(fitted[fitted.length - 1]);
  };
  const applyPlace = ({ obj, x, y, z }) => {
    const k = (dist - z) / dist;
    obj.position.set((x - IMG.w / 2) * k, (IMG.h / 2 - y) * k, z);
    obj.scale.setScalar(k);
  };

  /* ---------- 크기 맞춤: 사진이 화면을 꽉 채우도록(cover) ---------- */
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
    fitted.forEach(applyPlace);
    updateClip();
  };

  /* ---------- 장면 만들기(사진을 불러온 뒤) ---------- */
  const keys = [];
  const hitMeshes = [];
  let card = null;
  let lcd = null;
  const leds = [];
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const updateClip = () => {
    const k = (dist - 6) / dist;
    clipPlane.constant = (IMG.h / 2 - SLOT_Y) * k;
  };
  let ready = false;
  let disposed = false;

  Promise.all([loadImage(IMG.bg), loadImage(IMG.card), document.fonts?.load('16px "Galmuri11"').catch(() => {})]).then(([bg, cardImg]) => {
    if (disposed) return;

    // 배경: 키 자리는 움푹 파인 홈으로 칠해 둠(키가 눌려 들어가면 보임)
    const bgCanvas = crop(bg, 0, 0, IMG.w, IMG.h, (g) => {
      ROWS.forEach(([y0, y1]) => COLS.forEach(([x0, x1]) => {
        const grd = g.createLinearGradient(0, y0, 0, y1);
        grd.addColorStop(0, '#1b1514');
        grd.addColorStop(1, '#3a302d');
        g.fillStyle = grd;
        g.fillRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
      }));
    });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(IMG.w, IMG.h), new THREE.MeshBasicMaterial({ map: tex(bgCanvas) }));
    scene.add(bgMesh);

    // 키: 사진에서 오려낸 받침(가운데는 버튼 구멍) + 동그란 버튼(사진에서 오려낸 얼굴 + 옆면)
    const capSide = new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_H + 8, 48, 1, true);
    capSide.rotateX(Math.PI / 2);
    const capFace = new THREE.CircleGeometry(CAP_R, 48);
    KEYS.forEach((txt, k) => {
      const dark = k >= 9;
      const [x0, x1] = COLS[k % 3];
      const [y0, y1] = ROWS[Math.floor(k / 3)];
      const w = x1 - x0;
      const h = y1 - y0;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2 + 1;

      const group = new THREE.Group();
      place(group, cx, cy, BASE_D);
      scene.add(group);

      const baseTex = tex(crop(bg, x0, y0, w, h, (g) => {
        const r = g.createRadialGradient(cx - x0, cy - y0, CAP_R * 0.6, cx - x0, cy - y0, CAP_R + 2);
        r.addColorStop(0, '#0d0a09');
        r.addColorStop(1, dark ? '#24201f' : '#5b4c46');
        g.fillStyle = r;
        g.beginPath(); g.arc(cx - x0, cy - y0, CAP_R + 1.5, 0, Math.PI * 2); g.fill();
      }));
      const sideColor = dark ? '#3a3636' : '#bdaea6';
      const sideMat = new THREE.MeshBasicMaterial({ color: sideColor });
      const baseFront = new THREE.MeshBasicMaterial({ map: baseTex });
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, BASE_D), [sideMat, sideMat, sideMat, sideMat, baseFront, sideMat]);
      base.position.z = -BASE_D / 2;
      group.add(base);

      const capGroup = new THREE.Group();
      group.add(capGroup);
      const side = new THREE.Mesh(capSide, new THREE.MeshBasicMaterial({ color: dark ? '#2f2c2c' : '#cbbdb5' }));
      side.position.z = CAP_H / 2 - 4;
      capGroup.add(side);
      const faceMat = new THREE.MeshBasicMaterial({ map: tex(crop(bg, cx - CAP_R, cy - CAP_R, CAP_R * 2, CAP_R * 2)) });
      const face = new THREE.Mesh(capFace, faceMat);
      face.position.z = CAP_H;
      capGroup.add(face);

      for (const m of [base, side, face]) {
        m.userData.key = k;
        hitMeshes.push(m);
      }
      const snack = /^[1-6]$/.test(txt) ? Number(txt) - 1 : -1;
      keys.push({ txt, dark, snack, group, capGroup, faceMat, baseFront, p: 0, v: 0 });
    });

    // LCD: 사진 속 화면 자리에 글자를 직접 그림
    const lc = document.createElement('canvas');
    lc.width = (LCD.x1 - LCD.x0) * 4;
    lc.height = (LCD.y1 - LCD.y0) * 4;
    const lcdTex = tex(lc);
    lcd = { canvas: lc, tex: lcdTex, text: '' };
    const lcdMesh = new THREE.Mesh(new THREE.PlaneGeometry(LCD.x1 - LCD.x0, LCD.y1 - LCD.y0), new THREE.MeshBasicMaterial({ map: lcdTex }));
    place(lcdMesh, (LCD.x0 + LCD.x1) / 2, (LCD.y0 + LCD.y1) / 2, 0.5);
    scene.add(lcdMesh);

    // 투입구 화살표 LED 깜빡임
    const glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    {
      const g = glow.getContext('2d');
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(150,255,170,1)');
      r.addColorStop(0.35, 'rgba(90,255,140,.5)');
      r.addColorStop(1, 'rgba(60,255,120,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    }
    const glowTex = tex(glow);
    LEDS.forEach(([x, y]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      place(m, x, y, 0.6);
      scene.add(m);
      leds.push(m);
    });

    // 카드: 투입구에 꽂혀 늘어진 트럼프 카드(위쪽 경첩으로 살랑임, 누르면 튕겨 흔들림)
    const cardCanvas = crop(cardImg, 0, 0, CARD.w, CARD.h);
    {
      const g = cardCanvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.beginPath();
      g.roundRect(2, -40, cardCanvas.width - 4, cardCanvas.height + 40 - 6, 22);
      g.fill();
    }
    const cardMat = new THREE.MeshBasicMaterial({ map: tex(cardCanvas), transparent: true, side: THREE.DoubleSide, clippingPlanes: [clipPlane] });
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    {
      const g = shadowCanvas.getContext('2d');
      g.filter = 'blur(10px)';
      g.fillStyle = 'rgba(40,10,20,.55)';
      g.fillRect(22, 10, 84, 100);
    }
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD.w * 1.3, CARD.h * 1.25),
      new THREE.MeshBasicMaterial({ map: tex(shadowCanvas), transparent: true, depthWrite: false, clippingPlanes: [clipPlane] })
    );
    const pivot = new THREE.Group();          // 투입구 높이의 경첩
    place(pivot, CARD.x + CARD.w / 2, CARD.y, 6);
    scene.add(pivot);
    const slide = new THREE.Group();          // 빨려 들어갈 때 위로 이동
    pivot.add(slide);
    const hinge = new THREE.Group();
    slide.add(hinge);
    const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), cardMat);
    cardMesh.position.y = -CARD.h / 2;
    cardMesh.userData.card = true;
    hinge.add(cardMesh);
    shadow.position.set(10, -CARD.h / 2 - 12, -5.5);
    slide.add(shadow);
    hitMeshes.push(cardMesh);
    card = { hinge, slide, shadow, a: 0, va: 0, ins: 0 };

    ready = true;
    resize();
  }).catch(() => {});

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- 누르기 ---------- */
  const ray = new THREE.Raycaster();
  const nd = new THREE.Vector2();
  let pressed = -1;
  let chosen = -1;
  let chosenAt = 0;
  let notice = null;
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(nd, camera);
    const hit = ray.intersectObjects(hitMeshes)[0];
    if (!hit) return null;
    return hit.object.userData.card ? 'card' : hit.object.userData.key;
  };
  const say = (a, b, ms = 1400) => {
    notice = { a, b, until: performance.now() + ms };
  };
  const down = (e) => {
    if (!ready) return;
    const k = pick(e);
    if (k === 'card') {
      if (card.ins > 0) return;
      card.va -= 4.5;                // 툭 치면 앞으로 튕겨 흔들림
      sfx.cardPick();
      return;
    }
    if (k == null || chosen >= 0) return;
    pressed = k;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    sfx.buttonDown(keys[k].dark ? 0.8 : 1);
    const b = keys[k];
    if (b.snack >= 0) {
      say(`No.${b.txt} ${labels[b.snack].toUpperCase()}`, 'RELEASE TO BUY', 1e9);
      onHover(b.snack);
    } else if (b.dark) say('SELECT', 'No. 1 - 6');
    else say(`No.${b.txt}`, 'SOLD OUT');
  };
  const release = (k) => {
    pressed = -1;
    sfx.buttonUp();
    if (keys[k].snack >= 0) {
      notice = null;
      onHover(-1);
    }
  };
  const move = (e) => {
    if (pressed < 0) return;
    if (pick(e) !== pressed) release(pressed);
  };
  const up = (e) => {
    if (pressed < 0) return;
    const k = pressed;
    if (pick(e) !== k || keys[k].snack < 0) {
      release(k);
      return;
    }
    pressed = -1;
    chosen = k;
    chosenAt = performance.now();
    notice = null;
    // 버튼은 눌린 채로 걸리고(철컥), 0.45초 뒤 카드가 1.6초 동안 7번 걸리며 빨려 들어감(아래 그리기와 같은 박자)
    sfx.buttonUp(0.7);
    sfx.cardInsert(0.45, 1.6, 7);
    onSelect(keys[k].snack);
  };
  const cancel = () => {
    if (pressed >= 0) release(pressed);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);

  /* ---------- LCD ---------- */
  const drawLcd = (a, b) => {
    const key = a + '|' + b;
    if (!lcd || key === lcd.text) return;
    lcd.text = key;
    const c = lcd.canvas;
    const g = c.getContext('2d');
    const { width: w, height: h } = c;
    g.fillStyle = '#152114';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    g.font = '96px "Galmuri11", monospace';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(120,255,140,.55)';
    g.shadowBlur = 14;
    g.fillStyle = '#9fe7a4';
    g.fillText(a, 56, h * 0.29);
    g.fillText(b, 56, h * 0.73);
    lcd.tex.needsUpdate = true;
  };

  /* ---------- 그리기 ---------- */
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    if (ready) {
      // 키: 스프링으로 눌리고 튀어 오름. 버튼은 받침보다 더 깊이 들어가고 어두워짐
      keys.forEach((b, k) => {
        const target = k === pressed || k === chosen ? 1 : 0;
        const steps = 4;
        for (let s = 0; s < steps; s++) {
          const h = dt / steps;
          b.v += (900 * (target - b.p) - 30 * b.v) * h;
          b.p += b.v * h;
        }
        const p = Math.max(-0.25, b.p);
        b.group.position.z = BASE_D - p * 3.5;
        b.capGroup.position.z = -p * (CAP_H - 1.5);
        b.capGroup.scale.setScalar(1 - Math.max(0, p) * 0.035);   // 둘레에 어두운 홈이 드러남
        const shade = 1 - Math.max(0, p) * 0.2;
        b.faceMat.color.setScalar(shade);
        b.baseFront.color.setScalar(1 - Math.max(0, p) * 0.06);
        const glow = k === chosen ? 0.06 + 0.04 * Math.sin(now / 220) : 0;
        if (glow) b.faceMat.color.setRGB(shade + glow, shade + glow * 0.9, shade + glow * 0.5);
      });

      // 카드: 살랑임 + 튕김. 고른 뒤엔 평평해졌다가 덜컥덜컥 빨려 들어감
      if (card) {
        // a < 0: 아래쪽이 앞으로 들림. 패널(뒤)에 닿으면 살짝 튕겨 나옴
        const restA = chosen >= 0 ? 0 : -0.06 + Math.sin(t * 1.4) * 0.025;
        card.va += (60 * (restA - card.a) - 3.2 * card.va) * dt;
        card.a += card.va * dt;
        if (card.a > 0.015) {
          card.a = 0.015;
          card.va = -Math.abs(card.va) * 0.35;
        }
        card.hinge.rotation.x = card.a;
        if (chosen >= 0) {
          const p = Math.min(1, Math.max(0, (now - chosenAt - 450) / 1600));
          const stepped = p + Math.sin(p * Math.PI * 7) * 0.035;
          card.ins = Math.max(0, Math.min(1, stepped));
        }
        card.slide.position.y = card.ins * (CARD.h + 10);
        card.shadow.material.opacity = 0.35 + Math.min(1, Math.abs(card.a) * 6) * 0.65;
        card.shadow.position.set(6 + Math.abs(card.a) * 60, -CARD.h / 2 - 8 - Math.abs(card.a) * 40, -5.5);
      }

      const speed = chosen >= 0 ? 9 : 3;
      leds.forEach((m, i) => {
        m.material.opacity = Math.max(0, Math.sin(t * speed - i * 1.1)) * 0.7;
      });

      if (chosen >= 0) {
        const b = keys[chosen];
        drawLcd(`No.${b.txt} ${labels[b.snack].toUpperCase()}`, Math.floor(t * 2) % 2 ? 'THANK YOU' : 'THANK YOU _');
      } else if (notice && now < notice.until) drawLcd(notice.a, notice.b);
      else {
        notice = null;
        drawLcd(Math.floor(t / 2.2) % 2 ? '₩ 1,000' : 'CARD INSERTED', Math.floor(t * 2) % 2 ? 'PRESS 1 - 6' : 'PRESS 1 - 6 _');
      }
    }

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
    canvas.removeEventListener('pointercancel', cancel);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    renderer.dispose();
    canvas.remove();
  };
}
