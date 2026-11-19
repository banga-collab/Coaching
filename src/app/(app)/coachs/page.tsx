import Link from "next/link";
import { CalendarClock, Clock, Phone, UserPlus, Users } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, loadCoachDirectory } from "@/lib/coachs";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { CoachAvatar, NowBadge, WeekBars } from "@/components/coachs/bits";

export const metadata = { title: "Coachs" };

export default async function CoachsPage() {
  const me = await requireStaff();
  const manager = isManager(me.role);
  const supabase = await createClient();
  const { cards } = await loadCoachDirectory(supabase);
  const free = cards.filter((c) => c.now.kind === "libre").length;
  const busy = cards.filter((c) => c.now.kind === "en_seance" || c.now.kind === "en_cours_collectif").length;

  return (
    <div>
      <PageHeader
        title="Coachs"
        subtitle={`${cards.length} coachs · ${free} libre${free > 1 ? "s" : ""} maintenant · ${busy} en séance`}
        actions={
          <>
            {manager && (
              <LinkButton href="/planning" variant="secondary">
                <CalendarClock className="size-4" /> Planning équipe
              </LinkButton>
            )}
            {me.role === "admin" && (
              <LinkButton href="/admin/coachs">
                <UserPlus className="size-4" /> Ajouter un coach
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const name = c.profile.full_name || c.profile.email;
          return (
            <Link key={c.profile.id} href={`/coachs/${c.profile.id}`} className="group">
              <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <CoachAvatar name={name} id={c.profile.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold text-ink">{name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={c.profile.role === "head_coach" ? "accent" : c.profile.role === "admin" ? "brand" : "gray"}>{ROLE_LABEL[c.profile.role]}</Badge>
                      {c.profile.id === me.id && <Badge tone="green">Moi</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <NowBadge now={c.now} />
                </div>
                {c.profile.specialties && c.profile.specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.profile.specialties.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 py-2">
                    <p className="font-display text-lg font-bold text-ink">{c.clients}</p>
                    <p className="text-[11px] text-muted">clients</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2">
                    <p className="font-display text-lg font-bold text-ink">{c.today.length}</p>
                    <p className="text-[11px] text-muted">aujourd&apos;hui</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2">
                    <p className="font-display text-lg font-bold text-ink">{c.week.total}</p>
                    <p className="text-[11px] text-muted">cette semaine</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <Clock className="size-3" /> Créneaux · {c.weeklyHours} h / semaine
                  </p>
                  <WeekBars days={c.availability} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {c.week.done} réalisée{c.week.done > 1 ? "s" : ""} · {c.week.upcoming} à venir{c.week.classes ? ` · ${c.week.classes} cours` : ""}
                  </span>
                  {c.profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" /> {c.profile.phone}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
