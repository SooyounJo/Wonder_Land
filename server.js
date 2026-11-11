// Next 커스텀 서버 + 웹소켓(/ws)
// - display(메인 화면): 지금 장면 상태를 보냄 → 모든 pad로 전달
// - pad(아이패드): 선택·다이얼 명령을 보냄 → 모든 display로 전달
// - control(상황 확인): 연결 상태를 보고, 메인·패드를 한꺼번에 새로고침
const IDLE_MS = 10 * 60 * 1000;
const ACTIONS = new Set(["start", "back", "hover", "select", "dial", "dialSelect", "lang"]);
const dev = !process.argv.includes("--prod");
if (!dev) process.env.NODE_ENV = "production";

const { createServer } = require("http");
const os = require("os");
const next = require("next");
const { WebSocketServer } = require("ws");

const port = Number(process.env.PORT) || 3000;
const app = next({ dev, turbopack: true });
const handle = app.getRequestHandler();

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);

app.prepare().then(() => {
  const nextUpgrade = app.getUpgradeHandler();
  const server = createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ noServer: true });
  const clients = { display: new Set(), pad: new Set(), control: new Set() };
  let lastState = null;
  let lastActivity = Date.now();

  const send = (ws, msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const broadcast = (role, msg) => clients[role].forEach((ws) => send(ws, msg));
  const statusMsg = () => ({
    type: "status",
    displays: clients.display.size,
    pads: clients.pad.size,
    scene: lastState?.scene ?? null,
    idleMs: Date.now() - lastActivity,
    limitMs: IDLE_MS,
  });
  const announcePeers = () => {
    const peers = { type: "peers", displays: clients.display.size, pads: clients.pad.size };
    broadcast("pad", peers);
    broadcast("display", peers);
    broadcast("control", statusMsg());
  };
  const kick = () => {
    const msg = { type: "reload" };
    broadcast("display", msg);
    broadcast("pad", msg);
    lastState = null;
    lastActivity = Date.now();
    broadcast("control", statusMsg());
  };

  wss.on("connection", (ws, role) => {
    clients[role].add(ws);
    ws.alive = true;
    ws.on("pong", () => (ws.alive = true));
    if (role === "pad" && lastState) send(ws, lastState);
    if (role === "control") send(ws, statusMsg());
    announcePeers();

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      if (role === "display") {
        if (msg.type === "state") lastState = msg;
        broadcast("pad", msg);
        if (msg.type === "state") broadcast("control", statusMsg());
      } else if (role === "control") {
        if (msg.type === "reload") kick();
      } else {
        if (ACTIONS.has(msg.type)) lastActivity = Date.now();
        broadcast("display", msg);
      }
    });
    ws.on("close", () => {
      clients[role].delete(ws);
      if (role === "display" && clients.display.size === 0) lastState = null;   // 지난 회차 카드가 남지 않게
      announcePeers();
    });
  });

  // 패드 조작이 10분 없으면 메인 화면과 패드를 처음부터 다시 연다
  const idle = setInterval(() => {
    if (Date.now() - lastActivity < IDLE_MS) return;
    if (clients.display.size + clients.pad.size === 0) return;
    kick();
  }, 5000);
  wss.on("close", () => clearInterval(idle));

  // 잠든 아이패드처럼 끊긴 연결 정리
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  wss.on("close", () => clearInterval(heartbeat));

  server.on("upgrade", (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url, "http://localhost");
    if (pathname !== "/ws") return nextUpgrade(req, socket, head);
    const asked = searchParams.get("role");
    const role = asked === "display" || asked === "control" ? asked : "pad";
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, role));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`> 메인 화면  http://localhost:${port}`);
    console.log(`> 상황 확인  http://localhost:${port}/status`);
    for (const ip of lanAddresses()) {
      console.log(`> 아이패드   http://${ip}:${port}/pad`);
      console.log(`> 상황 확인  http://${ip}:${port}/status`);
    }
  });
});
