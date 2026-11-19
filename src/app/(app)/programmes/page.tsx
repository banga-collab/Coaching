import Link from "next/link";
import { CalendarRange, ChevronRight, Dumbbell, Layers, Plus, Target, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { ClientProgram, Program } from "@/lib/types";
import { cn } from "@/lib/utils";
import { normName } from "@/lib/video";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { levelTone } from "@/components/coaching/program-constants";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata = { title: "Programmes" };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ q?: string; objectif?: string; niveau?: string }> }) {
  await requireStaff();
  const { q = "", objectif = "", niveau = "" } = await searchParams;
  const supabase = await createClient();

  const [{ data: pData }, { data: cpData }] = await Promise.all([
    supabase.from("programs").select("*").order("created_at", { ascending: false }),
    supabase.from("client_programs").select("program_id, client_id, status").in("status", ["actif", "pause"]),
  ]);
  const all = (pData ?? []) as Program[];
  const assigned = (cpData ?? []) as Pick<ClientProgram, "program_id" | "client_id" | "status">[];
  const clientsByProgram = new Map<string, Set<string>>();
  for (const a of assigned) {
    const set = clientsByProgram.get(a.program_id) ?? new Set<string>();
    set.add(a.client_id);
    clientsByProgram.set(a.program_id, set);
  }
  const clientsOf = (id: string) => clientsByProgram.get(id)?.size ?? 0;

  // Recherche (insensible à la casse et aux accents) puis filtres
  const needle = normName(q);
  const searched = needle ? all.filter((p) => normName([p.name, p.description, p.goal, p.level].filter(Boolean).join(" ")).includes(needle)) : all;
  const countBy = (list: Program[], key: "goal" | "level") => {
    const m = new Map<string, number>();
    for (const p of list) if (p[key]) m.set(p[key]!, (m.get(p[key]!) ?? 0) + 1);
    return m;
  };
  const goalCount = countBy(niveau ? searched.filter((p) => p.level === niveau) : searched, "goal");
  const levelCount = countBy(objectif ? searched.filter((p) => p.goal === objectif) : searched, "level");
  const sortFr = (a: string, b: string) => a.localeCompare(b, "fr");
  const goals = [...new Set(all.map((p) => p.goal).filter((g): g is string => !!g))].sort(sortFr);
  const levels = [...new Set(all.map((p) => p.level).filter((l): l is string => !!l))].sort(sortFr);
  const filters = [
    { param: "objectif", label: "Objectif", options: goals.map((g) => ({ value: g, label: g, count: goalCount.get(g) ?? 0 })) },
    ...(levels.length ? [{ param: "niveau", label: "Niveau", options: levels.map((l) => ({ value: l, label: l, count: levelCount.get(l) ?? 0 })) }] : []),
  ];
  const programs = searched.filter((p) => (!objectif || p.goal === objectif) && (!niveau || p.level === niveau));
  const filtered = !!(q || objectif || niveau);

  return (
    <>
      <PageHeader
        title="Programmes"
        subtitle={`${all.length} programme${all.length > 1 ? "s" : ""} dans la bibliothèque · ${new Set(assigned.map((a) => a.client_id)).size} client(s) suivi(s)`}
        actions={
          <LinkButton href="/programmes/nouveau">
            <Plus className="size-4" /> Nouveau programme
          </LinkButton>
        }
      />

      <ListToolbar placeholder="Nom, description, objectif…" filters={filters} exportKind="programmes" />

      {programs.length === 0 ? (
        <Card>
          <Empty
            icon={<Dumbbell className="size-6" />}
            title={filtered ? "Aucun programme trouvé" : "Aucun programme pour l'instant"}
            text={filtered ? "Essaie une autre recherche ou un autre objectif." : "Crée ton premier programme d'entraînement, puis assigne-le à tes clients."}
            action={
              filtered ? (
                <LinkButton href="/programmes" variant="secondary">
                  Réinitialiser les filtres
                </LinkButton>
              ) : (
                <LinkButton href="/programmes/nouveau">
                  <Plus className="size-4" /> Créer un programme
                </LinkButton>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((p, i) => {
            const days = Array.isArray(p.days) ? p.days : [];
            const exCount = days.reduce((a, d) => a + (d.exercises?.length ?? 0), 0);
            const n = clientsOf(p.id);
            return (
              <Link
                key={p.id}
                href={`/programmes/${p.id}`}
                className="group animate-fade-up rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <Card className="relative flex h-full flex-col overflow-hidden transition duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-pop">
                  <div className="relative h-24 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-5 pt-4">
                    <Dumbbell className="absolute -end-4 -bottom-6 size-28 rotate-[-20deg] text-white/10 transition duration-300 group-hover:rotate-[-10deg]" />
                    <div className="flex items-center gap-2">
                      {p.goal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                          <Target className="size-3" /> {p.goal}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 font-display text-3xl font-extrabold leading-none text-white">
                      {p.weeks}
                      <span className="ms-1 text-sm font-semibold text-white/70">sem.</span>
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-base font-bold leading-snug text-ink group-hover:text-brand-600">{p.name}</h3>
                      <Badge tone={levelTone(p.level)}>{p.level ?? "—"}</Badge>
                    </div>
                    {p.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.description}</p>}
                    <div className="mt-auto grid grid-cols-3 gap-2 pt-5 text-center">
                      <div className="rounded-xl bg-canvas px-2 py-2">
                        <CalendarRange className="mx-auto size-4 text-brand-500" />
                        <p className="mt-1 text-sm font-bold text-ink">{days.length}</p>
                        <p className="text-[11px] text-muted">jour{days.length > 1 ? "s" : ""}/sem.</p>
                      </div>
                      <div className="rounded-xl bg-canvas px-2 py-2">
                        <Layers className="mx-auto size-4 text-brand-500" />
                        <p className="mt-1 text-sm font-bold text-ink">{exCount}</p>
                        <p className="text-[11px] text-muted">exercices</p>
                      </div>
                      <div className={cn("rounded-xl px-2 py-2", n ? "bg-accent-50" : "bg-canvas")}>
                        <Users className={cn("mx-auto size-4", n ? "text-accent-500" : "text-slate-400")} />
                        <p className={cn("mt-1 text-sm font-bold", n ? "text-accent-700" : "text-ink")}>{n}</p>
                        <p className="text-[11px] text-muted">client{n > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm font-semibold text-brand-600">
                    Voir le programme
                    <ChevronRight className="size-4 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
