"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";

const MAX_UPLOAD = 10 * 1024 * 1024;
const POSES = ["face", "profil", "dos"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

function revalidatePhotos(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/moi");
}

/** Vérifie que l'utilisateur peut ajouter une photo pour ce client (staff, ou l'adhérent lui-même) */
async function canUpload(clientId: string) {
  const me = await getProfile();
  if (me.role !== "client") return me;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("user_id", me.id).maybeSingle();
  return data ? me : null;
}

export async function uploadPhotoAction(_: FormState, fd: FormData): Promise<FormState> {
  const client_id = String(fd.get("client_id") ?? "");
  if (!client_id) return { error: "Client manquant." };
  const me = await canUpload(client_id);
  if (!me) return { error: "Accès refusé." };

  const taken_on = str(fd.get("taken_on"));
  if (!taken_on || !/^\d{4}-\d{2}-\d{2}$/.test(taken_on)) return { error: "Indique la date de la photo." };
  if (new Date(`${taken_on}T00:00:00Z`).getTime() > Date.now() + 86400000) return { error: "La date ne peut pas être dans le futur." };
  const pose = String(fd.get("pose") ?? "face") as (typeof POSES)[number];
  if (!POSES.includes(pose)) return { error: "Pose invalide." };
  const weight = parseNum(fd.get("weight_kg"));
  if (weight !== null && (weight < 25 || weight > 300)) return { error: "Le poids doit être compris entre 25 et 300 kg." };
  const notes = str(fd.get("notes"))?.slice(0, 500) ?? null;

  const file = fd.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!DEMO && !hasFile) return { error: "Choisis une photo à envoyer." };
  if (hasFile) {
    if (!file.type.startsWith("image/")) return { error: "Le fichier doit être une image (JPG, PNG, WebP ou HEIC)." };
    if (file.size > MAX_UPLOAD) return { error: "Photo trop lourde (10 Mo maximum)." };
  }

  const supabase = await createClient();
  let storage_path: string | null = null;
  let url: string | null = null;
  if (DEMO) {
    // Mode démo : aucun fichier n'est stocké, on enregistre une image d'illustration
    url = `https://picsum.photos/seed/moovup-${crypto.randomUUID().slice(0, 8)}/600/800?grayscale`;
  } else if (hasFile) {
    const fromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
    const ext = EXT[file.type] ?? (fromName || "jpg");
    storage_path = `${client_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("photos").upload(storage_path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) return { error: `Envoi impossible : ${upErr.message}` };
  }

  const { error } = await supabase.from("progress_photos").insert({
    client_id,
    taken_on,
    pose,
    storage_path,
    url,
    weight_kg: weight,
    notes,
    shared_publicly: false,
    created_by: me.id,
  });
  if (error) {
    if (storage_path) await supabase.storage.from("photos").remove([storage_path]);
    return { error: error.message };
  }
  revalidatePhotos(client_id);
  return undefined;
}

async function staffOnly() {
  const me = await getProfile();
  return me.role === "client" ? null : me;
}

export async function togglePhotoSharedAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const client_id = String(fd.get("client_id"));
  const supabase = await createClient();
  await supabase.from("progress_photos").update({ shared_publicly: fd.get("shared") === "1" }).eq("id", String(fd.get("id")));
  revalidatePhotos(client_id);
}

export async function deletePhotoAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const client_id = String(fd.get("client_id"));
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("progress_photos").select("storage_path").eq("id", id).maybeSingle();
  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (!DEMO && path) await supabase.storage.from("photos").remove([path]);
  await supabase.from("progress_photos").delete().eq("id", id);
  revalidatePhotos(client_id);
}
