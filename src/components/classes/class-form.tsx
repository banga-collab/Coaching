import { CalendarPlus, Save } from "lucide-react";
import type { GroupClass, Profile } from "@/lib/types";
import { isoToAgadir } from "@/lib/utils";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { saveClassAction } from "@/actions/classes";
import { CATEGORY_NAMES, LEVELS, ROOMS, cat } from "./categories";
import { RepeatField } from "./repeat-field";

export function ClassForm({ coaches, initial, defaultDate, meId }: { coaches: Profile[]; initial?: GroupClass; defaultDate: string; meId: string }) {
  const at = initial ? isoToAgadir(initial.starts_at) : { date: defaultDate, time: "18:00" };
  return (
    <ActionForm action={saveClassAction}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre du cours" className="sm:col-span-2">
              <Input name="title" required defaultValue={initial?.title} placeholder="Ex. CrossFit WOD, Yoga Flow…" />
            </Field>
            <Field label="Catégorie">
              <Select name="category" defaultValue={initial?.category ?? "HIIT"}>
                {CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {cat(c).emoji} {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Coach">
              <Select name="coach_id" defaultValue={initial?.coach_id ?? meId}>
                <option value="">— Non attribué —</option>
                {coaches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" name="date" required defaultValue={at.date} />
            </Field>
            <Field label="Heure de début">
              <Input type="time" name="time" required defaultValue={at.time} step={300} />
            </Field>
            <Field label="Durée (minutes)">
              <Input type="number" name="duration_min" min={10} max={240} step={5} required defaultValue={initial?.duration_min ?? 45} />
            </Field>
            <Field label="Nombre de places">
              <Input type="number" name="capacity" min={1} max={200} required defaultValue={initial?.capacity ?? 14} />
            </Field>
            <Field label="Salle">
              <Input name="room" list="rooms" defaultValue={initial?.room ?? ""} placeholder="Studio 1" />
              <datalist id="rooms">
                {ROOMS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <Field label="Niveau">
              <Select name="level" defaultValue={initial?.level ?? "Tous niveaux"}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2" hint="Visible par les adhérents au moment de réserver.">
              <Textarea name="description" defaultValue={initial?.description ?? ""} placeholder="Déroulé, matériel à prévoir, intensité…" />
            </Field>
          </div>
        </Card>
        <div className="space-y-4">
          {!initial && <RepeatField />}
          <div className="sticky bottom-20 z-10 lg:bottom-4">
            <SubmitButton className="h-12 w-full shadow-pop">
              {initial ? <Save className="size-4" /> : <CalendarPlus className="size-4" />}
              {initial ? "Enregistrer les modifications" : "Créer le cours"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
