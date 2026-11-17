import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import type { ProgressPhoto } from "@/lib/types";

function text(msg: string, status: number) {
  return new NextResponse(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Photo de progression : contrôle d'accès (RLS + propriétaire) puis redirection vers une URL signée (ou l'URL démo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return text("Connexion requise.", 401);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const { data } = await supabase.from("progress_photos").select("*").eq("id", id).maybeSingle();
  const photo = data as ProgressPhoto | null;
  if (!photo) return text("Photo introuvable ou accès refusé.", 404);

  // Un adhérent ne voit que ses propres photos (la RLS l'impose aussi en production)
  if ((profile as { role?: string } | null)?.role === "client") {
    const { data: own } = await supabase.from("clients").select("id").eq("id", photo.client_id).eq("user_id", user.id).maybeSingle();
    if (!own) return text("Photo introuvable ou accès refusé.", 404);
  }

  const headers = { "cache-control": "private, max-age=240" };
  if (!DEMO && photo.storage_path) {
    const { data: signed, error } = await supabase.storage.from("photos").createSignedUrl(photo.storage_path, 300);
    if (error || !signed?.signedUrl) return text("Impossible de générer le lien de la photo.", 500);
    return NextResponse.redirect(signed.signedUrl, { headers });
  }
  if (photo.url && /^https?:\/\//.test(photo.url)) return NextResponse.redirect(photo.url, { headers });
  return text("Photo non disponible.", 404);
}
