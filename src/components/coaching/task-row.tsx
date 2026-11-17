import Link from "next/link";
import { CalendarDays, Check, Trash2, UserRound, Zap } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Avatar, Badge } from "@/components/ui";
import { deleteTaskAction, toggleTaskAction } from "@/actions/coaching";

const PRIORITY: Record<Task["priority"], { label: string; tone: "red" | "brand" | "gray" }> = {
  haute: { label: "Haute", tone: "red" },
  normale: { label: "Normale", tone: "brand" },
  basse: { label: "Basse", tone: "gray" },
};

function dueLabel(due: string, today: string) {
  const diff = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff < 0) return `En retard de ${-diff} j`;
  if (diff < 7) return fmtDate(due, { weekday: "long", day: "numeric" });
  return fmtDate(due, { day: "numeric", month: "short" });
}

export function TaskRow({
  task,
  today,
  client,
  assignee,
}: {
  task: Task;
  today: string;
  client?: { id: string; full_name: string } | null;
  assignee?: string | null;
}) {
  const overdue = !task.done && !!task.due_date && task.due_date < today;
  const auto = task.source?.startsWith("auto:");
  return (
    <li className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-canvas/60 sm:px-5">
      <form action={toggleTaskAction} className="pt-0.5">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value={task.done ? "1" : "0"} />
        <button
          type="submit"
          aria-label={task.done ? "Marquer comme à faire" : "Marquer comme terminée"}
          title={task.done ? "Marquer comme à faire" : "Marquer comme terminée"}
          className={cn(
            "grid size-[22px] place-items-center rounded-lg border-2 transition active:scale-90",
            task.done
              ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
              : overdue
                ? "border-red-300 bg-white text-transparent hover:border-red-500 hover:text-red-400"
                : "border-slate-300 bg-white text-transparent hover:border-brand-500 hover:text-brand-400",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold leading-snug", task.done ? "text-slate-400 line-through" : "text-ink")}>{task.title}</p>
        {task.notes && !task.done && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{task.notes}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          {client && (
            <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-brand-600">
              <Avatar name={client.full_name} size={18} />
              {client.full_name}
            </Link>
          )}
          {task.due_date && (
            <span className={cn("inline-flex items-center gap-1", overdue ? "font-semibold text-red-600" : "text-muted")}>
              <CalendarDays className="size-3.5" />
              {task.done ? fmtDate(task.due_date, { day: "numeric", month: "short" }) : dueLabel(task.due_date, today)}
            </span>
          )}
          {assignee && (
            <span className="inline-flex items-center gap-1 text-muted">
              <UserRound className="size-3.5" /> {assignee}
            </span>
          )}
          {!task.done && task.priority !== "normale" && <Badge tone={PRIORITY[task.priority].tone}>{PRIORITY[task.priority].label}</Badge>}
          {auto && (
            <Badge tone="accent">
              <Zap className="size-3" /> Auto
            </Badge>
          )}
        </div>
      </div>

      <form action={deleteTaskAction}>
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label="Supprimer la tâche"
          title="Supprimer"
          className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </form>
    </li>
  );
}
