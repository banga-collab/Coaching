import Link from "next/link";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isManager, requireStaff } from "@/lib/auth";
import type { Client, ClientStatus, Measurement, Profile, Session } from "@/lib/types";
import { normName } from "@/lib/video";
import { STATUS_LABEL, age, cn, num, signed } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata = { title: "Clients" };

const STATUSES: ClientStatus[] = ["actif", "pause", "termine"];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; coach?: string }> }) {
  const me = await requireStaff();
  const { q = "", statut = "", coach = "" } = await searchParams;
  const supabase = await createClient();
  // Admin et head coach voient tous les clients, la colonne « Coach » et le filtre par coach
  const manager = isManager(me.role);

  const since = new Date(Date.now() - 42 * 86400000).toISOString();
  const [{ data: cData }, { data: mData }, { data: sData }, { data: pData }, { data: oData }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("measurements").select("client_id, measured_on, weight_kg").not("weight_kg", "is", null).order("measured_on"),
    supabase.from("sessions").select("client_id, status").gte("starts_at", since).in("status", ["realisee", "absent"]),
    manager ? supabase.from("profiles").select("id, full_name, email, active").in("role", ["admin", "head_coach", "coach"]) : Promise.resolve({ data: [] }),
    manager ? Promise.resolve({ data: [] }) : supabase.from("sessions").select("client_id, status").eq("coach_id", me.id),
  ]);
  // Coach : ses clients + ceux dont une séance lui est affectée (même règle que can_see_client en base,
  // appliquée ici aussi pour le mode démo qui n'a pas de RLS)
  const assigned = new Set(
    ((oData ?? []) as Pick<Session, "client_id" | "status">[]).filter((s) => s.status !== "refusee" && s.status !== "annulee").map((s) => s.client_id),
  );
  const all = ((cData ?? []) as Client[]).filter((c) => manager || c.coach_id === me.id || assigned.has(c.id));
  const meas = (mData ?? []) as Pick<Measurement, "client_id" | "measured_on" | "weight_kg">[];
  const sess = (sData ?? []) as Pick<Session, "client_id" | "status">[];
  const coachList = (pData ?? []) as Pick<Profile, "id" | "full_name" | "email" | "active">[];
  const coaches = new Map(coachList.map((p) => [p.id, p.full_name || p.email]));

  // Poids : première et dernière mesure par client (mesures triées par date)
  const weights = new Map<string, { first: number; last: number; n: number }>();
  for (const m of meas) {
    const w = Number(m.weight_kg);
    const cur = weights.get(m.client_id);
    if (cur) {
      cur.last = w;
      cur.n++;
    } else weights.set(m.client_id, { first: w, last: w, n: 1 });
  }
  const weight = (id: string) => {
    const w = weights.get(id);
    return w ? { last: w.last, delta: w.n > 1 ? w.last - w.first : null } : null;
  };
  // Présence sur 6 semaines
  const presence = new Map<string, { done: number; total: number }>();
  for (const s of sess) {
    const cur = presence.get(s.client_id) ?? { done: 0, total: 0 };
    cur.total++;
    if (s.status === "realisee") cur.done++;
    presence.set(s.client_id, cur);
  }
  const attendance = (id: string) => {
    const p = presence.get(id);
    return p?.total ? Math.round((p.done / p.total) * 100) : null;
  };

  // Recherche (insensible à la casse et aux accents) puis filtres
  const needle = normName(q);
  const searched = needle
    ? all.filter((c) => normName([c.full_name, c.goal, c.email, c.phone, c.frequency].filter(Boolean).join(" ")).includes(needle))
    : all;
  const byCoach = manager && coach ? searched.filter((c) => c.coach_id === coach) : searched;
  const clients = statut ? byCoach.filter((c) => c.status === statut) : byCoach;

  const statusCount = new Map<string, number>();
  for (const c of byCoach) statusCount.set(c.status, (statusCount.get(c.status) ?? 0) + 1);
  const coachCount = new Map<string, number>();
  for (const c of searched) coachCount.set(c.coach_id, (coachCount.get(c.coach_id) ?? 0) + 1);

  const filters = [
    { param: "statut", label: "Statut", options: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: statusCount.get(s) ?? 0 })) },
    ...(manager && coachList.length > 1
      ? [
          {
            param: "coach",
            label: "Coach",
            // Coachs désactivés : affichés seulement s'il leur reste des clients (archivés)
            options: coachList
              .filter((p) => p.active !== false || coachCount.has(p.id))
              .map((p) => ({ value: p.id, label: `${p.full_name || p.email}${p.active === false ? " (désactivé)" : ""}`, count: coachCount.get(p.id) ?? 0 })),
          },
        ]
      : []),
  ];
  const filtered = !!(q || statut || (manager && coach));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""}${filtered && clients.length !== all.length ? ` sur ${all.length}` : ""}`}
        actions={
          <LinkButton href="/clients/nouveau">
            <UserPlus className="size-4" /> Nouveau client
          </LinkButton>
        }
      />

      <ListToolbar placeholder="Nom, objectif, e-mail, téléphone…" filters={filters} exportKind="clients" />

      <Card className="overflow-hidden">
        {clients.length === 0 ? (
          <Empty
            icon={<Users className="size-6" />}
            title={filtered ? "Aucun résultat" : "Aucun client pour l'instant"}
            text={filtered ? "Essaie une autre recherche ou un autre filtre." : "Ajoute ton premier client pour commencer son suivi."}
            action={!filtered ? <LinkButton href="/clients/nouveau">Ajouter un client</LinkButton> : undefined}
          />
        ) : (
          <>
            {/* Tableau (bureau) */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line bg-slate-50/60 text-start text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5 text-start">Client</th>
                  <th className="px-4 py-2.5 text-start">Objectif</th>
                  {manager && <th className="px-4 py-2.5 text-start">Coach</th>}
                  <th className="px-4 py-2.5 text-start">Poids</th>
                  <th className="px-4 py-2.5 text-start">Présence</th>
                  <th className="px-4 py-2.5 text-start">Statut</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clients.map((c) => {
                  const w = weight(c.id);
                  const a = attendance(c.id);
                  const years = age(c.birth_date);
                  return (
                    <tr key={c.id} className="group relative cursor-pointer transition hover:bg-canvas/70">
                      <td className="px-5 py-2.5">
                        <Link href={`/clients/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']">
                          <Avatar name={c.full_name} size={34} />
                          <span>
                            <span className="block font-semibold text-ink group-hover:text-brand-600">{c.full_name}</span>
                            <span className="block text-xs text-muted">
                              {[years && `${years} ans`, c.frequency].filter(Boolean).join(" · ") || c.email || "—"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{c.goal ?? "—"}</td>
                      {manager && <td className="px-4 py-2.5 text-slate-600">{coaches.get(c.coach_id) ?? "—"}</td>}
                      <td className="px-4 py-2.5">
                        {w ? (
                          <>
                            <b>{num(w.last, "kg")}</b>
                            {w.delta !== null && <span className={cn("ms-1.5 text-xs font-semibold", w.delta <= 0 ? "text-emerald-600" : "text-accent-600")}>{signed(w.delta)}</span>}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {a === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <span className={cn("block h-full rounded-full", a >= 80 ? "bg-emerald-500" : a >= 60 ? "bg-accent-500" : "bg-red-500")} style={{ width: `${a}%` }} />
                            </span>
                            <span className="text-xs font-semibold text-slate-600">{a}%</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge dot tone={c.status === "actif" ? "green" : c.status === "pause" ? "amber" : "gray"}>{STATUS_LABEL[c.status]}</Badge>
                      </td>
                      <td className="pe-4">
                        <Link href={`/clients/${c.id}`} aria-label="Ouvrir">
                          <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-500 rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Liste (mobile) */}
            <ul className="divide-y divide-line md:hidden">
              {clients.map((c) => {
                const w = weight(c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-canvas">
                      <Avatar name={c.full_name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.full_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.goal ?? "—"}
                          {w ? ` · ${num(w.last, "kg")}` : ""}
                        </span>
                      </span>
                      <Badge dot tone={c.status === "actif" ? "green" : c.status === "pause" ? "amber" : "gray"}>{STATUS_LABEL[c.status]}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
