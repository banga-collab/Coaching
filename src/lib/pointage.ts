import { createHmac, timingSafeEqual } from "crypto";
import type { Espace } from "./types";
import { ESPACES } from "./espace";

/**
 * Pointage des coachs à la borne de l'accueil.
 * La borne (tablette posée à l'accueil) affiche un QR code et un code à 6 chiffres
 * qui changent toutes les 30 secondes : une photo du code ne sert plus 2 minutes après.
 * Les codes sont calculés avec un secret serveur (POINTAGE_SECRET) : impossible à deviner.
 */
export const WINDOW_S = 30;
const VALID_WINDOWS = 4; // code accepté pendant ~2 minutes (lecture, saisie, réseau lent)

function secret(): string | null {
  const s = process.env.POINTAGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (s) return s;
  return process.env.NEXT_PUBLIC_DEMO === "1" ? "moovup-demo-pointage" : null;
}
export const pointageReady = () => !!secret();

const hmac = (data: string) => createHmac("sha256", secret() ?? "").update(data).digest();
const windowAt = (ms = Date.now()) => Math.floor(ms / 1000 / WINDOW_S);

/** Code à 6 chiffres d'un espace pour une fenêtre de 30 s */
function codeFor(espace: Espace, w: number) {
  const n = hmac(`code:${espace}:${w}`).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Clé de la borne (dans l'adresse de l'écran de l'accueil) : identifie l'espace */
export function borneKey(espace: Espace) {
  return `${espace}.${hmac(`borne:${espace}`).toString("hex").slice(0, 24)}`;
}
export function espaceFromBorneKey(key: string | null | undefined): Espace | null {
  if (!key || !secret()) return null;
  const espace = ESPACES.find((e) => key.startsWith(`${e}.`));
  if (!espace) return null;
  const want = Buffer.from(borneKey(espace));
  const got = Buffer.from(key);
  return want.length === got.length && timingSafeEqual(want, got) ? espace : null;
}

/** Code affiché maintenant sur la borne + secondes avant le prochain */
export function currentCode(espace: Espace, nowMs = Date.now()) {
  const w = windowAt(nowMs);
  const left = WINDOW_S - Math.floor((nowMs / 1000) % WINDOW_S);
  return { code: codeFor(espace, w), secondsLeft: left };
}

/** Vérifie un code saisi ou scanné ; renvoie l'espace où se trouve la borne */
export function verifyCode(raw: string | null | undefined, nowMs = Date.now()): Espace | null {
  const code = String(raw ?? "").replace(/\D/g, "");
  if (code.length !== 6 || !secret()) return null;
  const w = windowAt(nowMs);
  for (const espace of ESPACES) {
    for (let i = 0; i < VALID_WINDOWS; i++) if (codeFor(espace, w - i) === code) return espace;
  }
  return null;
}
