import { MessageCircle } from "lucide-react";
import { WA_TEMPLATES, waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-150 active:scale-[.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 whitespace-nowrap";

/** Bouton « click-to-chat » WhatsApp (aucune API). Ne rend rien si le numéro est invalide. */
export function WhatsAppButton({ phone, name, message, compact }: { phone: string | null; name: string; message?: string; compact?: boolean }) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const href = waLink(phone, message ?? WA_TEMPLATES.generic(first));
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Écrire à ${name} sur WhatsApp`}
      className={cn(
        base,
        compact
          ? "h-9 border border-line bg-white text-ink hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          : "h-10 bg-[#25D366] text-white shadow-sm shadow-[#25D366]/25 hover:bg-[#1fb457]",
      )}
    >
      <MessageCircle className={cn("size-4", compact && "text-[#1fb457]")} /> WhatsApp
    </a>
  );
}
