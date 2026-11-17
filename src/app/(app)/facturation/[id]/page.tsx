import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CheckCircle2, MessageCircle, RotateCcw, Send, Wallet } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Client, Invoice } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { waLink, WA_TEMPLATES } from "@/lib/whatsapp";
import { Badge, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { INVOICE_STATE, PAY_METHODS, invoiceState, mad, todayKey } from "@/components/business/format";
import { cancelInvoiceAction, markInvoicePaidAction, markInvoiceSentAction, reopenInvoiceAction } from "@/actions/business";

export const metadata = { title: "Facture" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getProfile();
  const supabase = await createClient();
  const { data: iData } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!iData) notFound();
  const inv = iData as Invoice;
  const [{ data: cData }, settings] = await Promise.all([supabase.from("clients").select("*").eq("id", inv.client_id).maybeSingle(), getSettings()]);
  const client = cData as Client | null;
  const isStaff = me.role !== "client";
  if (!isStaff && (client?.user_id !== me.id || inv.status === "brouillon")) notFound();

  const today = todayKey();
  const state = invoiceState(inv, today);
  const st = INVOICE_STATE[state];
  const first = client?.full_name.split(" ")[0] ?? "";
  const reminder = client && (state === "envoyee" || state === "retard") ? waLink(client.phone, WA_TEMPLATES.invoice(first, inv.number, mad(inv.amount_mad))) : null;
  const logo = settings.logo_url || "/logo.png";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackLink href={isStaff ? "/facturation" : "/moi?tab=factures"} label={isStaff ? "Facturation" : "Mes factures"} />
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Facture {inv.number}</h1>
            <Badge dot tone={st.tone}>
              {st.label}
            </Badge>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className={cn("grid gap-5", isStaff && "lg:grid-cols-[1fr_300px] lg:items-start")}>
        {/* ---------- Facture A4 ---------- */}
        <article className="relative mx-auto [-webkit-print-color-adjust:exact] [print-color-adjust:exact] w-full max-w-[210mm] overflow-hidden rounded-2xl border border-line bg-white shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="h-2 bg-gradient-to-r from-brand-500 via-brand-500 to-accent-500" />
          <div className="p-6 sm:p-10">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt={settings.brand_name} className="size-16 shrink-0 rounded-xl object-contain" />
                <div className="text-sm leading-relaxed text-slate-600">
                  <p className="font-display text-base font-extrabold text-ink">{settings.brand_name}</p>
                  {settings.address && <p>{settings.address}</p>}
                  {settings.phone && <p>Tél. {settings.phone}</p>}
                  {settings.email && <p>{settings.email}</p>}
                  {settings.ice && <p className="text-xs text-slate-500">ICE : {settings.ice}</p>}
                </div>
              </div>
              <div className="sm:text-right">
                <p className="font-display text-3xl font-extrabold uppercase tracking-tight text-brand-500">Facture</p>
                <p className="mt-1 font-mono text-sm font-semibold text-ink">{inv.number}</p>
                <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm sm:justify-end">
                  <dt className="text-slate-500">Date d&apos;émission</dt>
                  <dd className="font-medium text-ink">{fmtDate(inv.issued_on, { day: "2-digit", month: "long", year: "numeric" })}</dd>
                  {inv.due_on && (
                    <>
                      <dt className="text-slate-500">Échéance</dt>
                      <dd className={cn("font-medium", state === "retard" ? "text-red-600" : "text-ink")}>{fmtDate(inv.due_on, { day: "2-digit", month: "long", year: "numeric" })}</dd>
                    </>
                  )}
                </dl>
              </div>
            </header>

            <section className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-canvas/70 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Facturé à</p>
                <p className="mt-1.5 font-display font-bold text-ink">{client?.full_name ?? "Client"}</p>
                <div className="mt-0.5 text-sm leading-relaxed text-slate-600">
                  {client?.phone && <p>{client.phone}</p>}
                  {client?.email && <p>{client.email}</p>}
                </div>
              </div>
              {inv.status === "payee" && (
                <div className="rounded-xl bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Règlement</p>
                  <p className="mt-1.5 font-semibold text-ink">{inv.method ?? "—"}</p>
                  {inv.paid_on && <p className="text-sm text-slate-600">Payée le {fmtDate(inv.paid_on, { day: "2-digit", month: "long", year: "numeric" })}</p>}
                </div>
              )}
            </section>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="border-b-2 border-brand-500 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Désignation</th>
                    <th className="px-3 py-2.5 text-center">Qté</th>
                    <th className="px-3 py-2.5 text-right">Prix unitaire</th>
                    <th className="py-2.5 pl-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inv.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-3 pr-3 font-medium text-ink">{l.label}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-600">{l.qty}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{mad(l.unit_price)}</td>
                      <td className="py-3 pl-3 text-right font-semibold tabular-nums text-ink">{mad(Number(l.qty) * Number(l.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Sous-total</span>
                  <span className="tabular-nums">{mad(inv.amount_mad)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-brand-500 px-4 py-3 text-white">
                  <span className="font-semibold">Total</span>
                  <span className="font-display text-lg font-extrabold tabular-nums">{mad(inv.amount_mad)}</span>
                </div>
              </div>
            </div>

            {inv.notes && (
              <div className="mt-8 rounded-xl border border-line p-4 text-sm text-slate-600">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Notes</p>
                <p className="whitespace-pre-wrap">{inv.notes}</p>
              </div>
            )}

            <footer className="mt-10 border-t border-line pt-5 text-center text-xs leading-relaxed text-slate-500">
              {settings.invoice_footer ? <p className="whitespace-pre-wrap">{settings.invoice_footer}</p> : <p>Merci pour votre confiance — {settings.brand_name}</p>}
            </footer>
          </div>

          {(inv.status === "payee" || inv.status === "annulee") && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute right-6 top-40 rotate-[-14deg] rounded-xl border-4 px-5 py-1.5 font-display text-3xl font-black tracking-widest opacity-80 sm:right-12 sm:top-44 sm:text-4xl",
                inv.status === "payee" ? "border-emerald-500 text-emerald-500" : "border-red-400 text-red-400",
              )}
            >
              {inv.status === "payee" ? "PAYÉE" : "ANNULÉE"}
            </div>
          )}
        </article>

        {/* ---------- Actions (staff) ---------- */}
        {isStaff && (
          <aside className="no-print space-y-4 lg:sticky lg:top-6">
            {(inv.status === "envoyee" || inv.status === "brouillon") && (
              <Card>
                <CardHeader title="Encaisser" subtitle={mad(inv.amount_mad)} icon={<Wallet className="size-4" />} />
                <form action={markInvoicePaidAction} className="space-y-3 px-5 pb-5">
                  <input type="hidden" name="id" value={inv.id} />
                  <Field label="Mode de paiement">
                    <Select name="method" defaultValue="Espèces">
                      {PAY_METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Date du paiement">
                    <Input type="date" name="paid_on" defaultValue={today} max={today} />
                  </Field>
                  <SubmitButton variant="brand" className="w-full" pendingText="Enregistrement…">
                    <CheckCircle2 className="size-4" /> Marquer comme payée
                  </SubmitButton>
                </form>
              </Card>
            )}

            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</p>
              <div className="space-y-2">
                {inv.status === "brouillon" && (
                  <form action={markInvoiceSentAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <SubmitButton variant="secondary" className="w-full" pendingText="…">
                      <Send className="size-4" /> Marquer comme envoyée
                    </SubmitButton>
                  </form>
                )}
                {reminder && (
                  <a
                    href={reminder}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    <MessageCircle className="size-4" /> Relancer sur WhatsApp
                  </a>
                )}
                {client && (
                  <Link href={`/clients/${client.id}?tab=factures`} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-canvas">
                    Voir la fiche client
                  </Link>
                )}
                {(inv.status === "payee" || inv.status === "annulee") && (
                  <form action={reopenInvoiceAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <SubmitButton variant="secondary" className="w-full" pendingText="…">
                      <RotateCcw className="size-4" /> Rouvrir la facture
                    </SubmitButton>
                  </form>
                )}
                {inv.status !== "annulee" && inv.status !== "payee" && (
                  <form action={cancelInvoiceAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <ConfirmButton message={`Annuler la facture ${inv.number} ?`} className="w-full">
                      <Ban className="size-4" /> Annuler la facture
                    </ConfirmButton>
                  </form>
                )}
              </div>
              {!client?.phone && (state === "envoyee" || state === "retard") && (
                <p className="mt-3 text-xs text-muted">Ajoutez un téléphone au client pour pouvoir le relancer sur WhatsApp.</p>
              )}
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
