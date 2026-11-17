import { Sparkles } from "lucide-react";
import { DEMO } from "@/lib/demo";

/** Simple repère visuel : les données sont fictives. L'espace affiché dépend du compte connecté. */
export async function DemoBar() {
  if (!DEMO) return null;
  return (
    <div className="no-print pointer-events-none fixed right-14 top-3.5 z-30 flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-pop backdrop-blur lg:bottom-[92px] lg:left-4 lg:right-auto lg:top-auto">
      <Sparkles className="size-3.5 text-accent-400" />
      <span className="hidden sm:inline">Mode démo · données fictives</span>
      <span className="sm:hidden">Démo</span>
    </div>
  );
}
