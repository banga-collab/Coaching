"use client";

import { useMemo, useState } from "react";
import { CalendarRange, CreditCard, Dumbbell, Receipt, RefreshCw, Wallet } from "lucide-react";
import type { Package } from "@/lib/types";
import { addDaysKey, diffDays, frDay } from "@/lib/memberships";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Input, Select } from "@/components/ui";
import { createMembershipAction } from "@/actions/memberships";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function MembershipForm({
  clients,
  packages,
  defaultClient,
  today,
  back,
}: {
  clients: { id: string; full_name: string }[];
  packages: Package[];
  defaultClient?: string;
  today: string;
  back?: string;
}) {
  const first = packages.find((p) => p.duration_days) ?? null;
  const [pkgId, setPkgId] = useState(first?.id ?? "");
  const [name, setName] = useState(first?.name ?? "");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDaysKey(today, first?.duration_days ?? 30));
  const [sessions, setSessions] = useState(first?.sessions_count ? String(first.sessions_count) : "");
  const [price, setPrice] = useState(first ? String(first.price_mad) : "");

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  const duration = valid ? diffDays(start, end) : 0;

  function pickPackage(id: string) {
    setPkgId(id);
    const p = packages.find((x) => x.id === id);
    if (!p) return;
    setName(p.name);
    setSessions(p.sessions_count ? String(p.sessions_count) : "");
    setPrice(String(p.price_mad));
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) setEnd(addDaysKey(start, p.duration_days ?? 30));
  }

  function changeStart(v: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && duration > 0) setEnd(addDaysKey(v, duration));
    setStart(v);
  }

  const perMonth = useMemo(() => {
    const p = Number(price.replace(",", "."));
    if (!p || duration <= 0) return null;
    return (p * 30) / Math.max(30, duration);
  }, [price, duration]);

  return (
    <ActionForm action={createMembershipAction} className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
      {back && <input type="hidden" name="back" value={back} />}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" className="sm:col-span-2">
            <Select name="client_id" defaultValue={defaultClient ?? ""} required>
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

          <Field label="Formule" hint="Pré-remplit la durée, les séances et le prix." className="sm:col-span-2">
            <Select name="package_id" value={pkgId} onChange={(e) => pickPackage(e.target.value)}>
              <option value="">Formule personnalisée</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {nf.format(p.price_mad)} MAD
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nom affiché sur la carte" className="sm:col-span-2">
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ex. Abonnement mensuel salle" />
          </Field>

          <Field label="Début">
            <Input type="date" name="start_date" value={start} onChange={(e) => changeStart(e.target.value)} required />
          </Field>
          <Field label="Fin" hint={duration > 0 ? `${duration} jours` : "Doit être après le début"}>
            <Input type="date" name="end_date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </Field>

          <Field label="Séances incluses" hint="Laisser vide pour un accès illimité">
            <Input name="sessions_total" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value.replace(/[^\d]/g, ""))} placeholder="Illimité" />
          </Field>
          <Field label="Prix (MAD)">
            <Input name="price_mad" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </Field>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition hover:border-brand-200 hover:bg-brand-50/40 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60">
            <input type="checkbox" name="with_invoice" className="mt-0.5 size-4 accent-brand-500" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Receipt className="size-4 text-brand-500" /> Créer la facture
              </span>
              <span className="block text-xs text-muted">Numéro MU-année-NNNN, échéance à 7 jours</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition hover:border-brand-200 hover:bg-brand-50/40 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60">
            <input type="checkbox" name="auto_renew" className="mt-0.5 size-4 accent-brand-500" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <RefreshCw className="size-4 text-brand-500" /> Renouvellement auto
              </span>
              <span className="block text-xs text-muted">À titre indicatif pour l&apos;équipe</span>
            </span>
          </label>
        </div>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-5 text-white shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-10 size-28 rounded-full bg-accent-500/30" />
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            <CreditCard className="size-3.5" /> Aperçu
          </p>
          <p className="mt-2 font-display text-lg font-extrabold leading-tight">{name || "Nouvelle formule"}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-center gap-2.5">
              <CalendarRange className="size-4 text-white/70" />
              {valid && duration > 0 ? (
                <span>
                  {frDay(start, { day: "numeric", month: "short" })} → {frDay(end, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              ) : (
                <span className="text-white/70">Dates à compléter</span>
              )}
            </li>
            <li className="flex items-center gap-2.5">
              <Dumbbell className="size-4 text-white/70" />
              {sessions ? `${sessions} séances` : "Accès illimité"}
            </li>
            <li className="flex items-center gap-2.5">
              <Wallet className="size-4 text-white/70" />
              {price ? `${nf.format(Number(price.replace(",", ".")) || 0)} MAD` : "Prix non renseigné"}
              {perMonth !== null && duration > 31 && <span className="text-white/70">· ≈ {nf.format(Math.round(perMonth))} MAD/mois</span>}
            </li>
          </ul>
        </div>
        <div className="sticky bottom-20 z-10 lg:static">
          <SubmitButton className="h-12 w-full text-[15px] shadow-pop">Créer l&apos;abonnement</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
