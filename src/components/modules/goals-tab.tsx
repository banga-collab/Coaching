import { Activity, Ban, CalendarCheck, CalendarClock, Check, Dumbbell, PartyPopper, Plus, RotateCcw, Ruler, Scale, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Goal, GoalMetric, Measurement } from "@/lib/types";
import { cn, fmtDate, num } from "@/lib/utils";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { ConfirmIcon } from "@/components/phase1/confirm-icon";
import { METRIC_META, daysUntil, goalProgress, type GoalProgress } from "@/components/phase1/shared";
import { deleteGoalAction, setGoalStatusAction, updateGoalValueAction } from "@/actions/phase1";

const ICONS: Record<GoalMetric, typeof Scale> = {
  weight_kg: Scale,
  body_fat: Activity,
  waist_cm: Ruler,
  squat_kg: Dumbbell,
  bench_kg: Dumbbell,
  deadlift_kg: Dumbbell,
  sessions: CalendarCheck,
  custom: Sparkles,
};
const STATUS: Record<Goal["status"], { label: string; tone: "brand" | "green" | "gray" }> = {
  en_cours: { label: "En cours", tone: "brand" },
  atteint: { label: "Atteint", tone: "green" },
  abandonne: { label: "Abandonné", tone: "gray" },
};
const RANK: Record<Goal["status"], number> = { en_cours: 0, atteint: 1, abandonne: 2 };

function Hidden({ g }: { g: Goal }) {
  return (
    <>
      <input type="hidden" name="id" value={g.id} />
      <input type="hidden" name="client_id" value={g.client_id} />
    </>
  );
}

export async function GoalsTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const [{ data: gData }, { data: mData }, { data: sData }] = await Promise.all([
    supabase.from("goals").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("measurements").select("*").eq("client_id", clientId).order("measured_on"),
    supabase.from("sessions").select("starts_at").eq("client_id", clientId).eq("status", "realisee"),
  ]);
  const goals = (gData ?? []) as Goal[];
  const meas = (mData ?? []) as Measurement[];
  const done = ((sData ?? []) as { starts_at: string }[]).map((s) => s.starts_at);
  const items = goals.map((g) => ({ g, p: goalProgress(g, meas, done) })).sort((a, b) => RANK[a.g.status] - RANK[b.g.status]);

  const newBtn = canEdit ? (
    <LinkButton href={`/clients/${clientId}/objectif`} className="h-9">
      <Plus className="size-4" /> Nouvel objectif
    </LinkButton>
  ) : null;

  if (!items.length) {
    return (
      <Card>
        <Empty
          icon={<Target className="size-6" />}
          title={canEdit ? "Aucun objectif défini" : "Pas encore d'objectif"}
          text={
            canEdit
              ? "Fixe un cap chiffré : poids, masse grasse, tour de taille, charges, nombre de séances ou objectif personnalisé. La progression se met à jour automatiquement."
              : "Ton coach va bientôt définir tes objectifs avec toi. Tu pourras suivre ta progression ici, étape par étape."
          }
          action={newBtn ?? undefined}
        />
      </Card>
    );
  }

  const active = items.filter((x) => x.g.status === "en_cours");
  const achieved = items.filter((x) => x.g.status === "atteint").length;
  const avg = active.length ? Math.round(active.reduce((s, x) => s + x.p.pct, 0) / active.length) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Stat icon={<Target className="size-4" />} label="En cours" value={active.length} />
          <Stat icon={<Trophy className="size-4" />} label="Atteints" value={achieved} tone="green" />
          {avg !== null && <Stat icon={<TrendingUp className="size-4" />} label="Progression moyenne" value={`${avg} %`} tone="accent" />}
        </div>
        {newBtn}
      </div>
      {!canEdit && active.length > 0 && (
        <p className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-700">
          {avg !== null && avg >= 50 ? "Tu as fait plus de la moitié du chemin, continue comme ça !" : "Chaque séance te rapproche de tes objectifs. Garde le rythme !"}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map(({ g, p }) => (
          <GoalCard key={g.id} g={g} p={p} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone = "brand" }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "brand" | "green" | "accent" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white py-2 pl-2 pr-4 shadow-card">
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "accent" ? "bg-accent-50 text-accent-500" : "bg-brand-50 text-brand-500",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="font-display text-base font-extrabold leading-none text-ink">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}

function GoalCard({ g, p, canEdit }: { g: Goal; p: GoalProgress; canEdit: boolean }) {
  const Icon = ICONS[g.metric] ?? Target;
  const unit = g.unit ?? METRIC_META[g.metric]?.unit ?? "";
  const st = STATUS[g.status];
  const done = g.status === "atteint";
  const dropped = g.status === "abandonne";
  const suggestReached = g.status === "en_cours" && p.reached;
  const days = g.due_date ? daysUntil(g.due_date) : null;

  return (
    <Card className={cn("flex flex-col p-5 transition hover:shadow-pop", dropped && "opacity-70", done && "border-emerald-200")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", done ? "bg-emerald-50 text-emerald-600" : dropped ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-500")}>
          {done ? <Trophy className="size-5" /> : <Icon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("font-display text-[15px] font-bold text-ink", dropped && "line-through decoration-slate-300")}>{g.title}</h3>
            <Badge tone={st.tone} dot>
              {st.label}
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            {p.decreasing ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}
            {METRIC_META[g.metric]?.label ?? "Objectif"}
            {p.currentOn && ` · mesuré le ${fmtDate(p.currentOn, { day: "numeric", month: "short" })}`}
          </p>
        </div>
        {canEdit && (
          <form action={deleteGoalAction} className="-mr-1 -mt-1">
            <Hidden g={g} />
            <ConfirmIcon message={`Supprimer l'objectif « ${g.title} » ?`} label="Supprimer l'objectif">
              <Trash2 className="size-4" />
            </ConfirmIcon>
          </form>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="font-display text-[26px] font-extrabold leading-none tracking-tight text-ink">
          {p.current !== null ? num(p.current) : "–"}
          <span className="ml-1 text-sm font-semibold text-muted">
            / {num(p.target)} {unit}
          </span>
        </p>
        <p className={cn("font-display text-lg font-extrabold", done || p.reached ? "text-emerald-600" : dropped ? "text-slate-400" : "text-brand-500")}>{p.pct} %</p>
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={cn("h-full rounded-full transition-all duration-700", done || p.reached ? "bg-emerald-500" : dropped ? "bg-slate-300" : "bg-gradient-to-r from-brand-500 to-brand-400")}
          style={{ width: `${Math.max(p.pct, 2)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          Départ {num(p.start)} {unit} → {num(p.target)} {unit}
        </span>
        {p.remaining !== null && !p.reached && !dropped && (
          <span className="font-semibold text-slate-600">
            Reste {num(p.remaining)} {unit}
          </span>
        )}
      </div>

      {days !== null && g.status === "en_cours" && (
        <p
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
            days < 0 ? "bg-red-50 text-red-700" : days <= 14 ? "bg-amber-50 text-amber-700" : "bg-canvas text-slate-600",
          )}
        >
          <CalendarClock className="size-3.5" />
          {days < 0 ? `Échéance dépassée de ${-days} j` : days === 0 ? "Échéance aujourd'hui" : `J-${days} · ${fmtDate(g.due_date!)}`}
        </p>
      )}
      {done && g.due_date && <p className="mt-3 text-xs text-emerald-700">Bravo ! Objectif atteint (échéance prévue le {fmtDate(g.due_date)}).</p>}

      {suggestReached && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <PartyPopper className="size-5 shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 text-sm font-medium text-emerald-800">{canEdit ? "La cible est atteinte !" : "Tu as atteint ta cible, bravo !"}</p>
          {canEdit && (
            <form action={setGoalStatusAction}>
              <Hidden g={g} />
              <input type="hidden" name="status" value="atteint" />
              <button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700">
                <Check className="size-3.5" /> Marquer atteint
              </button>
            </form>
          )}
        </div>
      )}

      {canEdit && g.metric === "custom" && g.status === "en_cours" && (
        <form action={updateGoalValueAction} className="mt-4 flex items-center gap-2">
          <Hidden g={g} />
          <div className="relative flex-1">
            <input
              name="current_value"
              inputMode="decimal"
              required
              placeholder={p.current !== null ? `Actuel : ${num(p.current)}` : "Nouvelle valeur"}
              className="h-9 w-full rounded-lg border border-line bg-white px-3 pr-12 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
            />
            {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>}
          </div>
          <button className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:bg-canvas">Mettre à jour</button>
        </form>
      )}

      {canEdit && (
        <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {g.status === "en_cours" ? (
            <>
              {!suggestReached && (
                <StatusBtn g={g} status="atteint">
                  <Check className="size-3.5" /> Atteint
                </StatusBtn>
              )}
              <StatusBtn g={g} status="abandonne">
                <Ban className="size-3.5" /> Abandonner
              </StatusBtn>
            </>
          ) : (
            <StatusBtn g={g} status="en_cours">
              <RotateCcw className="size-3.5" /> Remettre en cours
            </StatusBtn>
          )}
        </div>
        </div>
      )}
    </Card>
  );
}

function StatusBtn({ g, status, children }: { g: Goal; status: Goal["status"]; children: React.ReactNode }) {
  return (
    <form action={setGoalStatusAction}>
      <Hidden g={g} />
      <input type="hidden" name="status" value={status} />
      <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-canvas hover:text-ink">{children}</button>
    </form>
  );
}
