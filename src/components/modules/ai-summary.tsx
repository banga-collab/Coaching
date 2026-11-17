"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, Sparkles, X } from "lucide-react";
import { aiSummaryAction } from "@/actions/platform";
import type { AiSections } from "@/lib/ai";
import { buttonClass } from "@/components/ui";
import { AiSkeleton, CopyButton, SectionsView, SourceBadge, sectionsToText } from "@/components/platform/ai-ui";

/** Bouton « Résumé IA » + panneau latéral avec la synthèse du client. */
export function AiSummaryButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AiSections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setError(null);
      try {
        setData(await aiSummaryAction(clientId));
      } catch {
        setError("Impossible de générer le résumé pour le moment.");
      }
    });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!data && !pending) load();
        }}
        className={buttonClass("secondary", "h-9 group")}
      >
        <Sparkles className="size-4 text-accent-500 transition group-hover:rotate-12" /> Résumé IA
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Résumé IA du client">
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-[fade-up_.2s_ease-out_both]" />
          <aside className="relative flex h-full w-full max-w-[460px] flex-col bg-canvas shadow-pop animate-[slide-in_.28s_cubic-bezier(.2,.7,.2,1)_both]">
            <style>{`@keyframes slide-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}`}</style>
            <header className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-5 pb-5 pt-5 text-white">
              <div className="absolute -right-6 -top-6 size-28 rounded-full bg-accent-500/30 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-100">
                    <Sparkles className="size-3.5 text-accent-300" /> Assistant IA
                  </p>
                  <h2 className="mt-1 font-display text-xl font-extrabold">Résumé du client</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl bg-white/10 transition hover:bg-white/20" aria-label="Fermer">
                  <X className="size-4" />
                </button>
              </div>
              <div className="relative mt-3 h-5">{data && !pending && <SourceBadge source={data.source} />}</div>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {pending ? (
                <AiSkeleton />
              ) : error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              ) : data ? (
                <SectionsView data={data} />
              ) : null}
              <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
                Aide à la décision — ne remplace pas l&apos;avis d&apos;un professionnel de santé.
              </p>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-white px-5 py-3">
              <button type="button" onClick={load} disabled={pending} className={buttonClass("secondary", "h-9 px-3.5")}>
                <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> Régénérer
              </button>
              <CopyButton text={data && !pending ? sectionsToText(data) : ""} />
              <Link href={`/assistant?client=${clientId}`} className={buttonClass("brand", "ml-auto h-9 px-3.5")}>
                Assistant <ArrowUpRight className="size-4" />
              </Link>
            </footer>
          </aside>
        </div>,
          document.body,
        )}
    </>
  );
}
