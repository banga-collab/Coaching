import { CalendarDays, Dumbbell, NotebookPen } from "lucide-react";
import type { Client, Session, SessionExercise, SessionStatus } from "@/lib/types";
import { allowedStatuses, timeReached, type StaffMember } from "@/lib/planning";
import { SESSION_LABEL, SESSION_TYPES, isoToAgadir } from "@/lib/utils";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, LinkButton, SectionTitle, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ExerciseRows } from "@/components/exercise-rows";
import { saveSessionPlanningAction } from "@/actions/planning";
import { ClientPicker, PriceInput, TypePicker } from "@/components/planning/pickers";
import { SlotCalendar } from "@/components/planning/slot-calendar";

const agadir = isoToAgadir;

export function SessionForm({
  clients,
  session,
  exercises,
  defaultClient,
  defaultDate,
  defaultTime,
  coaches,
  defaultCoach,
  types,
  prices,
  selfId,
}: {
  clients: Pick<Client, "id" | "full_name">[];
  session?: Session;
  exercises?: SessionExercise[];
  defaultClient?: string;
  defaultDate?: string;
  defaultTime?: string;
  /** Liste des coachs (head coach / admin uniquement) : permet d'affecter la séance */
  coaches?: StaffMember[];
  defaultCoach?: string;
  /** Types de séance (liste gérée) */
  types?: string[];
  /** Prix indicatif par défaut de chaque type (DH) */
  prices?: Record<string, number>;
  /** Coach connecté (pour afficher ses créneaux libres quand il planifie lui-même) */
  selfId?: string;
}) {
  const when = session ? agadir(session.starts_at) : { date: defaultDate ?? agadir(new Date().toISOString()).date, time: defaultTime ?? "18:00" };
  // Statuts proposés : seulement les suites logiques du statut actuel (contrôlées aussi côté serveur)
  const now = Date.now();
  const options = session
    ? allowedStatuses(session.status, { isCoach: session.coach_id === selfId, started: new Date(session.starts_at).getTime() <= now, reached: timeReached(session, now) })
    : null;
  const label = (st: SessionStatus | "a_venir") => (st === "a_venir" ? "À reprogrammer (à venir)" : SESSION_LABEL[st]);
  return (
    <ActionForm action={saveSessionPlanningAction}>
      {session && <input type="hidden" name="id" value={session.id} />}
      <Card className="p-5 sm:p-7">
        <SectionTitle icon={<CalendarDays className="size-4" />}>Planning</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client *" className="sm:col-span-2">
            <ClientPicker clients={clients} defaultValue={session?.client_id ?? defaultClient} />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Date et heure *</span>
            <SlotCalendar defaultDate={when.date} defaultTime={when.time} coachId={coaches && coaches.length > 0 ? undefined : (session?.coach_id ?? selfId)} excludeId={session?.id} />
          </div>
          <Field label="Durée (min)">
            <Input name="duration_min" inputMode="numeric" defaultValue={session?.duration_min ?? 60} />
          </Field>
          <Field label="Type de séance">
            <TypePicker types={types ?? SESSION_TYPES} defaultValue={session?.type} prices={prices} />
          </Field>
          <Field label="Prix (DH)" hint="Prix indicatif de la séance, pré-rempli selon le type (information seulement).">
            <PriceInput defaultValue={session ? (session.price_mad ?? null) : null} />
          </Field>
          {coaches && coaches.length > 0 && (
            <Field label="Coach" hint="Si ce n'est pas toi, la séance lui est envoyée pour confirmation (créneau vérifié).">
              <Select name="coach_id" defaultValue={session?.coach_id ?? defaultCoach ?? ""}>
                {!session && <option value="">Coach habituel du client</option>}
                {coaches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label="Statut"
            hint={
              session
                ? "Seules les suites logiques sont proposées : « Terminée » une fois l'heure passée, « Absent » dès 30 min avant, « Acceptée » par le coach lui-même."
                : "« À venir » : le créneau du coach est vérifié (disponibilités, congés, cours collectifs, autres séances)."
            }
          >
            <Select name="status" defaultValue={session ? session.status : "a_venir"}>
              {options ? (
                options.map((st) => (
                  <option key={st} value={st}>
                    {label(st)}
                  </option>
                ))
              ) : (
                <>
                  <option value="a_venir">À venir</option>
                  <option value="realisee">Déjà réalisée</option>
                  <option value="absent">Absent</option>
                  <option value="annulee">Annulée</option>
                </>
              )}
            </Select>
          </Field>
        </div>

        <SectionTitle icon={<Dumbbell className="size-4" />}>Exercices</SectionTitle>
        <ExerciseRows
          initial={exercises?.map((e) => ({ name: e.name, sets: e.sets?.toString() ?? "", reps: e.reps ?? "", load: e.load_kg?.toString() ?? "", rpe: e.rpe?.toString() ?? "" }))}
        />

        <SectionTitle icon={<NotebookPen className="size-4" />}>Bilan de la séance</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Field label="RPE global (1-10)">
            <Input name="rpe" inputMode="numeric" defaultValue={session?.rpe ?? ""} placeholder="7" />
          </Field>
          <Field label="Notes du coach">
            <Textarea name="notes" defaultValue={session?.notes ?? ""} placeholder="Ressenti, technique, points à travailler…" />
          </Field>
        </div>
      </Card>
      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
        <LinkButton href={session ? `/seances/${session.id}` : "/seances"} variant="secondary">
          Annuler
        </LinkButton>
        <SubmitButton>{session ? "Enregistrer" : "Créer la séance"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
