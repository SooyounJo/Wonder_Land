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

// 시작점에서 끝점으로 작은 빛 점만 천천히 흘러감. 손을 대면 숨김
export function createDragNudge(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const sparks = Array.from({ length: 4 }, () => {
    const m = sprite(sparkTex(), 25);
    m.material.blending = THREE.AdditiveBlending;
    group.add(m);
    return m;
  });

  return {
    update(t, visible, from, to, size) {
      group.visible = visible;
      if (!visible) return;
      sparks.forEach((m, i) => {
        const cycle = ((t * 0.08 + i / sparks.length) % 1 + 1) % 1;
        m.position.copy(from).lerp(to, cycle);
        const tw = 0.7 + 0.3 * Math.sin(t * 0.9 + i * 1.7);
        const edge = cycle < 0.1 ? cycle / 0.1 : cycle > 0.88 ? (1 - cycle) / 0.12 : 1;
        const s = size * (0.18 + 0.06 * tw);
        m.scale.set(s, s, 1);
        m.material.opacity = edge * (0.45 + 0.4 * tw);
      });
    },
  };
}

// 눌러 보라는 고리만 버튼 위에서 퍼짐
export function createTapNudge(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const ring = sprite(ringTex(), 25);
  group.add(ring);

  return {
    update(t, visible, size) {
      group.visible = visible;
      if (!visible) return;
      const cycle = (t % 1.7) / 1.7;
      const rip = fade(cycle, 0.08, 0.82);
      ring.position.set(0, 0, 6);
      ring.scale.setScalar(size * (0.55 + rip * 0.7));
      ring.material.opacity = (1 - rip) * 0.85;
    },
  };
}
