"use client";

import Link from "next/link";
import type { Package } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Textarea, buttonClass } from "@/components/ui";
import { savePackageAction } from "@/actions/business";

export function PackageForm({ pkg }: { pkg?: Package | null }) {
  return (
    <ActionForm action={savePackageAction} className="space-y-4 px-5 pb-5">
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <Field label="Nom de la formule *">
        <Input name="name" defaultValue={pkg?.name ?? ""} placeholder="Ex. Coaching 8 séances" required />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={pkg?.description ?? ""} placeholder="Ce qui est inclus…" className="min-h-[72px]" />
      </Field>
      <Field label="Prix (MAD) *">
        <Input name="price_mad" inputMode="decimal" defaultValue={pkg ? String(pkg.price_mad) : ""} placeholder="1200" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Séances" hint="Vide = illimité">
          <Input name="sessions_count" inputMode="numeric" defaultValue={pkg?.sessions_count ?? ""} placeholder="8" />
        </Field>
        <Field label="Durée (jours)" hint="Vide = sans limite">
          <Input name="duration_days" inputMode="numeric" defaultValue={pkg?.duration_days ?? ""} placeholder="30" />
        </Field>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-ink">Formule active</span>
          <span className="block text-xs text-muted">Proposée lors de la création de factures</span>
        </span>
        <input type="checkbox" name="active" defaultChecked={pkg ? pkg.active : true} className="peer sr-only" />
        <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-brand-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
      </label>
      <div className="flex gap-2 pt-1">
        {pkg && (
          <Link href="/facturation/formules" className={buttonClass("secondary", "flex-1")}>
            Annuler
          </Link>
        )}
        <SubmitButton variant="brand" className="flex-1">
          {pkg ? "Enregistrer" : "Ajouter la formule"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
