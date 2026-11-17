"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileCheck2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { InvoiceLine, Package } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { createInvoiceAction } from "@/actions/business";

type ClientOpt = { id: string; full_name: string };
type Line = { key: number; label: string; qty: string; unit_price: string };

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const toNum = (s: string) => {
  const n = Number(String(s).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
};
let seq = 1;
const mk = (l?: Partial<InvoiceLine>): Line => ({ key: seq++, label: l?.label ?? "", qty: String(l?.qty ?? 1), unit_price: l?.unit_price !== undefined ? String(l.unit_price) : "" });

function Buttons() {
  const { pending, data } = useFormStatus();
  const which = data?.get("status");
  return (
    <div className="flex flex-col-reverse gap-2">
      <button type="submit" name="status" value="brouillon" disabled={pending} className={buttonClass("secondary")}>
        {pending && which === "brouillon" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Enregistrer en brouillon
      </button>
      <button type="submit" name="status" value="envoyee" disabled={pending} className={buttonClass("primary")}>
        {pending && which === "envoyee" ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Émettre la facture
      </button>
    </div>
  );
}

export function InvoiceForm({
  clients,
  packages,
  defaultClient,
  today,
  defaultDue,
}: {
  clients: ClientOpt[];
  packages: Package[];
  defaultClient?: string;
  today: string;
  defaultDue: string;
}) {
  const [pkgId, setPkgId] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [mk()]);
  const total = useMemo(() => lines.reduce((s, l) => s + toNum(l.qty) * toNum(l.unit_price), 0), [lines]);

  const payload = JSON.stringify(lines.map((l) => ({ label: l.label.trim(), qty: toNum(l.qty), unit_price: toNum(l.unit_price) })));

  function pickPackage(id: string) {
    setPkgId(id);
    const p = packages.find((x) => x.id === id);
    if (!p) return;
    const line = mk({ label: p.name, qty: 1, unit_price: Number(p.price_mad) });
    setLines((ls) => {
      const rest = ls.filter((l, i) => !(i === 0 || (!l.label.trim() && !l.unit_price)));
      return [line, ...rest];
    });
  }
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <ActionForm action={createInvoiceAction} className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
      <input type="hidden" name="lines" value={payload} />
      <input type="hidden" name="package_id" value={pkgId} />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Client & formule" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Client *">
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
            <Field label="Formule" hint="Pré-remplit la première ligne">
              <Select value={pkgId} onChange={(e) => pickPackage(e.target.value)}>
                <option value="">Aucune (lignes libres)</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {nf.format(Number(p.price_mad))} MAD
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Lignes"
            subtitle="Libellé, quantité et prix unitaire"
            action={
              <button type="button" onClick={() => setLines((ls) => [...ls, mk()])} className={buttonClass("ghost", "h-9 px-3 text-brand-600")}>
                <Plus className="size-4" /> Ajouter
              </button>
            }
          />
          <div className="px-5 pb-5">
            <div className="hidden grid-cols-[1fr_80px_120px_110px_36px] gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
              <span>Libellé</span>
              <span>Qté</span>
              <span>Prix unit.</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            <ul className="space-y-3 sm:space-y-2">
              {lines.map((l) => (
                <li key={l.key} className="grid grid-cols-[1fr_1fr_36px] gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_80px_120px_110px_36px] sm:items-center sm:border-0 sm:p-0">
                  <Input
                    aria-label="Libellé"
                    placeholder="Ex. Coaching 8 séances"
                    value={l.label}
                    onChange={(e) => update(l.key, { label: e.target.value })}
                    className="col-span-3 sm:col-span-1"
                  />
                  <Input aria-label="Quantité" inputMode="decimal" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} className="text-center" />
                  <Input aria-label="Prix unitaire (MAD)" inputMode="decimal" placeholder="0" value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} />
                  <span className="col-span-2 self-center text-sm font-semibold tabular-nums text-ink sm:col-span-1 sm:text-right">
                    <span className="mr-1 text-xs font-medium text-muted sm:hidden">Total :</span>
                    {nf.format(toNum(l.qty) * toNum(l.unit_price))} MAD
                  </span>
                  <button
                    type="button"
                    aria-label="Supprimer la ligne"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    className="col-start-3 row-start-2 grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:col-start-auto sm:row-start-auto"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="Notes" subtitle="Visibles sur la facture" />
          <div className="px-5 pb-5">
            <Textarea name="notes" placeholder="Conditions, période couverte, remarque…" />
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader title="Dates" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Date d'émission">
              <Input type="date" name="issued_on" defaultValue={today} required />
            </Field>
            <Field label="Échéance">
              <Input type="date" name="due_on" defaultValue={defaultDue} />
            </Field>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="bg-brand-500 px-5 py-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">Total à payer</p>
            <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
              {nf.format(total)} <span className="text-lg font-bold text-brand-100">MAD</span>
            </p>
            <p className="mt-1 text-xs text-brand-100">
              {lines.length} ligne{lines.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4">
            <Buttons />
          </div>
        </Card>
      </div>
    </ActionForm>
  );
}
