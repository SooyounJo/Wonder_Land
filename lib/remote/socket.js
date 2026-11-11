// 메인 화면(display)·아이패드(pad) 공용 웹소켓 연결. 끊기면 자동으로 다시 연결
export function connectRemote(role, { onMessage = () => {}, onStatus = () => {} } = {}) {
  let ws = null;
  let closed = false;
  let retry = 0;
  let timer = 0;
  const queue = [];

  const open = () => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws?role=${role}`);
    ws.onopen = () => {
      retry = 0;
      onStatus(true);
      while (queue.length) ws.send(queue.shift());
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg?.type === "reload") {
        location.reload();
        return;
      }
      onMessage(msg);
    };
    ws.onclose = () => {
      onStatus(false);
      if (closed) return;
      timer = setTimeout(open, Math.min(4000, 400 * 2 ** retry++));
    };
  };
  open();

  return {
    send(msg) {
      const data = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
      else if (msg.type === "state") queue.splice(0, queue.length, data);   // 상태는 최신 것만 보내면 됨
    },
    close() {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
