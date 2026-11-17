import { AlertTriangle, CalendarCheck, Info, ListChecks, MessageCircle, Wallet } from "lucide-react";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<Notification["kind"], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "bg-brand-50 text-brand-500" },
  alerte: { icon: AlertTriangle, cls: "bg-red-50 text-red-500" },
  message: { icon: MessageCircle, cls: "bg-sky-50 text-sky-600" },
  paiement: { icon: Wallet, cls: "bg-emerald-50 text-emerald-600" },
  reservation: { icon: CalendarCheck, cls: "bg-accent-50 text-accent-600" },
  tache: { icon: ListChecks, cls: "bg-violet-50 text-violet-600" },
};

export function NotifIcon({ kind, size = 36 }: { kind: Notification["kind"]; size?: number }) {
  const m = MAP[kind] ?? MAP.info;
  const Icon = m.icon;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", m.cls)} style={{ width: size, height: size }}>
      <Icon className="size-[18px]" />
    </span>
  );
}
