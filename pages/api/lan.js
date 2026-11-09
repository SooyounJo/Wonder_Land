import os from "os";

// 패드를 localhost로 연 경우, 휴대폰이 닿을 수 있는 주소로 QR을 만들기 위함
export default function handler(req, res) {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
  const ip = ips.find((v) => /^(192\.168\.|10\.|172\.)/.test(v)) || ips[0] || null;
  res.status(200).json({ ip });
}
