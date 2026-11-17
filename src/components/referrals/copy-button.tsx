"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copie un texte dans le presse-papiers avec retour visuel. */
export function CopyButton({ value, label = "Copier", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98]",
        done ? "bg-emerald-500 text-white" : "bg-white text-brand-700 hover:bg-brand-50",
        className,
      )}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? "Copié !" : label}
    </button>
  );
}
