"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Side = { src: string; label: string; sub?: string };

/** Curseur avant / après : glisser (souris, doigt) ou flèches du clavier. */
export function CompareSlider({ before, after, className }: { before: Side; after: Side; className?: string }) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const fromClientX = useCallback((x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  }, []);

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = pos - step;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = pos + step;
    if (e.key === "PageDown") next = pos - 10;
    if (e.key === "PageUp") next = pos + 10;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = 100;
    if (next !== null) {
      e.preventDefault();
      setPos(Math.min(100, Math.max(0, next)));
    }
  }

  return (
    <div
      ref={box}
      className={cn("group relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-2xl bg-slate-900 shadow-pop ring-1 ring-black/5", dragging ? "cursor-grabbing" : "cursor-ew-resize", className)}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
        fromClientX(e.clientX);
      }}
      onPointerMove={(e) => dragging && fromClientX(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {/* Après (dessous, visible à droite) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after.src} alt={`Après : ${after.label}`} draggable={false} className="absolute inset-0 size-full object-cover" />
      {/* Avant (dessus, rogné à gauche) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before.src} alt={`Avant : ${before.label}`} draggable={false} className="absolute inset-0 size-full object-cover" />
      </div>

      {/* Étiquettes */}
      <div className={cn("pointer-events-none absolute left-3 top-3 transition-opacity duration-200", pos < 18 && "opacity-0")}>
        <Tag tone="dark" label="Avant" date={before.label} sub={before.sub} />
      </div>
      <div className={cn("pointer-events-none absolute right-3 top-3 text-right transition-opacity duration-200", pos > 82 && "opacity-0")}>
        <Tag tone="accent" label="Après" date={after.label} sub={after.sub} />
      </div>

      {/* Ligne + poignée */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,.45)]" />
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Curseur de comparaison avant / après"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)} % avant`}
        onKeyDown={onKey}
        className={cn(
          "absolute top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-[0_6px_24px_rgba(0,0,0,.35)] ring-4 ring-white/40 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-accent-400",
          dragging ? "scale-110" : "group-hover:scale-105",
        )}
        style={{ left: `${pos}%` }}
      >
        <span className="flex items-center -space-x-1">
          <ChevronLeft className="size-4" strokeWidth={3} />
          <ChevronRight className="size-4" strokeWidth={3} />
        </span>
      </div>

      {/* Indice */}
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-white/80 drop-shadow transition-opacity group-hover:opacity-0">Fais glisser pour comparer</p>
    </div>
  );
}

function Tag({ tone, label, date, sub }: { tone: "dark" | "accent"; label: string; date: string; sub?: string }) {
  return (
    <div className={cn("inline-block rounded-xl px-3 py-1.5 backdrop-blur-md", tone === "accent" ? "bg-accent-500/90 text-white" : "bg-black/55 text-white")}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-sm font-bold leading-tight">{date}</p>
      {sub && <p className="text-xs opacity-90">{sub}</p>}
    </div>
  );
}
