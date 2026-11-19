import { Sparkles } from "lucide-react";
import { DEMO } from "@/lib/demo";
import { getT } from "@/lib/i18n";

/** Simple repère visuel : les données sont fictives. L'espace affiché dépend du compte connecté. */
export async function DemoBar() {
  if (!DEMO) return null;
  const t = await getT();
  return (
    <div className="no-print pointer-events-none fixed bottom-[76px] start-3 z-30 flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-pop backdrop-blur lg:bottom-[92px] lg:start-4">
      <Sparkles className="size-3.5 text-accent-400" />
      <span className="hidden sm:inline">{t("demo.badge")}</span>
      <span className="sm:hidden">{t("demo.short")}</span>
    </div>
  );
}
