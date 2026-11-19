import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock3, ExternalLink, MessageSquare, MonitorSmartphone, ShieldCheck, Star, UserX } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LATE_MIN, UNCONFIRMED_AFTER_H, loadControle, type EspaceFilter } from "@/lib/controle";
import { ESPACE_LABEL, ESPACES } from "@/lib/espace";
import { borneKey } from "@/lib/pointage";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";
import { Panel, Section } from "@/components/admin/ceo/sections";

export const metadata = { title: "Contrôle à distance" };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

export default async function ControlePage({ searchParams }: { searchParams: Promise<{ espace?: string; jours?: string }> }) {
  const [, sp] = await Promise.all([requireAdmin(), searchParams]);
  const espace: EspaceFilter = sp.espace === "mixte" || sp.espace === "tout" ? sp.espace : "lady";
  const days = sp.jours === "30" ? 30 : 7;
  const supabase = await createClient();
  const d = await loadControle(supabase, espace, days);
  const t = d.totals;
  const link = (e: EspaceFilter, j = days) => `/admin/controle?espace=${e}${j === 30 ? "&jours=30" : ""}`;
  const bornes = espace === "tout" ? ESPACES : [espace];

  const kpis = [
    { label: "Séances confirmées par les clientes", value: pct(t.confirmed, t.done), sub: `${t.confirmed} / ${t.done} séances réalisées`, icon: CheckCircle2, bad: t.done > 0 && t.confirmed / t.done < 0.7 },
    { label: "Séances contestées", value: String(t.contested), sub: "La cliente dit que la séance n'a pas eu lieu", icon: AlertOctagon, bad: t.contested > 0 },
    { label: "Séances sans pointage", value: String(t.noPointage), sub: "Jours avec séances « réalisées » sans arrivée", icon: UserX, bad: t.noPointage > 0 },
    { label: "Ponctualité", value: pct(t.daysOnTime, t.daysWorked), sub: `Arrivée avant la 1re séance (+${LATE_MIN} min)`, icon: Clock3, bad: t.daysWorked > 0 && t.daysOnTime / t.daysWorked < 0.85 },
    { label: "Note des clientes", value: t.ratingAvg ? `${t.ratingAvg.toFixed(1).replace(".", ",")} / 5` : "—", sub: `${t.ratings} avis`, icon: Star, bad: t.ratingAvg !== null && t.ratingAvg < 3.5 },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-600">Contrôle à distance</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{espace === "tout" ? "Tous les espaces" : ESPACE_LABEL[espace]}</h1>
          <p className="mt-1 text-sm text-muted">Pointage à la borne, séances confirmées par les clientes et leurs avis · {days} derniers jours</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <nav className="flex flex-1 rounded-xl border border-line bg-white p-1 text-sm font-semibold shadow-card sm:flex-none" aria-label="Espace">
            {(["lady", "mixte", "tout"] as EspaceFilter[]).map((e) => (
              <Link key={e} href={link(e)} aria-current={e === espace ? "page" : undefined} className={cn("flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition sm:flex-none", e === espace ? "bg-brand-500 text-white" : "text-muted hover:bg-canvas hover:text-ink")}>
                {e === "lady" ? "Lady" : e === "mixte" ? "Mixte" : "Tout"}
              </Link>
            ))}
          </nav>
          <nav className="flex rounded-xl border border-line bg-white p-1 text-sm font-semibold shadow-card" aria-label="Période">
            {[7, 30].map((j) => (
              <Link key={j} href={link(espace, j)} aria-current={j === days ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 transition", j === days ? "bg-brand-500 text-white" : "text-muted hover:bg-canvas hover:text-ink")}>
                {j} j
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {!d.coaches.length ? (
        <Card className="p-8 text-center text-sm text-muted">
          Aucune coach dans cet espace. Indiquez l&apos;espace « Moov&apos;Up Lady » sur la fiche des coachs (Admin → Coachs → Modifier).
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.label} className={cn("rounded-2xl border bg-white p-4 shadow-card", k.bad ? "border-red-200" : "border-line")}>
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[12.5px] font-semibold leading-tight text-muted">{k.label}</span>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", k.bad ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-500")}>
                    <k.icon className="size-4" />
                  </span>
                </span>
                <span className={cn("mt-1.5 block font-display text-[24px] font-extrabold leading-none tabular-nums", k.bad ? "text-red-600" : "text-ink")}>{k.value}</span>
                <span className="mt-2 block text-[11.5px] leading-snug text-muted">{k.sub}</span>
              </div>
            ))}
          </div>

          {/* Aujourd'hui */}
          <Section title="Aujourd'hui" subtitle="Qui est là, qui est en retard" icon={<Clock3 className="size-4" />}>
            <Card className="divide-y divide-line">
              {d.today.length ? (
                d.today.map((r) => (
                  <div key={r.coach.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
                    <div className="min-w-[180px] flex-1">
                      <p className="font-semibold text-ink">{r.coach.full_name || r.coach.email}</p>
                      <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1", TONE[r.tone])}>{r.label}</span>
                    </div>
                    <div className="text-xs text-muted">
                      <p>Arrivée : <b className="text-ink tabular-nums">{r.arrival ? fmtTime(r.arrival) : "—"}</b></p>
                      <p>Départ : <b className="text-ink tabular-nums">{r.departure ? fmtTime(r.departure) : "—"}</b></p>
                    </div>
                    <ul className="w-full space-y-0.5 text-xs text-muted sm:w-auto sm:min-w-[260px]">
                      {r.sessions.map((s) => (
                        <li key={s.id} className="flex gap-2">
                          <span className="w-10 font-semibold tabular-nums text-ink">{fmtTime(s.starts_at)}</span>
                          <span className="truncate">{s.client} · {s.type}</span>
                          <span className="ms-auto shrink-0">{s.status === "realisee" ? "✓" : s.status === "absent" ? "absente" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="px-5 py-6 text-sm text-muted">Aucune séance ni pointage aujourd&apos;hui.</p>
              )}
            </Card>
          </Section>

          {/* Alertes */}
          <Section title="À vérifier" subtitle="Contestations, séances sans pointage, retards, mauvaises notes" icon={<AlertTriangle className="size-4" />}>
            <Card className="divide-y divide-line">
              {d.alerts.length ? (
                d.alerts.slice(0, 25).map((a, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    {a.level === "red" ? <AlertOctagon className="mt-0.5 size-4 shrink-0 text-red-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{a.title}</p>
                      <p className="text-xs text-muted">{a.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{fmtDate(a.at, { weekday: "short", day: "numeric", month: "short" })}</span>
                  </div>
                ))
              ) : (
                <p className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-700">
                  <CheckCircle2 className="size-4" /> Rien à signaler sur la période.
                </p>
              )}
            </Card>
          </Section>

          {/* Par coach */}
          <Section title="Par coach" subtitle={`${days} derniers jours`} icon={<ShieldCheck className="size-4" />}>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-canvas text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Coach</th>
                    <th className="px-3 py-2.5 font-semibold">Réalisées</th>
                    <th className="px-3 py-2.5 font-semibold">Confirmées</th>
                    <th className="px-3 py-2.5 font-semibold">Contestées</th>
                    <th className="px-3 py-2.5 font-semibold" title={`Sans réponse après ${UNCONFIRMED_AFTER_H} h`}>Sans réponse</th>
                    <th className="px-3 py-2.5 font-semibold">Note</th>
                    <th className="px-3 py-2.5 font-semibold">Retards</th>
                    <th className="px-3 py-2.5 font-semibold">Sans pointage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.stats.map((s) => (
                    <tr key={s.coach.id}>
                      <td className="px-4 py-3 font-semibold text-ink">{s.coach.full_name || s.coach.email}</td>
                      <td className="px-3 py-3 tabular-nums">{s.done}</td>
                      <td className="px-3 py-3 tabular-nums">{s.confirmed} <span className="text-xs text-muted">({pct(s.confirmed, s.done)})</span></td>
                      <td className={cn("px-3 py-3 tabular-nums", s.contested > 0 && "font-bold text-red-600")}>{s.contested}</td>
                      <td className="px-3 py-3 tabular-nums">{s.unconfirmed}{s.noAccount ? <span className="text-xs text-muted"> +{s.noAccount} sans appli</span> : null}</td>
                      <td className="px-3 py-3 tabular-nums">{s.ratingAvg ? `${s.ratingAvg.toFixed(1).replace(".", ",")} ★` : "—"}</td>
                      <td className={cn("px-3 py-3 tabular-nums", s.lateDays > 0 && "font-bold text-amber-700")}>{s.lateDays} / {s.daysWorked} j</td>
                      <td className={cn("px-3 py-3 tabular-nums", s.noPointageDays > 0 && "font-bold text-red-600")}>{s.noPointageDays} j</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {t.noAccountClients > 0 && (
              <p className="mt-2 text-xs text-muted">
                {t.noAccountClients} cliente{t.noAccountClients > 1 ? "s" : ""} active{t.noAccountClients > 1 ? "s" : ""} sur {t.activeClients} n&apos;{t.noAccountClients > 1 ? "ont" : "a"} pas l&apos;application : elle{t.noAccountClients > 1 ? "s" : ""} ne peu{t.noAccountClients > 1 ? "vent" : "t"} pas confirmer les séances. Donnez-leur l&apos;accès depuis leur fiche client.
              </p>
            )}
          </Section>

          {/* Avis */}
          <Section title="Avis des clientes" subtitle="Visibles par la direction seulement" icon={<MessageSquare className="size-4" />}>
            <Card className="divide-y divide-line">
              {d.feedback.filter((f) => f.comment || !f.happened).length ? (
                d.feedback
                  .filter((f) => f.comment || !f.happened)
                  .slice(0, 10)
                  .map((f) => (
                    <div key={f.id} className="px-5 py-3.5">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <b className="text-ink">{f.client}</b>
                        <span className="text-muted">→ {f.coach}</span>
                        {f.happened ? f.rating ? <Badge tone={f.rating <= 2 ? "red" : f.rating >= 4 ? "green" : "amber"}>{f.rating}/5</Badge> : null : <Badge tone="red">Pas eu lieu</Badge>}
                        <span className="ms-auto text-xs text-muted">{f.sessionAt ? fmtDate(f.sessionAt, { day: "numeric", month: "short" }) : ""}</span>
                      </p>
                      {f.comment && <p className="mt-1 text-sm text-muted">« {f.comment} »</p>}
                    </div>
                  ))
              ) : (
                <p className="px-5 py-6 text-sm text-muted">Pas encore de commentaire.</p>
              )}
            </Card>
          </Section>
        </>
      )}

      {/* Borne */}
      <Section title="Borne de pointage" subtitle="Tablette à l'accueil, écran toujours allumé" icon={<MonitorSmartphone className="size-4" />}>
        <div className="grid gap-4 md:grid-cols-2">
          {bornes.map((e) => (
            <Panel key={e} title={`Borne ${ESPACE_LABEL[e]}`} subtitle="Le code change toutes les 30 secondes">
              <div className="space-y-3 px-5 pb-5 text-sm text-muted">
                <ol className="list-decimal space-y-1 ps-5">
                  <li>Ouvrez ce lien sur la tablette de l&apos;accueil, laissez-la allumée.</li>
                  <li>Chaque coach pointe en arrivant et en partant (QR code ou code à 6 chiffres).</li>
                  <li>Ne partagez pas le lien : il permet d&apos;afficher les codes.</li>
                </ol>
                <a href={`/borne?k=${borneKey(e)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                  Ouvrir la borne <ExternalLink className="size-3.5" />
                </a>
              </div>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  );
}
