import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO, DEMO_ADMIN, demoClient } from "@/lib/demo";
import { runAutomations } from "@/lib/automations";

export const dynamic = "force-dynamic";

/**
 * Exécution quotidienne des automatisations (Vercel Cron, 06:00 UTC).
 * Protégé par `Authorization: Bearer ${CRON_SECRET}`.
 * Le cron n'a pas de session utilisateur : il faut la clé service-role Supabase.
 */
export async function GET(request: NextRequest) {
  if (DEMO) {
    const summary = await runAutomations(demoClient(DEMO_ADMIN));
    return NextResponse.json({ ok: true, demo: true, ...summary });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY n'est pas configurée : le cron ne peut pas accéder aux données sans session. Ajoutez-la dans les variables d'environnement (Vercel > Settings > Environment Variables) ou utilisez le bouton « Exécuter maintenant » dans /automatisations.",
      },
      { status: 501 },
    );
  }

  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const summary = await runAutomations(supabase);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, { status: 500 });
  }
}
