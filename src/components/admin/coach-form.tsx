"use client";

import { useActionState, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createCoachAction, updateCoachAction, type AdminFormState } from "@/actions/admin";

export type CoachOption = { id: string; label: string };

/**
 * Formulaire coach : création (sans `coach`) ou modification (avec `coach`).
 * - `handover` : ce que le coach suit encore (clients actifs, séances à venir) + coachs actifs vers qui
 *   transférer ; le choix « Transférer à » apparaît quand on le repasse adhérent.
 * - `linkedFile` : nom du dossier client relié à ce compte (adhérent promu → dossier délié).
 */
export function CoachForm({
  coach,
  demo,
  canInvite,
  isSelf,
  handover,
  linkedFile,
}: {
  coach?: Profile;
  demo?: boolean;
  canInvite?: boolean;
  isSelf?: boolean;
  handover?: { summary: string; coaches: CoachOption[] };
  linkedFile?: string | null;
}) {
  const edit = !!coach;
  const [state, action] = useActionState<AdminFormState, FormData>(edit ? updateCoachAction : createCoachAction, undefined);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<string>(coach?.role ?? "coach");
  const leaving = edit && coach.role !== "client" && role === "client";
  const joining = edit && coach.role === "client" && role !== "client";

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.ok}
          </p>
          {state.secret && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(state.secret!).then(() => setCopied(true))}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-semibold text-ink ring-1 ring-emerald-200"
            >
              {state.secret} <Copy className="size-3.5" /> {copied ? "copié" : ""}
            </button>
          )}
        </div>
      )}

      {edit && <input type="hidden" name="id" value={coach.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet">
          <Input name="full_name" required defaultValue={coach?.full_name ?? ""} placeholder="Ex. Anas Ouazzani" />
        </Field>
        <Field label="E-mail" hint={edit ? "L'e-mail de connexion ne se modifie pas ici." : undefined}>
          <Input name="email" type="email" required={!edit} disabled={edit} defaultValue={coach?.email ?? ""} placeholder="prenom@moovup.ma" />
        </Field>
        <Field label="Téléphone">
          <Input name="phone" type="tel" defaultValue={coach?.phone ?? ""} placeholder="06 00 00 00 00" />
        </Field>
        <Field label="Rôle" hint={isSelf ? "Tu ne peux pas retirer ton propre rôle admin." : undefined}>
          {isSelf ? (
            <>
              <input type="hidden" name="role" value={coach?.role} />
              <Select disabled defaultValue={coach?.role}>
                <option value="admin">Admin</option>
              </Select>
            </>
          ) : (
            <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="coach">Coach</option>
              <option value="head_coach">Head coach (planning de l&apos;équipe)</option>
              {edit && <option value="admin">Admin (accès complet + espace admin)</option>}
              {edit && <option value="client">Retirer de l&apos;équipe (adhérent)</option>}
            </Select>
          )}
        </Field>
        <Field label="Espace" hint="Moov'Up Lady : coachs femmes, clientes femmes uniquement, suivi dans Contrôle à distance.">
          <Select name="espace" defaultValue={coach?.espace ?? "mixte"}>
            <option value="mixte">Moov&apos;Up (mixte)</option>
            <option value="lady">Moov&apos;Up Lady (100 % femmes)</option>
          </Select>
        </Field>
        <Field label="Spécialités" hint="Séparées par des virgules">
          <Input name="specialties" defaultValue={(coach?.specialties ?? []).join(", ")} placeholder="Musculation, Mobilité, Boxe" />
        </Field>
      </div>

      {leaving && handover?.summary && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Ce coach suit encore <b>{handover.summary}</b>. Choisis à qui les transférer : les clients changent de coach référent et
              les séances repartent « à confirmer » chez le nouveau coach (notifié).
            </span>
          </p>
          <Field label="Transférer à" className="mt-3">
            <Select name="transfer_to" required defaultValue="">
              <option value="" disabled>
                Choisir un coach actif…
              </option>
              {handover.coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {joining && linkedFile && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Ce compte est relié au dossier client <b>{linkedFile}</b>. En le passant dans l&apos;équipe, ce dossier sera délié : l&apos;historique est
            conservé, mais le compte n&apos;aura plus accès à l&apos;espace adhérent.
          </span>
        </p>
      )}

      {!edit && !demo && canInvite && (
        <fieldset className="rounded-xl border border-line p-3 text-sm">
          <legend className="px-1 text-xs font-semibold text-slate-600">Compte de connexion</legend>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" name="mode" value="invite" defaultChecked /> Envoyer une invitation par e-mail
          </label>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" name="mode" value="password" /> Créer avec un mot de passe provisoire (affiché ici)
          </label>
        </fieldset>
      )}
      {!edit && demo && <p className="text-xs text-muted">Mode démo : le coach est ajouté à l&apos;équipe sans compte de connexion.</p>}
      {!edit && !demo && !canInvite && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY n&apos;est pas configurée : seul un compte déjà inscrit (même e-mail) peut être promu coach. Pour créer ou inviter un nouveau compte, ajoute la clé service-role sur le serveur.
        </p>
      )}

      <SubmitButton variant="brand" className="w-full sm:w-auto">
        {edit ? "Enregistrer" : "Ajouter le coach"}
      </SubmitButton>
    </form>
  );
}
