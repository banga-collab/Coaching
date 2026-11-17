import Link from "next/link";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Client, Measurement, Profile, Session } from "@/lib/types";
import { STATUS_LABEL, age, cn, num, signed } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Clients" };

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "actif", label: "Actifs" },
  { key: "pause", label: "En pause" },
  { key: "termine", label: "Terminés" },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  const me = await requireStaff();
  const { q = "", statut = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("clients").select("*").order("full_name");
  if (statut) query = query.eq("status", statut);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,goal.ilike.%${q.replace(/[%,()]/g, "")}%`);

  const since = new Date(Date.now() - 42 * 86400000).toISOString();
  const [{ data: cData }, { data: mData }, { data: sData }, { data: pData }] = await Promise.all([
    query,
    supabase.from("measurements").select("client_id, measured_on, weight_kg").not("weight_kg", "is", null).order("measured_on"),
    supabase.from("sessions").select("client_id, status").gte("starts_at", since).in("status", ["realisee", "absent"]),
    me.role === "admin" ? supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "coach"]) : Promise.resolve({ data: [] }),
  ]);
  const clients = (cData ?? []) as Client[];
  const meas = (mData ?? []) as Pick<Measurement, "client_id" | "measured_on" | "weight_kg">[];
  const sess = (sData ?? []) as Pick<Session, "client_id" | "status">[];
  const coaches = new Map(((pData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map((p) => [p.id, p.full_name || p.email]));

  const weight = (id: string) => {
    const m = meas.filter((x) => x.client_id === id);
    if (!m.length) return null;
    return { last: Number(m.at(-1)!.weight_kg), delta: m.length > 1 ? Number(m.at(-1)!.weight_kg) - Number(m[0]!.weight_kg) : null };
  };
  const attendance = (id: string) => {
    const s = sess.filter((x) => x.client_id === id);
    return s.length ? Math.round((s.filter((x) => x.status === "realisee").length / s.length) * 100) : null;
  };

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""}${statut ? ` · ${STATUS_LABEL[statut as keyof typeof STATUS_LABEL]?.toLowerCase()}` : ""}`}
        actions={
          <LinkButton href="/clients/nouveau">
            <UserPlus className="size-4" /> Nouveau client
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={{ pathname: "/clients", query: { ...(q && { q }), ...(f.key && { statut: f.key }) } }}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", statut === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="relative sm:w-72">
          {statut && <input type="hidden" name="statut" value={statut} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Rechercher un client…" className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50" />
        </form>
      </div>

      <Card className="overflow-hidden">
        {clients.length === 0 ? (
          <Empty
            icon={<Users className="size-6" />}
            title={q || statut ? "Aucun résultat" : "Aucun client pour l'instant"}
            text={q || statut ? "Essaie une autre recherche ou un autre filtre." : "Ajoute ton premier client pour commencer son suivi."}
            action={!q && !statut ? <LinkButton href="/clients/nouveau">Ajouter un client</LinkButton> : undefined}
          />
        ) : (
          <>
            {/* Tableau (bureau) */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Client</th>
                  <th className="px-4 py-3">Objectif</th>
                  {me.role === "admin" && <th className="px-4 py-3">Coach</th>}
                  <th className="px-4 py-3">Poids</th>
                  <th className="px-4 py-3">Présence</th>
                  <th className="px-4 py-3">Statut</th>
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
                      <td className="px-5 py-3.5">
                        <Link href={`/clients/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']">
                          <Avatar name={c.full_name} size={38} />
                          <span>
                            <span className="block font-semibold text-ink group-hover:text-brand-600">{c.full_name}</span>
                            <span className="block text-xs text-muted">
                              {[years && `${years} ans`, c.frequency].filter(Boolean).join(" · ") || c.email || "—"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{c.goal ?? "—"}</td>
                      {me.role === "admin" && <td className="px-4 py-3.5 text-slate-600">{coaches.get(c.coach_id) ?? "—"}</td>}
                      <td className="px-4 py-3.5">
                        {w ? (
                          <>
                            <b>{num(w.last, "kg")}</b>
                            {w.delta !== null && <span className={cn("ml-1.5 text-xs font-semibold", w.delta <= 0 ? "text-emerald-600" : "text-accent-600")}>{signed(w.delta)}</span>}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
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
                      <td className="px-4 py-3.5">
                        <Badge dot tone={c.status === "actif" ? "green" : c.status === "pause" ? "amber" : "gray"}>{STATUS_LABEL[c.status]}</Badge>
                      </td>
                      <td className="pr-4">
                        <Link href={`/clients/${c.id}`} aria-label="Ouvrir">
                          <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-500" />
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
                    <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-canvas">
                      <Avatar name={c.full_name} size={42} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.full_name}</span>
                        <span className="block truncate text-xs text-muted">{c.goal ?? "—"}{w ? ` · ${num(w.last, "kg")}` : ""}</span>
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
