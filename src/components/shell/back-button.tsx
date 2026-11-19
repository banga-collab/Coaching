"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Pages d'accueil : pas de bouton retour */
const ROOTS = new Set(["/", "/moi", "/admin"]);

/** Page « parente » si l'historique est vide (lien ouvert directement, appli tablette) */
function parentOf(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  const up = "/" + parts.join("/");
  if (up === "/" && path.startsWith("/moi")) return "/moi";
  return up;
}

/**
 * Bouton « Retour » de l'en-tête : revient à la page précédente de l'application,
 * sinon remonte d'un niveau (ex. /clients/123/bilan → /clients/123).
 */
export function BackButton({ variant = "light", className, wrapClass }: { variant?: "light" | "dark" | "compact"; className?: string; wrapClass?: string }) {
  const path = usePathname();
  const router = useRouter();
  const t = useT();
  if (!path || ROOTS.has(path)) return null;
  const label = t("top.back");

  function go() {
    if (window.history.length > 1) router.back();
    else router.push(parentOf(path));
  }

  const btn = (
    <button
      type="button"
      onClick={go}
      aria-label={label}
      title={label}
      className={cn(
        "no-print inline-flex shrink-0 items-center gap-1.5 font-semibold transition",
        variant === "light" && "h-11 rounded-2xl border border-line bg-white px-3.5 text-sm text-slate-700 shadow-card hover:border-brand-200 hover:text-brand-600",
        variant === "compact" && "size-9 justify-center rounded-xl text-slate-700 hover:bg-canvas",
        variant === "dark" && "h-9 rounded-lg px-2.5 text-sm text-[#b9d6e2] hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      <ArrowLeft className="size-4 rtl:-scale-x-100" />
      {variant !== "compact" && <span>{label}</span>}
    </button>
  );
  return wrapClass ? <div className={wrapClass}>{btn}</div> : btn;
}
