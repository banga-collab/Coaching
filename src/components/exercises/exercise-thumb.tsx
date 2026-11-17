import { Activity, Dumbbell, Flame, Move, Play, Shield, StretchHorizontal, type LucideIcon } from "lucide-react";
import type { Exercise } from "@/lib/types";
import { categoryGradient, parseVideo } from "@/lib/video";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Musculation: Dumbbell,
  Cardio: Flame,
  Gainage: Shield,
  Mobilité: Move,
  Étirements: StretchHorizontal,
  Fonctionnel: Activity,
};

export function categoryIcon(category: string | null | undefined): LucideIcon {
  return ICONS[category ?? ""] ?? Dumbbell;
}

/** Vignette 16:9 : miniature YouTube, ou visuel généré (dégradé + icône) si pas de vidéo. */
export function ExerciseThumb({
  exercise,
  className,
  showPlay = true,
  size = "md",
}: {
  exercise: Pick<Exercise, "name" | "category" | "video_url">;
  className?: string;
  showPlay?: boolean;
  size?: "sm" | "md";
}) {
  const video = parseVideo(exercise.video_url);
  const Icon = categoryIcon(exercise.category);
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-slate-900", className)}>
      {video?.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnail} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", categoryGradient(exercise.category))}>
          <div className="absolute -right-6 -top-6 size-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-4 size-32 rounded-full bg-black/10" />
          <Icon className={cn("absolute text-white/25", size === "sm" ? "-bottom-1 right-1 size-10" : "-bottom-3 right-2 size-24")} strokeWidth={1.5} />
          {size === "md" && (
            <p className="absolute bottom-3 left-3 right-16 line-clamp-2 font-display text-lg font-extrabold leading-tight text-white drop-shadow-sm">{exercise.name}</p>
          )}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      {showPlay && video && (
        <span
          className={cn(
            "absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-accent-500 shadow-lg ring-4 ring-white/30 transition duration-200 group-hover:scale-110",
            size === "sm" ? "size-8" : "size-14",
          )}
        >
          <Play className={cn("translate-x-[1px] fill-current", size === "sm" ? "size-3.5" : "size-6")} />
        </span>
      )}
      {showPlay && !video && size === "md" && (
        <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">Sans vidéo</span>
      )}
    </div>
  );
}
