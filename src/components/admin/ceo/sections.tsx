/** Blocs serveur de la Vue CEO (aucune interactivité : liens et petites barres en HTML). */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlarmClock,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Info,
  ListTodo,
  Megaphone,
  MessageSquare,
  Minus,
} from "lucide-react";
import type { CeoAlert, CeoData, CeoKpi } from "@/lib/ceo";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";
import { fmtInt, fmtPct, fmtValue, trendOf } from "./format";

/* ---------- Tuile KPI ---------- */
export function KpiTile({ k, icon, compare }: { k: CeoKpi; icon: ReactNode; compare: string }) {
  const t = trendOf(k);
  const Arrow = t?.dir === "up" ? ArrowUpRight : t?.dir === "down" ? ArrowDownRight : Minus;
  return (
    <Link
      href={k.href}
      title={k.hint}
      className="group relative flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-pop print-break"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-semibold leading-tight text-muted">{k.label}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">{icon}</span>
      </span>
      <span className="mt-1.5 font-display text-[21px] font-extrabold leading-none tracking-tight text-ink tabular-nums sm:text-[25px]">{fmtValue(k.value, k.format)}</span>
      <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px]">
        {k.snapshot ? (
          <span className="font-semibold text-muted">Aujourd&apos;hui</span>
        ) : t ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold",
                t.good === null ? "bg-slate-100 text-slate-600" : t.good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
              )}
            >
              <Arrow className="size-3" />
              {t.text}
            </span>
            <span className="text-muted" title={compare}>
              vs {fmtValue(k.prev, k.format)}
            </span>
          </>
        ) : (
          <span className="text-muted">Pas de comparaison</span>
        )}
      </span>
      {k.sub && <span className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-muted">{k.sub}</span>}
    </Link>
  );
}

/* ---------- Titre de section ---------- */
export function Section({ id, title, subtitle, icon, children, action }: { id?: string; title: string; subtitle?: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[#0f3a4b] text-white">{icon}</span>
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export const MoreLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="no-print inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
    {children} <ArrowRight className="size-3.5" />
  </Link>
);

/* ---------- Alertes ---------- */
const ALERT_STYLE: Record<CeoAlert["level"], { icon: typeof Info; box: string; dot: string; label: string }> = {
  critique: { icon: AlertOctagon, box: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", label: "Critique" },
  attention: { icon: AlertTriangle, box: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", label: "À surveiller" },
  info: { icon: Info, box: "border-brand-100 bg-brand-50 text-brand-600", dot: "bg-brand-400", label: "Info" },
};

export function AlertsPanel({ alerts }: { alerts: CeoAlert[] }) {
  if (!alerts.length)
    return (
      <Card className="flex items-center gap-3 p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="font-display font-bold text-ink">Rien à signaler</p>
          <p className="text-sm text-muted">Aucune alerte sur l&apos;activité, les clients ou les opérations.</p>
        </div>
      </Card>
    );
  const counts = { critique: 0, attention: 0, info: 0 };
  alerts.forEach((a) => counts[a.level]++);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-xs">
        {(["critique", "attention", "info"] as const).map((l) =>
          counts[l] ? (
            <span key={l} className="inline-flex items-center gap-1.5 font-semibold text-muted">
              <span className={cn("size-2 rounded-full", ALERT_STYLE[l].dot)} />
              {counts[l]} {ALERT_STYLE[l].label.toLowerCase()}
            </span>
          ) : null,
        )}
      </div>
      <ul className="grid divide-y divide-line lg:grid-cols-2 lg:divide-y-0">
        {alerts.map((a, i) => {
          const s = ALERT_STYLE[a.level];
          const Icon = s.icon;
          return (
            <li key={i} className="lg:border-b lg:border-line lg:odd:border-r">
              <Link href={a.href} className="group flex items-start gap-3 px-5 py-3 transition hover:bg-canvas/70">
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border", s.box)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{a.text}</span>
                  {a.detail && <span className="block text-xs text-muted">{a.detail}</span>}
                </span>
                <ArrowRight className="no-print mt-1 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Carte de chaleur jour × heure ---------- */
export function Heatmap({ heat }: { heat: CeoData["activity"]["heat"] }) {
  if (!heat.total) return <p className="px-5 pb-6 text-sm text-muted">Aucune séance passée sur la période.</p>;
  return (
    <div className="px-5 pb-5">
      <div className="overflow-x-auto">
        <div className="min-w-[540px]">
          <div className="grid gap-1" style={{ gridTemplateColumns: `34px repeat(${heat.hours.length}, minmax(0, 1fr))` }}>
            <span />
            {heat.hours.map((h) => (
              <span key={h} className="pb-0.5 text-center text-[10px] font-semibold text-muted tabular-nums">
                {h}h
              </span>
            ))}
            {heat.grid.map((row, d) => (
              <div key={d} className="contents">
                <span className="flex items-center text-[11px] font-semibold text-muted">{heat.days[d]}</span>
                {row.map((v, hi) => {
                  const a = v ? 0.14 + 0.86 * (v / Math.max(1, heat.max)) : 0;
                  return (
                    <span
                      key={hi}
                      title={`${heat.days[d]} ${heat.hours[hi]}h–${heat.hours[hi]! + 1}h : ${v} séance${v > 1 ? "s" : ""}`}
                      className={cn("grid h-7 place-items-center rounded-md text-[10px] font-bold tabular-nums", v ? (a > 0.55 ? "text-white" : "text-brand-700") : "bg-canvas text-transparent")}
                      style={v ? { background: `rgba(26,109,142,${a.toFixed(2)})` } : undefined}
                    >
                      {v || "·"}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>{fmtInt(heat.total)} séances réalisées ou manquées · heure d&apos;Agadir</span>
        <span className="flex items-center gap-1.5">
          Moins
          {[0.14, 0.35, 0.56, 0.78, 1].map((a) => (
            <span key={a} className="size-3 rounded" style={{ background: `rgba(26,109,142,${a})` }} />
          ))}
          Plus
        </span>
      </div>
    </div>
  );
}

/* ---------- Barre horizontale simple ---------- */
export function HBar({ label, value, max, right, href, tone = "bg-brand-500", sub }: { label: ReactNode; value: number; max: number; right: ReactNode; href?: string; tone?: string; sub?: ReactNode }) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-ink">{label}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink">{right}</span>
      </span>
      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-canvas">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${max > 0 ? Math.max(value > 0 ? 3 : 0, Math.min(100, (value / max) * 100)) : 0}%` }} />
      </span>
      {sub && <span className="mt-1 block text-[11px] text-muted">{sub}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-canvas/70">
      {body}
    </Link>
  ) : (
    <div className="py-1.5">{body}</div>
  );
}

/* ---------- Cours collectifs ---------- */
export function ClassesFill({ c }: { c: CeoData["activity"]["classes"] }) {
  if (!c.count) return <p className="px-5 pb-6 text-sm text-muted">Aucun cours collectif passé sur la période.</p>;
  const t = c.fill !== null && c.prevFill !== null ? Math.round(c.fill - c.prevFill) : null;
  return (
    <div className="px-5 pb-5">
      <Link href="/cours" className="flex items-end gap-3 rounded-xl bg-canvas/70 px-4 py-3 transition hover:bg-canvas">
        <span className="font-display text-3xl font-extrabold text-ink tabular-nums">{fmtPct(c.fill === null ? null : Math.round(c.fill))}</span>
        <span className="pb-1 text-xs text-muted">
          {fmtInt(c.booked)} places prises / {fmtInt(c.capacity)} · {c.count} cours
          {t !== null && (
            <b className={cn("ms-1.5", t > 0 ? "text-emerald-700" : t < 0 ? "text-red-700" : "text-muted")}>
              {t > 0 ? "+" : t < 0 ? "−" : "±"}
              {Math.abs(t)} pts
            </b>
          )}
          {c.waitlist ? ` · ${c.waitlist} en liste d'attente` : ""}
        </span>
      </Link>
      <div className="mt-3 space-y-1">
        {c.byCategory.slice(0, 6).map((x) => (
          <HBar
            key={x.label}
            label={x.label}
            value={x.fill}
            max={100}
            right={`${Math.round(x.fill)} %`}
            sub={`${x.booked}/${x.capacity} places · ${x.count} cours`}
            tone={x.fill >= 90 ? "bg-accent-500" : "bg-brand-500"}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Entonnoir clients ---------- */
export function Funnel({ steps }: { steps: CeoData["clients"]["funnel"] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const tones = ["bg-brand-300", "bg-brand-500", "bg-emerald-500", "bg-amber-400", "bg-slate-400"];
  return (
    <ol className="space-y-2 px-5 pb-5">
      {steps.map((s, i) => (
        <li key={s.label}>
          <Link href={s.href} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-canvas/70">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{s.label}</span>
              <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-canvas">
                <span className={cn("block h-full rounded-full", tones[i % tones.length])} style={{ width: `${Math.max(s.value ? 4 : 0, (s.value / max) * 100)}%` }} />
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">{s.hint}</span>
            </span>
            <span className="font-display text-xl font-extrabold text-ink tabular-nums">{fmtInt(s.value)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Qualité & opérations ---------- */
function OpTile({ href, icon, label, value, sub, tone }: { href: string; icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone: "ok" | "warn" | "bad" | "neutral" }) {
  const toneCls = { ok: "bg-emerald-50 text-emerald-600", warn: "bg-amber-50 text-amber-600", bad: "bg-red-50 text-red-600", neutral: "bg-brand-50 text-brand-500" }[tone];
  return (
    <Link href={href} className="group flex min-w-0 items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-pop print-break">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneCls)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-muted">{label}</span>
        <span className="block font-display text-2xl font-extrabold text-ink tabular-nums">{value}</span>
        {sub && <span className="block text-[11.5px] leading-snug text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

export function QualityGrid({ q }: { q: CeoData["quality"] }) {
  const riskTotal = q.risk.vert + q.risk.orange + q.risk.rouge;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
      <Panel title="Bilans sportifs" subtitle="Niveau de risque du dernier bilan de chaque client" action={<MoreLink href="/evaluations">Évaluations</MoreLink>}>
        <div className="px-5 pb-5">
          {riskTotal ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`Vert ${q.risk.vert}, orange ${q.risk.orange}, rouge ${q.risk.rouge}`}>
                {(["vert", "orange", "rouge"] as const).map((r) =>
                  q.risk[r] ? <span key={r} className={cn("h-full border-r-2 border-white last:border-r-0", r === "vert" ? "bg-emerald-500" : r === "orange" ? "bg-amber-400" : "bg-red-500")} style={{ width: `${(q.risk[r] / riskTotal) * 100}%` }} /> : null,
                )}
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
                {(["vert", "orange", "rouge"] as const).map((r) => (
                  <li key={r} className="rounded-xl bg-canvas/70 px-2 py-2">
                    <span className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted">
                      <span className={cn("size-2 rounded-full", r === "vert" ? "bg-emerald-500" : r === "orange" ? "bg-amber-400" : "bg-red-500")} />
                      {r === "vert" ? "Vert" : r === "orange" ? "Orange" : "Rouge"}
                    </span>
                    <span className="block font-display text-xl font-extrabold text-ink tabular-nums">{q.risk[r]}</span>
                    <span className="block text-[10.5px] text-muted">{Math.round((q.risk[r] / riskTotal) * 100)} %</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">Aucun bilan sportif enregistré.</p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            {q.toValidate ? <Badge tone="amber">{q.toValidate} à valider</Badge> : <Badge tone="green">Tout est validé</Badge>}
            <span>{q.assessmentsPeriod} bilan{q.assessmentsPeriod > 1 ? "s" : ""} réalisé{q.assessmentsPeriod > 1 ? "s" : ""} sur la période</span>
          </p>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OpTile
          href={q.complaintsOld ? "/reclamations?statut=nouvelle" : "/reclamations"}
          icon={<Megaphone className="size-4" />}
          label="Réclamations ouvertes"
          value={q.complaintsOpen}
          sub={q.complaintsOld ? <b className="text-red-700">{q.complaintsOld} depuis plus de 7 jours</b> : `${q.complaintsPeriod} reçue${q.complaintsPeriod > 1 ? "s" : ""} sur la période`}
          tone={q.complaintsOld ? "bad" : q.complaintsOpen ? "warn" : "ok"}
        />
        <OpTile
          href="/reservations?statut=nouvelle"
          icon={<Inbox className="size-4" />}
          label="Demandes de réservation"
          value={q.bookingsPending}
          sub={q.bookingsExpired ? `à traiter · ${q.bookingsExpired} dont la date est passée` : "à traiter"}
          tone={q.bookingsPending ? "warn" : "ok"}
        />
        <OpTile
          href="/seances"
          icon={<AlarmClock className="size-4" />}
          label="Séances à clôturer"
          value={q.toCloseTotal}
          sub={
            q.toClose.length ? (
              <>
                Plus récente : {q.toClose[0]!.client} · {fmtDate(q.toClose[0]!.starts_at, { day: "numeric", month: "short" })} {fmtTime(q.toClose[0]!.starts_at)}
              </>
            ) : (
              "Passées mais encore ouvertes (60 j)"
            )
          }
          tone={q.toCloseTotal >= 5 ? "bad" : q.toCloseTotal ? "warn" : "ok"}
        />
        <OpTile
          href="/planning"
          icon={<CalendarClock className="size-4" />}
          label="En attente d'un coach"
          value={q.awaitingCoach}
          sub="Séances à venir non encore acceptées"
          tone={q.awaitingCoach ? "warn" : "ok"}
        />
        <OpTile
          href="/taches?vue=all"
          icon={<ListTodo className="size-4" />}
          label="Tâches en retard"
          value={q.tasksOverdue}
          sub={q.tasksOverdueHigh ? `dont ${q.tasksOverdueHigh} haute priorité` : "Toutes équipes confondues"}
          tone={q.tasksOverdueHigh ? "bad" : q.tasksOverdue ? "warn" : "ok"}
        />
        <OpTile
          href={q.unreadOldest ? `/messages?client=${q.unreadOldest.clientId}` : "/messages"}
          icon={<MessageSquare className="size-4" />}
          label="Messages clients non lus"
          value={q.unread}
          sub={q.unreadOldest ? `${q.unreadClients} conversation${q.unreadClients > 1 ? "s" : ""} · plus ancien : ${q.unreadOldest.client}, ${fmtDate(q.unreadOldest.created_at, { day: "numeric", month: "short" })}` : "Boîte à jour"}
          tone={q.unread ? "warn" : "ok"}
        />
      </div>
    </div>
  );
}
