import { createHash } from "node:crypto";

/** Identifiant stable par (client, jour, métrique, source) : réimporter remplace au lieu de dupliquer. */
export function sampleId(clientId: string, day: string, metric: string, source: string) {
  const h = createHash("sha256").update(`${clientId}|${day}|${metric}|${source}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
