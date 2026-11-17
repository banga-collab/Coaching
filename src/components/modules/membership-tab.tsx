import Image from "next/image";
import { CalendarClock, CalendarRange, CreditCard, History, Infinity as InfinityIcon, Plus, QrCode, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Client, GymCheckin, Membership } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import {
  MEMBERSHIP_STATE,
  currentMembership,
  daysLeft,
  daysLeftLabel,
  daysTone,
  durationDays,
  frDay,
  membershipState,
  sessionsLeft,
  todayKey,
} from "@/lib/memberships";
import { Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { DaysRing } from "@/components/memberships/days-ring";
import { MembershipActions } from "@/components/memberships/membership-actions";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const METHOD: Record<GymCheckin["method"], string> = { qr: "QR code", code: "Code", manuel: "Manuel" };

export async function MembershipTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const [{ data: mData }, { data: gData }, { data: cData }] = await Promise.all([
    supabase.from("memberships").select("*").eq("client_id", clientId).order("start_date", { ascending: false }),
    supabase.from("gym_checkins").select("*").eq("client_id", clientId).order("checked_at", { ascending: false }),
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
  ]);
  const list = (mData ?? []) as Membership[];
  const checkins = (gData ?? []) as GymCheckin[];
  const client = cData as Client | null;
  const today = todayKey();
  const cur = currentMembership(list, today);
  const monthCount = checkins.filter((g) => g.checked_at.slice(0, 7) === today.slice(0, 7)).length;
  const last20 = checkins.slice(0, 20);
  const newHref = `/abonnements/nouveau?client=${clientId}`;

  if (!cur) {
    return (
      <Card>
        <Empty
          icon={<CreditCard className="size-6" />}
          title="Aucun abonnement"
          text={canEdit ? "Ajoutez une formule pour suivre les échéances et autoriser l'accès à la salle." : "Ton abonnement apparaîtra ici dès qu'il sera enregistré."}
          action={canEdit ? <LinkButton href={newHref}>Nouvel abonnement</LinkButton> : undefined}
        />
      </Card>
    );
  }

  const st = membershipState(cur, today);
  const left = daysLeft(cur, today);
  const sl = sessionsLeft(cur);
  const state = MEMBERSHIP_STATE[st];
  const alert = st === "bientot";
  const dead = st === "expire" || st === "epuise" || st === "annule";

  return (
    <div className="space-y-4">
      {(alert || dead) && (
        <div className={cn("flex items-center gap-3 rounded-2xl border p-4", alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900")}>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", alert ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600")}>
            <CalendarClock className="size-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">
              {alert ? (left === 0 ? "L'abonnement se termine aujourd'hui" : `L'abonnement se termine dans ${left} jour${left > 1 ? "s" : ""}`) : state.label}
            </span>
            <span className="block opacity-80">{canEdit ? "Proposez un renouvellement au client." : "Pense à renouveler pour garder ton accès 💪"}</span>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Carte principale */}
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl p-5 text-white shadow-card sm:p-6",
            dead ? "bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500" : "bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500",
          )}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-accent-500/25 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white px-2 py-1">
                  <Image src="/logo.png" alt="Moov'Up" width={473} height={136} className="h-5 w-auto object-contain" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Membre</span>
              </div>
              <p className="mt-4 font-display text-xl font-extrabold leading-tight sm:text-2xl">{cur.name}</p>
              {client && <p className="mt-1 text-sm text-white/80">{client.full_name}</p>}
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
                  <span className={cn("size-1.5 rounded-full", st === "actif" ? "bg-emerald-300" : alert ? "bg-amber-300" : dead ? "bg-red-300" : "bg-white")} />
                  {state.label}
                </span>
              </div>
            </div>
            <DaysRing left={left} total={durationDays(cur)} label={left === 1 ? "jour" : "jours"} />
          </div>

          <div className="relative mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/15 sm:gap-3 sm:p-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Début</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{frDay(cur.start_date, { day: "numeric", month: "short", year: "2-digit" })}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Valable jusqu&apos;au</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{frDay(cur.end_date, { day: "numeric", month: "short", year: "2-digit" })}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Séances</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold">
                {sl === null ? (
                  <>
                    <InfinityIcon className="size-4" /> Illimité
                  </>
                ) : (
                  <>
                    {sl} <span className="font-normal text-white/70">/ {cur.sessions_total}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {sl !== null && cur.sessions_total ? (
            <div className="relative mt-4 flex gap-1" aria-label={`${cur.sessions_used} séances utilisées sur ${cur.sessions_total}`}>
              {Array.from({ length: Math.min(cur.sessions_total, 36) }, (_, i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < cur.sessions_used ? "bg-white/25" : "bg-accent-400")} />
              ))}
            </div>
          ) : null}

          {client?.access_code && (
            <p className="relative mt-4 flex items-center gap-1.5 text-xs text-white/70">
              <QrCode className="size-3.5" /> Code d&apos;accès <span className="font-mono font-semibold tracking-wider text-white">{client.access_code}</span>
            </p>
          )}
        </div>

        {/* Résumé & actions */}
        <Card className="flex flex-col">
          <CardHeader title="Fréquentation" subtitle="Passages à l'accueil" icon={<ScanLine className="size-4" />} />
          <div className="grid grid-cols-2 gap-3 px-5">
            <div className="rounded-xl bg-brand-50/70 p-3.5">
              <p className="text-xs font-medium text-muted">Ce mois-ci</p>
              <p className="font-display text-2xl font-extrabold text-brand-600">{monthCount}</p>
            </div>
            <div className="rounded-xl bg-accent-50/70 p-3.5">
              <p className="text-xs font-medium text-muted">Dernier passage</p>
              <p className="mt-1 truncate text-sm font-bold text-accent-700">{checkins[0] ? fmtDate(checkins[0].checked_at, { day: "numeric", month: "short" }) : "—"}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 px-5 pb-5 text-sm">
            <p className="flex justify-between gap-3">
              <span className="text-muted">Prix</span>
              <span className="font-semibold text-ink">{cur.price_mad !== null ? `${nf.format(Number(cur.price_mad))} MAD` : "—"}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-muted">Échéance</span>
              <Badge tone={daysTone(left)} dot>
                {daysLeftLabel(left)}
              </Badge>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-muted">Renouvellement auto</span>
              <span className="font-semibold text-ink">{cur.auto_renew ? "Oui" : "Non"}</span>
            </p>
          </div>
          {canEdit && (
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
              <MembershipActions m={cur} highlight={alert || dead} />
              <LinkButton href={newHref} variant="ghost" className="h-9 px-3">
                <Plus className="size-4" /> Autre formule
              </LinkButton>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Historique des abonnements" subtitle={`${list.length} formule${list.length > 1 ? "s" : ""}`} icon={<History className="size-4" />} />
          <ul className="divide-y divide-line border-t border-line">
            {list.map((m) => {
              const s = MEMBERSHIP_STATE[membershipState(m, today)];
              return (
                <li key={m.id} className={cn("flex items-center gap-3 px-5 py-3", m.id === cur.id && "bg-brand-50/40")}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
                    <CalendarRange className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                    <span className="block text-xs text-muted">
                      {frDay(m.start_date, { day: "numeric", month: "short" })} → {frDay(m.end_date, { day: "numeric", month: "short", year: "numeric" })}
                      {m.sessions_total ? ` · ${m.sessions_used}/${m.sessions_total} séances` : ""}
                    </span>
                  </span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Passages à la salle"
            subtitle={`${monthCount} ce mois · ${checkins.length} au total`}
            icon={<ScanLine className="size-4" />}
            action={canEdit ? <LinkButton href="/acces" variant="secondary" className="h-9 px-3">Accueil</LinkButton> : undefined}
          />
          {last20.length === 0 ? (
            <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Aucun passage enregistré pour l&apos;instant.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto border-t border-line">
              {last20.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                    {g.method === "qr" ? <QrCode className="size-4" /> : <ScanLine className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium capitalize text-ink">{fmtDate(g.checked_at, { weekday: "long", day: "numeric", month: "short" })}</span>
                  </span>
                  <span className="text-xs text-muted">{METHOD[g.method]}</span>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-700">{fmtTime(g.checked_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
