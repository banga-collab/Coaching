import Link from "next/link";
import { ArrowRight, ClipboardCheck, Clock, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { SportAssessment } from "@/lib/types-bilan";
import { fmtDate } from "@/lib/utils";
import { RISK_TEXT, computeRisk, normalizeAnswers } from "@/lib/bilan";
import { Card, LinkButton } from "@/components/ui";
import { RiskBadge } from "./bilan-view";

/** Carte compacte « Bilan sportif » de la fiche client (niveau de risque, principaux signaux, lien). */
export async function BilanCard({ clientId, sex, ageYears }: { clientId: string; sex: "H" | "F" | null; ageYears: number | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sport_assessments").select("*").eq("client_id", clientId).order("done_on", { ascending: false }).limit(1).maybeSingle();
  if (error) return null; // table absente (migration v5-bilan.sql non appliquée)
  const href = `/clients/${clientId}/bilan-sportif`;

  if (!data) {
    return (
      <Card className="no-print mt-4 flex flex-wrap items-center gap-3 px-5 py-3.5 animate-fade-up">
        <span className="grid size-9 place-items-center rounded-xl bg-accent-50 text-accent-500">
          <ClipboardCheck className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Bilan sportif</p>
          <p className="text-xs text-muted">Pas encore fait : profil sportif, antécédents médicaux, PAR-Q et tests.</p>
        </div>
        <LinkButton href={`${href}/nouveau`} className="h-9">
          <Plus className="size-4" /> Faire le bilan
        </LinkButton>
      </Card>
    );
  }

  const b = data as SportAssessment;
  const risk = computeRisk(normalizeAnswers(b.answers), { sex, age: ageYears, now: new Date(b.done_on) });
  const top = risk.flags.filter((f) => f.level !== "info").slice(0, 3);
  return (
    <Link href={href} className="group mt-4 block animate-fade-up print:hidden">
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition group-hover:border-brand-200 group-hover:shadow-pop">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-500">
          <ClipboardCheck className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-bold">Bilan sportif</p>
            <RiskBadge level={risk.level} size="sm" />
            {b.status === "a_valider" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                <Clock className="size-3" /> À valider
              </span>
            )}
            <span className="text-xs text-muted">{fmtDate(b.done_on)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-600">{top.length ? top.map((f) => f.label).join(" · ") : RISK_TEXT[risk.level]}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
          Voir <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  );
}
