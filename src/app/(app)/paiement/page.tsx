import Link from "next/link";
import { CheckCircle2, ChevronRight, CreditCard, FlaskConical, Hourglass, Package as PackageIcon, Receipt, Settings, Wallet, XCircle } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { canSimulate, PAYMENT_STATUS, paymentMode, PROVIDER_LABEL } from "@/lib/payments";
import type { Client, Invoice, OnlinePayment, Package } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
import { INVOICE_STATE, invoiceState, mad, todayKey } from "@/components/business/format";
import { CardMarks, ProviderName } from "@/components/payments/marks";
import { BuyPackageButton } from "@/components/payments/buy-package";

export const metadata = { title: "Paiement en ligne" };

function InvoiceRow({ inv, client, today }: { inv: Invoice; client?: Client | null; today: string }) {
  const st = INVOICE_STATE[invoiceState(inv, today)];
  return (
    <li>
      <Link href={`/paiement/${inv.id}`} className="group flex min-h-16 items-center gap-3 px-5 py-3 transition hover:bg-canvas/70">
        {client ? (
          <Avatar name={client.full_name} size={38} />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
            <Receipt className="size-[18px]" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-600">{client ? client.full_name : (inv.lines[0]?.label ?? inv.number)}</span>
          <span className="block truncate text-xs text-muted">
            <span className="font-mono">{inv.number}</span>
            {inv.due_on ? ` · échéance ${fmtDate(inv.due_on, { day: "numeric", month: "short" })}` : ""}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="text-sm font-bold tabular-nums text-ink">{mad(inv.amount_mad)}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </span>
        <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-500" />
      </Link>
    </li>
  );
}

export default async function PaymentsIndexPage() {
  const me = await getProfile();
  const supabase = await createClient();
  const settings = await getSettings();
  const { mode, reason } = paymentMode(settings);
  const today = todayKey();
  const available = mode !== "off" && (mode !== "demo" || canSimulate(me.role));

  /* ---------------- Espace membre ---------------- */
  if (me.role === "client") {
    const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
    const client = cData as Client | null;
    if (!client) {
      return (
        <>
          <PageHeader title="Paiement" />
          <Card>
            <Empty icon={<Hourglass className="size-6" />} title="Ton dossier n'est pas encore relié" text="Demande à ton coach de relier ton compte à ta fiche." />
          </Card>
        </>
      );
    }
    const [{ data: iData }, { data: pData }] = await Promise.all([
      supabase.from("invoices").select("*").eq("client_id", client.id).eq("status", "envoyee").order("issued_on", { ascending: false }),
      supabase.from("packages").select("*").eq("active", true).order("price_mad"),
    ]);
    const open = (iData ?? []) as Invoice[];
    const packages = (pData ?? []) as Package[];
    const featured = packages.length > 2 ? packages[Math.floor(packages.length / 2)]?.id : null;

    return (
      <>
        <PageHeader title="Paiement" subtitle="Règle tes factures ou choisis une formule, en toute sécurité." />
        {mode === "demo" && available && (
          <p className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <FlaskConical className="mt-0.5 size-4 shrink-0" /> <span><b>Paiement simulé (mode démo).</b> Aucune carte n&apos;est débitée.</span>
          </p>
        )}
        {!available && (
          <p className="mb-5 flex items-start gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-muted shadow-card">
            <Wallet className="mt-0.5 size-4 shrink-0 text-brand-500" /> Le paiement en ligne n&apos;est pas encore disponible : tu peux régler à l&apos;accueil de la salle.
          </p>
        )}

        <Card className="mb-6 overflow-hidden">
          <CardHeader title="À régler" subtitle={open.length ? `${open.length} facture${open.length > 1 ? "s" : ""} en attente` : "Tout est à jour"} icon={<Receipt className="size-4" />} />
          {open.length === 0 ? (
            <Empty icon={<CheckCircle2 className="size-6" />} title="Aucune facture à payer 🎉" text="Tu es à jour. Merci !" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {open.map((i) => (
                <InvoiceRow key={i.id} inv={i} today={today} />
              ))}
            </ul>
          )}
        </Card>

        {available && packages.length > 0 && (
          <>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
              <PackageIcon className="size-5 text-accent-500" /> Nos formules
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((p, i) => (
                <Card key={p.id} className={cn("relative flex flex-col p-5 animate-fade-up", p.id === featured && "ring-2 ring-accent-400")} style={{ animationDelay: `${i * 40}ms` }}>
                  {p.id === featured && <span className="absolute -top-2.5 right-4 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">Populaire</span>}
                  <p className="font-display text-base font-bold text-ink">{p.name}</p>
                  {p.description && <p className="mt-1 text-sm leading-relaxed text-muted">{p.description}</p>}
                  <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-brand-600 tabular-nums">{mad(p.price_mad)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[p.sessions_count ? `${p.sessions_count} séance${p.sessions_count > 1 ? "s" : ""}` : null, p.duration_days ? `${p.duration_days} jours` : null].filter(Boolean).join(" · ") || "Formule"}
                  </p>
                  <div className="mt-auto pt-5">
                    <BuyPackageButton packageId={p.id} featured={p.id === featured} />
                  </div>
                </Card>
              ))}
            </div>
            <CardMarks provider={mode} className="mt-5 justify-center" />
          </>
        )}
      </>
    );
  }

  /* ---------------- Staff ---------------- */
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: iData }, { data: cData }, { data: pData }] = await Promise.all([
    supabase.from("invoices").select("*").eq("status", "envoyee").order("due_on", { ascending: true }),
    supabase.from("clients").select("*"),
    supabase.from("online_payments").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const open = (iData ?? []) as Invoice[];
  const clients = new Map(((cData ?? []) as Client[]).map((c) => [c.id, c]));
  const payments = (pData ?? []) as OnlinePayment[];
  const recent = payments.filter((p) => p.created_at >= since);
  const ok = recent.filter((p) => p.status === "reussi");
  const failed = recent.filter((p) => p.status === "echoue").length;

  return (
    <>
      <PageHeader
        title="Paiement en ligne"
        subtitle="Encaissement par carte : Stripe ou CMI"
        actions={
          me.role === "admin" ? (
            <LinkButton href="/parametres#paiement-en-ligne" variant="secondary">
              <Settings className="size-4" /> Configurer
            </LinkButton>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Encaissé en ligne (30 j)" value={mad(ok.reduce((s, p) => s + Number(p.amount_mad), 0))} icon={<CreditCard className="size-5" />} delta={`${ok.length} paiement${ok.length > 1 ? "s" : ""}`} />
        <Kpi label="Factures à encaisser" value={String(open.length)} tone="accent" icon={<Receipt className="size-5" />} delta={mad(open.reduce((s, i) => s + Number(i.amount_mad), 0))} />
        <Card className="relative overflow-hidden p-5">
          <div className={cn("absolute inset-x-0 top-0 h-1", mode === "off" ? "bg-slate-300" : mode === "demo" ? "bg-amber-400" : "bg-emerald-500")} />
          <p className="text-[13px] font-medium text-muted">Prestataire</p>
          <div className="mt-2">
            <ProviderName mode={mode} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{reason ?? "Connecté : les paiements sont réels."}</p>
          {failed > 0 && <p className="mt-1 text-xs font-semibold text-red-600">{failed} échec{failed > 1 ? "s" : ""} sur 30 jours</p>}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Factures en attente" subtitle="Ouvrez une facture pour la faire payer par carte" icon={<Wallet className="size-4" />} />
          {open.length === 0 ? (
            <Empty icon={<CheckCircle2 className="size-6" />} title="Aucune facture en attente" text="Toutes les factures envoyées sont réglées." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {open.slice(0, 12).map((i) => (
                <InvoiceRow key={i.id} inv={i} client={clients.get(i.client_id)} today={today} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Derniers paiements en ligne" subtitle="Stripe, CMI et paiements simulés" icon={<CreditCard className="size-4" />} />
          {payments.length === 0 ? (
            <Empty icon={<CreditCard className="size-6" />} title="Aucun paiement en ligne" text="Les paiements par carte apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {payments.slice(0, 12).map((p) => {
                const c = clients.get(p.client_id);
                const st = PAYMENT_STATUS[p.status];
                return (
                  <li key={p.id}>
                    <Link href={`/facturation/${p.invoice_id}`} className="flex min-h-16 items-center gap-3 px-5 py-3 transition hover:bg-canvas/70">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", p.status === "reussi" ? "bg-emerald-50 text-emerald-600" : p.status === "echoue" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600")}>
                        {p.status === "echoue" ? <XCircle className="size-[18px]" /> : p.status === "reussi" ? <CheckCircle2 className="size-[18px]" /> : <Hourglass className="size-[18px]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{c?.full_name ?? "Client"}</span>
                        <span className="block truncate text-xs text-muted">
                          {PROVIDER_LABEL[p.provider]} · {fmtDate(p.paid_at ?? p.created_at, { day: "numeric", month: "short" })} à {fmtTime(p.paid_at ?? p.created_at)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold tabular-nums text-ink">{mad(p.amount_mad)}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
