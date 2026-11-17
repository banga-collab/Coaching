"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Cpu, Lightbulb, ShieldAlert, Sparkles, ThumbsUp, Wrench } from "lucide-react";
import type { AiSections, AiSource } from "@/lib/ai";
import { cn } from "@/lib/utils";

export function SourceBadge({ source }: { source: AiSource }) {
  return source === "claude" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
      <Sparkles className="size-3" /> Généré par Claude
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      <Cpu className="size-3" /> Analyse automatique (sans IA)
    </span>
  );
}

const STYLE = {
  forts: { icon: ThumbsUp, box: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  surveiller: { icon: AlertTriangle, box: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
  recos: { icon: Lightbulb, box: "bg-brand-50 text-brand-500", dot: "bg-brand-500" },
  ajustements: { icon: Wrench, box: "bg-accent-50 text-accent-600", dot: "bg-accent-500" },
} as const;

export function SectionsView({ data }: { data: AiSections }) {
  return (
    <div className="space-y-4">
      {data.note && <Note text={data.note} />}
      {data.headline && <p className="rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm font-medium text-ink">{data.headline}</p>}
      {data.sections.map((s) => {
        const st = STYLE[s.key];
        const Icon = st.icon;
        return (
          <section key={s.title} className="rounded-2xl border border-line bg-white p-4">
            <h4 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <span className={cn("grid size-7 place-items-center rounded-lg", st.box)}>
                <Icon className="size-4" />
              </span>
              {s.title}
              <span className="ml-auto rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-500">{s.items.length}</span>
            </h4>
            <ul className="mt-3 space-y-2">
              {s.items.map((it, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                  <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", st.dot)} />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function Note({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
      <ShieldAlert className="mt-px size-4 shrink-0" /> {text}
    </p>
  );
}

export function AiSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Analyse en cours">
      <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line p-4">
          <div className="flex items-center gap-2">
            <div className="size-7 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function sectionsToText(d: AiSections) {
  return [d.headline, ...d.sections.map((s) => `\n${s.title}\n${s.items.map((i) => `• ${i}`).join("\n")}`)].filter(Boolean).join("\n");
}

export function CopyButton({ text, className, label = "Copier" }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* presse-papiers indisponible */
        }
      }}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-canvas disabled:opacity-60",
        className,
      )}
    >
      {done ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      {done ? "Copié" : label}
    </button>
  );
}
