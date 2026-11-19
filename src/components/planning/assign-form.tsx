import { CalendarPlus } from "lucide-react";
import type { StaffMember } from "@/lib/planning";
import { staffName } from "@/lib/planning";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { assignSessionAction } from "@/actions/planning";
import { PlanForm } from "./plan-form";
import { ClientPicker, PriceInput, TypePicker } from "./pickers";
import { SlotCalendar } from "./slot-calendar";

/** Formulaire « Affecter une séance » du planning (head coach / admin) */
export function AssignForm({
  clients,
  staff,
  defaults,
  types,
  prices,
}: {
  clients: { id: string; full_name: string; coach_id: string }[];
  staff: StaffMember[];
  defaults: { client?: string; coach?: string; date: string; time?: string };
  /** Types de séance (liste gérée) */
  types: string[];
  /** Prix indicatif par défaut de chaque type (DH) */
  prices?: Record<string, number>;
}) {
  const coachName = new Map(staff.map((p) => [p.id, staffName(p)]));
  return (
    <Card id="affecter" className="scroll-mt-20 p-5">
      <p className="mb-1 flex items-center gap-2 font-display font-bold">
        <CalendarPlus className="size-4 text-accent-500" /> Affecter une séance
      </p>
      <p className="mb-4 text-xs text-muted">Le créneau est vérifié (disponibilités, congés, cours collectifs, autres séances). Le coach reçoit une notification et doit confirmer.</p>
      <PlanForm action={assignSessionAction} className="space-y-3">
        <Field label="Client *">
          <ClientPicker
            clients={clients}
            defaultValue={defaults.client}
            suffix={Object.fromEntries(clients.filter((c) => coachName.get(c.coach_id)).map((c) => [c.id, coachName.get(c.coach_id)!.split(" ")[0]!]))}
          />
        </Field>
        <Field label="Coach *">
          <Select name="coach_id" required defaultValue={defaults.coach ?? ""}>
            <option value="" disabled>
              Choisir un coach…
            </option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {staffName(p)}
                {p.role === "head_coach" ? " (head coach)" : p.role === "admin" ? " (admin)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Durée (min)">
            <Input name="duration_min" inputMode="numeric" defaultValue={60} />
          </Field>
          <Field label="Type">
            <TypePicker types={types} prices={prices} />
          </Field>
        </div>
        <Field label="Prix (DH)" hint="Prix indicatif, pré-rempli selon le type (information seulement).">
          <PriceInput />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Date et heure *</span>
          <SlotCalendar defaultDate={defaults.date} defaultTime={defaults.time} />
        </div>
        <Field label="Note pour le coach">
          <Textarea name="notes" className="min-h-[60px]" placeholder="Objectif de la séance, matériel…" />
        </Field>
        <SubmitButton className="w-full" pendingText="Vérification…">
          Affecter la séance
        </SubmitButton>
      </PlanForm>
    </Card>
  );
}
