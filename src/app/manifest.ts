import { readdirSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { DEFAULT_SETTINGS } from "@/lib/settings";

/**
 * Application installable (PWA) et base de l'application Android (Trusted Web Activity, voir docs/ANDROID.md).
 * Captures d'écran : déposer des PNG dans public/screenshots/ (« mobile-1.png »… en portrait 1080×1920,
 * « large-1.png »… en paysage 1920×1080) : elles sont ajoutées automatiquement au manifeste.
 */
function screenshots(): NonNullable<MetadataRoute.Manifest["screenshots"]> {
  try {
    return readdirSync(path.join(process.cwd(), "public", "screenshots"))
      .filter((f) => /^(mobile|large)-\d+\.png$/i.test(f))
      .sort()
      .map((f) => {
        const wide = f.toLowerCase().startsWith("large");
        return { src: `/screenshots/${f}`, sizes: wide ? "1920x1080" : "1080x1920", type: "image/png", form_factor: wide ? "wide" : "narrow", label: "Moov'Up Coach" };
      });
  } catch {
    return [];
  }
}

const icon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];

export default function manifest(): MetadataRoute.Manifest {
  const shots = screenshots();
  return {
    id: "/",
    name: DEFAULT_SETTINGS.app_name,
    short_name: "Moov'Up Coach",
    description: "Suivi des séances, de la progression, des bilans et de la santé connectée — Complexe Moov'Up Sports Agadir",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    theme_color: "#1a6d8e",
    background_color: "#f4f6f8",
    categories: ["health", "fitness", "sports", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Clients", short_name: "Clients", description: "Liste des clients", url: "/clients", icons: icon },
      { name: "Séances", short_name: "Séances", description: "Agenda des séances", url: "/seances", icons: icon },
      { name: "Ma progression", short_name: "Mon suivi", description: "Espace adhérent", url: "/moi", icons: icon },
      { name: "Ma santé connectée", short_name: "Santé", description: "Sommeil, pas et fréquence cardiaque", url: "/moi/sante", icons: icon },
    ],
    ...(shots.length ? { screenshots: shots } : {}),
  };
}
