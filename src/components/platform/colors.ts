/** Génère des nuances de couleur (mélange avec blanc / noir) à partir d'un hexadécimal. */

export const DEFAULT_PRIMARY = "#1a6d8e";
export const DEFAULT_ACCENT = "#e8782a";

export function isHex(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-f]{6}$/i.test(v.trim());
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function toHex([r, g, b]: number[]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v!))).toString(16).padStart(2, "0")).join("");
}
/** amount > 0 : vers le blanc ; amount < 0 : vers le noir */
function mix(hex: string, amount: number) {
  const rgb = toRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  return toHex(rgb.map((c) => c + (target - c) * a));
}

const BRAND_STEPS: [number, number][] = [
  [50, 0.92], [100, 0.83], [200, 0.65], [300, 0.45], [400, 0.22], [500, 0],
  [600, -0.18], [700, -0.32], [800, -0.45], [900, -0.58],
];
const ACCENT_STEPS = BRAND_STEPS.slice(0, 8);

export function shades(hex: string, kind: "brand" | "accent") {
  const steps = kind === "brand" ? BRAND_STEPS : ACCENT_STEPS;
  return Object.fromEntries(steps.map(([k, a]) => [k, a === 0 ? hex.toLowerCase() : mix(hex, a)])) as Record<number, string>;
}

/** Feuille de style qui surcharge les variables Tailwind --color-brand-* et --color-accent-*. */
export function brandCss(primary: string, accent: string) {
  const vars: string[] = [];
  if (isHex(primary) && primary.toLowerCase() !== DEFAULT_PRIMARY) {
    for (const [k, v] of Object.entries(shades(primary, "brand"))) vars.push(`--color-brand-${k}:${v}`);
  }
  if (isHex(accent) && accent.toLowerCase() !== DEFAULT_ACCENT) {
    for (const [k, v] of Object.entries(shades(accent, "accent"))) vars.push(`--color-accent-${k}:${v}`);
  }
  return vars.length ? `:root{${vars.join(";")}}` : "";
}

/** Couleur de texte lisible (blanc ou encre) sur un fond donné. */
export function readableOn(hex: string) {
  if (!isHex(hex)) return "#ffffff";
  const [r, g, b] = toRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? "#16212b" : "#ffffff";
}
