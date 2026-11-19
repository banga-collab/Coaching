import { Ban, Check, CheckCircle2, CircleDot, Clock, Flag, Hourglass, Play, Repeat, Send, Square, Undo2, UserPlus, UserX, X } from "lucide-react";
import type { Session } from "@/lib/types";
import { EARLY_START_MIN, canMarkAbsent, canStart, fmtMinutes, isForgotten, realDuration, timeReached, type StaffMember, staffName } from "@/lib/planning";
import { cn, fmtDate, fmtTime, isoToAgadir } from "@/lib/utils";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  endSessionAction,
  keepOriginalTimeAction,
  markSessionAction,
  reassignSessionAction,
  respondSessionAction,
  startSessionAction,
  validateProposalAction,
} from "@/actions/planning";
import { PlanForm } from "./plan-form";

const dt = (iso: string) => `${fmtDate(iso, { weekday: "short", day: "numeric", month: "short" })} · ${fmtTime(iso)}`;

/* ---------- Réponse du coach ---------- */
export function RespondPanel({ s }: { s: Session }) {
  const day = isoToAgadir(s.starts_at);
  return (
    <Card className="overflow-hidden border-amber-300">
      <div className="bg-amber-50 px-5 py-3">
        <p className="font-display font-bold text-amber-900">Séance à confirmer</p>
        <p className="text-xs text-amber-800">Accepte, refuse (avec un motif) ou propose un autre horaire.</p>
      </div>
      <div className="space-y-3 p-5">
        <PlanForm action={respondSessionAction}>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="answer" value="accept" />
          <SubmitButton variant="brand" className="h-12 w-full text-base" pendingText="Envoi…">
            <Check className="size-5" /> Accepter
          </SubmitButton>
        </PlanForm>
        <details className="group rounded-xl border border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600">
            <X className="size-4" /> Refuser
          </summary>
          <PlanForm action={respondSessionAction} className="space-y-3 border-t border-line p-4">
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="answer" value="refuse" />
            <Field label="Motif du refus *">
              <Textarea name="note" required placeholder="Ex. : déjà pris, rendez-vous médical…" className="min-h-[70px]" />
            </Field>
            <SubmitButton variant="danger" className="w-full" pendingText="Envoi…">
              Envoyer le refus
            </SubmitButton>
          </PlanForm>
        </details>
        <details className="group rounded-xl border border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700">
            <Repeat className="size-4" /> Reporter (proposer un horaire)
          </summary>
          <PlanForm action={respondSessionAction} className="space-y-3 border-t border-line p-4">
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="answer" value="report" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *">
                <Input name="date" type="date" required defaultValue={day.date} />
              </Field>
              <Field label="Heure *">
                <Input name="time" type="time" required defaultValue={day.time} />
              </Field>
            </div>
            <Field label="Note">
              <Textarea name="note" placeholder="Pourquoi ce changement ?" className="min-h-[60px]" />
            </Field>
            <SubmitButton variant="secondary" className="w-full" pendingText="Envoi…">
              <Send className="size-4" /> Proposer ce nouvel horaire
            </SubmitButton>
          </PlanForm>
        </details>
      </div>
    </Card>
  );
}

/* ---------- Gros boutons Démarrer / Terminer ---------- */
export function RunButtons({ s }: { s: Session }) {
  const now = Date.now();
  if (s.status === "acceptee" && !canStart(s, now)) {
    if (timeReached(s, now)) return null; // heure dépassée : la séance est « À clôturer »
    const from = new Date(new Date(s.starts_at).getTime() - EARLY_START_MIN * 60000).toISOString();
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-dashed border-line bg-white px-4 py-3 text-sm text-muted">
        <Hourglass className="size-4 shrink-0 text-accent-500" />
        <span>
          Bouton « Séance démarrée » disponible le <b className="text-ink">{fmtDate(from, { weekday: "short", day: "numeric", month: "short" })}</b> à partir de{" "}
          <b className="text-ink">{fmtTime(from)}</b> (30 min avant).
        </span>
      </p>
    );
  }
  if (s.status === "acceptee") {
    return (
      <form action={startSessionAction}>
        <input type="hidden" name="id" value={s.id} />
        <SubmitButton variant="primary" className="h-16 w-full rounded-2xl text-lg shadow-lg shadow-accent-500/30" pendingText="Démarrage…">
          <Play className="size-6 fill-current" /> Séance démarrée
        </SubmitButton>
      </form>
    );
  }
  if (s.status === "en_cours") {
    const live = realDuration(s) ?? 0;
    return (
      <div className="space-y-2">
        <p className="flex items-center justify-center gap-2 rounded-xl bg-orange-50 py-2 text-sm font-semibold text-orange-800">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-orange-500" />
          </span>
          En cours depuis {fmtTime(s.started_at!)} ({fmtMinutes(live)})
        </p>
        <form action={endSessionAction}>
          <input type="hidden" name="id" value={s.id} />
          <SubmitButton variant="brand" className="h-16 w-full rounded-2xl text-lg shadow-lg shadow-brand-500/30" pendingText="Clôture…">
            <Square className="size-5 fill-current" /> Séance terminée
          </SubmitButton>
        </form>
      </div>
    );
  }
  return null;
}

/* ---------- Actions du manager : valider le report, réaffecter ---------- */
export function ManagerPanel({ s, staff, free }: { s: Session; staff: StaffMember[]; free: Set<string> }) {
  const others = staff.filter((p) => p.id !== s.coach_id || s.status === "refusee");
  const proposalPast = !!s.proposed_at && new Date(s.proposed_at).getTime() < Date.now();
  return (
    <Card className="space-y-4 p-5">
      <p className="text-sm font-semibold">Gestion (head coach / admin)</p>
      {s.status === "reportee" && s.proposed_at && (
        <PlanForm action={validateProposalAction}>
          <input type="hidden" name="id" value={s.id} />
          <p className="mb-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
            Nouvel horaire proposé : <b>{dt(s.proposed_at)}</b>
            {s.response_note ? <span className="block opacity-80">« {s.response_note} »</span> : null}
          </p>
          {proposalPast ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Cet horaire est déjà passé : il ne peut plus être validé.</p>
          ) : (
            <SubmitButton variant="brand" className="w-full" pendingText="Validation…">
              <CheckCircle2 className="size-4" /> Valider le nouvel horaire
            </SubmitButton>
          )}
        </PlanForm>
      )}
      {s.status === "reportee" && (
        <PlanForm action={keepOriginalTimeAction}>
          <input type="hidden" name="id" value={s.id} />
          <SubmitButton variant="secondary" className="w-full" pendingText="…">
            <Undo2 className="size-4" /> Garder l&apos;horaire initial ({dt(s.starts_at)})
          </SubmitButton>
          <p className="mt-1.5 text-[11px] text-muted">La séance repasse « en attente du coach » : il accepte l&apos;horaire initial ou refuse.</p>
        </PlanForm>
      )}
      <PlanForm action={reassignSessionAction} className="space-y-2">
        <input type="hidden" name="id" value={s.id} />
        <Field label={s.status === "reportee" ? "Ou réaffecter à un coach" : "Réaffecter à un coach"} hint="Les coachs libres à l'horaire de la séance sont marqués ✓.">
          <Select name="coach_id" defaultValue="" required>
            <option value="" disabled>
              Choisir un coach…
            </option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {free.has(p.id) ? "✓ " : "✗ "}
                {staffName(p)}
                {free.has(p.id) ? " (libre)" : " (occupé / indisponible)"}
              </option>
            ))}
          </Select>
        </Field>
        {s.status === "reportee" && s.proposed_at && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="use_proposed" value="1" className="size-4 accent-brand-500" /> à l&apos;horaire proposé ({dt(s.proposed_at)})
          </label>
        )}
        <SubmitButton variant="secondary" className="w-full" pendingText="Réaffectation…">
          <UserPlus className="size-4" /> Réaffecter
        </SubmitButton>
      </PlanForm>
    </Card>
  );
}

/* ---------- Frise du statut ---------- */
type Step = { label: string; at?: string | null; who?: string | null; detail?: string | null; state: "done" | "current" | "todo" | "bad" };

export function StatusTimeline({ s, names }: { s: Session & { created_at?: string | null }; names: Map<string, string> }) {
  const coach = names.get(s.coach_id) ?? "Coach";
  const assigner = s.assigned_by ? names.get(s.assigned_by) ?? "Head coach" : null;
  const steps: Step[] = [];
  steps.push({
    label: assigner && s.assigned_by !== s.coach_id ? `Affectée à ${coach}` : "Créée",
    at: s.created_at ?? null,
    who: assigner ?? null,
    state: "done",
  });

  const answered = ["acceptee", "en_cours", "realisee"].includes(s.status) || (["absent", "annulee"].includes(s.status) && !!s.responded_at);
  if (s.status === "planifiee") steps.push({ label: "Réponse du coach", detail: `En attente de ${coach}`, state: "current" });
  else if (s.status === "refusee") steps.push({ label: "Refusée", at: s.responded_at, who: coach, detail: s.response_note, state: "bad" });
  else if (s.status === "reportee")
    steps.push({ label: "Report proposé", at: s.responded_at, who: coach, detail: `${s.proposed_at ? `Nouvel horaire : ${dt(s.proposed_at)}` : ""}${s.response_note ? ` · ${s.response_note}` : ""}`, state: "current" });
  else steps.push({ label: "Acceptée", at: s.responded_at, who: answered ? coach : null, detail: s.response_note, state: answered ? "done" : "todo" });

  const finalBad = s.status === "absent" || s.status === "annulee";
  steps.push({ label: "Démarrée", at: s.started_at, who: s.started_at ? coach : null, state: s.started_at ? "done" : s.status === "acceptee" ? "current" : "todo" });
  const dur = realDuration(s);
  steps.push({
    label: finalBad ? (s.status === "absent" ? "Client absent" : "Annulée") : "Terminée",
    at: s.ended_at,
    who: s.ended_at ? coach : null,
    detail: s.ended_at && dur !== null ? `Durée réelle : ${fmtMinutes(dur)} (prévu ${s.duration_min} min)` : null,
    state: finalBad ? "bad" : s.ended_at ? "done" : s.status === "en_cours" ? "current" : "todo",
  });

  const icon = (st: Step["state"]) =>
    st === "done" ? <Check className="size-3.5" /> : st === "bad" ? <X className="size-3.5" /> : st === "current" ? <CircleDot className="size-3.5" /> : <Clock className="size-3.5" />;
  return (
    <Card className="p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Flag className="size-4 text-accent-500" /> Suivi de la séance
      </p>
      <ol className="relative space-y-4">
        <span className="absolute bottom-2 left-[11px] top-2 w-0.5 bg-line" aria-hidden />
        {steps.map((st, i) => (
          <li key={i} className="relative flex gap-3">
            <span
              className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full ring-4 ring-white",
                st.state === "done" && "bg-emerald-500 text-white",
                st.state === "current" && "bg-amber-400 text-white",
                st.state === "bad" && "bg-red-500 text-white",
                st.state === "todo" && "bg-slate-100 text-slate-400",
              )}
            >
              {icon(st.state)}
            </span>
            <span className="min-w-0 text-sm">
              <b className={cn("block", st.state === "todo" && "font-medium text-slate-400")}>{st.label}</b>
              {(st.at || st.who) && (
                <span className="block text-xs text-muted">
                  {st.at ? dt(st.at) : ""}
                  {st.at && st.who ? " · " : ""}
                  {st.who ? `par ${st.who}` : ""}
                </span>
              )}
              {st.detail && <span className="mt-0.5 block text-xs text-slate-600">{st.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------- Clôture rapide d'une séance (oubliée ou en cours) : Terminée / Absent / Annulée ---------- */
export function CloseActions({ s, compact = false }: { s: Session; compact?: boolean }) {
  const now = Date.now();
  const items: { st: string; label: string; Icon: typeof Check; tone: string }[] = [];
  if (new Date(s.starts_at).getTime() <= now && s.status !== "refusee") items.push({ st: "realisee", label: "Terminée", Icon: Check, tone: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" });
  if (canMarkAbsent(s, now)) items.push({ st: "absent", label: "Absent", Icon: UserX, tone: "border-red-200 text-red-700 hover:bg-red-50" });
  items.push({ st: "annulee", label: "Annulée", Icon: Ban, tone: "text-slate-600 hover:bg-canvas" });
  return (
    <div className={cn("flex flex-wrap gap-1.5", !compact && "w-full")}>
      {items.map(({ st, label, Icon, tone }) => (
        <form key={st} action={markSessionAction} className={compact ? undefined : "flex-1"}>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="status" value={st} />
          <SubmitButton variant="secondary" className={cn("h-9 w-full px-2.5 text-xs", tone)} pendingText="…">
            <Icon className="size-3.5" /> {label}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}

/** Encadré « À clôturer » sur la page d'une séance oubliée (heure passée, jamais démarrée ou jamais terminée) */
export function ForgottenPanel({ s }: { s: Session }) {
  if (!isForgotten(s)) return null;
  return (
    <Card className="overflow-hidden border-amber-300">
      <div className="bg-amber-50 px-5 py-3">
        <p className="font-display font-bold text-amber-900">À clôturer</p>
        <p className="text-xs text-amber-800">
          {s.status === "en_cours" ? "Cette séance n'a jamais été terminée." : "L'heure de cette séance est passée sans qu'elle soit démarrée."} Indique ce qui s&apos;est passé
          {s.status === "en_cours" ? " (la fin est plafonnée à l'heure prévue + 1 h)" : ""}.
        </p>
      </div>
      <div className="p-4">
        <CloseActions s={s} />
      </div>
    </Card>
  );
}
