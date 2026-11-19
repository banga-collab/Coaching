import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Clock, History, Pencil, Plus, Trash2 } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import type { SportAssessment } from "@/lib/types-bilan";
import { age, cn, fmtDate } from "@/lib/utils";
import { computeRisk, normalizeAnswers } from "@/lib/bilan";
import { Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { BilanAnswersView, RiskBadge, RiskPanel } from "@/components/bilan/bilan-view";
import { deleteBilanAction, validateBilanAction } from "@/actions/bilan";

export const metadata = { title: "Bilan sportif" };

export default async function BilanSportifPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string; ok?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const me = await requireStaff();
  const supabase = await createClient();
  const [{ data: cData }, { data: bData }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("sport_assessments").select("*").eq("client_id", id).order("done_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (!cData) notFound();
  const c = cData as Client;
  const list = ((bData ?? []) as SportAssessment[]).map((b) => ({ ...b, answers: normalizeAnswers(b.answers) }));
  const people = [...new Set(list.flatMap((b) => [b.created_by, b.validated_by]).filter(Boolean))] as string[];
  const { data: pData } = people.length ? await supabase.from("profiles").select("id, full_name, role").in("id", people) : { data: [] };
  const names = new Map(((pData ?? []) as { id: string; full_name: string; role: string }[]).map((p) => [p.id, p]));
  const who = (uid: string | null) => (uid ? names.get(uid)?.full_name ?? "—" : "—");

  const current = list.find((b) => b.id === sp.b) ?? list[0];
  const years = age(c.birth_date);
  const risk = current ? computeRisk(current.answers, { sex: c.sex, age: years, now: new Date(current.done_on) }) : null;
  // Droits (mêmes règles que src/actions/bilan.ts) : modifier/valider = coach du client, auteur ou manager ; supprimer = manager
  const manager = isManager(me.role);
  const canEdit = (b: SportAssessment) => manager || c.coach_id === me.id || b.created_by === me.id;
  const byMember = (b: SportAssessment) => names.get(b.created_by ?? "")?.role === "client";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/clients/${id}`} label={c.full_name} />
        <div className="flex flex-wrap items-center gap-2">
          {current && canEdit(current) && (
            <LinkButton href={`/clients/${id}/bilan-sportif/${current.id}/modifier`} variant="secondary">
              <Pencil className="size-4" /> Modifier
            </LinkButton>
          )}
          {current && <PrintButton />}
          <LinkButton href={`/clients/${id}/bilan-sportif/nouveau`}>
            <Plus className="size-4" /> {list.length ? "Nouveau bilan" : "Faire le bilan"}
          </LinkButton>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-fade-up">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent-500">Bilan sportif & médical</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">{c.full_name}</h1>
          {current && (
            <p className="mt-1 text-sm text-muted">
              Bilan du {fmtDate(current.done_on)} · {byMember(current) ? `rempli par l'adhérent` : `par ${who(current.created_by)}`}
              {current.status === "valide" && current.validated_by && current.validated_by !== current.created_by && ` · validé par ${who(current.validated_by)}`}
            </p>
          )}
        </div>
        {risk && <RiskBadge level={risk.level} size="lg" />}
      </div>

      {sp.ok && (
        <p className="no-print mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" /> Bilan enregistré.
        </p>
      )}

      {!current || !risk ? (
        <Card>
          <Empty
            icon={<ClipboardCheck className="size-6" />}
            title="Aucun bilan sportif"
            text="Le bilan d'entrée regroupe le profil sportif, le mode de vie, les antécédents médicaux, le PAR-Q et les tests physiques. Il calcule un niveau de risque et des précautions."
            action={
              <LinkButton href={`/clients/${id}/bilan-sportif/nouveau`}>
                <Plus className="size-4" /> Faire le bilan
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {current.status === "a_valider" && canEdit(current) && (
            <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4" /> Questionnaire rempli par l&apos;adhérent : à valider par le coach. Complète les tests avec « Modifier » ou valide tel quel.
              </p>
              <form action={validateBilanAction}>
                <input type="hidden" name="id" value={current.id} />
                <input type="hidden" name="client_id" value={id} />
                <SubmitButton variant="brand" pendingText="Validation…">
                  <CheckCircle2 className="size-4" /> Valider
                </SubmitButton>
              </form>
            </div>
          )}
          {current.id !== list[0]?.id && (
            <p className="no-print rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
              Tu consultes un ancien bilan.{" "}
              <Link href={`/clients/${id}/bilan-sportif`} className="font-semibold text-brand-600 hover:underline">
                Voir le plus récent
              </Link>
            </p>
          )}

          <RiskPanel risk={risk} />
          <BilanAnswersView a={current.answers} sex={c.sex} ageYears={years} showCoach doneOn={current.done_on} />

          <Card className="no-print overflow-hidden">
            <CardHeader title="Historique des bilans" subtitle={`${list.length} bilan${list.length > 1 ? "s" : ""}`} icon={<History className="size-4" />} />
            <ul className="divide-y divide-line border-t border-line">
              {list.map((b) => (
                <li key={b.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", b.id === current.id && "bg-brand-50/50")}>
                  <Link href={`/clients/${id}/bilan-sportif?b=${b.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <RiskBadge level={b.risk_level} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{fmtDate(b.done_on, { day: "numeric", month: "long", year: "numeric" })}</p>
                      <p className="truncate text-xs text-muted">
                        {byMember(b) ? "Rempli par l'adhérent" : who(b.created_by)}
                        {b.risk_flags?.length ? ` · ${b.risk_flags.slice(0, 2).join(" · ")}` : ""}
                      </p>
                    </div>
                  </Link>
                  {b.status === "a_valider" && <Badge tone="amber">À valider</Badge>}
                  {b.id === current.id && <Badge tone="brand">Affiché</Badge>}
                  {manager && (
                  <form action={deleteBilanAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="client_id" value={id} />
                    <ConfirmButton message={`Supprimer le bilan du ${fmtDate(b.done_on)} ?`} className="h-8 px-2.5">
                      <Trash2 className="size-3.5" />
                    </ConfirmButton>
                  </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
