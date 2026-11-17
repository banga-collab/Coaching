import Link from "next/link";
import { headers } from "next/headers";
import { CalendarCheck, CalendarClock, Check, ExternalLink, Globe, Mail, MessageSquareText, Phone, X } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { BookingRequest } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, Kpi, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { WhatsAppButton } from "@/components/modules/whatsapp-button";
import { CopyButton } from "@/components/platform/ai-ui";
import { confirmBookingAction, refuseBookingAction } from "@/actions/platform";

export const metadata = { title: "Réservations" };

const STATUS: Record<BookingRequest["status"], { label: string; tone: "accent" | "green" | "gray" }> = {
  nouvelle: { label: "Nouvelle", tone: "accent" },
  confirmee: { label: "Confirmée", tone: "green" },
  refusee: { label: "Refusée", tone: "gray" },
};
const FILTERS = [
  { key: "toutes", label: "Toutes" },
  { key: "nouvelle", label: "Nouvelles" },
  { key: "confirmee", label: "Confirmées" },
  { key: "refusee", label: "Refusées" },
] as const;

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const [{ statut = "toutes" }] = await Promise.all([searchParams, requireStaff()]);
  const supabase = await createClient();
  const [{ data }, settings, h] = await Promise.all([
    supabase.from("booking_requests").select("*").order("created_at", { ascending: false }).limit(300),
    getSettings(),
    headers(),
  ]);
  const all = (data ?? []) as BookingRequest[];
  const order = { nouvelle: 0, confirmee: 1, refusee: 2 } as const;
  const rows = all
    .filter((b) => statut === "toutes" || b.status === statut)
    .sort((a, b) => order[a.status] - order[b.status] || (a.status === "nouvelle" ? a.wanted_at.localeCompare(b.wanted_at) : b.created_at.localeCompare(a.created_at)));

  const count = (s: BookingRequest["status"]) => all.filter((b) => b.status === s).length;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const publicUrl = `${proto}://${host}/reserver`;
  const now = Date.now();

  return (
    <>
      <PageHeader title="Réservations" subtitle="Demandes de rendez-vous reçues depuis la page de réservation en ligne." />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Kpi label="Nouvelles" value={count("nouvelle")} tone="accent" />
          <Kpi label="Confirmées" value={count("confirmee")} />
          <Kpi label="Refusées" value={count("refusee")} />
        </div>

        <Card className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-accent-100 opacity-60 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white">
              <Globe className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[15px] font-bold text-ink">Lien de réservation public</p>
                <Badge dot tone={settings.booking_enabled ? "green" : "gray"}>
                  {settings.booking_enabled ? "En ligne" : "Fermée"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted">À partager sur Instagram, Google Maps ou WhatsApp.</p>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-canvas px-3.5 py-2 text-sm text-brand-700">{publicUrl}</code>
            <CopyButton text={publicUrl} label="Copier le lien" />
            <a href="/reserver" target="_blank" rel="noopener" className="inline-flex size-9 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:bg-canvas hover:text-ink" aria-label="Ouvrir la page publique">
              <ExternalLink className="size-4" />
            </a>
          </div>
        </Card>
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "toutes" ? "/reservations" : `/reservations?statut=${f.key}`}
            scroll={false}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition",
              statut === f.key ? "border-accent-500 text-brand-600" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {f.label}
            {f.key === "nouvelle" && count("nouvelle") > 0 && <span className="ml-1.5 rounded-full bg-accent-500 px-1.5 text-xs text-white">{count("nouvelle")}</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon={<CalendarClock className="size-6" />}
            title={statut === "toutes" ? "Aucune demande pour le moment" : "Aucune demande dans cette catégorie"}
            text="Partagez votre lien de réservation : les demandes apparaîtront ici en temps réel."
          />
        </Card>
      ) : (
        <div className="grid gap-3 animate-fade-up">
          {rows.map((b) => {
            const past = new Date(b.wanted_at).getTime() < now;
            return (
              <Card key={b.id} className={cn("p-4 sm:p-5 transition hover:shadow-pop", b.status === "nouvelle" && "border-l-4 border-l-accent-500")}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  {/* Date */}
                  <div className="flex shrink-0 items-center gap-3 md:w-36 md:flex-col md:items-start md:gap-1">
                    <div className={cn("grid w-14 place-items-center rounded-xl py-1.5 text-center", past ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand-600")}>
                      <span className="text-[11px] font-semibold uppercase">{fmtDate(b.wanted_at, { month: "short" })}</span>
                      <span className="font-display text-xl font-extrabold leading-none">{fmtDate(b.wanted_at, { day: "numeric" })}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-ink">{fmtDate(b.wanted_at, { weekday: "long" })}</p>
                      <p className="text-sm text-muted">{fmtTime(b.wanted_at)}</p>
                    </div>
                  </div>

                  {/* Personne */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar name={b.full_name} size={32} />
                      <p className="font-display font-bold text-ink">{b.full_name}</p>
                      <Badge dot tone={STATUS[b.status].tone}>
                        {STATUS[b.status].label}
                      </Badge>
                      <Badge tone="brand">{b.type}</Badge>
                      {past && b.status === "nouvelle" && <Badge tone="red">Date passée</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                      <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
                        <Phone className="size-3.5" /> {b.phone}
                      </a>
                      {b.email && (
                        <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
                          <Mail className="size-3.5" /> {b.email}
                        </a>
                      )}
                      <span className="text-xs">Reçue le {fmtDate(b.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {b.message && (
                      <p className="mt-3 flex gap-2 rounded-xl bg-canvas px-3.5 py-2.5 text-sm text-slate-700">
                        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted" /> {b.message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <WhatsAppButton
                      phone={b.phone}
                      name={b.full_name}
                      compact
                      message={
                        b.status === "confirmee"
                          ? `Bonjour ${b.full_name.split(" ")[0]} 👋 Votre rendez-vous « ${b.type} » du ${fmtDate(b.wanted_at, { weekday: "long", day: "numeric", month: "long" })} à ${fmtTime(b.wanted_at)} est confirmé. À bientôt au ${settings.brand_name} !`
                          : `Bonjour ${b.full_name.split(" ")[0]} 👋 Merci pour votre demande de rendez-vous « ${b.type} » au ${settings.brand_name}.`
                      }
                    />
                    {b.status === "nouvelle" && (
                      <>
                        <form action={refuseBookingAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <ConfirmButton message={`Refuser la demande de ${b.full_name} ?`} className="h-9 px-3.5">
                            <X className="size-4" /> Refuser
                          </ConfirmButton>
                        </form>
                        <form action={confirmBookingAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <SubmitButton variant="brand" className="h-9 px-3.5" pendingText="Confirmation…">
                            <Check className="size-4" /> Confirmer
                          </SubmitButton>
                        </form>
                      </>
                    )}
                    {b.status === "confirmee" && b.session_id && (
                      <Link href={`/seances/${b.session_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                        <CalendarCheck className="size-4" /> Voir la séance
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
