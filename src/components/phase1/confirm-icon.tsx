"use client";

import { cn } from "@/lib/utils";

/** Petit bouton de soumission avec confirmation (suppression dans une liste). */
export function ConfirmIcon({ message, label, children, className, wide }: { message: string; label: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={cn(
        "rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600",
        wide ? "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold" : "grid size-8 place-items-center",
        className,
      )}
    >
      {children}
    </button>
  );
}
