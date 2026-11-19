import type { CoachNow } from "@/lib/coachs";
import { Badge } from "@/components/ui";
import { cn, initials } from "@/lib/utils";

const AVATAR = ["bg-brand-600", "bg-accent-500", "bg-emerald-600", "bg-violet-600", "bg-sky-600", "bg-rose-500"];

export function CoachAvatar({ name, id, size = "md" }: { name: string; id: string; size?: "md" | "lg" }) {
  const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-bold text-white",
        AVATAR[n % AVATAR.length],
        size === "lg" ? "size-16 text-xl" : "size-12 text-base",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function NowBadge({ now }: { now: CoachNow }) {
  if (now.kind === "en_seance") return <Badge tone="accent" dot>En séance · jusqu&apos;à {now.until}</Badge>;
  if (now.kind === "en_cours_collectif") return <Badge tone="accent" dot>{now.label} · jusqu&apos;à {now.until}</Badge>;
  if (now.kind === "libre") return <Badge tone="green" dot>Libre · jusqu&apos;à {now.until}</Badge>;
  if (now.kind === "conge") return <Badge tone="red" dot>{now.label}</Badge>;
  return (
    <Badge tone="gray" dot>
      {now.next ? `Prochain créneau ${now.next}` : now.label}
    </Badge>
  );
}

export function WeekBars({ days }: { days: { weekday: number; label: string; slots: string[] }[] }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => (
        <div key={d.weekday} className="text-center" title={d.slots.length ? d.slots.join(", ") : "Pas de créneau"}>
          <div className={cn("mx-auto h-1.5 rounded-full", d.slots.length ? "bg-emerald-400" : "bg-slate-200")} />
          <span className={cn("mt-1 block text-[10px] font-semibold", d.slots.length ? "text-ink" : "text-muted")}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
