import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, CreditCard, Plus, ScanLine, Search, TrendingUp, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Membership } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  MEMBERSHIP_STATE,
  currentMembership,
  daysLeft,
  daysLeftLabel,
  daysTone,
  frDay,
  membershipState,
  monthlyValue,
  sessionsLeft,
  sessionsProgress,
  timeProgress,
  todayKey,
  type MembershipState,
} from "@/lib/memberships";
import { Avatar, Badge, Card, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
import { MiniProgress } from "@/components/memberships/progress";
import { MembershipActions } from "@/components/memberships/membership-actions";

export const metadata = { title: "Abonnements" };

type FilterKey = "" | "bientot" | "expire" | "suspendu";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "bientot", label: "Expire bientôt" },
  { key: "expire", label: "Expirés" },
  { key: "suspendu", label: "Suspendus" },
];

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const money = (v: number, suffix?: string) => (
  <span className="whitespace-nowrap text-[22px] sm:text-[28px]">
    {nf0.format(v)}
    <span className="ml-1 text-sm font-bold opacity-70">MAD{suffix}</span>
  </span>
);

function matches(st: MembershipState, f: FilterKey) {
  if (!f) return true;
  if (f === "expire") return st === "expire" || st === "epuise";
  if (f === "suspendu") return st === "suspendu";
  return st === "bientot";
}

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string; ok?: string }> }) {
  await requireStaff();
  const { filtre = "", q = "", ok } = await searchParams;
  const filter = (FILTERS.some((f) => f.key === filtre) ? filtre : "") as FilterKey;
  const supabase = await createClient();
  const [{ data: mData }, { data: cData }] = await Promise.all([
    supabase.from("memberships").select("*").order("end_date", { ascending: false }),
    supabase.from("clients").select("*"),
  ]);
  const all = (mData ?? []) as Membership[];
  const clients = new Map(((cData ?? []) as Client[]).map((c) => [c.id, c]));
  const today = todayKey();
  const month = today.slice(0, 7);

  // Un abonnement de référence par client
  const byClient = new Map<string, Membership[]>();
  all.forEach((m) => byClient.set(m.client_id, [...(byClient.get(m.client_id) ?? []), m]));
  const current = [...byClient.values()]
    .map((list) => currentMembership(list, today))
    .filter((m): m is Membership => !!m)
    .map((m) => ({ m, st: membershipState(m, today), left: daysLeft(m, today), client: clients.get(m.client_id) }));

  const active = current.filter((x) => x.st === "actif" || x.st === "bientot");
  const soon = current.filter((x) => x.st === "bientot");
  const expiredThisMonth = current.filter((x) => x.st === "expire" && x.m.end_date.startsWith(month));
  const mrr = active.reduce((s, x) => s + monthlyValue(x.m), 0);
  const counts: Record<FilterKey, number> = {
    "": current.length,
    bientot: soon.length,
    expire: current.filter((x) => matches(x.st, "expire")).length,
    suspendu: current.filter((x) => x.st === "suspendu").length,
  };

  const needle = q.trim().toLowerCase();
  const order: Record<MembershipState, number> = { bientot: 0, expire: 1, epuise: 1, actif: 2, a_venir: 3, suspendu: 4, annule: 5 };
  const rows = current
    .filter((x) => matches(x.st, filter))
    .filter((x) => !needle || (x.client?.full_name ?? "").toLowerCase().includes(needle) || x.m.name.toLowerCase().includes(needle))
    .sort((a, b) => order[a.st] - order[b.st] || (a.st === "expire" ? b.left - a.left : a.left - b.left));

  return (
    <>
      <PageHeader
        title="Abonnements"
        subtitle="Formules en cours, échéances et accès à la salle"
        actions={
          <>
            <LinkButton href="/acces" variant="secondary">
              <ScanLine className="size-4" /> Accueil / scan
            </LinkButton>
            <LinkButton href="/abonnements/nouveau">
              <Plus className="size-4" /> Nouvel abonnement
            </LinkButton>
          </>
        }
      />

      {ok === "cree" && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> Abonnement créé.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi label="Abonnés actifs" value={active.length} icon={<Users className="size-[18px]" />} delta={`${current.length} membres suivis`} />
        <Kpi
          label="Expirent sous 7 jours"
          value={soon.length}
          tone="accent"
          icon={<CalendarClock className="size-[18px]" />}
          delta={soon.length ? "À relancer" : "Rien à signaler"}
          positive={soon.length === 0 ? true : undefined}
        />
        <Kpi
          label="Expirés ce mois"
          value={expiredThisMonth.length}
          tone="accent"
          icon={<AlertTriangle className="size-[18px]" />}
          delta={expiredThisMonth.length ? "Non renouvelés" : "Aucun"}
          positive={expiredThisMonth.length === 0}
        />
        <Kpi label="Revenu récurrent estimé" value={money(mrr, "/mois")} icon={<TrendingUp className="size-[18px]" />} delta="Prix ramenés à 30 jours" />
      </div>

      {soon.length > 0 && filter !== "bientot" && (
        <Link
          href="/abonnements?filtre=bientot"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 transition hover:bg-amber-100/70 sm:mt-6"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
            <CalendarClock className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">
              {soon.length} abonnement{soon.length > 1 ? "s expirent" : " expire"} dans les 7 prochains jours
            </span>
            <span className="block truncate text-amber-800/80">{soon.map((x) => x.client?.full_name.split(" ")[0]).join(", ")} — proposez un renouvellement.</span>
          </span>
        </Link>
      )}

      <div className="mb-4 mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={{ pathname: "/abonnements", query: { ...(q && { q }), ...(f.key && { filtre: f.key }) } }}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", filter === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
              >
                {f.label}
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[10px]",
                    filter === f.key ? "bg-white/20" : f.key === "bientot" && counts.bientot ? "bg-amber-50 text-amber-700" : f.key === "expire" && counts.expire ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {counts[f.key]}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <form className="relative lg:w-72">
          {filter && <input type="hidden" name="filtre" value={filter} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Client ou formule…"
            className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty
            icon={<CreditCard className="size-6" />}
            title={filter || q ? "Aucun abonnement trouvé" : "Aucun abonnement pour l'instant"}
            text={filter || q ? "Essayez un autre filtre ou une autre recherche." : "Créez un abonnement à partir d'une formule : dates, séances et prix sont pré-remplis."}
            action={!filter && !q ? <LinkButton href="/abonnements/nouveau">Nouvel abonnement</LinkButton> : undefined}
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ m, st, left, client }) => {
              const state = MEMBERSHIP_STATE[st];
              const sl = sessionsLeft(m);
              const sp = sessionsProgress(m);
              const tp = timeProgress(m, today);
              const alert = st === "bientot";
              const dead = st === "expire" || st === "epuise";
              return (
                <li key={m.id} className={cn("relative px-4 py-4 transition hover:bg-canvas/60 sm:px-5", alert && "bg-amber-50/40", dead && "bg-red-50/30")}>
                  {(alert || dead) && <span className={cn("absolute inset-y-0 left-0 w-1", alert ? "bg-amber-400" : "bg-red-400")} />}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
                    <Link href={`/clients/${m.client_id}?tab=abonnement`} className="group flex min-w-0 items-center gap-3 md:w-64 md:shrink-0">
                      <Avatar name={client?.full_name ?? "?"} size={42} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink group-hover:text-brand-600">{client?.full_name ?? "Client supprimé"}</span>
                        <span className="block truncate text-xs text-muted">{m.name}</span>
                      </span>
                    </Link>

                    <div className="grid flex-1 grid-cols-2 gap-4">
                      <MiniProgress
                        label={`${frDay(m.start_date, { day: "numeric", month: "short" })} → ${frDay(m.end_date, { day: "numeric", month: "short" })}`}
                        value={`${tp} %`}
                        pct={tp}
                        tone={dead ? "red" : alert ? "amber" : "brand"}
                      />
                      {sp === null ? (
                        <div className="min-w-0">
                          <p className="mb-1 text-[11px] font-medium text-muted">Séances</p>
                          <p className="text-xs font-semibold text-slate-700">Accès illimité</p>
                        </div>
                      ) : (
                        <MiniProgress label="Séances" value={`${m.sessions_used}/${m.sessions_total}`} pct={sp} tone={sl === 0 ? "red" : (sl ?? 0) <= 2 ? "amber" : "accent"} />
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 md:w-[300px] md:shrink-0 md:justify-end">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {st === "actif" || st === "bientot" || st === "expire" ? (
                          <Badge tone={daysTone(left)} dot>
                            {daysLeftLabel(left)}
                          </Badge>
                        ) : (
                          <Badge tone={state.tone} dot>
                            {state.label}
                          </Badge>
                        )}
                      </span>
                      <MembershipActions m={m} highlight={alert || dead} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
