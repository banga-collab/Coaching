import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, ChevronDown, Inbox, ListChecks, Plus, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Client, Profile, Task } from "@/lib/types";
import { cn, dayKey } from "@/lib/utils";
import { Card, Empty, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { TaskRow } from "@/components/coaching/task-row";
import { createTaskAction } from "@/actions/coaching";

export const metadata = { title: "Tâches" };

const PRIOS = [
  { key: "", label: "Toutes" },
  { key: "haute", label: "Haute" },
  { key: "normale", label: "Normale" },
  { key: "basse", label: "Basse" },
];

function Section({
  title,
  icon,
  tone,
  count,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: "red" | "accent" | "brand" | "gray";
  count: number;
  children: ReactNode;
}) {
  const tones = {
    red: "bg-red-50 text-red-600",
    accent: "bg-accent-50 text-accent-600",
    brand: "bg-brand-50 text-brand-500",
    gray: "bg-slate-100 text-slate-500",
  };
  return (
    <Card className={cn("overflow-hidden animate-fade-up", tone === "red" && "border-red-200")}>
      <div className={cn("flex items-center gap-2.5 px-4 py-3 sm:px-5", tone === "red" && "bg-red-50/60")}>
        <span className={cn("grid size-8 place-items-center rounded-lg", tones[tone])}>{icon}</span>
        <h2 className={cn("font-display text-[15px] font-bold", tone === "red" ? "text-red-700" : "text-ink")}>{title}</h2>
        <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone])}>{count}</span>
      </div>
      <ul className="divide-y divide-line border-t border-line">{children}</ul>
    </Card>
  );
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ vue?: string; prio?: string }> }) {
  const me = await requireStaff();
  const { vue = "mine", prio = "" } = await searchParams;
  const isAdmin = me.role === "admin";
  const showAll = isAdmin && vue === "all";
  const supabase = await createClient();

  let query = supabase.from("tasks").select("*").order("due_date", { ascending: true });
  if (!showAll) query = query.eq("assigned_to", me.id);
  if (prio) query = query.eq("priority", prio);

  const [{ data: tData }, { data: cData }, { data: pData }] = await Promise.all([
    query,
    supabase.from("clients").select("*").order("full_name"),
    showAll ? supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "coach"]) : Promise.resolve({ data: [] }),
  ]);
  const tasks = (tData ?? []) as Task[];
  const clients = (cData ?? []) as Client[];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const staff = new Map(((pData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map((p) => [p.id, p.full_name || p.email]));

  const today = dayKey(new Date());
  const open = tasks.filter((t) => !t.done);
  const rank = { haute: 0, normale: 1, basse: 2 } as const;
  const byPrio = (a: Task, b: Task) => rank[a.priority] - rank[b.priority] || a.created_at.localeCompare(b.created_at);
  const overdue = open.filter((t) => t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!) || byPrio(a, b));
  const dueToday = open.filter((t) => t.due_date === today).sort(byPrio);
  const upcoming = open.filter((t) => t.due_date && t.due_date > today).sort((a, b) => a.due_date!.localeCompare(b.due_date!) || byPrio(a, b));
  const noDate = open.filter((t) => !t.due_date).sort(byPrio);
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""))
    .slice(0, 40);

  const row = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      today={today}
      client={t.client_id ? clientById.get(t.client_id) ?? null : null}
      assignee={showAll && t.assigned_to && t.assigned_to !== me.id ? staff.get(t.assigned_to) ?? null : null}
    />
  );
  const href = (patch: Record<string, string>) => {
    const q = { ...(vue !== "mine" && { vue }), ...(prio && { prio }), ...patch };
    return { pathname: "/taches", query: Object.fromEntries(Object.entries(q).filter(([, v]) => v)) };
  };

  return (
    <>
      <PageHeader
        title="Tâches"
        subtitle={
          <>
            <b className="text-ink">{open.length}</b> à faire
            {overdue.length > 0 && (
              <>
                {" · "}
                <b className="text-red-600">{overdue.length} en retard</b>
              </>
            )}
            {" · "}
            {dueToday.length} aujourd&apos;hui
          </>
        }
      />

      {/* Ajout rapide */}
      <Card className="mb-5 p-3 sm:p-4">
        <ActionForm action={createTaskAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_160px_130px_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Plus className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-accent-500" />
            <Input name="title" required placeholder="Nouvelle tâche… (ex. Appeler Karim pour son bilan)" className="pl-10" aria-label="Intitulé" />
          </div>
          <Select name="client_id" defaultValue="" aria-label="Client">
            <option value="">Sans client</option>
            {clients
              .filter((c) => c.status !== "termine")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
          </Select>
          <Input type="date" name="due_date" defaultValue={today} aria-label="Échéance" />
          <Select name="priority" defaultValue="normale" aria-label="Priorité">
            <option value="haute">Haute</option>
            <option value="normale">Normale</option>
            <option value="basse">Basse</option>
          </Select>
          <SubmitButton className="h-11 sm:col-span-2 lg:col-span-1" pendingText="Ajout…">
            <Plus className="size-4" /> Ajouter
          </SubmitButton>
        </ActionForm>
      </Card>

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
            {[
              { key: "mine", label: "Mes tâches" },
              { key: "all", label: "Toute l'équipe" },
            ].map((f) => (
              <Link
                key={f.key}
                href={href({ vue: f.key === "mine" ? "" : f.key })}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", (showAll ? "all" : "mine") === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
              >
                {f.label}
              </Link>
            ))}
          </div>
        )}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
            {PRIOS.map((f) => (
              <Link
                key={f.key || "all"}
                href={href({ prio: f.key })}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", prio === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <Empty
            icon={<ListChecks className="size-6" />}
            title={prio ? "Aucune tâche avec ce filtre" : "Aucune tâche"}
            text={prio ? "Change de priorité pour voir d'autres tâches." : "Ajoute une tâche ci-dessus. Les automatisations en créeront aussi pour toi."}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {open.length === 0 && (
            <Card className="flex items-center gap-4 p-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </span>
              <div>
                <p className="font-display font-bold text-ink">Tout est fait, bravo !</p>
                <p className="text-sm text-muted">Aucune tâche en attente pour le moment.</p>
              </div>
            </Card>
          )}
          {overdue.length > 0 && (
            <Section title="En retard" icon={<AlertTriangle className="size-4" />} tone="red" count={overdue.length}>
              {overdue.map(row)}
            </Section>
          )}
          {dueToday.length > 0 && (
            <Section title="Aujourd'hui" icon={<Sun className="size-4" />} tone="accent" count={dueToday.length}>
              {dueToday.map(row)}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="À venir" icon={<CalendarClock className="size-4" />} tone="brand" count={upcoming.length}>
              {upcoming.map(row)}
            </Section>
          )}
          {noDate.length > 0 && (
            <Section title="Sans date" icon={<Inbox className="size-4" />} tone="gray" count={noDate.length}>
              {noDate.map(row)}
            </Section>
          )}
          {done.length > 0 && (
            <details className="group/done">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 shadow-card transition hover:bg-canvas sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-4" />
                </span>
                <span className="font-display text-[15px] font-bold text-ink">Terminées</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{done.length}</span>
                <ChevronDown className="ml-auto size-4 text-muted transition group-open/done:rotate-180" />
              </summary>
              <Card className="mt-2 overflow-hidden">
                <ul className="divide-y divide-line">{done.map(row)}</ul>
              </Card>
            </details>
          )}
          <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted">
            <CalendarDays className="size-3.5" /> Les tâches marquées « Auto » sont créées par les{" "}
            <Link href="/automatisations" className="font-semibold text-brand-600 hover:underline">
              automatisations
            </Link>
            .
          </p>
        </div>
      )}
    </>
  );
}
