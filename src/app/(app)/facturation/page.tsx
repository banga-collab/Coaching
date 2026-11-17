import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock, Package as PackageIcon, Plus, Receipt, Search, TrendingUp, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
import { RevenueBars } from "@/components/business/revenue-bars";
import { INVOICE_STATE, invoiceState, mad, todayKey, type InvoiceState } from "@/components/business/format";

export const metadata = { title: "Facturation" };

const FILTERS: { key: "" | InvoiceState; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "brouillon", label: "Brouillons" },
  { key: "envoyee", label: "Envoyées" },
  { key: "retard", label: "En retard" },
  { key: "payee", label: "Payées" },
  { key: "annulee", label: "Annulées" },
];

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const money = (v: number) => (
  <span className="whitespace-nowrap text-[22px] sm:text-[28px]">
    {nf0.format(v)}
    <span className="ml-1 text-sm font-bold opacity-70">MAD</span>
  </span>
);

function monthKeys(today: string, n: number) {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  const me = await requireStaff();
  const { q = "", statut = "" } = await searchParams;
  const supabase = await createClient();
  const [{ data: iData }, { data: cData }] = await Promise.all([
    supabase.from("invoices").select("*").order("issued_on", { ascending: false }),
    supabase.from("clients").select("*"),
  ]);
  const invoices = (iData ?? []) as Invoice[];
  const clients = new Map(((cData ?? []) as Client[]).map((c) => [c.id, c]));
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const months = monthKeys(today, 12);
  const prevMonth = months.at(-2)!;

  const paid = invoices.filter((i) => i.status === "payee");
  const paidIn = (mk: string) => paid.filter((i) => (i.paid_on ?? i.issued_on).startsWith(mk)).reduce((s, i) => s + Number(i.amount_mad), 0);
  const cashThis = paidIn(thisMonth);
  const cashPrev = paidIn(prevMonth);
  const pending = invoices.filter((i) => invoiceState(i, today) === "envoyee");
  const late = invoices.filter((i) => invoiceState(i, today) === "retard");
  const sum = (arr: Invoice[]) => arr.reduce((s, i) => s + Number(i.amount_mad), 0);
  const chart = months.map((mk) => ({
    label: fmtDate(`${mk}-15T12:00:00`, { month: "short" }).replace(".", ""),
    value: paidIn(mk),
  }));
  const revenue12 = chart.reduce((s, x) => s + x.value, 0);
  const delta = cashPrev ? Math.round(((cashThis - cashPrev) / cashPrev) * 100) : null;

  const needle = q.trim().toLowerCase();
  const rows = invoices.filter((i) => {
    if (statut && invoiceState(i, today) !== statut) return false;
    if (!needle) return true;
    const c = clients.get(i.client_id);
    return (c?.full_name ?? "").toLowerCase().includes(needle) || i.number.toLowerCase().includes(needle);
  });

  return (
    <>
      <PageHeader
        title="Facturation"
        subtitle="Factures, paiements et formules"
        actions={
          <>
            {me.role === "admin" && (
              <LinkButton href="/facturation/formules" variant="secondary">
                <PackageIcon className="size-4" /> Formules
              </LinkButton>
            )}
            <LinkButton href="/facturation/nouvelle">
              <Plus className="size-4" /> Nouvelle facture
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          label="Encaissé ce mois"
          value={money(cashThis)}
          icon={<Wallet className="size-[18px]" />}
          delta={delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta} % vs mois dernier`}
          positive={delta === null ? undefined : delta >= 0}
        />
        <Kpi label="En attente" value={money(sum(pending))} tone="accent" icon={<Clock className="size-[18px]" />} delta={`${pending.length} facture${pending.length > 1 ? "s" : ""}`} />
        <Kpi
          label="En retard"
          value={money(sum(late))}
          tone="accent"
          icon={<AlertTriangle className="size-[18px]" />}
          delta={late.length ? `${late.length} à relancer` : "Aucun retard"}
          positive={late.length === 0}
        />
        <Kpi label="CA 12 mois" value={money(revenue12)} icon={<TrendingUp className="size-[18px]" />} delta={`${paid.length} factures payées`} />
      </div>

      <Card className="mt-4 sm:mt-6">
        <CardHeader title="Encaissements par mois" subtitle="12 derniers mois · factures payées" icon={<TrendingUp className="size-4" />} />
        <div className="px-3 pb-4 sm:px-5">
          <RevenueBars data={chart} />
        </div>
      </Card>

      <div className="mb-4 mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={{ pathname: "/facturation", query: { ...(q && { q }), ...(f.key && { statut: f.key }) } }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  statut === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {f.label}
                {f.key === "retard" && late.length > 0 && (
                  <span className={cn("ml-1.5 rounded-full px-1.5 text-[10px]", statut === f.key ? "bg-white/20" : "bg-red-50 text-red-600")}>{late.length}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
        <form className="relative lg:w-72">
          {statut && <input type="hidden" name="statut" value={statut} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Client ou n° de facture…"
            className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
        </form>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <Empty
            icon={<Receipt className="size-6" />}
            title={q || statut ? "Aucune facture trouvée" : "Aucune facture pour l'instant"}
            text={q || statut ? "Essayez un autre filtre ou une autre recherche." : "Créez votre première facture à partir d'une formule."}
            action={!q && !statut ? <LinkButton href="/facturation/nouvelle">Créer une facture</LinkButton> : undefined}
          />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Facture</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Émise le</th>
                  <th className="px-4 py-3">Échéance</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => {
                  const c = clients.get(i.client_id);
                  const st = INVOICE_STATE[invoiceState(i, today)];
                  return (
                    <tr key={i.id} className="group relative transition hover:bg-canvas/70">
                      <td className="px-5 py-3.5">
                        <Link href={`/facturation/${i.id}`} className="font-mono text-[13px] font-semibold text-ink after:absolute after:inset-0 after:content-[''] group-hover:text-brand-600">
                          {i.number}
                        </Link>
                        <span className="block text-xs text-muted">{i.lines[0]?.label ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={c?.full_name ?? "?"} size={30} />
                          <span className="font-medium text-slate-700">{c?.full_name ?? "Client supprimé"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{fmtDate(i.issued_on)}</td>
                      <td className={cn("px-4 py-3.5", st.tone === "red" ? "font-semibold text-red-600" : "text-slate-600")}>{i.due_on ? fmtDate(i.due_on) : "—"}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-ink">{mad(i.amount_mad)}</td>
                      <td className="px-4 py-3.5">
                        <Badge dot tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="pr-4">
                        <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {rows.map((i) => {
                const c = clients.get(i.client_id);
                const st = INVOICE_STATE[invoiceState(i, today)];
                return (
                  <li key={i.id}>
                    <Link href={`/facturation/${i.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-canvas">
                      <Avatar name={c?.full_name ?? "?"} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{c?.full_name ?? "Client supprimé"}</span>
                        <span className="block truncate text-xs text-muted">
                          {i.number} · {fmtDate(i.issued_on, { day: "numeric", month: "short" })}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold tabular-nums text-ink">{mad(i.amount_mad)}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
