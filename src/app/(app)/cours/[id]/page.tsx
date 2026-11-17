import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CalendarDays, Check, Clock, Gauge, Hourglass, MapPin, Pencil, RotateCcw, Trash2, UserPlus, UserRound, Users, X } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassBooking, Client, GroupClass, Profile } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, LinkButton, PageHeader, Select } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { OccupancyBar } from "@/components/classes/class-card";
import { BOOKING_LABEL, cat, classStats } from "@/components/classes/categories";
import {
  cancelClassAction,
  deleteClassAction,
  restoreClassAction,
  setBookingStatusAction,
  staffAddMemberAction,
  staffCancelBookingAction,
} from "@/actions/classes";

export const metadata = { title: "Cours collectif" };

function IconAction({ action, b, status, title, className, children }: { action: (fd: FormData) => Promise<void>; b: ClassBooking; status?: string; title: string; className: string; children: React.ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="booking_id" value={b.id} />
      <input type="hidden" name="class_id" value={b.class_id} />
      {status && <input type="hidden" name="status" value={status} />}
      <button type="submit" title={title} aria-label={title} className={cn("grid size-9 place-items-center rounded-xl border transition", className)}>
        {children}
      </button>
    </form>
  );
}

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireStaff()]);
  const supabase = await createClient();
  const { data: cData } = await supabase.from("group_classes").select("*").eq("id", id).maybeSingle();
  if (!cData) notFound();
  const c = cData as GroupClass;
  const [{ data: bData }, { data: clData }, coachRes] = await Promise.all([
    supabase.from("class_bookings").select("*").eq("class_id", id).order("created_at"),
    supabase.from("clients").select("*").neq("status", "termine").order("full_name"),
    c.coach_id ? supabase.from("profiles").select("*").eq("id", c.coach_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const bookings = (bData ?? []) as ClassBooking[];
  const clients = (clData ?? []) as Client[];
  const byId = new Map(clients.map((x) => [x.id, x]));
  // Clients terminés éventuellement inscrits
  const missing = bookings.filter((b) => !byId.has(b.client_id)).map((b) => b.client_id);
  if (missing.length) {
    const { data } = await supabase.from("clients").select("*").in("id", missing);
    for (const x of (data ?? []) as Client[]) byId.set(x.id, x);
  }
  const coach = coachRes.data as Profile | null;
  const st = cat(c.category);
  const stats = classStats(bookings, id);
  const roster = bookings.filter((b) => b.status === "inscrit" || b.status === "present" || b.status === "absent");
  const waitlist = bookings.filter((b) => b.status === "attente");
  const cancelled = bookings.filter((b) => b.status === "annule");
  const activeIds = new Set(bookings.filter((b) => b.status !== "annule").map((b) => b.client_id));
  const candidates = clients.filter((x) => !activeIds.has(x.id));
  const start = new Date(c.starts_at).getTime();
  const started = start < Date.now();
  const end = new Date(start + c.duration_min * 60000).toISOString();
  const full = stats.taken >= c.capacity;
  const presentCount = bookings.filter((b) => b.status === "present").length;

  const name = (cid: string) => byId.get(cid)?.full_name ?? "Membre";

  return (
    <>
      <PageHeader
        back={<BackLink href={`/cours?semaine=${c.starts_at.slice(0, 10)}`} label="Planning des cours" />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className={cn("line-clamp-2", c.cancelled && "line-through decoration-2")}>{c.title}</span>
            {c.cancelled && <Badge tone="red">Annulé</Badge>}
          </span>
        }
        subtitle={
          <span className="capitalize">
            {fmtDate(c.starts_at, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(c.starts_at)} – {fmtTime(end)}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/cours/${id}/modifier`} variant="secondary">
              <Pencil className="size-4" /> Modifier
            </LinkButton>
            {c.cancelled ? (
              <form action={restoreClassAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="secondary" pendingText="…">
                  <RotateCcw className="size-4" /> Rétablir
                </SubmitButton>
              </form>
            ) : (
              !started && (
                <form action={cancelClassAction}>
                  <input type="hidden" name="id" value={id} />
                  <ConfirmButton message={`Annuler ce cours ? Les ${stats.taken + stats.waiting} membres inscrits ou en attente seront prévenus.`}>
                    <Ban className="size-4" /> Annuler le cours
                  </ConfirmButton>
                </form>
              )
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Infos */}
        <div className="space-y-5">
          <Card className="relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: st.hex }} />
            <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold", st.soft)}>
              {st.emoji} {c.category}
            </span>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                [CalendarDays, "Date", <span key="d" className="capitalize">{fmtDate(c.starts_at, { weekday: "long", day: "numeric", month: "long" })}</span>],
                [Clock, "Horaire", `${fmtTime(c.starts_at)} · ${c.duration_min} min`],
                [UserRound, "Coach", coach?.full_name || "Non attribué"],
                [MapPin, "Salle", c.room ?? "—"],
                [Gauge, "Niveau", c.level ?? "Tous niveaux"],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={label as string} className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-muted">
                      <I className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label as string}</dt>
                      <dd className="truncate font-medium text-ink">{value as React.ReactNode}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
            {c.description && <p className="mt-4 rounded-xl bg-canvas p-3 text-sm text-slate-600">{c.description}</p>}
          </Card>

          <Card className="p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[13px] font-medium text-muted">Remplissage</p>
                <p className={cn("font-display text-[28px] font-extrabold tracking-tight", full ? "text-red-600" : "text-brand-500")}>
                  {stats.taken}
                  <span className="text-lg text-muted">/{c.capacity}</span>
                </p>
              </div>
              <div className="text-right text-xs font-semibold">
                {full ? <Badge tone="red">Complet</Badge> : <Badge tone="green">{c.capacity - stats.taken} places libres</Badge>}
                {stats.waiting > 0 && <p className="mt-1.5 text-amber-600">{stats.waiting} en attente</p>}
              </div>
            </div>
            <OccupancyBar taken={stats.taken} capacity={c.capacity} className="mt-3 h-2.5" />
            {started && roster.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                {presentCount} présent{presentCount > 1 ? "s" : ""} sur {roster.length} inscrit{roster.length > 1 ? "s" : ""}
              </p>
            )}
          </Card>

          {!c.cancelled && (
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-ink">
                <UserPlus className="size-4 text-brand-500" /> Inscrire un membre
              </p>
              {candidates.length ? (
                <ActionForm action={staffAddMemberAction} className="space-y-3">
                  <input type="hidden" name="class_id" value={id} />
                  <Select name="client_id" required defaultValue="">
                    <option value="" disabled>
                      Choisir un membre…
                    </option>
                    {candidates.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.full_name}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="brand" className="w-full" pendingText="Inscription…">
                    {full ? "Ajouter en liste d'attente" : "Inscrire"}
                  </SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-sm text-muted">Tous les membres actifs sont déjà inscrits.</p>
              )}
            </Card>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-5">
          <Card>
            <CardHeader icon={<Users className="size-4" />} title="Participants" subtitle={started ? "Pointez les présences" : "Inscriptions confirmées"} action={<Badge tone="brand">{roster.length}</Badge>} />
            {roster.length === 0 ? (
              <Empty icon={<Users className="size-6" />} title="Personne n'est encore inscrit" text="Les réservations des adhérents apparaîtront ici." />
            ) : (
              <ul className="divide-y divide-line">
                {roster.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-canvas/60">
                    <span className="w-5 text-center text-xs font-semibold text-muted">{i + 1}</span>
                    <Avatar name={name(b.client_id)} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/clients/${b.client_id}`} className="block truncate font-semibold text-ink hover:text-brand-600">
                        {name(b.client_id)}
                      </Link>
                      <p className="text-xs text-muted">Réservé le {fmtDate(b.created_at, { day: "numeric", month: "short" })}</p>
                    </div>
                    <Badge dot tone={BOOKING_LABEL[b.status].tone}>
                      {BOOKING_LABEL[b.status].label}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <IconAction
                        action={setBookingStatusAction}
                        b={b}
                        status={b.status === "present" ? "inscrit" : "present"}
                        title={b.status === "present" ? "Retirer la présence" : "Marquer présent"}
                        className={b.status === "present" ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-white text-emerald-600 hover:bg-emerald-50"}
                      >
                        <Check className="size-4" />
                      </IconAction>
                      <IconAction
                        action={setBookingStatusAction}
                        b={b}
                        status={b.status === "absent" ? "inscrit" : "absent"}
                        title={b.status === "absent" ? "Retirer l'absence" : "Marquer absent"}
                        className={b.status === "absent" ? "border-red-500 bg-red-500 text-white" : "border-line bg-white text-red-600 hover:bg-red-50"}
                      >
                        <X className="size-4" />
                      </IconAction>
                      {!started && (
                        <IconAction action={staffCancelBookingAction} b={b} title="Annuler la réservation" className="border-line bg-white text-muted hover:bg-canvas hover:text-ink">
                          <Trash2 className="size-4" />
                        </IconAction>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon={<Hourglass className="size-4" />} title="Liste d'attente" subtitle="Promotion automatique dès qu'une place se libère" action={<Badge tone="amber">{waitlist.length}</Badge>} />
            {waitlist.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Aucun membre en attente.</p>
            ) : (
              <ul className="divide-y divide-line">
                {waitlist.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-7 place-items-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">{i + 1}</span>
                    <Avatar name={name(b.client_id)} size={32} />
                    <Link href={`/clients/${b.client_id}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-brand-600">
                      {name(b.client_id)}
                    </Link>
                    <IconAction action={staffCancelBookingAction} b={b} title="Retirer de la liste d'attente" className="border-line bg-white text-muted hover:bg-canvas hover:text-ink">
                      <X className="size-4" />
                    </IconAction>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {cancelled.length > 0 && (
            <details className="group rounded-2xl border border-line bg-white shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-muted hover:text-ink">
                Réservations annulées ({cancelled.length})
                <span className="text-xs transition group-open:rotate-180">▾</span>
              </summary>
              <ul className="flex flex-wrap gap-2 px-5 pb-5">
                {cancelled.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-full bg-canvas py-1 pl-1 pr-3 text-sm text-slate-600">
                    <Avatar name={name(b.client_id)} size={24} /> {name(b.client_id)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <form action={deleteClassAction} className="flex justify-end">
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message="Supprimer définitivement ce cours et toutes ses réservations ?" className="h-9 border-transparent text-xs">
              <Trash2 className="size-3.5" /> Supprimer le cours
            </ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
