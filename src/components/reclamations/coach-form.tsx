"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarX2, CheckCircle2, CircleHelp, FileText, Loader2, User, Users, Wrench } from "lucide-react";
import { createCoachReclamationAction, type CoachReclamationState } from "@/actions/reclamations";
import { CATEGORY_LABEL, COACH_CATEGORIES, COACH_CATEGORY_HINT } from "@/lib/reclamations";
import { cn } from "@/lib/utils";
import { Card, Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { ImageInput } from "@/components/image-input";

type Cat = (typeof COACH_CATEGORIES)[number];
const ICON: Record<Cat, typeof Wrench> = { client: User, planning: CalendarX2, materiel: Wrench, equipe: Users, administratif: FileText, autre: CircleHelp };

/** Formulaire « Nouvelle réclamation » d'un coach à la direction */
export function CoachReclamationForm({ clients, defaultClient }: { clients: { id: string; full_name: string }[]; defaultClient?: string }) {
  const [state, action, pending] = useActionState<CoachReclamationState, FormData>(createCoachReclamationAction, undefined);
  const [cat, setCat] = useState<Cat | "">(defaultClient ? "client" : "");

  if (state?.ok) {
    return (
      <Card className="p-8 text-center animate-fade-up">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h2 className="mt-4 font-display text-xl font-extrabold text-ink">Réclamation envoyée</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">La direction est prévenue. Vous recevrez une notification dès qu&apos;elle vous répond.</p>
        <Link href="/reclamations?source=coach" className={buttonClass("primary", "mt-6")}>
          Voir mes réclamations
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-7">
      <form action={action} className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-600">Sujet</legend>
          <input type="hidden" name="category" value={cat} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COACH_CATEGORIES.map((c) => {
              const I = ICON[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={cat === c}
                  className={cn(
                    "flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition",
                    cat === c ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-50" : "border-line bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  <I className="size-6" />
                  <span className="text-sm font-semibold">{CATEGORY_LABEL[c]}</span>
                  <span className="text-[11px] leading-tight text-muted">{COACH_CATEGORY_HINT[c]}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client concerné (facultatif)">
            <Select name="client_id" defaultValue={defaultClient ?? ""}>
              <option value="">— Aucun —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lieu ou séance (facultatif)">
            <Input name="location" maxLength={120} placeholder="Ex. : salle cardio, séance de mardi 18 h" />
          </Field>
        </div>

        <Field label="Que se passe-t-il ?">
          <Textarea name="description" required minLength={5} maxLength={2000} rows={5} placeholder="Décrivez le problème et ce que vous attendez de la direction." />
        </Field>

        <ImageInput name="photo" label="Photo (facultatif)" hint="Une photo aide à comprendre (machine, lieu…)." removeLabel="Retirer la photo" />

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-canvas/60 p-4 text-sm">
          <input type="checkbox" name="urgent" className="mt-0.5 size-5 accent-red-600" />
          <span>
            <b className="text-ink">Urgent</b>
            <span className="block text-muted">À traiter aujourd&apos;hui (sécurité, client en difficulté, séance bloquée…).</span>
          </span>
        </label>

        {state?.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending || !cat} className={buttonClass("primary", "h-12 w-full text-[15px]")}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Envoyer à la direction
        </button>
        <p className="text-center text-xs text-muted">Visible uniquement par vous et la direction (admin, head coach).</p>
      </form>
    </Card>
  );
}
