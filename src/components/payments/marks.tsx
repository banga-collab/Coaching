import { Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Logos texte des moyens de paiement (pas d'images externes). */
export function CardMarks({ provider, className }: { provider: "stripe" | "cmi" | "demo" | "off"; className?: string }) {
  const marks: { label: string; cls: string }[] = [
    { label: "VISA", cls: "text-[#1a1f71] italic tracking-tight" },
    { label: "mastercard", cls: "text-[#eb001b] lowercase tracking-tight" },
  ];
  if (provider === "cmi") marks.unshift({ label: "CMI", cls: "text-[#0a4f9e] tracking-wider" });
  if (provider === "stripe") marks.push({ label: "AMEX", cls: "text-[#2e77bb] tracking-wider" });
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Cartes acceptées">
      {marks.map((m) => (
        <span key={m.label} className={cn("inline-flex h-7 min-w-12 items-center justify-center rounded-md border border-line bg-white px-2 font-display text-[11px] font-black shadow-sm", m.cls)}>
          {m.label}
        </span>
      ))}
    </div>
  );
}

export function ProviderName({ mode }: { mode: "stripe" | "cmi" | "demo" | "off" }) {
  if (mode === "stripe")
    return (
      <span className="font-display text-sm font-extrabold tracking-tight text-[#635bff]">
        stripe
      </span>
    );
  if (mode === "cmi")
    return (
      <span className="font-display text-sm font-extrabold tracking-wider text-[#0a4f9e]">
        CMI <span className="font-semibold tracking-normal text-slate-500">· Centre Monétique Interbancaire</span>
      </span>
    );
  if (mode === "demo") return <span className="font-display text-sm font-bold text-amber-700">Paiement simulé</span>;
  return <span className="text-sm text-muted">Indisponible</span>;
}

export function SecureBadge({ mode, className }: { mode: "stripe" | "cmi" | "demo" | "off"; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl bg-emerald-50/70 px-3.5 py-3 text-xs leading-relaxed text-emerald-800 ring-1 ring-inset ring-emerald-100", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <p>
        <b className="font-semibold">Paiement 100 % sécurisé.</b>{" "}
        {mode === "cmi"
          ? "La carte est saisie sur la page sécurisée du CMI (3-D Secure) : le numéro n'est jamais visible par la salle."
          : mode === "stripe"
            ? "La carte est saisie sur la page sécurisée de Stripe (3-D Secure) : le numéro n'est jamais visible par la salle."
            : "Mode démonstration : aucune carte n'est débitée et aucune donnée n'est envoyée à une banque."}
        <span className="mt-1 flex items-center gap-1 font-semibold text-emerald-700">
          <Lock className="size-3" /> Connexion chiffrée TLS
        </span>
      </p>
    </div>
  );
}
