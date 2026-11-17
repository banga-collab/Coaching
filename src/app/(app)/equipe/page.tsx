import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { setRoleAction, updateMyNameAction } from "../actions";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: pData }, { data: cData }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("clients").select("coach_id, user_id"),
  ]);
  const profiles = (pData ?? []) as Profile[];
  const links = (cData ?? []) as { coach_id: string; user_id: string | null }[];
  const count = (id: string) => links.filter((l) => l.coach_id === id).length;
  const linked = new Set(links.map((l) => l.user_id).filter(Boolean));
  const staff = profiles.filter((p) => p.role !== "client");
  const members = profiles.filter((p) => p.role === "client");

  const RoleForm = ({ p }: { p: Profile }) =>
    p.id === me.id ? (
      <Badge tone="accent">Vous</Badge>
    ) : (
      <form action={setRoleAction} className="flex items-center gap-2">
        <input type="hidden" name="id" value={p.id} />
        <select name="role" defaultValue={p.role} className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
          <option value="client">Adhérent</option>
          <option value="coach">Coach</option>
          <option value="admin">Admin</option>
        </select>
        <button className="h-9 rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600">OK</button>
      </form>
    );

  return (
    <>
      <PageHeader title="Équipe" subtitle="Gère les coachs et les accès. Un nouveau coach crée son compte, puis tu lui donnes le rôle « Coach » ici." />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader title="Coachs & admins" subtitle={`${staff.length} membre${staff.length > 1 ? "s" : ""}`} icon={<ShieldCheck className="size-4" />} />
            <ul className="divide-y divide-line border-t border-line">
              {staff.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Avatar name={p.full_name || p.email} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.full_name || "—"}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.email} · {count(p.id)} client{count(p.id) > 1 ? "s" : ""}
                    </span>
                  </span>
                  <RoleForm p={p} />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Comptes adhérents" subtitle="Passe un compte en « Coach » pour lui donner accès à l'espace coach." />
            {members.length === 0 ? (
              <p className="border-t border-line px-5 py-6 text-center text-sm text-muted">Aucun compte adhérent pour l&apos;instant.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {members.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar name={p.full_name || p.email} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.full_name || "—"}</span>
                      <span className="block truncate text-xs text-muted">
                        {p.email} · inscrit le {fmtDate(p.created_at)}
                      </span>
                    </span>
                    {linked.has(p.id) ? <Badge tone="green">Dossier relié</Badge> : <Badge tone="amber">Sans dossier</Badge>}
                    <RoleForm p={p} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h3 className="font-display font-bold">Mon profil</h3>
          <form action={updateMyNameAction} className="mt-4 space-y-3">
            <Input name="full_name" defaultValue={me.full_name} placeholder="Nom affiché" />
            <button className="h-10 w-full rounded-xl bg-accent-500 text-sm font-semibold text-white hover:bg-accent-600">Enregistrer</button>
          </form>
        </Card>
      </div>
    </>
  );
}
