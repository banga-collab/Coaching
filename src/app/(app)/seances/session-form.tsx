import { CalendarDays, Dumbbell, NotebookPen } from "lucide-react";
import type { Client, Session, SessionExercise } from "@/lib/types";
import { SESSION_TYPES, isoToAgadir } from "@/lib/utils";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, LinkButton, SectionTitle, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ExerciseRows } from "@/components/exercise-rows";
import { saveSessionAction } from "../actions";

const agadir = isoToAgadir;

export function SessionForm({ clients, session, exercises, defaultClient, defaultDate }: { clients: Pick<Client, "id" | "full_name">[]; session?: Session; exercises?: SessionExercise[]; defaultClient?: string; defaultDate?: string }) {
  const when = session ? agadir(session.starts_at) : { date: defaultDate ?? new Date().toISOString().slice(0, 10), time: "18:00" };
  return (
    <ActionForm action={saveSessionAction}>
      {session && <input type="hidden" name="id" value={session.id} />}
      <Card className="p-5 sm:p-7">
        <SectionTitle icon={<CalendarDays className="size-4" />}>Planning</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client *" className="sm:col-span-2">
            <Select name="client_id" required defaultValue={session?.client_id ?? defaultClient ?? ""}>
              <option value="" disabled>
                Choisir un client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date *">
            <Input name="date" type="date" required defaultValue={when.date} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Heure">
              <Input name="time" type="time" defaultValue={when.time} />
            </Field>
            <Field label="Durée (min)">
              <Input name="duration_min" inputMode="numeric" defaultValue={session?.duration_min ?? 60} />
            </Field>
          </div>
          <Field label="Type de séance">
            <Input name="type" list="types" defaultValue={session?.type ?? ""} placeholder="Choisir ou écrire…" />
            <datalist id="types">
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Statut">
            <Select name="status" defaultValue={session?.status ?? "planifiee"}>
              <option value="planifiee">Planifiée</option>
              <option value="realisee">Réalisée</option>
              <option value="absent">Absent</option>
              <option value="annulee">Annulée</option>
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
