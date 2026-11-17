"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dumbbell, Gauge, Lightbulb, ListOrdered, Play, X } from "lucide-react";
import type { Exercise } from "@/lib/types";
import { parseVideo } from "@/lib/video";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { ExerciseThumb } from "./exercise-thumb";

/** Lecteur 16:9 responsive (YouTube nocookie, Vimeo, ou fichier mp4). */
export function ExercisePlayer({ url, title, fallback }: { url: string | null | undefined; title: string; fallback?: ReactNode }) {
  const video = parseVideo(url);
  if (!video) return <>{fallback ?? null}</>;
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {video.kind === "file" ? (
        <video src={video.src} controls playsInline preload="metadata" className="absolute inset-0 size-full object-contain" />
      ) : (
        <iframe
          src={video.embedUrl}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      )}
    </div>
  );
}

export const levelTone = (l: string | null | undefined) =>
  l === "Débutant" ? "green" : l === "Intermédiaire" ? "amber" : l === "Avancé" ? "red" : "gray";

/** Fenêtre de détail d'un exercice (bottom sheet sur mobile, modale sur ordinateur). */
export function ExerciseModal({
  exercise,
  onClose,
  footer,
  extra,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  footer?: ReactNode;
  extra?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!exercise) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [exercise, onClose]);

  if (!mounted || !exercise) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={exercise.name}>
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] animate-[fade-in_.2s_ease-out]" />
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop animate-[sheet-up_.28s_cubic-bezier(.2,.8,.2,1)] sm:rounded-3xl">
        <style>{`@keyframes sheet-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}@keyframes fade-in{from{opacity:0}to{opacity:1}}`}</style>
        <div className="relative shrink-0">
          <ExercisePlayer
            url={exercise.video_url}
            title={exercise.name}
            fallback={<ExerciseThumb exercise={exercise} showPlay={false} />}
          />
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/60 sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{exercise.category}</p>
              <h2 className="mt-0.5 font-display text-xl font-extrabold text-ink sm:text-2xl">{exercise.name}</h2>
            </div>
            {exercise.level && <Badge tone={levelTone(exercise.level)}>{exercise.level}</Badge>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {exercise.muscles.map((m) => (
              <span key={m} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
                {m}
              </span>
            ))}
            {exercise.equipment && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                <Dumbbell className="size-3" /> {exercise.equipment}
              </span>
            )}
          </div>
          {extra}
          {exercise.instructions && (
            <section className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <ListOrdered className="size-4 text-brand-500" /> Exécution
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{exercise.instructions}</p>
            </section>
          )}
          {exercise.tips && (
            <section className="mt-4 rounded-2xl border border-accent-100 bg-accent-50/60 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-accent-700">
                <Lightbulb className="size-4" /> Conseils du coach
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{exercise.tips}</p>
            </section>
          )}
          {!exercise.instructions && !exercise.tips && (
            <p className="mt-5 flex items-center gap-2 text-sm text-muted">
              <Gauge className="size-4" /> Pas encore de consignes pour cet exercice.
            </p>
          )}
          {footer && <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Bouton qui ouvre la fiche vidéo d'un exercice. */
export function ExerciseVideoButton({
  exercise,
  children,
  className,
  label,
}: {
  exercise: Exercise;
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const hasVideo = !!parseVideo(exercise.video_url);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ?? `Voir la vidéo : ${exercise.name}`}
        className={cn("group inline-flex items-center gap-1.5 text-left transition", className)}
      >
        {children ?? (
          <>
            <span className="font-semibold text-ink underline decoration-brand-200 decoration-2 underline-offset-4 group-hover:text-brand-600 group-hover:decoration-brand-400">
              {exercise.name}
            </span>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-white", hasVideo ? "bg-accent-500" : "bg-brand-400")}>
              <Play className="size-2.5 translate-x-[0.5px] fill-current" />
            </span>
          </>
        )}
      </button>
      <ExerciseModal exercise={open ? exercise : null} onClose={close} />
    </>
  );
}
