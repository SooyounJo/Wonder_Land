import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// 과자 자판기 정면 패널 (블렌더 렌더 느낌)
// 왼쪽: 지폐가 꽂혀 있는 지폐 투입구 + 메뉴판 / 오른쪽: LCD + 크림색 숫자 키패드(7~9, 4~6, 1~3) + 검은 점 버튼 3개
// 숫자 1~6이 과자 6개. 누르고 있으면 onHover(i), 그대로 떼면 onSelect(i) → 지폐가 빨려 들어감
export function createSnackButtons({ container, labels, onHover = () => {}, onSelect = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // AgX·ACES는 분홍 채도를 많이 깎음
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  // 반사 환경: 위는 흰 소프트박스, 아래는 분홍 (기본 방 환경은 바닥이 어두워 광택면이 검게 비침)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vDir;
        void main(){
          vec3 floorC=vec3(.93,.66,.76), sky=vec3(1.,.96,.97);
          vec3 c=mix(floorC, sky, smoothstep(-.3,.5,vDir.y));
          c+=vec3(1.3)*smoothstep(.84,.96,dot(vDir, normalize(vec3(-.5,.7,.6))));   // 왼쪽 위 앞 소프트박스
          gl_FragColor=vec4(c,1.);
        }`,
    })
  ));
  scene.environment = pmrem.fromScene(studio, 0.03).texture;

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe79ab6, 0.42));
  const key = new THREE.DirectionalLight(0xfff6ee, 1.45);
  key.position.set(-6, 8, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 40 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe0ec, 0.55);
  fill.position.set(8, 2, 8);
  scene.add(fill);

  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const shadowed = (m, cast = true, receive = true) => {
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  };

  /* ---------- 몸판 ---------- */
  const PANEL = { w: 16.4, h: 9.8, y: -0.55 };
  const panelMat = new THREE.MeshPhysicalMaterial({ color: '#f29cbc', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const panel = shadowed(new THREE.Mesh(new RoundedBoxGeometry(PANEL.w, PANEL.h, 0.6, 6, 0.32), panelMat), false);
  panel.position.set(0, PANEL.y, -0.3);
  scene.add(panel);

  // 모서리 나사
  const screwGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24);
  const screwMat = new THREE.MeshStandardMaterial({ color: '#d9d4d8', metalness: 0.9, roughness: 0.3 });
  const slotGeo = new THREE.BoxGeometry(0.18, 0.03, 0.02);
  const slotMat = new THREE.MeshBasicMaterial({ color: '#6e6168' });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const s = shadowed(new THREE.Mesh(screwGeo, screwMat), false);
    s.rotation.x = Math.PI / 2;
    s.position.set(sx * (PANEL.w / 2 - 0.45), PANEL.y + sy * (PANEL.h / 2 - 0.45), 0.03);
    scene.add(s);
    const g = new THREE.Mesh(slotGeo, slotMat);
    g.position.set(s.position.x, s.position.y, 0.065);
    g.rotation.z = Math.PI / 4;
    scene.add(g);
  }

  const darkMat = new THREE.MeshPhysicalMaterial({ color: '#2b2830', roughness: 0.48, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const blackMat = new THREE.MeshPhysicalMaterial({ color: '#141317', roughness: 0.55, clearcoat: 0.3 });

  /* ---------- 왼쪽: 지폐 투입구 ---------- */
  const LX = -4.2;
  const BILL_UNIT = { y: 2.1, w: 5.4, h: 2.5 };
  const unit = shadowed(new THREE.Mesh(new RoundedBoxGeometry(BILL_UNIT.w, BILL_UNIT.h, 0.5, 5, 0.14), darkMat));
  unit.position.set(LX, BILL_UNIT.y, 0.25);
  scene.add(unit);
  const SLOT = { y: 1.72, z: 0.5, w: 3.9 };
  // 입구 둘레의 은색 테 + 안쪽 검은 틈
  const lip = shadowed(new THREE.Mesh(
    new RoundedBoxGeometry(SLOT.w + 0.36, 0.56, 0.16, 4, 0.06),
    new THREE.MeshStandardMaterial({ color: '#cfcbd2', metalness: 0.85, roughness: 0.28 })
  ));
  lip.position.set(LX, SLOT.y, SLOT.z + 0.02);
  scene.add(lip);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(SLOT.w, 0.2), new THREE.MeshBasicMaterial({ color: '#030304' }));
  mouth.position.set(LX, SLOT.y, SLOT.z + 0.105);
  scene.add(mouth);
  // 들어가는 방향 화살표 LED
  const ledMat = new THREE.MeshBasicMaterial({ color: '#5dff8a', toneMapped: false });
  const ledShape = new THREE.Shape();
  ledShape.moveTo(-0.2, 0.1); ledShape.lineTo(0, -0.08); ledShape.lineTo(0.2, 0.1); ledShape.lineTo(0.2, 0.18); ledShape.lineTo(0, 0); ledShape.lineTo(-0.2, 0.18); ledShape.closePath();
  const ledGeo = new THREE.ShapeGeometry(ledShape);
  const leds = [-1.3, 0, 1.3].map((dx) => {
    const m = new THREE.Mesh(ledGeo, ledMat.clone());
    m.position.set(LX + dx, SLOT.y + 0.62, 0.502);
    scene.add(m);
    return m;
  });
  const unitLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 0.46),
    new THREE.MeshBasicMaterial({
      transparent: true,
      toneMapped: false,
      map: canvasTex(1024, 102, (g, w, h) => {
        g.fillStyle = '#f2e9dc';
        g.font = '700 56px "Inter Tight", Arial, sans-serif';
        g.textBaseline = 'middle';
        g.textAlign = 'left';
        g.fillText('BILLS', 24, h / 2 + 2);
        g.textAlign = 'right';
        g.fillText('₩1,000', w - 24, h / 2 + 2);
      }),
    })
  );
  unitLabel.position.set(LX, SLOT.y + 1.18, 0.502);
  scene.add(unitLabel);

  // 지폐: 투입구에서 앞으로 나와 아래로 휘어 늘어짐. 고르면 덜컥덜컥 빨려 들어감
  const BILL = { w: 3.3, len: 3.7, R: 0.62, bend: 1.32, seg: 48 };
  const billTex = canvasTex(1024, 470, (g, w, h) => {
    g.fillStyle = '#cfe6c8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5f8f62';
    g.lineWidth = 10;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.lineWidth = 3;
    g.strokeRect(40, 40, w - 80, h - 80);
    g.globalAlpha = 0.18;
    for (let x = 60; x < w - 60; x += 14) {
      g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 40, h - 50); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#e9f4e3';
    g.beginPath(); g.ellipse(w * 0.7, h / 2, 150, 150, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5f8f62'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#e88aa9';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.beginPath(); g.ellipse(w * 0.7 + Math.cos(a) * 52, h / 2 + Math.sin(a) * 52, 40, 40, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#f4c64e';
    g.beginPath(); g.ellipse(w * 0.7, h / 2, 40, 40, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f5a35';
    g.font = '900 120px "Inter Tight", Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('1000', 80, h / 2 - 20);
    g.font = '700 38px "Inter Tight", Arial, sans-serif';
    g.fillText('SNACK BANK · 과자 은행', 84, h / 2 + 80);
  });
  const billGeo = new THREE.BufferGeometry();
  const billPos = new Float32Array((BILL.seg + 1) * 2 * 3);
  const billUv = new Float32Array((BILL.seg + 1) * 2 * 2);
  const billIdx = [];
  for (let i = 0; i <= BILL.seg; i++) {
    const v = i / BILL.seg;
    billUv.set([v, 0, v, 1], i * 4);   // 지폐 그림은 가로로 길어 길이 방향을 u로
    if (i < BILL.seg) {
      const a = i * 2;
      billIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  billGeo.setAttribute('position', new THREE.BufferAttribute(billPos, 3));
  billGeo.setAttribute('uv', new THREE.BufferAttribute(billUv, 2));
  billGeo.setIndex(billIdx);
  const bill = shadowed(new THREE.Mesh(
    billGeo,
    new THREE.MeshStandardMaterial({ map: billTex, color: '#dfe9da', roughness: 0.85, side: THREE.DoubleSide })
  ), true, false);
  scene.add(bill);
  const BILL_IDLE = 0.85;
  let billIns = BILL_IDLE;
  const layBill = (ins, sway) => {
    const bend = BILL.bend + sway;
    const arc = BILL.R * bend;
    for (let i = 0; i <= BILL.seg; i++) {
      // d: 투입구에서 지폐를 따라 잰 거리(바깥 끝 i=0, 0 이하는 기계 안)
      const d = BILL.len - ins - (i / BILL.seg) * BILL.len;
      let y = SLOT.y;
      let z = SLOT.z;
      if (d <= 0) z = SLOT.z + d - 0.02;
      else if (d <= arc) {
        const th = d / BILL.R;
        z = SLOT.z + BILL.R * Math.sin(th);
        y = SLOT.y - BILL.R * (1 - Math.cos(th));
      } else {
        const r = d - arc;
        z = SLOT.z + BILL.R * Math.sin(bend) + r * Math.cos(bend);
        y = SLOT.y - BILL.R * (1 - Math.cos(bend)) - r * Math.sin(bend);
      }
      billPos.set([LX - BILL.w / 2, y, z, LX + BILL.w / 2, y, z], i * 6);
    }
    billGeo.attributes.position.needsUpdate = true;
    billGeo.computeVertexNormals();
    billGeo.computeBoundingSphere();
  };

  /* ---------- 왼쪽 아래: 메뉴판 ---------- */
  const menuFrame = shadowed(new THREE.Mesh(new RoundedBoxGeometry(5.4, 3.3, 0.18, 4, 0.08), blackMat));
  menuFrame.position.set(LX, -2.95, 0.09);
  scene.add(menuFrame);
  const drawMenu = (g, w, h) => {
    g.fillStyle = '#f6eedd';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c23f74';
    g.font = '900 64px "Inter Tight", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('M E N U', w / 2, 66);
    g.fillStyle = '#e7a7bd';
    g.fillRect(60, 108, w - 120, 5);
    g.textAlign = 'left';
    labels.forEach((name, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 60 + col * (w / 2 - 10);
      const y = 180 + row * 128;
      g.fillStyle = '#2b2830';
      g.beginPath(); g.ellipse(x + 38, y, 38, 38, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f6eedd';
      g.font = '700 48px "Inter Tight", Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText(String(i + 1), x + 38, y + 3);
      g.textAlign = 'left';
      g.fillStyle = '#3b2a31';
      g.font = '700 58px "Inter Tight", Arial, sans-serif';
      g.fillText(name, x + 96, y + 3);
    });
  };
  const menuCard = shadowed(new THREE.Mesh(
    new THREE.PlaneGeometry(5.1, 3.0),
    new THREE.MeshStandardMaterial({ map: canvasTex(1020, 600, drawMenu), roughness: 0.6 })
  ), false);
  menuCard.position.set(LX, -2.95, 0.182);
  scene.add(menuCard);

  /* ---------- 오른쪽: LCD ---------- */
  const RX = 4.1;
  const lcdBezel = shadowed(new THREE.Mesh(new RoundedBoxGeometry(4.65, 1.35, 0.3, 4, 0.1), blackMat));
  lcdBezel.position.set(RX, 3.0, 0.15);
  scene.add(lcdBezel);
  const lcdCanvas = document.createElement('canvas');
  lcdCanvas.width = 1024;
  lcdCanvas.height = 220;
  const lcdTex = new THREE.CanvasTexture(lcdCanvas);
  lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.92), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false }));
  lcd.position.set(RX, 3.0, 0.302);
  scene.add(lcd);
  let lcdText = '';
  const drawLcd = (a, b) => {
    const k = a + '|' + b;
    if (k === lcdText) return;
    lcdText = k;
    const g = lcdCanvas.getContext('2d');
    const { width: w, height: h } = lcdCanvas;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#16321f');
    bg.addColorStop(1, '#0d2216');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,255,160,0.05)';
    for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
    g.font = '900 78px "Doto", monospace';
    g.textBaseline = 'middle';
    g.shadowColor = '#7dffa6';
    g.shadowBlur = 18;
    g.fillStyle = '#b6ffc8';
    g.textAlign = 'left';
    g.fillText(a, 40, h * 0.32);
    g.fillText(b, 40, h * 0.74);
    g.shadowBlur = 0;
    lcdTex.needsUpdate = true;
  };

  /* ---------- 오른쪽: 키패드 ---------- */
  const PITCH = 1.46;
  const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '..', '...'];
  const PAD_Y = -1.25;
  const frame = shadowed(new THREE.Mesh(new RoundedBoxGeometry(PITCH * 3 + 0.34, PITCH * 4 + 0.34, 0.3, 4, 0.1), blackMat));
  frame.position.set(RX, PAD_Y, 0.05);
  scene.add(frame);

  const baseGeo = new RoundedBoxGeometry(1.34, 1.34, 0.4, 4, 0.09);
  const CAP = { r: 0.5, h: 0.24, round: 0.11 };
  const capProfile = [new THREE.Vector2(0, 0), new THREE.Vector2(CAP.r, 0)];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2);
    capProfile.push(new THREE.Vector2(CAP.r - CAP.round + Math.cos(a) * CAP.round, CAP.h - CAP.round + Math.sin(a) * CAP.round));
  }
  capProfile.push(new THREE.Vector2(0, CAP.h));
  const capGeo = new THREE.LatheGeometry(capProfile, 64);
  const creamBase = new THREE.MeshPhysicalMaterial({ color: '#e4d9c1', roughness: 0.55, clearcoat: 0.25 });
  const blackBase = new THREE.MeshPhysicalMaterial({ color: '#1c1b20', roughness: 0.5, clearcoat: 0.3 });
  const faceGeo = new THREE.PlaneGeometry(0.7, 0.7);

  const keyFace = (txt, dark) => canvasTex(256, 256, (g, w, h) => {
    if (txt.startsWith('.')) {
      g.fillStyle = '#f4f1ea';
      const n = txt.length;
      for (let k = 0; k < n; k++) {
        const x = w / 2 + (k - (n - 1) / 2) * 66;
        g.beginPath(); g.roundRect(x - 21, h / 2 - 40, 42, 80, 21); g.fill();
      }
      return;
    }
    g.fillStyle = dark ? '#f4f1ea' : '#1b1a1e';
    g.font = '600 150px "Inter Tight", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 + 8);
  });

  const KEY_Z = 0.05;
  const keys = KEYS.map((txt, k) => {
    const dark = txt.startsWith('.');
    const col = k % 3;
    const row = Math.floor(k / 3);
    const group = new THREE.Group();
    group.position.set(RX + (col - 1) * PITCH, PAD_Y + (1.5 - row) * PITCH, KEY_Z);
    scene.add(group);
    const base = shadowed(new THREE.Mesh(baseGeo, dark ? blackBase : creamBase));
    base.position.z = 0.2;
    group.add(base);
    const capMat = new THREE.MeshPhysicalMaterial({
      color: dark ? '#17161a' : '#f6f0e3',
      roughness: dark ? 0.35 : 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color('#ffd9a8'),
      emissiveIntensity: 0,
    });
    const cap = shadowed(new THREE.Mesh(capGeo, capMat));
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.36;
    group.add(cap);
    const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: keyFace(txt, dark), transparent: true, toneMapped: false }));
    face.position.z = 0.36 + CAP.h + 0.004;
    group.add(face);
    const snack = /^[1-6]$/.test(txt) ? Number(txt) - 1 : -1;
    for (const m of [base, cap, face]) m.userData.key = k;
    return { group, cap, capMat, face, txt, dark, snack, press: 0, glow: 0 };
  });

  // 폰트가 늦게 오면 글자를 다시 그림
  Promise.all([
    document.fonts?.load('600 150px "Inter Tight"'),
    document.fonts?.load('900 78px "Doto"'),
  ]).then(() => {
    if (disposed) return;
    for (const b of keys) {
      b.face.material.map.dispose();
      b.face.material.map = keyFace(b.txt, b.dark);
    }
    menuCard.material.map.dispose();
    menuCard.material.map = canvasTex(1020, 600, drawMenu);
    lcdText = '';
  }).catch(() => {});

  /* ---------- 크기 맞춤: 패널 전체가 보이고 위쪽에 질문 문구 자리를 남김 ---------- */
  const CONTENT = { halfW: 8.7, top: PANEL.y + PANEL.h / 2 + 0.15, bottom: PANEL.y - PANEL.h / 2 - 0.25 };
  const TOP_SPACE = 0.2;
  const BOTTOM_SPACE = 0.05;
  const TILT = THREE.MathUtils.degToRad(5);   // 거의 정면, 키가 튀어나온 게 보일 만큼만 위에서
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const ch = CONTENT.top - CONTENT.bottom;
    const H = Math.max(ch / (1 - TOP_SPACE - BOTTOM_SPACE), (CONTENT.halfW * 2) / camera.aspect);
    const cy = (CONTENT.top + CONTENT.bottom) / 2 + ((TOP_SPACE - BOTTOM_SPACE) / 2) * H;
    const dist = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, cy + Math.sin(TILT) * dist, Math.cos(TILT) * dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- 누르기 ---------- */
  const ray = new THREE.Raycaster();
  const nd = new THREE.Vector2();
  const hitMeshes = keys.flatMap((b) => b.group.children);
  let pressed = -1;
  let chosen = -1;
  let chosenAt = 0;
  let notice = null;   // { a, b, until }
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(nd, camera);
    const hit = ray.intersectObjects(hitMeshes)[0];
    return hit ? hit.object.userData.key : -1;
  };
  const canvas = renderer.domElement;
  const say = (a, b, ms = 1400) => {
    notice = { a, b, until: performance.now() + ms };
  };
  const down = (e) => {
    if (chosen >= 0) return;
    const k = pick(e);
    if (k < 0) return;
    pressed = k;
    canvas.setPointerCapture(e.pointerId);
    const b = keys[k];
    if (b.snack >= 0) {
      say(`No.${b.txt}`, labels[b.snack].toUpperCase(), 1e9);
      onHover(b.snack);
    } else if (b.dark) say('SELECT', 'No. 1 - 6');
    else say(`No.${b.txt}`, 'SOLD OUT');
  };
  const release = (k) => {
    pressed = -1;
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
    onSelect(keys[k].snack);
  };
  const cancel = () => {
    if (pressed >= 0) release(pressed);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);

  /* ---------- 그리기 ---------- */
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    keys.forEach((b, k) => {
      const target = k === pressed || k === chosen ? 1 : 0;
      b.press += (target - b.press) * Math.min(1, dt * 24);
      b.glow += ((k === chosen ? 1 : 0) - b.glow) * Math.min(1, dt * 4);
      b.group.position.z = KEY_Z - b.press * 0.16;
      b.cap.scale.set(1, 1 - b.press * 0.12, 1);
      b.face.position.z = 0.36 + CAP.h * (1 - b.press * 0.12) + 0.004;
      b.capMat.emissiveIntensity = b.glow * (0.22 + 0.1 * Math.sin(now / 240));
    });

    // 지폐: 평소엔 살랑살랑, 고른 뒤엔 덜컥거리며 빨려 들어감
    let sway = Math.sin(t * 1.3) * 0.035 + Math.sin(t * 2.9) * 0.015;
    if (chosen >= 0) {
      const p = Math.min(1, (now - chosenAt - 250) / 1500);
      if (p > 0) {
        const stepped = (p + Math.sin(p * Math.PI * 8) * 0.04);
        billIns = BILL_IDLE + (BILL.len + 0.1 - BILL_IDLE) * Math.min(1, Math.max(0, stepped));
        sway *= 1 - p;
      }
    }
    layBill(billIns, sway);
    bill.visible = billIns < BILL.len + 0.05;

    // 화살표 LED: 위에서 아래로 차례로 깜빡임(고른 뒤엔 빠르게)
    const speed = chosen >= 0 ? 9 : 3;
    leds.forEach((m, i) => {
      const on = 0.5 + 0.5 * Math.sin(t * speed - i * 1.1);
      m.material.color.setRGB(0.12 + 0.25 * on, 0.35 + 0.65 * on, 0.18 + 0.36 * on);
    });

    if (chosen >= 0) {
      const b = keys[chosen];
      drawLcd(`No.${b.txt} ${labels[b.snack].toUpperCase()}`, Math.floor(t * 2) % 2 ? 'THANK YOU' : 'THANK YOU _');
    } else if (notice && now < notice.until) drawLcd(notice.a, notice.b);
    else {
      notice = null;
      drawLcd(Math.floor(t / 2.2) % 2 ? '₩ 1,000' : 'INSERTED', Math.floor(t * 2) % 2 ? 'PRESS 1 - 6' : 'PRESS 1 - 6 _');
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
    scene.environment.dispose();
    studio.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
