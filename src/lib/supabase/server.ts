import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO, DEMO_ADMIN, DEMO_CLIENT_USER, demoClient } from "../demo";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (DEMO) {
    return demoClient(cookieStore.get("demo_role")?.value === "client" ? DEMO_CLIENT_USER : DEMO_ADMIN);
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un Server Component : le middleware rafraîchit la session.
          }
        },
      },
    },
  );
}
