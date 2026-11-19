import Link from "next/link";
import { ChevronRight, Mail, Phone, Plus, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { CoachForm } from "@/components/admin/coach-form";
import { ROLE_LABEL, ROLE_TONE, loadStaffStats } from "@/components/admin/data";
import { setCoachActiveAction } from "@/actions/admin";

export const metadata = { title: "Coachs" };

export default async function AdminCoachsPage({ searchParams }: { searchParams: Promise<{ nouveau?: string; voir?: string }> }) {
  const me = await requireAdmin();
  const { nouveau, voir = "actifs" } = await searchParams;
  const supabase = await createClient();
  const { staff, clientsOf, doneOf, month } = await loadStaffStats(supabase);
  const order: Record<string, number> = { admin: 0, head_coach: 1, coach: 2 };
  const sorted = [...staff].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || (a.full_name || "").localeCompare(b.full_name || ""));
  const inactive = sorted.filter((p) => p.active === false).length;
  const list = voir === "tous" ? sorted : sorted.filter((p) => p.active !== false);
  const canInvite = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <>
      <PageHeader
        title="Coachs"
        subtitle={`${staff.length - inactive} actif${staff.length - inactive > 1 ? "s" : ""}${inactive ? ` · ${inactive} désactivé${inactive > 1 ? "s" : ""}` : ""} · séances réalisées en ${month.label}`}
        actions={
          <Link href={nouveau ? "/admin/coachs" : "/admin/coachs?nouveau=1#nouveau"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e8782a] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-95">
            <Plus className="size-4" /> Nouveau coach
          </Link>
        }
      />

      {nouveau && (
        <Card className="mb-5 p-5" id="nouveau">
          <h3 className="mb-4 font-display text-[15px] font-bold">Nouveau coach</h3>
          <CoachForm demo={DEMO} canInvite={canInvite} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title="Équipe"
          subtitle="Rôle, contact, spécialités et activité du mois"
          icon={<UsersRound className="size-4" />}
          action={
            inactive > 0 ? (
              <div className="flex gap-1 rounded-lg bg-canvas p-1 text-xs font-semibold">
                <Link href="/admin/coachs" className={`rounded-md px-2.5 py-1 ${voir !== "tous" ? "bg-white text-ink shadow-sm" : "text-muted"}`}>Actifs</Link>
                <Link href="/admin/coachs?voir=tous" className={`rounded-md px-2.5 py-1 ${voir === "tous" ? "bg-white text-ink shadow-sm" : "text-muted"}`}>Tous</Link>
              </div>
            ) : undefined
          }
        />
        {list.length === 0 ? (
          <Empty icon={<UsersRound className="size-6" />} title="Aucun coach" text="Ajoute ton premier coach avec « Nouveau coach »." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {list.map((p) => {
              const clients = clientsOf(p.id);
              const done = doneOf(p.id);
              return (
                <li key={p.id} className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto_auto] lg:items-center ${p.active === false ? "opacity-60" : ""}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={p.full_name || p.email} size={42} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/coachs/${p.id}`} className="truncate font-semibold hover:text-brand-500">
                          {p.full_name || "—"}
                        </Link>
                        <Badge tone={ROLE_TONE[p.role] ?? "gray"}>{ROLE_LABEL[p.role] ?? p.role}</Badge>
                        {p.active === false && <Badge tone="red">Désactivé</Badge>}
                        {p.id === me.id && <Badge tone="gray">Vous</Badge>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span className="inline-flex items-center gap-1"><Mail className="size-3" /> {p.email}</span>
                        {p.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {p.phone}</span>}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {(p.specialties ?? []).length ? (
                      (p.specialties ?? []).map((s) => (
                        <span key={s} className="rounded-md bg-canvas px-2 py-0.5 text-xs text-slate-600">{s}</span>
                      ))
                    ) : (
                      <span className="text-xs text-muted">Aucune spécialité</span>
                    )}
                  </span>
                  <span className="grid grid-cols-2 gap-3 text-center text-xs lg:w-[160px]">
                    <Stat label="Clients" value={clients} />
                    <Stat label="Séances" value={done} />
                  </span>
                  <span className="flex items-center justify-end gap-2">
                    {p.id !== me.id &&
                      (p.active === false ? (
                        <form action={setCoachActiveAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="active" value="1" />
                          <button className="h-9 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Réactiver</button>
                        </form>
                      ) : (
                        // Désactivation depuis la fiche : passation des clients et séances à venir
                        <Link
                          href={`/admin/coachs/${p.id}#desactiver`}
                          className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-xs font-semibold text-muted hover:border-red-200 hover:text-red-600"
                        >
                          Désactiver
                        </Link>
                      ))}
                    <Link href={`/admin/coachs/${p.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600">
                      Modifier <ChevronRight className="size-3.5" />
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Avant de désactiver un coach (ou de le repasser adhérent), ses clients actifs et ses séances à venir sont transférés à un autre coach depuis sa fiche. Un coach désactivé disparaît de cette liste et des listes de coachs ; en production (après supabase/v5-securite.sql) il perd ses droits sur les données et, si la clé service-role est configurée, sa connexion est bloquée. Réactivation possible à tout moment. Il reste toujours au moins un administrateur actif.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span>
      <span className="block font-display text-sm font-bold text-ink">{value}</span>
      <span className="block text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </span>
  );
}
