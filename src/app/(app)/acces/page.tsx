import Link from "next/link";
import { Activity, Clock, QrCode, ScanLine, UserCheck, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, GymCheckin, Membership } from "@/lib/types";
import { cn, dayKey, fmtTime } from "@/lib/utils";
import { currentMembership, todayKey } from "@/lib/memberships";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { Scanner } from "@/components/memberships/scanner";

export const metadata = { title: "Accès salle" };

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 h → 22 h
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Casablanca" }).format(new Date(iso)));
const METHOD: Record<GymCheckin["method"], string> = { qr: "QR", code: "Code", manuel: "Manuel" };

export default async function AccessPage() {
  await requireStaff();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: gData }, { data: cData }, { data: mData }] = await Promise.all([
    supabase.from("gym_checkins").select("*").gte("checked_at", since).order("checked_at", { ascending: false }),
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("memberships").select("*"),
  ]);
  const checkins = (gData ?? []) as GymCheckin[];
  const clientList = (cData ?? []) as Client[];
  const clients = new Map(clientList.map((c) => [c.id, c]));
  const memberships = (mData ?? []) as Membership[];
  const today = todayKey();

  const todays = checkins.filter((g) => dayKey(g.checked_at) === today);
  const present = new Set(todays.map((g) => g.client_id)).size;
  const nowHour = hourOf(new Date().toISOString());
  const byHour = HOURS.map((h) => ({ h, n: todays.filter((g) => hourOf(g.checked_at) === h).length }));
  const maxHour = Math.max(1, ...byHour.map((x) => x.n));
  const past = checkins.filter((g) => dayKey(g.checked_at) !== today);
  const days = new Set(past.map((g) => dayKey(g.checked_at))).size || 1;
  const usual = HOURS.map((h) => ({ h, n: past.filter((g) => hourOf(g.checked_at) === h).length / days }));
  const peak = usual.reduce((a, b) => (b.n > a.n ? b : a), usual[0]!);
  const avgPerDay = Math.round(past.length / days);

  const msByClient = new Map<string, Membership[]>();
  memberships.forEach((m) => msByClient.set(m.client_id, [...(msByClient.get(m.client_id) ?? []), m]));

  const scanClients = clientList
    .filter((c) => c.status !== "termine")
    .map((c) => ({ id: c.id, name: c.full_name, code: c.access_code ?? null, phone: c.phone }));

  return (
    <>
      <PageHeader
        title="Accès salle"
        subtitle="Scan des cartes membres à l'accueil"
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            {present} présent{present > 1 ? "s" : ""} aujourd&apos;hui
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <Scanner clients={scanClients} />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="relative overflow-hidden p-4">
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                <Users className="size-4 text-emerald-600" /> Présents
              </p>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-emerald-600 tabular-nums">{present}</p>
              <p className="text-xs text-muted">{todays.length} passage{todays.length > 1 ? "s" : ""} aujourd&apos;hui</p>
            </Card>
            <Card className="relative overflow-hidden p-4">
              <div className="absolute inset-x-0 top-0 h-1 bg-accent-500" />
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                <Activity className="size-4 text-accent-500" /> Moyenne
              </p>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-accent-500 tabular-nums">{avgPerDay}</p>
              <p className="text-xs text-muted">passages / jour (30 j)</p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Affluence du jour"
              subtitle={peak.n > 0 ? `Pointe habituelle vers ${peak.h} h` : "Par heure"}
              icon={<Clock className="size-4" />}
            />
            <div className="px-5 pb-5">
              <div className="flex h-28 items-end gap-1">
                {byHour.map(({ h, n }, i) => {
                  const avg = usual[i]!.n;
                  return (
                    <div key={h} className="group relative flex h-full flex-1 flex-col justify-end" title={`${h} h : ${n} passage${n > 1 ? "s" : ""} (moy. ${avg.toFixed(1)})`}>
                      <span className="absolute inset-x-0 bottom-0 rounded-t bg-slate-100" style={{ height: `${Math.min(100, (avg / Math.max(maxHour, peak.n || 1)) * 100)}%` }} />
                      <span
                        className={cn("relative rounded-t transition-all", h === nowHour ? "bg-accent-500" : n ? "bg-brand-500" : "bg-transparent")}
                        style={{ height: `${n ? Math.max(8, (n / Math.max(maxHour, peak.n || 1)) * 100) : 0}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex gap-1 text-[10px] font-medium text-muted">
                {byHour.map(({ h }) => (
                  <span key={h} className={cn("flex-1 text-center", h === nowHour && "font-bold text-accent-600")}>
                    {h % 3 === 0 ? h : ""}
                  </span>
                ))}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand-500" /> Aujourd&apos;hui
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-accent-500" /> Heure actuelle
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-slate-200" /> Moyenne 30 j
                </span>
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Passages d'aujourd'hui" subtitle="Mise à jour automatique" icon={<UserCheck className="size-4" />} />
            {todays.length === 0 ? (
              <div className="flex flex-col items-center border-t border-line px-6 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                  <ScanLine className="size-6" />
                </span>
                <p className="mt-3 font-display text-sm font-bold text-ink">Aucun passage pour l&apos;instant</p>
                <p className="mt-1 text-xs text-muted">Les membres scannés apparaîtront ici.</p>
              </div>
            ) : (
              <ul className="max-h-[440px] divide-y divide-line overflow-y-auto border-t border-line">
                {todays.map((g) => {
                  const c = clients.get(g.client_id);
                  const m = currentMembership(msByClient.get(g.client_id) ?? [], today);
                  return (
                    <li key={g.id}>
                      <Link href={`/clients/${g.client_id}?tab=abonnement`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-canvas/70">
                        <Avatar name={c?.full_name ?? "?"} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{c?.full_name ?? "Membre"}</span>
                          <span className="block truncate text-xs text-muted">{m?.name ?? "Sans abonnement"}</span>
                        </span>
                        <Badge tone={g.method === "qr" ? "brand" : "gray"}>
                          {g.method === "qr" && <QrCode className="size-3" />}
                          {METHOD[g.method]}
                        </Badge>
                        <span className="w-12 text-right text-sm font-bold tabular-nums text-slate-700">{fmtTime(g.checked_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
