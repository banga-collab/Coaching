import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import type { DocumentRow } from "@/lib/types";

function text(msg: string, status: number) {
  return new NextResponse(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Téléchargement d'un document : contrôle d'accès (RLS) puis redirection vers une URL signée. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return text("Connexion requise.", 401);

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const { data } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  const doc = data as DocumentRow | null;
  if (!doc) return text("Document introuvable ou accès refusé.", 404);

  // Un client ne voit que ses documents partagés (la RLS l'impose aussi en production)
  if ((profile as { role?: string } | null)?.role === "client") {
    const { data: own } = await supabase.from("clients").select("id").eq("id", doc.client_id).eq("user_id", user.id).maybeSingle();
    if (!own || !doc.shared) return text("Document introuvable ou accès refusé.", 404);
  }

  if (DEMO || !doc.storage_path) {
    return text(`« ${doc.name} » n'est pas disponible : en mode démo, les fichiers ne sont pas stockés (seules leurs informations sont enregistrées).`, 404);
  }

  const { data: signed, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60, { download: doc.name });
  if (error || !signed?.signedUrl) return text("Impossible de générer le lien de téléchargement. Réessaie dans un instant.", 500);
  return NextResponse.redirect(signed.signedUrl);
}
