/** Saisie manuelle rapide : sommeil, pas, FC au repos (+ poids). */
import { PenLine } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { addManualHealthAction } from "@/actions/health-data";

export function ManualHealthForm({
  clientId,
  back,
  today,
  title = "Saisie rapide",
  subtitle = "Sans montre ? Note ta nuit et ta journée en 10 secondes.",
}: {
  clientId: string;
  back: string;
  today: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={<PenLine className="size-4" />} />
      <ActionForm action={addManualHealthAction} className="px-5 pb-5">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="back" value={back} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] [&>*]:min-w-0">
          <Field label="Date">
            <Input name="day" type="date" defaultValue={today} max={today} required />
          </Field>
          <Field label="Sommeil" hint="ex. 7h30">
            <Input name="sleep" inputMode="text" placeholder="7h30" autoComplete="off" />
          </Field>
          <Field label="Pas">
            <Input name="steps" inputMode="numeric" placeholder="8500" autoComplete="off" />
          </Field>
          <Field label="FC au repos" hint="bpm, au réveil">
            <Input name="hr_resting" inputMode="numeric" placeholder="62" autoComplete="off" />
          </Field>
          <Field label="Poids (kg)" hint="facultatif">
            <Input name="weight" inputMode="decimal" placeholder="78,5" autoComplete="off" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
