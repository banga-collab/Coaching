import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CalendarRange, ChevronRight, Dumbbell, Hourglass, Infinity as InfinityIcon, MessageCircle, QrCode as QrIcon, Receipt, ScanLine, Sun } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { waLink } from "@/lib/whatsapp";
import type { Client, GymCheckin, Membership } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { MEMBERSHIP_STATE, currentMembership, daysLeft, durationDays, frDay, membershipState, sessionsLeft, todayKey } from "@/lib/memberships";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { QrCode } from "@/components/memberships/qr-code";
import { DaysRing } from "@/components/memberships/days-ring";

export const metadata = { title: "Ma carte" };

export default async function MyCardPage() {
  const me = await getProfile();
  if (me.role !== "client") redirect("/acces");
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  const client = cData as Client | null;

  if (!client) {
    return (
      <>
        <PageHeader title="Ma carte" />
        <Card>
          <Empty
            icon={<Hourglass className="size-6" />}
            title="Ton dossier n'est pas encore relié"
            text={`Demande à l'accueil d'ajouter ton e-mail (${me.email}) à ta fiche pour obtenir ta carte membre.`}
          />
        </Card>
      </>
    );
  }

  const [{ data: mData }, { data: gData }, settings] = await Promise.all([
    supabase.from("memberships").select("*").eq("client_id", client.id),
    supabase.from("gym_checkins").select("*").eq("client_id", client.id).order("checked_at", { ascending: false }).limit(60),
    getSettings(),
  ]);
  const today = todayKey();
  const m = currentMembership((mData ?? []) as Membership[], today);
  const checkins = (gData ?? []) as GymCheckin[];
  const st = m ? membershipState(m, today) : null;
  const left = m ? daysLeft(m, today) : 0;
  const sl = m ? sessionsLeft(m) : null;
  const monthCount = checkins.filter((g) => g.checked_at.slice(0, 7) === today.slice(0, 7)).length;
  const dead = st === "expire" || st === "epuise" || st === "annule" || st === "suspendu";
  const renewSoon = st === "bientot" || st === "expire" || st === "epuise" || (sl !== null && sl <= 2);
  const wa = waLink(settings.whatsapp ?? settings.phone, `Bonjour, c'est ${client.full_name}. Je souhaite renouveler mon abonnement${m ? ` « ${m.name} »` : ""} 🙂`);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Ma carte" subtitle="Présente ce QR code à l'accueil" />

      {/* Carte membre */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] p-5 text-white shadow-pop animate-fade-up",
          dead ? "bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600" : "bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500",
        )}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-accent-500/30 blur-3xl" />

        <div className="relative flex items-center justify-between gap-3">
          <span className="rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
            <Image src="/logo.png" alt="Moov'Up" width={473} height={136} priority className="h-6 w-auto object-contain" />
          </span>
          {st && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
              <span className={cn("size-1.5 rounded-full", st === "actif" ? "bg-emerald-300" : st === "bientot" ? "bg-amber-300" : dead ? "bg-red-300" : "bg-white")} />
              {MEMBERSHIP_STATE[st].label}
            </span>
          )}
        </div>

        <div className="relative mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Membre</p>
          <p className="font-display text-2xl font-extrabold leading-tight">{client.full_name}</p>
          <p className="mt-0.5 text-sm text-white/80">{m ? m.name : "Aucun abonnement en cours"}</p>
        </div>

        <div className="relative mx-auto mt-5 w-full max-w-[260px] rounded-3xl bg-white p-3.5 shadow-lg">
          {client.access_code ? (
            <>
              <QrCode value={client.access_code} className="aspect-square w-full" label={`QR code d'accès de ${client.full_name}`} />
              <p className="mt-2 text-center font-mono text-lg font-bold tracking-[0.25em] text-brand-800">{client.access_code}</p>
            </>
          ) : (
            <div className="grid aspect-square place-items-center text-center text-sm text-muted">
              <span>
                <QrIcon className="mx-auto mb-2 size-8 text-slate-300" />
                Code d&apos;accès en cours de création. Demande-le à l&apos;accueil.
              </span>
            </div>
          )}
        </div>

        {m && (
          <div className="relative mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/15">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Valable jusqu&apos;au</p>
              <p className="mt-0.5 text-sm font-bold">{frDay(m.end_date, { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Séances</p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-sm font-bold">
                {sl === null ? (
                  <>
                    <InfinityIcon className="size-4" /> Illimité
                  </>
                ) : (
                  `${sl} restante${sl > 1 ? "s" : ""}`
                )}
              </p>
            </div>
          </div>
        )}
        <p className="relative mt-3 text-center text-[11px] text-white/60">Augmente la luminosité de ton écran pour un scan rapide</p>
      </div>

      {/* Alerte renouvellement */}
      {m && renewSoon && (
        <div className={cn("mt-4 rounded-2xl border p-4", st === "bientot" || (sl !== null && sl > 0) ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50")}>
          <p className={cn("flex items-center gap-2 font-semibold", st === "bientot" || (sl !== null && sl > 0) ? "text-amber-900" : "text-red-900")}>
            <CalendarClock className="size-5 shrink-0" />
            {st === "expire"
              ? "Ton abonnement a expiré"
              : st === "epuise"
                ? "Tu as utilisé toutes tes séances"
                : st === "bientot"
                  ? left === 0
                    ? "Ton abonnement se termine aujourd'hui"
                    : `Plus que ${left} jour${left > 1 ? "s" : ""} d'abonnement`
                  : `Plus que ${sl} séance${(sl ?? 0) > 1 ? "s" : ""}`}
          </p>
          <p className="mt-1 text-sm text-slate-700">Renouvelle maintenant pour continuer sur ta lancée 💪</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link href="/moi?tab=factures" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-canvas">
              <Receipt className="size-4 text-brand-500" /> Mes factures
            </Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white transition hover:brightness-95">
                <MessageCircle className="size-4" /> Écrire à la salle
              </a>
            )}
          </div>
        </div>
      )}

      {/* Statut */}
      {m ? (
        <Card className="mt-4 flex items-center gap-4 p-4">
          <DaysRing left={left} total={durationDays(m)} size={84} stroke={8} tone="dark" label={left === 1 ? "jour" : "jours"} />
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <p className="flex items-center gap-2 text-slate-700">
              <CalendarRange className="size-4 shrink-0 text-brand-500" />
              Du {frDay(m.start_date, { day: "numeric", month: "short" })} au {frDay(m.end_date, { day: "numeric", month: "short" })}
            </p>
            <p className="flex items-center gap-2 text-slate-700">
              <Dumbbell className="size-4 shrink-0 text-brand-500" />
              {sl === null ? "Accès illimité à la salle" : `${m.sessions_used} séance${m.sessions_used > 1 ? "s" : ""} utilisée${m.sessions_used > 1 ? "s" : ""} sur ${m.sessions_total}`}
            </p>
            <p className="flex items-center gap-2 text-slate-700">
              <Sun className="size-4 shrink-0 text-accent-500" />
              {monthCount} passage{monthCount > 1 ? "s" : ""} ce mois-ci {monthCount >= 8 ? "🔥" : ""}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="mt-4">
          <Empty
            icon={<CalendarClock className="size-6" />}
            title="Pas d'abonnement actif"
            text="Passe à l'accueil ou écris-nous pour choisir la formule qui te correspond."
            action={
              wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white">
                  <MessageCircle className="size-4" /> Écrire sur WhatsApp
                </a>
              ) : undefined
            }
          />
        </Card>
      )}

      {/* Derniers passages */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Mes derniers passages" subtitle={checkins.length ? `${monthCount} ce mois-ci` : undefined} icon={<ScanLine className="size-4" />} />
        {checkins.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Ton premier passage apparaîtra ici. À très vite à la salle !</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {checkins.slice(0, 8).map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ScanLine className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-ink">{fmtDate(g.checked_at, { weekday: "long", day: "numeric", month: "long" })}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-600">{fmtTime(g.checked_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link href="/moi/parrainage" className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-accent-500 to-accent-400 p-4 text-white shadow-sm transition hover:brightness-105">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 text-xl">🎁</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Parraine un ami</span>
          <span className="block text-sm text-white/85">Gagne une récompense dès que ton ami s&apos;inscrit</span>
        </span>
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
