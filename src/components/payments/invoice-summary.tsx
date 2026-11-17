import { Receipt } from "lucide-react";
import type { Client, Invoice } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Card } from "@/components/ui";
import { mad } from "@/components/business/format";

/** Récapitulatif compact d'une facture (pages de paiement). */
export function InvoiceSummary({ invoice, client, brand }: { invoice: Invoice; client: Client | null; brand: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-brand-500 to-accent-500" />
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
            <Receipt className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{brand}</p>
            <p className="truncate font-mono text-sm font-semibold text-ink">Facture {invoice.number}</p>
            {client && <p className="truncate text-xs text-muted">{client.full_name}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">À payer</p>
          <p className="font-display text-2xl font-extrabold tracking-tight text-brand-600 tabular-nums">{mad(invoice.amount_mad)}</p>
        </div>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {invoice.lines.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{l.label}</span>
              <span className="text-xs text-muted">
                {l.qty} × {mad(l.unit_price)}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{mad(Number(l.qty) * Number(l.unit_price))}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/60 px-5 py-3 text-xs text-muted">
        <span>Émise le {fmtDate(invoice.issued_on, { day: "numeric", month: "long", year: "numeric" })}</span>
        {invoice.due_on && <span>Échéance {fmtDate(invoice.due_on, { day: "numeric", month: "short" })}</span>}
      </div>
    </Card>
  );
}
