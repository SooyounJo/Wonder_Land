import * as THREE from 'three';

// 테이블 사진(위에서 내려다본 천 · 접시 · 티스푼) 위에 놓인 꽃 카드 세 장
// 카드를 집으면 떠오르며 빛 때문에 테이블에 그림자가 생기고(높이 들수록 멀어지고 흐려짐), 접시에 내려놓으면 선택
// 좌표는 사진 픽셀 기준(1344×752), 테이블 면이 z=0
const IMG = { w: 1344, h: 752, src: '/pad/table.webp' };
const PLATE = { x: 672, y: 355, r: 164 };
const CARD = { w: 148, h: 199, d: 3, r: 9 };
const FOV = 30;
const LIFT = { drag: 90, active: 16 };

const loadTexture = (src, aniso) => new Promise((ok, fail) => {
  new THREE.TextureLoader().load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    ok(t);
  }, undefined, fail);
});

// cards: [{ src, x, y, rot }] (사진 좌표, rot는 도)
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
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  let dist = 1000;

  // 사진 좌표 ↔ 월드(가운데가 원점, 위가 +y)
  const wx = (x) => x - IMG.w / 2;
  const wy = (y) => IMG.h / 2 - y;

  /* ---------- 빛과 그림자 ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8e8d8, 2.1);
  hemi.position.set(0, 0, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-380, 560, 820);   // 왼쪽 위에서 비춤 → 그림자는 오른쪽 아래로
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 460, bottom: -460, near: 100, far: 2200 });
  scene.add(sun);
  scene.add(sun.target);

  const table = new THREE.Mesh(new THREE.PlaneGeometry(IMG.w, IMG.h), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(table);
  // 사진 위에 그림자만 얹는 판
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(IMG.w, IMG.h), new THREE.ShadowMaterial({ color: 0x0b2a14, opacity: 0.5 }));
  shadowCatcher.position.z = 0.2;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // 접시 위에 올렸을 때 접시 테두리가 은은하게 빛남
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(PLATE.r * 0.92, PLATE.r * 1.08, 96),
    new THREE.MeshBasicMaterial({ color: 0xfffff0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  glow.position.set(wx(PLATE.x), wy(PLATE.y), 0.5);
  scene.add(glow);

  /* ---------- 카드 ---------- */
  const shape = new THREE.Shape();
  {
    const { w, h, r } = CARD;
    const x = -w / 2;
    const y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
  }
  const cardGeo = new THREE.ExtrudeGeometry(shape, { depth: CARD.d, bevelEnabled: false, curveSegments: 6 });
  {
    // 앞뒷면 UV를 카드 크기 0~1로
    const pos = cardGeo.attributes.position;
    const uv = cardGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / CARD.w + 0.5, pos.getY(i) / CARD.h + 0.5);
    uv.needsUpdate = true;
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#e9e0d0', roughness: 0.9 });

  const items = cards.map((c, i) => {
    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.02 });
    const mesh = new THREE.Mesh(cardGeo, [faceMat, edgeMat]);
    mesh.castShadow = true;
    mesh.userData.card = i;
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    const home = { x: wx(c.x), y: wy(c.y), rot: THREE.MathUtils.degToRad(c.rot) };
    group.position.set(home.x, home.y, i * 0.5);
    group.rotation.z = home.rot;
    loadTexture(c.src, aniso).then((t) => {
      if (disposed) return t.dispose();
      faceMat.map = t;
      faceMat.needsUpdate = true;
    }).catch(() => {});
    return {
      group, mesh, faceMat, home,
      pos: new THREE.Vector3(home.x, home.y, 0), target: new THREE.Vector3(home.x, home.y, 0),
      rot: home.rot, rotTarget: home.rot, tilt: new THREE.Vector2(), dim: 0, order: i,
    };
  });

  loadTexture(IMG.src, aniso).then((t) => {
    if (disposed) return t.dispose();
    table.material.map = t;
    table.material.needsUpdate = true;
  }).catch(() => {});

  /* ---------- 크기 맞춤(사진이 화면을 꽉 채우도록) ---------- */
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const visH = camera.aspect < IMG.w / IMG.h ? IMG.h : IMG.w / camera.aspect;
    dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.near = dist * 0.2;
    camera.far = dist * 2;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- 집고 옮기기 ---------- */
  const ray = new THREE.Raycaster();
  const nd = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPt = new THREE.Vector3();
  let active = -1;
  let chosen = -1;
  let drag = null;
  let over = false;
  let topOrder = cards.length;

  const pointAt = (e, z = 0) => {
    const r = canvas.getBoundingClientRect();
    nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(nd, camera);
    plane.constant = -z;
    return ray.ray.intersectPlane(plane, hitPt) ? hitPt.clone() : null;
  };
  const overPlate = (p) => Math.hypot(p.x - wx(PLATE.x), p.y - wy(PLATE.y)) < PLATE.r * 1.1;

  const down = (e) => {
    if (chosen >= 0) return;
    const r = canvas.getBoundingClientRect();
    nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(nd, camera);
    const hit = ray.intersectObjects(items.map((it) => it.mesh))[0];
    if (!hit) return;
    const i = hit.object.userData.card;
    const it = items[i];
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    const p = pointAt(e, it.pos.z);
    drag = { i, off: new THREE.Vector2(it.pos.x - p.x, it.pos.y - p.y), x0: e.clientX, y0: e.clientY, moved: false, last: p };
    it.order = ++topOrder;
    if (active !== i) {
      active = i;
      onHover(i);
    }
  };
  const move = (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
    if (!drag.moved) return;
    const it = items[drag.i];
    const p = pointAt(e, LIFT.drag);
    if (!p) return;
    it.target.set(p.x + drag.off.x, p.y + drag.off.y, LIFT.drag);
    // 끄는 방향으로 살짝 기울어짐
    it.tilt.set(THREE.MathUtils.clamp((p.y - drag.last.y) * 0.012, -0.25, 0.25), THREE.MathUtils.clamp(-(p.x - drag.last.x) * 0.012, -0.25, 0.25));
    drag.last = p;
    const o = overPlate(pointAt(e, 0));
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
    const p = pointAt(e, 0);
    if (moved && e.type === 'pointerup' && p && overPlate(p)) {
      chosen = i;
      it.target.set(wx(PLATE.x) + 6, wy(PLATE.y) + 4, 0);
      it.rotTarget = THREE.MathUtils.degToRad(-8);
      items.forEach((o, k) => {
        if (k !== i) o.dim = 1;
      });
      onSelect(i);
    } else {
      it.target.set(it.home.x, it.home.y, 0);
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
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    let maxLift = 0;
    const sorted = [...items].sort((a, b) => a.order - b.order);
    items.forEach((it, i) => {
      const dragging = drag && drag.i === i && drag.moved;
      // 고른 뒤 쳐다보는 카드(살짝 들림), 끄는 카드(높이 들림), 나머지(테이블 위)
      if (!dragging && i !== chosen) {
        const z = i === active && chosen < 0 ? LIFT.active : 0;
        it.target.z = z;
      }
      const k = Math.min(1, dt * (dragging ? 18 : 9));
      it.pos.x += (it.target.x - it.pos.x) * k;
      it.pos.y += (it.target.y - it.pos.y) * k;
      it.pos.z += (it.target.z - it.pos.z) * Math.min(1, dt * 10);
      it.rot += (it.rotTarget - it.rot) * Math.min(1, dt * 8);
      const layer = sorted.indexOf(it) * 0.6;
      it.group.position.set(it.pos.x, it.pos.y, it.pos.z + layer);
      it.group.rotation.set(it.tilt.x * Math.min(1, it.pos.z / 40), it.tilt.y * Math.min(1, it.pos.z / 40), it.rot);
      it.tilt.multiplyScalar(1 - Math.min(1, dt * 6));
      it.faceMat.color.setScalar(1 - it.dim * 0.35);
      maxLift = Math.max(maxLift, it.pos.z);
    });
    // 높이 들수록 그림자가 퍼지고 옅어짐
    sun.shadow.radius = 3 + maxLift * 0.1;
    shadowCatcher.material.opacity = 0.5 - Math.min(0.12, maxLift * 0.0013);
    glow.material.opacity += ((over ? 0.55 : 0) - glow.material.opacity) * Math.min(1, dt * 10);

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
