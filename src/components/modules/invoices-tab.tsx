import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { INVOICE_STATE, invoiceState, mad, todayKey } from "@/components/business/format";

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
              return (
                <li key={i.id}>
                  <Link href={`/facturation/${i.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-canvas/70">
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
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
