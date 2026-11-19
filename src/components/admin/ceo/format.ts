/** Mise en forme des chiffres de la Vue CEO (serveur et client). */
import type { CeoKpi, KpiFormat } from "@/lib/ceo";

const int = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 12450 → « 12 450 » (espace fine insécable remplacée par une espace simple pour l'impression) */
export const fmtInt = (n: number) => int.format(n).replace(/ /g, " ");
export const fmtOne = (n: number) => one.format(n).replace(/ /g, " ");
export const fmtPct = (n: number | null) => (n === null ? "—" : `${fmtInt(n)} %`);
export const fmtHours = (n: number) => `${fmtOne(n)} h`;
export const fmtMad = (n: number) => `${fmtInt(n)} DH`;
/** Délai en heures → « 45 min », « 6 h », « 1,5 j » */
export function fmtDelay(h: number | null) {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${fmtOne(h < 10 ? h : Math.round(h))} h`;
  return `${fmtOne(h / 24)} j`;
}

export function fmtValue(v: number | null, f: KpiFormat) {
  if (v === null) return "—";
  switch (f) {
    case "pct":
      return fmtPct(v);
    case "hours":
      return fmtHours(v);
    case "dh":
      return fmtMad(v);
    case "delay":
      return fmtDelay(v);
    default:
      return fmtInt(v);
  }
}

export type Trend = { dir: "up" | "down" | "flat"; good: boolean | null; text: string };

/** Évolution vs période précédente : en points pour un taux, en % sinon. */
export function trendOf(k: Pick<CeoKpi, "value" | "prev" | "better" | "points" | "format">): Trend | null {
  if (k.value === null || k.prev === null) return null;
  const diff = k.value - k.prev;
  if (k.points) {
    const d = Math.round(diff);
    if (d === 0) return { dir: "flat", good: null, text: "= stable" };
    return { dir: d > 0 ? "up" : "down", good: (d > 0) === (k.better === "up"), text: `${d > 0 ? "+" : "−"}${Math.abs(d)} pt${Math.abs(d) > 1 ? "s" : ""}` };
  }
  if (k.prev === 0) {
    if (k.value === 0) return { dir: "flat", good: null, text: "= stable" };
    return { dir: "up", good: k.better === "up", text: "nouveau" };
  }
  const p = Math.round((diff / Math.abs(k.prev)) * 100);
  if (p === 0) return { dir: "flat", good: null, text: "= stable" };
  return { dir: p > 0 ? "up" : "down", good: (p > 0) === (k.better === "up"), text: `${p > 0 ? "+" : "−"}${Math.abs(p)} %` };
}

/** Classe de couleur d'un taux de remplissage */
export const occTone = (v: number | null) => (v === null ? "bg-slate-300" : v >= 90 ? "bg-red-500" : v >= 70 ? "bg-accent-500" : v >= 35 ? "bg-brand-500" : "bg-slate-400");
