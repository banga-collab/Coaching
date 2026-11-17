import { Contact, Target, UserRound } from "lucide-react";
import type { Client, Profile } from "@/lib/types";
import { ActionForm, type FormState } from "@/components/action-form";
import { Card, Field, Input, LinkButton, SectionTitle, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const GOALS = ["Perte de poids", "Prise de masse", "Tonification", "Remise en forme", "Performance sportive", "Santé & mobilité", "Rééducation / reprise", "Préparation compétition"];

export function ClientForm({
  action,
  client,
  coaches,
  meId,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  client?: Client;
  coaches?: Pick<Profile, "id" | "full_name" | "email">[];
  meId: string;
}) {
  const c = client;
  return (
    <ActionForm action={action}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Card className="p-5 sm:p-7">
        <SectionTitle icon={<UserRound className="size-4" />}>Identité</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet *" className="sm:col-span-2">
            <Input name="full_name" required defaultValue={c?.full_name} placeholder="Prénom Nom" autoFocus={!c} />
          </Field>
          <Field label="Date de naissance">
            <Input name="birth_date" type="date" defaultValue={c?.birth_date ?? ""} />
          </Field>
          <Field label="Sexe">
            <Select name="sex" defaultValue={c?.sex ?? ""}>
              <option value="">—</option>
              <option value="H">Homme</option>
              <option value="F">Femme</option>
            </Select>
          </Field>
          <Field label="Taille (cm)">
            <Input name="height_cm" inputMode="decimal" defaultValue={c?.height_cm ?? ""} placeholder="175" />
          </Field>
          <Field label="Date de début">
            <Input name="start_date" type="date" defaultValue={c?.start_date ?? new Date().toISOString().slice(0, 10)} />
          </Field>
        </div>

        <SectionTitle icon={<Contact className="size-4" />}>Contact</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" hint="Le client pourra créer son compte avec cet e-mail pour voir sa progression.">
            <Input name="email" type="email" defaultValue={c?.email ?? ""} placeholder="client@exemple.com" />
          </Field>
          <Field label="Téléphone">
            <Input name="phone" type="tel" defaultValue={c?.phone ?? ""} placeholder="06 00 00 00 00" />
          </Field>
        </div>

        <SectionTitle icon={<Target className="size-4" />}>Suivi</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Objectif principal">
            <Input name="goal" list="goals" defaultValue={c?.goal ?? ""} placeholder="Choisir ou écrire…" />
            <datalist id="goals">
              {GOALS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="Fréquence">
            <Select name="frequency" defaultValue={c?.frequency ?? "2x/semaine"}>
              {["1x/semaine", "2x/semaine", "3x/semaine", "4x/semaine", "5x/semaine", "Ponctuel"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          </Field>
          <Field label="Statut">
            <Select name="status" defaultValue={c?.status ?? "actif"}>
              <option value="actif">Actif</option>
              <option value="pause">En pause</option>
              <option value="termine">Terminé</option>
            </Select>
          </Field>
          {coaches && coaches.length > 0 && (
            <Field label="Coach référent">
              <Select name="coach_id" defaultValue={c?.coach_id ?? meId}>
                {coaches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={c?.notes ?? ""} placeholder="Contexte, préférences, disponibilités…" />
          </Field>
        </div>
      </Card>
      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
        <LinkButton href={c ? `/clients/${c.id}` : "/clients"} variant="secondary">
          Annuler
        </LinkButton>
        <SubmitButton>{c ? "Enregistrer" : "Créer le client"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
