import { readCard } from "@/lib/cardStore";

export const config = {
  api: { responseLimit: "6mb" },
};

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end();
    return;
  }
  const id = String(req.query.id || "");
  const item = readCard(id);
  if (!item) {
    res.status(404).end("없는 카드");
    return;
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(item.filename)}`);
  res.setHeader("Cache-Control", "private, max-age=0, no-store");
  res.status(200).send(item.png);
}
