"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, Share2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShopItem = { key: string; name: string; category: string; amount: string; detail: string };

/** Liste de courses (7 jours) : cases cochées gardées dans le navigateur, partage WhatsApp */
export function ShoppingList({ storageKey, items, planName }: { storageKey: string; items: ShopItem[]; planName: string }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [storageKey]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  function reset() {
    setChecked(new Set());
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  const groups = [...new Set(items.map((i) => i.category))].map((c) => ({ category: c, items: items.filter((i) => i.category === c) }));
  const remaining = items.filter((i) => !checked.has(i.key));
  const done = items.length - remaining.length;
  const text = [
    `🛒 Liste de courses – ${planName} (7 jours)`,
    "",
    ...groups.flatMap((g) => {
      const left = g.items.filter((i) => !checked.has(i.key));
      return left.length ? [`*${g.category}*`, ...left.map((i) => `• ${i.name} : ${i.amount}`), ""] : [];
    }),
    "Généré avec Moov'Up Coach 💪",
  ].join("\n");
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-accent-50 text-accent-500">
              <ShoppingCart className="size-5" />
            </span>
            <div>
              <p className="font-display text-[15px] font-bold text-ink">Pour 7 jours</p>
              <p className="text-xs text-muted">
                {done} / {items.length} article{items.length > 1 ? "s" : ""} dans le panier
              </p>
            </div>
          </div>
          {done > 0 && (
            <button type="button" onClick={reset} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-muted transition hover:bg-canvas hover:text-ink">
              <RotateCcw className="size-3.5" /> Tout décocher
            </button>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.category} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <h3 className="border-b border-line bg-canvas/60 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-brand-600">{g.category}</h3>
          <ul className="divide-y divide-line/70">
            {g.items.map((i) => {
              const on = checked.has(i.key);
              return (
                <li key={i.key}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-canvas/50">
                    <input type="checkbox" checked={on} onChange={() => toggle(i.key)} className="peer sr-only" />
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-lg border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100",
                        on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent",
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-semibold transition", on ? "text-slate-400 line-through" : "text-ink")}>{i.name}</span>
                      <span className="block truncate text-xs text-muted">{i.detail}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-bold", on ? "text-slate-300" : "text-brand-600")}>{i.amount}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-bold text-white shadow-pop transition hover:brightness-95 active:scale-[.99]"
        >
          <Share2 className="size-5" /> {remaining.length < items.length ? `Partager les ${remaining.length} restants` : "Partager sur WhatsApp"}
        </a>
      </div>
    </div>
  );
}
