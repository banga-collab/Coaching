import type { MetadataRoute } from "next";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: DEFAULT_SETTINGS.app_name,
    short_name: "Moov'Up",
    description: "Suivi des séances, de la progression et des bilans — Complexe Moov'Up Sports Agadir",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#1a6d8e",
    background_color: "#f4f6f8",
    categories: ["health", "fitness", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Clients", url: "/clients", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Séances", url: "/seances", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
