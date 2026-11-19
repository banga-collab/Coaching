import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CalendarPlus, Clock, Mail, MessageCircle, Pencil, Phone, Plane, Users } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Session } from "@/lib/types";
import { ROLE_LABEL, loadCoachDirectory } from "@/lib/coachs";
import { UPCOMING_STATUSES, WEEKDAYS } from "@/lib/planning";
import { SESSION_LABEL, fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { CoachAvatar, NowBadge } from "@/components/coachs/bits";

export const metadata = { title: "Coach" };

const tone = (s: Session["status"]) =>
  s === "realisee" ? "green" : s === "planifiee" || s === "reportee" ? "amber" : s === "en_cours" ? "accent" : s === "absent" || s === "refusee" ? "red" : s === "annulee" ? "gray" : "brand";

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const manager = isManager(me.role);
  const supabase = await createClient();
  const { cards } = await loadCoachDirectory(supabase, id);
  const c = cards[0];
  if (!c) notFound();
  const p = c.profile;
  const name = p.full_name || p.email;
  const seeClients = manager || id === me.id;

  const nowIso = new Date().toISOString();
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString();
  const [{ data: upData }, { data: clData }] = await Promise.all([
    supabase.from("sessions").select("*").eq("coach_id", id).gte("starts_at", nowIso).lt("starts_at", in14).order("starts_at"),
    seeClients ? supabase.from("clients").select("*").eq("coach_id", id).neq("status", "termine").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const upcoming = ((upData ?? []) as Session[]).filter((s) => UPCOMING_STATUSES.includes(s.status));
  const myClients = (clData ?? []) as Client[];
  const clientIds = [...new Set(upcoming.map((s) => s.client_id))];
  const { data: names } = clientIds.length ? await supabase.from("clients").select("id, full_name").in("id", clientIds) : { data: [] };
  const clientName = new Map(((names ?? []) as { id: string; full_name: string }[]).map((x) => [x.id, x.full_name]));
  const wa = p.phone ? `https://wa.me/212${p.phone.replace(/\D/g, "").replace(/^0/, "")}` : null;

  return (
    <div>
      <PageHeader
        back={<BackLink href="/coachs" label="Coachs" />}
        title={
          <span className="flex items-center gap-4">
            <CoachAvatar name={name} id={p.id} size="lg" />
            <span>
              {name}
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-base font-normal">
                <Badge tone={p.role === "head_coach" ? "accent" : p.role === "admin" ? "brand" : "gray"}>{ROLE_LABEL[p.role]}</Badge>
                <NowBadge now={c.now} />
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {manager && (
              <LinkButton href={`/planning?coach=${p.id}#affecter`}>
                <CalendarPlus className="size-4" /> Affecter une séance
              </LinkButton>
            )}
            {(manager || id === me.id) && (
              <LinkButton href={id === me.id ? "/disponibilites" : `/disponibilites?coach=${p.id}`} variant="secondary">
                <Clock className="size-4" /> Créneaux
              </LinkButton>
            )}
            {me.role === "admin" && (
              <LinkButton href={`/admin/coachs/${p.id}`} variant="secondary">
                <Pencil className="size-4" /> Modifier
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: c.clients, l: "clients actifs" },
              { v: c.today.length, l: "séances aujourd'hui" },
              { v: `${c.week.done}/${c.week.total}`, l: "réalisées cette semaine" },
              { v: `${Math.round((c.week.minutes / 60) * 10) / 10} h`, l: "de coaching cette semaine" },
            ].map((k) => (
              <Card key={k.l} className="p-4">
                <p className="font-display text-2xl font-bold text-ink">{k.v}</p>
                <p className="text-xs text-muted">{k.l}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Prochaines séances" subtitle="14 prochains jours" icon={<CalendarClock className="size-4" />} />
            {upcoming.length ? (
              <ul className="divide-y divide-line">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    <Link href={`/seances/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="w-24 shrink-0">
                        <p className="text-sm font-semibold capitalize text-ink">{fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })}</p>
                        <p className="text-xs text-muted">{fmtTime(s.starts_at)} · {s.duration_min} min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{clientName.get(s.client_id) ?? "Client"}</p>
                        <p className="truncate text-xs text-muted">{s.type}</p>
                      </div>
                      <Badge tone={tone(s.status)}>{SESSION_LABEL[s.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted">Aucune séance prévue.</p>
            )}
          </Card>

          {seeClients && (
            <Card>
              <CardHeader title={`Clients suivis (${myClients.length})`} icon={<Users className="size-4" />} />
              {myClients.length ? (
                <ul className="grid gap-px bg-line sm:grid-cols-2">
                  {myClients.map((cl) => (
                    <li key={cl.id} className="bg-white">
                      <Link href={`/clients/${cl.id}`} className="block px-5 py-3 hover:bg-slate-50">
                        <p className="font-semibold text-ink">{cl.full_name}</p>
                        <p className="text-xs text-muted">
                          {cl.goal ?? "Objectif non renseigné"}
                          {cl.status === "pause" ? " · en pause" : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-muted">Aucun client actif.</p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-3 font-display font-bold">Contact</p>
            <div className="space-y-2 text-sm">
              {p.phone && (
                <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-ink hover:text-brand-600">
                  <Phone className="size-4 text-muted" /> {p.phone}
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-ink hover:text-emerald-600">
                  <MessageCircle className="size-4 text-muted" /> WhatsApp
                </a>
              )}
              <a href={`mailto:${p.email}`} className="flex items-center gap-2 break-all text-ink hover:text-brand-600">
                <Mail className="size-4 text-muted" /> {p.email}
              </a>
            </div>
            {p.specialties && p.specialties.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Spécialités</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.specialties.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-3 flex items-center justify-between font-display font-bold">
              Créneaux de la semaine <span className="text-xs font-semibold text-muted">{c.weeklyHours} h</span>
            </p>
            <ul className="space-y-1.5 text-sm">
              {c.availability.map((d) => (
                <li key={d.weekday} className="flex items-start justify-between gap-3">
                  <span className="w-20 shrink-0 font-semibold text-ink">{WEEKDAYS[d.weekday - 1]}</span>
                  <span className={d.slots.length ? "text-right text-ink" : "text-right text-muted"}>{d.slots.length ? d.slots.join(" · ") : "—"}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <p className="mb-3 flex items-center gap-2 font-display font-bold">
              <Plane className="size-4 text-accent-500" /> Congés à venir
            </p>
            {c.timeOff.length ? (
              <ul className="space-y-2 text-sm">
                {c.timeOff.map((o) => (
                  <li key={o.id}>
                    <p className="font-semibold text-ink">
                      {fmtDate(o.starts_on, { day: "numeric", month: "short" })} → {fmtDate(o.ends_on, { day: "numeric", month: "short" })}
                    </p>
                    {o.reason && <p className="text-xs text-muted">{o.reason}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aucun congé prévu.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
