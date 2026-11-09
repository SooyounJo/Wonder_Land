import { saveCard } from "@/lib/cardStore";

export const config = {
  api: { bodyParser: false },
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("too big"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// 패드가 그린 카드 PNG를 잠깐 보관하고 주소를 돌려준다
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end();
    return;
  }
  let buf;
  try {
    buf = await readBody(req, 4_000_000);
  } catch (err) {
    res.status(err.status || 400).end();
    return;
  }
  if (buf.length < 32 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    res.status(400).json({ error: "png" });
    return;
  }
  const raw = String(req.query.name || "카드");
  const name = raw.replace(/[^\w가-힣]+/g, "") || "카드";
  const id = saveCard(buf, `성장측정실-${name}.png`);
  res.status(200).json({ id });
}
