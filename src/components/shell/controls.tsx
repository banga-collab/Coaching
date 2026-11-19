"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages, Loader2, Moon, Sun, Tablet } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/client";
import { LANGS, dir, type Lang } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";

const YEAR = 31536000;
const setCookie = (k: string, v: string) => {
  document.cookie = `${k}=${v}; path=/; max-age=${YEAR}; samesite=lax`;
};

/** Bouton clair / sombre : effet immédiat (classe « dark » sur <html>) + cookie « theme » pour le rendu serveur */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    const d = document.documentElement;
    d.classList.toggle("dark", next);
    d.style.colorScheme = next ? "dark" : "light";
    setCookie("theme", next ? "dark" : "light");
    setDark(next);
  };
  const label = dark ? t("top.light") : t("top.dark");
  return (
    <button type="button" onClick={toggle} className={cn(iconBtn, className)} title={label} aria-label={label} aria-pressed={dark}>
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

/** Bouton mode tablette : classe « tablet » sur <html> + cookie « ui=tablet » */
export function TabletToggle({ className }: { className?: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(document.documentElement.classList.contains("tablet")), []);
  const toggle = () => {
    const next = !on;
    document.documentElement.classList.toggle("tablet", next);
    setCookie("ui", next ? "tablet" : "desktop");
    setOn(next);
  };
  const label = on ? t("top.tabletOff") : t("top.tabletOn");
  return (
    <button type="button" onClick={toggle} className={cn(iconBtn, on && "border-brand-200 bg-brand-50 text-brand-600", className)} title={label} aria-label={label} aria-pressed={on}>
      <Tablet className="size-[18px]" />
    </button>
  );
}

/** Sélecteur de langue : français, English, العربية (rtl). Cookie « lang » puis rafraîchissement serveur. */
export function LangSwitcher({ className, up }: { className?: string; up?: boolean }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (l: Lang) => {
    setOpen(false);
    if (l === lang) return;
    setCookie("lang", l);
    document.documentElement.lang = l;
    document.documentElement.dir = dir(l);
    start(() => router.refresh());
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn(iconBtn, "w-auto gap-1.5 px-2.5")} title={t("top.language")} aria-label={t("top.language")} aria-expanded={open}>
        {pending ? <Loader2 className="size-[18px] animate-spin" /> : <Languages className="size-[18px]" />}
        <span className="text-xs font-bold">{LANGS.find((x) => x.code === lang)?.short}</span>
      </button>
      {open && (
        <div className={cn("absolute end-0 z-40 w-40 rounded-2xl border border-line bg-white p-1.5 shadow-pop animate-fade-up", up ? "bottom-full mb-2" : "top-full mt-2")}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => choose(l.code)}
              lang={l.code}
              className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm font-medium transition hover:bg-canvas", l.code === lang ? "text-brand-600" : "text-slate-600")}
            >
              <span className="flex-1">{l.label}</span>
              {l.code === lang && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-slate-500 shadow-card transition hover:text-ink";
