import type { Espace } from "./types";

/** Espaces du complexe (utilisable côté client et serveur) */
export const ESPACES: Espace[] = ["mixte", "lady"];
export const ESPACE_LABEL: Record<Espace, string> = { mixte: "Moov'Up (mixte)", lady: "Moov'Up Lady" };
export const ESPACE_SHORT: Record<Espace, string> = { mixte: "Mixte", lady: "Lady" };

export const espaceOf = (p: { espace?: Espace | null } | null | undefined): Espace => (p?.espace === "lady" ? "lady" : "mixte");
export const isEspace = (v: unknown): v is Espace => v === "mixte" || v === "lady";
