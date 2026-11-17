import type { HealthCheck } from "./types";

export type Alert = { level: "high" | "medium"; text: string };

/** Signaux à surveiller dans un bilan de santé. */
export function healthAlerts(h: HealthCheck | undefined | null): Alert[] {
  if (!h) return [];
  const a: Alert[] = [];
  if (h.pain_zones?.length) a.push({ level: "high", text: `Douleur : ${h.pain_zones.join(", ").toLowerCase()}` });
  if (h.systolic && h.diastolic && (h.systolic >= 140 || h.diastolic >= 90)) a.push({ level: "high", text: `Tension élevée (${h.systolic}/${h.diastolic})` });
  if (h.sleep && h.sleep <= 4) a.push({ level: "medium", text: `Sommeil faible (${h.sleep}/10)` });
  if (h.stress && h.stress >= 8) a.push({ level: "medium", text: `Stress élevé (${h.stress}/10)` });
  if (h.energy && h.energy <= 3) a.push({ level: "medium", text: `Énergie basse (${h.energy}/10)` });
  if (h.recovery && h.recovery <= 3) a.push({ level: "medium", text: `Récupération difficile (${h.recovery}/10)` });
  return a;
}

/** Garde le plus récent élément par client_id (liste triée du plus récent au plus ancien). */
export function latestBy<T extends { client_id: string }>(rows: T[]) {
  const m = new Map<string, T>();
  for (const r of rows) if (!m.has(r.client_id)) m.set(r.client_id, r);
  return m;
}
