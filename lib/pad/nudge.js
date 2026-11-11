import * as THREE from "three";

// 아직 손을 대기 전, 어디로 끌고 가면 되는지 보여주는 손과 반짝이는 선
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const fade = (t, a, b) => {
  const u = clamp01((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};

const canvasTex = (paint, size) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const handTex = () =>
  canvasTex((g, s) => {
    g.translate(s * 0.5, s * 0.56);
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = s * 0.04;
    g.strokeStyle = "rgba(36, 24, 32, 0.88)";
    g.fillStyle = "#fffdf8";
    g.beginPath();
    g.moveTo(-s * 0.05, s * 0.02);
    g.lineTo(-s * 0.055, -s * 0.32);
    g.quadraticCurveTo(0, -s * 0.44, s * 0.055, -s * 0.32);
    g.lineTo(s * 0.06, s * 0.02);
    g.quadraticCurveTo(s * 0.2, s * 0.08, s * 0.18, s * 0.26);
    g.quadraticCurveTo(s * 0.14, s * 0.38, 0, s * 0.36);
    g.quadraticCurveTo(-s * 0.16, s * 0.34, -s * 0.18, s * 0.2);
    g.quadraticCurveTo(-s * 0.34, s * 0.18, -s * 0.34, s * 0.04);
    g.quadraticCurveTo(-s * 0.26, -s * 0.02, -s * 0.14, s * 0.04);
    g.closePath();
    g.fill();
    g.stroke();
  }, 160);

const dashTex = () => {
  const t = canvasTex((g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = "rgba(42, 26, 34, 0.72)";
    g.fillRect(s * 0.04, s * 0.3, s * 0.52, s * 0.4);
    g.fillStyle = "rgba(255, 250, 232, 0.98)";
    g.fillRect(s * 0.08, s * 0.38, s * 0.44, s * 0.24);
  }, 128);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(9, 1);
  return t;
};

const sparkTex = () =>
  canvasTex((g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,245,1)");
    r.addColorStop(0.2, "rgba(255,236,170,0.95)");
    r.addColorStop(1, "rgba(255,220,120,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }, 64);

const ringTex = () =>
  canvasTex((g, s) => {
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = s * 0.045;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
    g.stroke();
  }, 128);

const sprite = (map, order) => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false })
  );
  mesh.renderOrder = order;
  return mesh;
};

// 시작점에서 끝점으로 손이 끌려가고, 그 경로가 반짝임. 손을 대면 숨김
export function createDragNudge(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const line = sprite(dashTex(), 24);
  group.add(line);
  const sparks = Array.from({ length: 8 }, () => {
    const m = sprite(sparkTex(), 25);
    m.material.blending = THREE.AdditiveBlending;
    group.add(m);
    return m;
  });
  const hand = sprite(handTex(), 26);
  group.add(hand);
  const mid = new THREE.Vector3();

  return {
    update(t, visible, from, to, size) {
      group.visible = visible;
      if (!visible) return;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ang = Math.atan2(dy, dx);
      mid.copy(from).lerp(to, 0.5);
      line.position.copy(mid);
      line.rotation.z = ang;
      line.scale.set(len, Math.max(18, size * 0.2), 1);
      line.material.map.offset.x = -t * 0.55;
      line.material.opacity = 1;

      const cycle = (t % 2.8) / 2.8;
      const travel = fade(cycle, 0.08, 0.72);
      const alpha = cycle < 0.08 ? cycle / 0.08 : cycle > 0.84 ? (1 - cycle) / 0.16 : 1;
      sparks.forEach((m, i) => {
        const u = (i + 0.5) / sparks.length;
        m.position.copy(from).lerp(to, u);
        const tw = 0.35 + 0.65 * Math.max(0, Math.sin(t * 8 - i * 0.8));
        const near = 1 - Math.min(1, Math.abs(u - travel) * 2.4);
        const s = size * (0.28 + 0.16 * tw + 0.22 * near);
        m.scale.set(s, s, 1);
        m.material.opacity = alpha * (0.35 + 0.65 * tw);
      });
      hand.position.copy(from).lerp(to, travel);
      hand.rotation.z = ang - Math.PI / 2;
      const hs = size * (1 + 0.04 * Math.sin(t * 7));
      hand.scale.set(hs, hs, 1);
      hand.material.opacity = alpha;
    },
  };
}

// 버튼을 누르라는 손. 내렸다가 고리가 퍼짐
export function createTapNudge(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const ring = sprite(ringTex(), 25);
  group.add(ring);
  const hand = sprite(handTex(), 26);
  hand.rotation.z = 0.35;
  group.add(hand);

  return {
    update(t, visible, size) {
      group.visible = visible;
      if (!visible) return;
      const cycle = (t % 1.7) / 1.7;
      const press = Math.sin(Math.min(1, fade(cycle, 0.05, 0.42)) * Math.PI);
      hand.position.set(size * 0.18, size * (0.16 - press * 0.28), 12);
      hand.scale.setScalar(size * (1 - press * 0.06));
      hand.material.opacity = cycle > 0.82 ? (1 - cycle) / 0.18 : 1;
      const rip = fade(cycle, 0.28, 0.78);
      ring.position.set(0, 0, 6);
      ring.scale.setScalar(size * (0.7 + rip * 0.85));
      ring.material.opacity = (1 - rip) * (cycle > 0.28 ? 0.9 : 0);
    },
  };
}
