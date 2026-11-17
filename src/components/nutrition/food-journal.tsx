"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Minus, Plus, Search, Sparkles, Trash2, UtensilsCrossed, X } from "lucide-react";
import type { Food, FoodLog, Meal } from "@/lib/types";
import { addFoodLogAction, deleteFoodLogAction } from "@/actions/nutrition";
import { cn, num } from "@/lib/utils";
import { JOURNAL_MEALS, fmtQty } from "./shared";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Journal du jour groupé par repas + ajout rapide (feuille en bas d'écran) */
export function FoodJournal({ date, logs, foods, planMeals }: { date: string; logs: FoodLog[]; foods: Food[]; planMeals: Meal[] }) {
  const [sheetMeal, setSheetMeal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const meals = useMemo(() => {
    const extra = [...new Set(logs.map((l) => l.meal))].filter((m) => !JOURNAL_MEALS.includes(m));
    return [...JOURNAL_MEALS, ...extra];
  }, [logs]);

  function remove(id: string) {
    setDeleting(id);
    startTransition(async () => {
      await deleteFoodLogAction(id);
      setDeleting(null);
    });
  }

  return (
    <>
      <div className="space-y-3">
        {meals.map((meal) => {
          const rows = logs.filter((l) => l.meal === meal);
          const kcal = rows.reduce((s, l) => s + Number(l.kcal), 0);
          return (
            <section key={meal} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[15px] font-bold text-ink">{meal}</h3>
                  <p className="text-xs text-muted">{rows.length ? `${num(Math.round(kcal))} kcal · ${rows.length} aliment${rows.length > 1 ? "s" : ""}` : "Rien de noté"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetMeal(meal)}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-100 active:scale-[.98]"
                  aria-label={`Ajouter à ${meal}`}
                >
                  <Plus className="size-4" /> Ajouter
                </button>
              </div>
              {rows.length > 0 && (
                <ul className="divide-y divide-line/70 border-t border-line">
                  {rows.map((l) => (
                    <li key={l.id} className={cn("flex items-center gap-3 py-2 pl-4 pr-2 transition", deleting === l.id && "opacity-40")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{l.food_name}</p>
                        <p className="text-xs text-muted">
                          ×{fmtQty(Number(l.qty))} · P {num(Math.round(l.protein))} · G {num(Math.round(l.carbs))} · L {num(Math.round(l.fat))}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-ink">{num(Math.round(l.kcal))}</p>
                      <button
                        type="button"
                        onClick={() => remove(l.id)}
                        disabled={deleting === l.id}
                        className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Supprimer ${l.food_name}`}
                      >
                        {deleting === l.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Bouton principal collant */}
      <div className="sticky bottom-20 z-20 mt-5 lg:bottom-4">
        <button
          type="button"
          onClick={() => setSheetMeal(guessMeal())}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 text-base font-bold text-white shadow-pop shadow-accent-500/30 transition hover:bg-accent-600 active:scale-[.99]"
        >
          <Plus className="size-5" /> Noter un aliment
        </button>
      </div>

      {sheetMeal !== null && <AddSheet date={date} initialMeal={sheetMeal} meals={meals} foods={foods} planMeals={planMeals} onClose={() => setSheetMeal(null)} />}
    </>
  );
}

function guessMeal() {
  const h = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Casablanca" }).format(new Date()));
  if (h < 11) return "Petit-déjeuner";
  if (h < 15) return "Déjeuner";
  if (h < 19) return "Collation";
  return "Dîner";
}

function AddSheet({ date, initialMeal, meals, foods, planMeals, onClose }: { date: string; initialMeal: string; meals: string[]; foods: Food[]; planMeals: Meal[]; onClose: () => void }) {
  const [meal, setMeal] = useState(initialMeal);
  const [q, setQ] = useState("");
  const [moroccan, setMoroccan] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const suggestions = useMemo(() => {
    const pm = planMeals.find((m) => norm(m.name) === norm(meal)) ?? null;
    return (pm?.items ?? []).map((i) => (i.food_id ? byId.get(i.food_id) : undefined)).filter((f): f is Food => !!f);
  }, [planMeals, meal, byId]);
  const needle = norm(q.trim());
  const results = foods.filter((f) => (!moroccan || f.moroccan) && (!needle || norm(`${f.name} ${f.category}`).includes(needle))).slice(0, needle ? 30 : 14);

  function confirm() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const res = await addFoodLogAction({ date, meal, foodId: picked.id, qty });
      if (res.error) {
        setError(res.error);
        return;
      }
      setAdded(picked.name);
      setPicked(null);
      setQty(1);
      setQ("");
      setTimeout(() => setAdded(null), 2200);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Ajouter un aliment">
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-up" onClick={onClose} aria-label="Fermer" />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="font-display text-lg font-extrabold text-ink">{picked ? "Quelle portion ?" : "Ajouter un aliment"}</h2>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-xl text-slate-400 hover:bg-canvas hover:text-ink" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        {/* Repas */}
        <div className="-mx-0 overflow-x-auto px-5 pb-3">
          <div className="flex w-max gap-1.5">
            {meals.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeal(m)}
                aria-pressed={meal === m}
                className={cn("h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition", meal === m ? "bg-brand-500 text-white" : "bg-canvas text-muted hover:text-ink")}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {added && (
          <p className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 animate-fade-up">
            <Check className="size-4" /> {added} ajouté à « {meal} ». Bien joué !
          </p>
        )}
        {error && <p className="mx-5 mb-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

        {picked ? (
          <div className="px-5 pb-6">
            <div className="rounded-2xl bg-canvas p-4">
              <p className="font-semibold text-ink">{picked.name}</p>
              <p className="text-xs text-muted">1 portion = {picked.portion ?? `${picked.grams} g`}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setQty((v) => Math.max(0.25, v <= 1 ? v - 0.25 : v - 0.5))}
                  disabled={qty <= 0.25}
                  className="grid size-14 place-items-center rounded-2xl bg-white text-ink shadow-sm ring-1 ring-line transition active:scale-95 disabled:opacity-40"
                  aria-label="Diminuer la portion"
                >
                  <Minus className="size-5" />
                </button>
                <div className="text-center" aria-live="polite">
                  <p className="font-display text-3xl font-extrabold text-ink">×{fmtQty(qty)}</p>
                  <p className="text-xs text-muted">portion{qty > 1 ? "s" : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQty((v) => Math.min(10, v < 1 ? v + 0.25 : v + 0.5))}
                  className="grid size-14 place-items-center rounded-2xl bg-white text-ink shadow-sm ring-1 ring-line transition active:scale-95"
                  aria-label="Augmenter la portion"
                >
                  <Plus className="size-5" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <Macro label="kcal" value={picked.kcal * qty} strong />
                <Macro label="Prot." value={picked.protein * qty} />
                <Macro label="Gluc." value={picked.carbs * qty} />
                <Macro label="Lip." value={picked.fat * qty} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={() => setPicked(null)} className="h-14 rounded-2xl border border-line px-5 text-sm font-semibold text-muted transition hover:bg-canvas">
                Retour
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent-500 text-base font-bold text-white shadow-sm transition hover:bg-accent-600 active:scale-[.99] disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Ajouter à {meal.toLowerCase()}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 px-5 pb-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Harira, tajine, œufs, msemen…"
                  aria-label="Rechercher un aliment"
                  className="h-12 w-full rounded-xl border border-line bg-canvas/60 pl-10 pr-3 text-base placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setMoroccan((v) => !v)}
                aria-pressed={moroccan}
                className={cn("h-12 shrink-0 rounded-xl border px-3 text-xs font-bold transition", moroccan ? "border-accent-200 bg-accent-50 text-accent-700" : "border-line text-muted")}
              >
                Plats
                <br />
                marocains
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              {!needle && suggestions.length > 0 && (
                <div className="mb-3 px-2">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent-600">
                    <Sparkles className="size-3.5" /> Prévu dans ton plan pour ce repas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((f) => (
                      <button key={f.id} type="button" onClick={() => setPicked(f)} className="min-h-10 rounded-full border border-accent-200 bg-accent-50/60 px-3.5 text-sm font-medium text-accent-800 transition hover:bg-accent-100">
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {results.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted">Aucun aliment trouvé. Demande à ton coach de l&apos;ajouter à la bibliothèque.</p>
              ) : (
                <ul>
                  {results.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => setPicked(f)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-canvas active:bg-brand-50">
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", f.moroccan ? "bg-accent-50 text-accent-600" : "bg-brand-50 text-brand-500")}>
                          <UtensilsCrossed className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{f.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {f.portion ?? `${f.grams} g`}
                            {f.moroccan && <span className="ml-1.5 font-semibold text-accent-600">· Marocain</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-ink">{num(f.kcal)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Macro({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-white py-2 ring-1 ring-line">
      <p className={cn("font-display font-extrabold", strong ? "text-accent-600" : "text-ink")}>{num(Math.round(value))}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
