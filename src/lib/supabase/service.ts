import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO, DEMO_ADMIN, demoClient } from "../demo";

/**
 * Client Supabase « service » (côté serveur uniquement) pour les écritures sans session utilisateur.
 * En démo : la fausse base avec le compte administrateur.
 * Renvoie null si SUPABASE_SERVICE_ROLE_KEY manque.
 */
export function serviceClient(): SupabaseClient | null {
  if (DEMO) return demoClient(DEMO_ADMIN) as SupabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
