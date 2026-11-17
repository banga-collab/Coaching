import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  brand_name: "Complexe Moov'Up Sports",
  app_name: "Moov'Up Coach",
  primary_color: "#1a6d8e",
  accent_color: "#e8782a",
  logo_url: null,
  phone: null,
  whatsapp: null,
  email: null,
  address: "Agadir, Maroc",
  ice: null,
  invoice_footer: null,
  booking_enabled: true,
  booking_types: ["Séance découverte", "Bilan initial", "Coaching individuel"],
  booking_hours: { start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5, 6], slot: 60 },
  calendar_token: "",
  webhook_url: null,
};

/** Paramètres de la salle (marque blanche, contact…), mis en cache par requête. */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as Settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});
