import {
  Award,
  CalendarCheck,
  Crown,
  Dumbbell,
  Flame,
  HeartHandshake,
  Lock,
  Medal,
  Sparkles,
  Sunrise,
  Target,
  TrendingDown,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeDef } from "@/lib/badges";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { CalendarCheck, Crown, Dumbbell, Flame, HeartHandshake, Medal, Sparkles, Sunrise, Target, TrendingDown, Trophy, Zap };

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Award;
  return <I className={className} />;
}

/** Médaillon rond d'un badge (coloré si obtenu, gris sinon) */
export function BadgeMedal({ def, earned, size = 56 }: { def: BadgeDef; earned: boolean; size?: number }) {
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full", earned ? "text-white shadow-md" : "bg-slate-100 text-slate-300")}
      style={{
        width: size,
        height: size,
        ...(earned ? { background: `radial-gradient(circle at 30% 25%, ${def.color}cc, ${def.color})`, boxShadow: `0 6px 16px -6px ${def.color}` } : {}),
      }}
    >
      <BadgeIcon name={def.icon} className="size-[45%]" />
      {!earned && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-white bg-slate-300 text-white">
          <Lock className="size-2.5" />
        </span>
      )}
    </span>
  );
}
