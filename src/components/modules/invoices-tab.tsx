import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, CreditCard, Lock, Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { canSimulate, ONLINE_METHOD, paymentMode } from "@/lib/payments";
import type { Invoice } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { INVOICE_STATE, invoiceState, mad, todayKey } from "@/components/business/format";
import { CardMarks } from "@/components/payments/marks";

export async function InvoicesTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("client_id", clientId).order("issued_on", { ascending: false });
  const today = todayKey();
  // Les brouillons ne sont pas montrés au membre
  const invoices = ((data ?? []) as Invoice[]).filter((i) => canEdit || i.status !== "brouillon");

  const paid = invoices.filter((i) => i.status === "payee").reduce((s, i) => s + Number(i.amount_mad), 0);
  const open = invoices.filter((i) => i.status === "envoyee");
  const outstanding = open.reduce((s, i) => s + Number(i.amount_mad), 0);
  const lateCount = open.filter((i) => invoiceState(i, today) === "retard").length;
  // Paiement en ligne (Stripe / CMI / simulé) : disponible si un prestataire est actif
  const { mode } = paymentMode(await getSettings());
  const canPayOnline = mode !== "off" && (mode !== "demo" || canSimulate(canEdit ? "coach" : "client"));

  const stats = [
    { label: canEdit ? "Total payé" : "Total réglé", value: mad(paid), icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
    {
      label: "Reste à payer",
      value: mad(outstanding),
      icon: lateCount ? AlertTriangle : Clock,
      cls: lateCount ? "bg-red-50 text-red-500" : "bg-accent-50 text-accent-600",
      sub: lateCount ? `${lateCount} en retard` : open.length ? `${open.length} facture${open.length > 1 ? "s" : ""} en attente` : "À jour",
    },
    { label: "Factures", value: String(invoices.length), icon: Receipt, cls: "bg-brand-50 text-brand-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3.5 p-4">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", s.cls)}>
              <s.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted">{s.label}</span>
              <span className="block truncate font-display text-lg font-extrabold text-ink">{s.value}</span>
              {s.sub && <span className={cn("block text-[11px] font-semibold", lateCount ? "text-red-600" : "text-muted")}>{s.sub}</span>}
            </span>
          </Card>
        ))}
      </div>

      {canPayOnline && !canEdit && open.length > 0 && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent-500 to-brand-500" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
              <CreditCard className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-ink">
                {open.length > 1 ? `${open.length} factures à régler` : "1 facture à régler"} · {mad(outstanding)}
              </p>
              <p className="mt-0.5 text-sm text-muted">Paie en ligne par carte en quelques secondes, en toute sécurité.</p>
              <CardMarks provider={mode} className="mt-2" />
            </div>
            <LinkButton href={open.length === 1 ? `/paiement/${open[0]!.id}` : "/paiement"} className="h-12 w-full sm:h-11 sm:w-auto">
              <Lock className="size-4" /> Payer en ligne
            </LinkButton>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title={canEdit ? "Factures" : "Mes factures"}
          subtitle={canEdit ? "Historique de facturation du client" : "Clique sur une facture pour l'afficher ou l'imprimer"}
          icon={<Receipt className="size-4" />}
          action={
            canEdit ? (
              <LinkButton href={`/facturation/nouvelle?client=${clientId}`} className="h-9 px-3">
                <Plus className="size-4" /> Nouvelle facture
              </LinkButton>
            ) : undefined
          }
        />
        {invoices.length === 0 ? (
          <Empty
            icon={<Receipt className="size-6" />}
            title="Aucune facture"
            text={canEdit ? "Créez une facture à partir d'une formule en quelques secondes." : "Tes factures apparaîtront ici."}
          />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {invoices.map((i) => {
              const st = INVOICE_STATE[invoiceState(i, today)];
              const payable = canPayOnline && i.status === "envoyee";
              return (
                <li key={i.id} className="flex items-center">
                  <Link href={`/facturation/${i.id}`} className="group flex min-w-0 flex-1 items-center gap-3 px-5 py-3.5 transition hover:bg-canvas/70">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", i.status === "payee" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500")}>
                      <Receipt className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-ink group-hover:text-brand-600">{i.number}</span>
                        <span className="hidden sm:inline">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {i.lines[0]?.label ?? "—"} · {fmtDate(i.issued_on)}
                        {i.status === "payee" && i.paid_on ? ` · payée le ${fmtDate(i.paid_on, { day: "numeric", month: "short" })}` : ""}
                        {i.status === "payee" && i.method === ONLINE_METHOD ? " · en ligne" : ""}
                        {i.status === "envoyee" && i.due_on ? ` · échéance ${fmtDate(i.due_on, { day: "numeric", month: "short" })}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular-nums text-ink">{mad(i.amount_mad)}</span>
                      <span className="sm:hidden">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-500" />
                  </Link>
                  {payable && (
                    <Link
                      href={`/paiement/${i.id}`}
                      aria-label={`Payer en ligne la facture ${i.number}`}
                      className="mr-4 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-accent-500 px-3 text-xs font-semibold text-white shadow-sm shadow-accent-500/20 transition hover:bg-accent-600"
                    >
                      <CreditCard className="size-4" />
                      <span className="hidden sm:inline">Payer</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
