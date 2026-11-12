import * as THREE from 'three';
import * as sfx from './sfx';

// 테이블 사진(비스듬히 내려다본 레이스 천 · 찻잔 · 분홍 접시) 위에 놓인 꽃 카드 세 장
// 사진과 같은 각도로 눕힌 '테이블 면'에 카드를 올려 원근을 맞추고, 왼쪽 위 햇빛으로 진짜 그림자를 드리움
// 카드를 집으면 떠오르며 그림자가 멀어지고 흐려짐 → 접시에 내려놓으면 선택. 햇빛은 천천히 강해졌다 약해짐
// 좌표는 사진 픽셀 기준(2048×1348)
const IMG = { w: 2048, h: 1348, src: '/pad/table-main.webp' };
const PLATE = { x: 1046, y: 896, rx: 394, ry: 301 };
const CARD = { w: 290, h: 400, d: 4, r: 16 };
const TILT = THREE.MathUtils.degToRad(38);   // 테이블 면이 카메라에서 기울어진 각도(위쪽이 멀어짐)
const FOV = 30;
const LIFT = { drag: 110, active: 22 };
const STACK = { gap: 14, lean: 0.035 };       // 겹친 카드 사이 높이 · 아래 카드 쪽으로 기우는 정도

const loadTexture = (src, aniso) => new Promise((ok, fail) => {
  new THREE.TextureLoader().load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    ok(t);
  }, undefined, fail);
});

// cards: [{ src, x, y, rot, layer }] (사진 좌표, rot는 도, layer가 클수록 위)
export function createTeaCards({ container, cards, onHover = () => {}, onSelect = () => {}, onOver = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 20000);
  let dist = 1000;

  // 사진 좌표 ↔ 월드(사진 판은 z=0, 가운데가 원점, 위가 +y)
  const wx = (x) => x - IMG.w / 2;
  const wy = (y) => IMG.h / 2 - y;

  /* ---------- 사진 ---------- */
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(IMG.w, IMG.h),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false })
  );
  photo.renderOrder = -2;
  scene.add(photo);

  // 접시 위에 올렸을 때 접시 테두리가 은은하게 빛남(사진 위 타원)
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.02, 128),
    new THREE.MeshBasicMaterial({ color: 0xfff6ec, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  glow.scale.set(PLATE.rx, PLATE.ry, 1);
  glow.position.set(wx(PLATE.x), wy(PLATE.y), 0);
  glow.renderOrder = -1;
  scene.add(glow);

  // 햇살: 왼쪽 위에서 비스듬히 내려오는 부드러운 빛줄기(밝기가 천천히 변함)
  const beamTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 340;
    const g = c.getContext('2d');
    g.filter = 'blur(28px)';
    g.translate(256, 170);
    g.rotate(-0.62);
    for (const [x, w, a] of [[-170, 70, 0.55], [-40, 120, 0.8], [110, 60, 0.5], [210, 90, 0.4]]) {
      g.fillStyle = `rgba(255, 236, 205, ${a})`;
      g.fillRect(x, -400, w, 800);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const beams = new THREE.Mesh(
    new THREE.PlaneGeometry(IMG.w * 1.2, IMG.h * 1.2),
    new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  beams.renderOrder = 10;
  scene.add(beams);

  // 가끔 찻잔 테두리 · 유리컵 · 스푼에 햇빛이 스치며 반짝임(천천히 피었다 사라짐)
  const glintTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 128);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.08, 'rgba(255,250,235,0.85)');
    core.addColorStop(0.3, 'rgba(255,236,210,0.22)');
    core.addColorStop(1, 'rgba(255,230,200,0)');
    g.fillStyle = core;
    g.fillRect(-128, -128, 256, 256);
    for (const [rot, len, thick, a] of [[0, 128, 3, 0.9], [Math.PI / 2, 110, 3, 0.8], [Math.PI / 4, 54, 2, 0.45], [-Math.PI / 4, 54, 2, 0.45]]) {
      g.save();
      g.rotate(rot);
      const ray = g.createLinearGradient(-len, 0, len, 0);
      ray.addColorStop(0, 'rgba(255,248,230,0)');
      ray.addColorStop(0.5, `rgba(255,252,240,${a})`);
      ray.addColorStop(1, 'rgba(255,248,230,0)');
      g.fillStyle = ray;
      g.fillRect(-len, -thick / 2, len * 2, thick);
      g.restore();
    }
    return new THREE.CanvasTexture(c);
  })();
  const GLINTS = [
    { x: 1120, y: 214, size: 120 },   // 찻잔 테두리 오른쪽 위
    { x: 852, y: 246, size: 90 },     // 찻잔 테두리 왼쪽
    { x: 1333, y: 226, size: 130 },   // 유리컵 입구
    { x: 1580, y: 330, size: 100 },   // 유리컵 옆면
    { x: 1548, y: 745, size: 90 },    // 스푼
    { x: 1312, y: 676, size: 80 },    // 접시 테두리
  ].map((p) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.position.set(wx(p.x), wy(p.y), 0);
    m.renderOrder = -1;
    scene.add(m);
    return { ...p, mesh: m, t: -1, dur: 2.4 };
  });
  let nextGlint = 2.5;
  // 찻잔 안쪽에 햇빛이 고였다 빠지는 은은한 빛
  const softTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    d.addColorStop(0, 'rgba(255,255,255,1)');
    d.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const cupGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: softTex, color: 0xffd9b0, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  cupGlow.position.set(wx(990), wy(268), 0);
  cupGlow.scale.set(300, 170, 1);
  cupGlow.renderOrder = -1;
  scene.add(cupGlow);

  /* ---------- 테이블 면(사진과 같은 각도로 눕힘) ---------- */
  const tableGroup = new THREE.Group();
  tableGroup.rotation.x = -TILT;
  scene.add(tableGroup);
  tableGroup.updateMatrixWorld();
  const tableNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(tableGroup.quaternion);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfe0cf, 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.9);
  sun.position.set(-320, 400, 1000);          // 왼쪽 위에서 비춤 → 그림자는 오른쪽 아래로(사진 속 포크 그림자와 같은 방향)
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -1400, right: 1400, top: 1100, bottom: -1100, near: 100, far: 4000 });
  tableGroup.add(sun);
  tableGroup.add(sun.target);

  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(IMG.w * 2, IMG.h * 2.4),
    new THREE.ShadowMaterial({ color: 0x0d2414, opacity: 0.5, depthWrite: false })
  );
  shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = 0;
  tableGroup.add(shadowCatcher);

  /* ---------- 사진 좌표 → 테이블 면 위 점 ---------- */
  const ray = new THREE.Raycaster();
  const nd = new THREE.Vector2();
  const tablePlane = new THREE.Plane();
  const photoPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const tmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const setTablePlane = (lift) => tablePlane.setFromNormalAndCoplanarPoint(tableNormal, tableNormal.clone().multiplyScalar(lift));
  const toLocal = (world) => tableGroup.worldToLocal(world.clone());
  // 사진 위 (x, y)에 보이도록 테이블 면(높이 0)에 놓을 점(테이블 로컬 좌표)
  const photoToTable = (x, y) => {
    camPos.set(0, 0, dist);
    const dir = new THREE.Vector3(wx(x), wy(y), 0).sub(camPos).normalize();
    ray.set(camPos, dir);
    setTablePlane(0);
    return ray.ray.intersectPlane(tablePlane, tmp) ? toLocal(tmp) : new THREE.Vector3();
  };
  const setRay = (e) => {
    const r = canvas.getBoundingClientRect();
    nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(nd, camera);
  };
  // 손가락 → 테이블 면에서 lift만큼 뜬 평면 위 점(로컬)
  const pointAt = (e, lift) => {
    setRay(e);
    setTablePlane(lift);
    return ray.ray.intersectPlane(tablePlane, tmp) ? toLocal(tmp) : null;
  };
  // 손가락 → 사진 좌표
  const photoAt = (e) => {
    setRay(e);
    if (!ray.ray.intersectPlane(photoPlane, tmp)) return null;
    return { x: tmp.x + IMG.w / 2, y: IMG.h / 2 - tmp.y };
  };
  const overPlate = (p) => p && ((p.x - PLATE.x) / PLATE.rx) ** 2 + ((p.y - PLATE.y) / PLATE.ry) ** 2 < 1.05;

  /* ---------- 카드 ---------- */
  const roundRect = (path, w, h, r) => {
    const x = -w / 2;
    const y = -h / 2;
    path.moveTo(x + r, y);
    path.lineTo(x + w - r, y);
    path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r);
    path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h);
    path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
  };
  const shape = new THREE.Shape();
  roundRect(shape, CARD.w, CARD.h, CARD.r);
  const cardGeo = new THREE.ExtrudeGeometry(shape, { depth: CARD.d, bevelEnabled: false, curveSegments: 8 });
  {
    const pos = cardGeo.attributes.position;
    const uv = cardGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / CARD.w + 0.5, pos.getY(i) / CARD.h + 0.5);
    uv.needsUpdate = true;
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#efe5d3', roughness: 0.9 });
  // 카드 앞면 위에 그림자만 받는 판(위에 겹친 카드의 그림자가 아래 카드에 떨어짐)
  const cardShadowGeo = new THREE.ShapeGeometry(shape, 8);
  const cardShadowMat = new THREE.ShadowMaterial({ color: 0x2a2014, opacity: 0.4, depthWrite: false });

  const items = cards.map((c, i) => {
    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.02 });
    const mesh = new THREE.Mesh(cardGeo, [faceMat, edgeMat]);
    mesh.castShadow = true;
    mesh.userData.card = i;
    mesh.renderOrder = 1;
    const group = new THREE.Group();
    group.add(mesh);
    const faceShadow = new THREE.Mesh(cardShadowGeo, cardShadowMat);
    faceShadow.position.z = CARD.d + 0.2;
    faceShadow.receiveShadow = true;
    faceShadow.renderOrder = 2;
    group.add(faceShadow);
    tableGroup.add(group);
    loadTexture(c.src, aniso).then((t) => {
      if (disposed) return t.dispose();
      faceMat.map = t;
      faceMat.needsUpdate = true;
    }).catch(() => {});
    return {
      group, mesh, faceMat, photo: { x: c.x, y: c.y },
      home: new THREE.Vector3(), pos: null, target: new THREE.Vector3(),
      homeRot: THREE.MathUtils.degToRad(c.rot), rot: THREE.MathUtils.degToRad(c.rot), rotTarget: THREE.MathUtils.degToRad(c.rot),
      tilt: new THREE.Vector2(), dim: 0, order: c.layer ?? i, atHome: true,
    };
  });

  loadTexture(IMG.src, aniso).then((t) => {
    if (disposed) return t.dispose();
    photo.material.map = t;
    photo.material.needsUpdate = true;
  }).catch(() => {});

  /* ---------- 세 장 묶음 실루엣(한 덩어리 테두리, 장마다 고리를 그리지 않음) ---------- */
  const fillRound = (g, x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, rr);
    else {
      g.moveTo(x + rr, y);
      g.lineTo(x + w - rr, y);
      g.quadraticCurveTo(x + w, y, x + w, y + rr);
      g.lineTo(x + w, y + h - rr);
      g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      g.lineTo(x + rr, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - rr);
      g.lineTo(x, y + rr);
      g.quadraticCurveTo(x, y, x + rr, y);
    }
    g.fill();
  };
  let fanRimMesh = null;
  let fanRimMat = null;
  const rebuildFanRim = () => {
    const pad = 22;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    items.forEach((it) => {
      const c = Math.cos(it.homeRot);
      const s = Math.sin(it.homeRot);
      const hw = CARD.w / 2 + pad;
      const hh = CARD.h / 2 + pad;
      [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([lx, ly]) => {
        const x = it.home.x + lx * c - ly * s;
        const y = it.home.y + lx * s + ly * c;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });
    const W = maxX - minX;
    const H = maxY - minY;
    if (!(W > 1 && H > 1)) return;
    const SCALE = Math.min(2.2, 1400 / Math.max(W, H));
    const cw = Math.max(2, Math.round(W * SCALE));
    const ch = Math.max(2, Math.round(H * SCALE));
    const paint = (g, grow) => {
      g.fillStyle = '#fff';
      items.forEach((it) => {
        g.save();
        g.translate((it.home.x - minX) * SCALE, (maxY - it.home.y) * SCALE);
        g.rotate(-it.homeRot);
        g.scale(1, -1);
        const w = CARD.w + grow * 2;
        const h = CARD.h + grow * 2;
        fillRound(g, (-w / 2) * SCALE, (-h / 2) * SCALE, w * SCALE, h * SCALE, (CARD.r + grow * 0.4) * SCALE);
        g.restore();
      });
    };
    const src = document.createElement('canvas');
    src.width = cw;
    src.height = ch;
    const sg = src.getContext('2d');
    paint(sg, 20);
    sg.globalCompositeOperation = 'destination-out';
    paint(sg, 0);
    const cnv = document.createElement('canvas');
    cnv.width = cw;
    cnv.height = ch;
    const cg = cnv.getContext('2d');
    cg.filter = 'blur(5px)';
    cg.drawImage(src, 0, 0);
    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const prev = fanRimMat ? fanRimMat.opacity : 0;
    if (fanRimMesh) {
      tableGroup.remove(fanRimMesh);
      fanRimMesh.geometry.dispose();
      fanRimMesh.material.map.dispose();
      fanRimMesh.material.dispose();
    }
    fanRimMat = new THREE.MeshBasicMaterial({
      map: tex,
      color: 0xfff6ec,
      transparent: true,
      opacity: prev,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    fanRimMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), fanRimMat);
    fanRimMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, CARD.d + 3);
    fanRimMesh.renderOrder = 4;
    tableGroup.add(fanRimMesh);
  };

  /* ---------- 크기 맞춤(사진이 화면을 꽉 채우도록) ---------- */
  let platePos = new THREE.Vector3();
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
    // 카메라 거리가 바뀌면 사진 속 자리에 맞도록 다시 계산
    items.forEach((it) => {
      it.home.copy(photoToTable(it.photo.x, it.photo.y));
      if (!it.pos) it.pos = it.home.clone();
      if (it.atHome) {
        it.target.set(it.home.x, it.home.y, it.target.z);
        if (!drag || drag.i !== items.indexOf(it)) it.pos.set(it.home.x, it.home.y, it.pos.z);
      }
    });
    platePos = photoToTable(PLATE.x + 8, PLATE.y - 6);
    const ch = items[chosen];
    if (ch) ch.target.set(platePos.x, platePos.y, 0);
    rebuildFanRim();
  };
  const ro = new ResizeObserver(resize);

  /* ---------- 집고 옮기기 ---------- */
  let active = -1;
  let chosen = -1;
  let drag = null;
  let over = false;
  let topOrder = Math.max(...items.map((it) => it.order)) + 1;

  ro.observe(container);
  resize();

  const down = (e) => {
    if (chosen >= 0) return;
    setRay(e);
    const hit = ray.intersectObjects(items.map((it) => it.mesh))[0];
    if (!hit) return;
    const i = hit.object.userData.card;
    const it = items[i];
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    const p = pointAt(e, it.pos.z);
    if (!p) return;
    drag = { i, off: new THREE.Vector2(it.pos.x - p.x, it.pos.y - p.y), x0: e.clientX, y0: e.clientY, moved: false, last: p };
    it.order = ++topOrder;
    // 집을 때마다 메인 화면에 그 차의 설명을 띄움(메인 화면에서 다른 잔을 눌렀어도 다시 맞춰짐)
    active = i;
    onHover(i);
    sfx.cardPick();
  };
  const move = (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
    if (!drag.moved) return;
    const it = items[drag.i];
    const p = pointAt(e, LIFT.drag);
    if (!p) return;
    it.atHome = false;
    it.target.set(p.x + drag.off.x, p.y + drag.off.y, LIFT.drag);
    // 끄는 방향으로 살짝 기울어짐
    it.tilt.set(THREE.MathUtils.clamp((p.y - drag.last.y) * 0.008, -0.22, 0.22), THREE.MathUtils.clamp(-(p.x - drag.last.x) * 0.008, -0.22, 0.22));
    drag.last = p;
    const o = overPlate(photoAt(e));
    if (o !== over) {
      over = o;
      onOver(o);
    }
  };
  const up = (e) => {
    if (!drag) return;
    const { i, moved } = drag;
    drag = null;
    const it = items[i];
    it.tilt.set(0, 0);
    if (moved && e.type === 'pointerup' && overPlate(photoAt(e))) {
      chosen = i;
      it.target.set(platePos.x, platePos.y, 0);
      it.rotTarget = THREE.MathUtils.degToRad(-6);
      items.forEach((o, k) => {
        if (k !== i) o.dim = 1;
      });
      onSelect(i);
      sfx.cardDrop(true, 0.16);
    } else {
      if (moved) sfx.cardDrop(false, 0.14);
      it.atHome = true;
      it.target.set(it.home.x, it.home.y, 0);
      it.rotTarget = it.homeRot;
    }
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
  const photoTint = new THREE.Color();
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    // 햇빛: 구름이 지나가듯 몇 초에 걸쳐 강해졌다 약해짐(0~1)
    // (10~25초 주기의 느린 물결만 섞어 끊김 없이 부드럽게)
    const sunL = THREE.MathUtils.clamp(0.5 + 0.34 * Math.sin(t * 0.27) + 0.16 * Math.sin(t * 0.61 + 1.7) + 0.08 * Math.sin(t * 0.13 + 0.4), 0, 1);
    photoTint.setRGB(0.87 + 0.17 * sunL, 0.87 + 0.15 * sunL, 0.89 + 0.1 * sunL);
    photo.material.color.copy(photoTint);
    beams.material.opacity = 0.04 + 0.24 * sunL;
    beams.position.set(Math.sin(t * 0.12) * 40, Math.cos(t * 0.09) * 22, 0);
    cupGlow.material.opacity = 0.05 + 0.13 * sunL * sunL;

    // 몇 초에 한 번, 한 곳씩 반짝임(햇빛이 강할 때 더 또렷)
    nextGlint -= dt;
    if (nextGlint <= 0) {
      const idle = GLINTS.filter((g) => g.t < 0);
      const g = idle[Math.floor(Math.random() * idle.length)];
      if (g) g.t = 0;
      nextGlint = 3.5 + Math.random() * 4;
    }
    GLINTS.forEach((g) => {
      if (g.t < 0) return;
      g.t += dt;
      const p = g.t / g.dur;
      if (p >= 1) {
        g.t = -1;
        g.mesh.material.opacity = 0;
        return;
      }
      const env = Math.sin(Math.PI * p) ** 2;
      const s = g.size * (0.6 + 0.4 * env);
      g.mesh.scale.set(s, s, 1);
      g.mesh.rotation.z = 0.25 * p;
      g.mesh.material.opacity = env * (0.45 + 0.4 * sunL);
    });
    sun.intensity = 0.5 + 0.8 * sunL;

    let maxLift = 0;
    const sorted = [...items].sort((a, b) => a.order - b.order);
    items.forEach((it, i) => {
      const dragging = drag && drag.i === i && drag.moved;
      if (!dragging && i !== chosen) it.target.z = i === active && chosen < 0 ? LIFT.active : 0;
      const k = Math.min(1, dt * (dragging ? 18 : 9));
      it.pos.x += (it.target.x - it.pos.x) * k;
      it.pos.y += (it.target.y - it.pos.y) * k;
      it.pos.z += (it.target.z - it.pos.z) * Math.min(1, dt * 10);
      it.rot += (it.rotTarget - it.rot) * Math.min(1, dt * 8);
      // 겹친 카드는 아래 카드 위에 얹혀 조금씩 떠 있고(사이로 그림자가 짐), 아래 카드 쪽으로 살짝 기욺
      const idx = sorted.indexOf(it);
      const stacked = i !== chosen;
      const layer = stacked ? idx * STACK.gap : 1;
      const lean = stacked ? idx * STACK.lean : 0;
      it.group.position.set(it.pos.x, it.pos.y, it.pos.z + layer);
      it.group.rotation.set(it.tilt.x * Math.min(1, it.pos.z / 60), it.tilt.y * Math.min(1, it.pos.z / 60) + lean, it.rot);
      it.tilt.multiplyScalar(1 - Math.min(1, dt * 6));
      const lit = (0.9 + 0.12 * sunL) * (1 - it.dim * 0.35);
      it.faceMat.color.setScalar(lit);
      maxLift = Math.max(maxLift, it.pos.z);
    });
    // 높이 들수록 그림자가 퍼지고 옅어짐, 햇빛이 강할수록 진해짐
    sun.shadow.radius = 3 + maxLift * 0.13;
    shadowCatcher.material.opacity = (0.42 + 0.26 * sunL) - Math.min(0.14, maxLift * 0.0011);
    cardShadowMat.opacity = 0.38 + 0.24 * sunL;
    glow.material.opacity += ((over ? 0.28 : 0) - glow.material.opacity) * Math.min(1, dt * 10);

    if (fanRimMat) {
      const rimOn = chosen < 0 && !drag;
      const rimPulse = 0.22 + 0.26 * (0.5 + 0.5 * Math.sin(t * 1.4));
      fanRimMat.opacity += ((rimOn ? rimPulse : 0) - fanRimMat.opacity) * Math.min(1, dt * 8);
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
    canvas.removeEventListener('pointercancel', up);
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
