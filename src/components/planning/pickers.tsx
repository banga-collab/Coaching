"use client";

import { useState } from "react";
import { UserPlus, Plus } from "lucide-react";
import { Input, Select } from "@/components/ui";

const NEW = "__new__";

/**
 * Liste déroulante des clients avec « + Nouveau client… » :
 * les champs du nouveau client s'affichent sous la liste et sont créés à l'enregistrement de la séance.
 */
export function ClientPicker({
  clients,
  defaultValue,
  suffix,
}: {
  clients: { id: string; full_name: string; coach_id?: string }[];
  defaultValue?: string;
  /** Texte ajouté après le nom (ex. prénom du coach) */
  suffix?: Record<string, string>;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const isNew = value === NEW;
  return (
    <div className="space-y-2">
      <Select name="client_id" required value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="" disabled>
          Choisir un client…
        </option>
        <option value={NEW}>＋ Nouveau client…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
            {suffix?.[c.id] ? ` · ${suffix[c.id]}` : ""}
          </option>
        ))}
      </Select>
      {/* Toujours dans le DOM (masqué) pour garder la saisie si l'envoi échoue */}
      <div className={isNew ? "grid gap-2 rounded-xl border border-accent-200 bg-accent-50/60 p-3 sm:grid-cols-2" : "hidden"}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-700 sm:col-span-2">
          <UserPlus className="size-3.5" /> Nouveau client : sa fiche sera créée avec la séance
        </p>
        <Input name="new_client_name" placeholder="Nom et prénom *" autoComplete="off" className="sm:col-span-2" />
        <Input name="new_client_phone" placeholder="Téléphone" inputMode="tel" autoComplete="off" />
        <Input name="new_client_email" placeholder="E-mail" type="email" autoComplete="off" />
        <Input name="new_client_goal" placeholder="Objectif (ex. perte de poids)" autoComplete="off" className="sm:col-span-2" />
      </div>
    </div>
  );
}

/**
 * Liste déroulante des types de séance avec « + Nouveau type… » (ajouté à la liste pour les prochaines fois).
 * Avec `prices` : choisir un type pré-remplit le champ « price_mad » du formulaire avec son prix indicatif.
 */
export function TypePicker({ types, defaultValue, prices }: { types: string[]; defaultValue?: string | null; prices?: Record<string, number> }) {
  const list = defaultValue && !types.includes(defaultValue) ? [defaultValue, ...types] : types;
  const [value, setValue] = useState(defaultValue ?? "");
  const isNew = value === NEW;
  const onPick = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setValue(v);
    const price = prices?.[v];
    const input = e.target.form?.querySelector<HTMLInputElement>('input[name="price_mad"]');
    if (input && price !== undefined) input.value = String(price);
  };
  return (
    <div className="space-y-2">
      <Select name="type" value={value} onChange={onPick}>
        <option value="">Choisir un type…</option>
        {list.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value={NEW}>＋ Nouveau type…</option>
      </Select>
      <div className={isNew ? "flex items-center gap-2" : "hidden"}>
        <Plus className="size-4 shrink-0 text-accent-500" />
        <Input name="new_type" placeholder="Nom du nouveau type (ex. Boxe, Pilates…)" autoComplete="off" />
      </div>
    </div>
  );
}

/** Champ « Prix (DH) » : prix indicatif de la séance (information seulement, aucun paiement) */
export function PriceInput({ defaultValue }: { defaultValue?: number | null }) {
  return (
    <div className="relative">
      <Input name="price_mad" inputMode="decimal" defaultValue={defaultValue ?? ""} placeholder="Ex. 300" autoComplete="off" className="pe-10" />
      <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-xs font-semibold text-muted">DH</span>
    </div>
  );
}
