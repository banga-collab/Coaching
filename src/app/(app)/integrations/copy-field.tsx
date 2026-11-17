"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3.5 font-mono text-xs text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
      />
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98]",
          copied ? "bg-emerald-500 text-white" : "bg-brand-500 text-white hover:bg-brand-600",
        )}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        <span className="hidden sm:inline">{copied ? "Copié" : "Copier"}</span>
      </button>
    </div>
  );
}
