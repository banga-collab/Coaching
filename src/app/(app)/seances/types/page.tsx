import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Shapes, Trash2 } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDh, loadSessionTypes } from "@/lib/session-extras";
import { Badge, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { addSessionTypeAction, deleteSessionTypeAction, moveSessionTypeAction, setSessionTypePriceAction, toggleSessionTypeAction } from "@/actions/session-types";

export const metadata = { title: "Types de séance" };

export default async function SessionTypesPage() {
  const me = await requireStaff();
  const canEdit = isManager(me.role);
  const supabase = await createClient();
  const [types, { data: sessions }] = await Promise.all([loadSessionTypes(supabase, true), supabase.from("sessions").select("type")]);
  const used = new Map<string, number>();
  for (const s of (sessions ?? []) as { type: string | null }[]) if (s.type) used.set(s.type, (used.get(s.type) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink href="/seances" label="Séances" />}
        title="Types de séance"
        subtitle={
          canEdit
            ? "La liste proposée dans les formulaires de séance et le planning. Le prix indicatif (DH) pré-remplit le prix de la séance : information seulement, aucun encaissement."
            : "La liste proposée dans les formulaires de séance."
        }
      />

      {canEdit && (
        <Card className="mb-5 p-5">
          <ActionForm action={addSessionTypeAction} className="grid gap-3 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
            <Field label="Nouveau type">
              <Input name="name" required placeholder="Ex. Boxe, Pilates, Stretching…" autoComplete="off" />
            </Field>
            <Field label="Durée habituelle">
              <Input name="duration_min" inputMode="numeric" placeholder="60 min" />
            </Field>
            <Field label="Prix indicatif (DH)">
              <Input name="price_mad" inputMode="decimal" placeholder="300" />
            </Field>
            <SubmitButton>Ajouter</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <CardHeader title={`${types.filter((t) => t.active !== false).length} types actifs`} subtitle="Masquer un type le retire des listes sans toucher aux séances existantes." icon={<Shapes className="size-4" />} />
        <ul className="divide-y divide-line">
          {types.map((t, i) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${t.active === false ? "text-muted line-through" : "text-ink"}`}>{t.name}</p>
                <p className="text-xs text-muted">
                  {used.get(t.name) ?? 0} séance{(used.get(t.name) ?? 0) > 1 ? "s" : ""}
                  {t.duration_min ? ` · ${t.duration_min} min` : ""}
                  {!canEdit && t.price_mad !== null && t.price_mad !== undefined ? ` · ${fmtDh(Number(t.price_mad))}` : ""}
                </p>
              </div>
              {canEdit && (
                <ActionForm action={setSessionTypePriceAction} className="flex items-center gap-1">
                  <input type="hidden" name="name" value={t.name} />
                  <label className="sr-only" htmlFor={`price-${t.id}`}>
                    Prix indicatif (DH) de {t.name}
                  </label>
                  <Input
                    id={`price-${t.id}`}
                    name="price_mad"
                    inputMode="decimal"
                    defaultValue={t.price_mad ?? ""}
                    placeholder="Prix"
                    title="Prix indicatif (DH) — pré-remplit le prix des nouvelles séances"
                    className="h-9 w-24 text-right"
                  />
                  <span className="text-xs text-muted">DH</span>
                  <SubmitButton variant="secondary" className="h-9 px-2.5" pendingText="…">
                    <Check className="size-4" />
                  </SubmitButton>
                </ActionForm>
              )}
              {t.active === false && <Badge tone="gray">Masqué</Badge>}
              {canEdit && (
                <div className="flex items-center gap-1">
                  <form action={moveSessionTypeAction}>
                    <input type="hidden" name="name" value={t.name} />
                    <input type="hidden" name="dir" value="up" />
                    <button disabled={i === 0} className="rounded-lg p-2 text-muted hover:bg-slate-100 disabled:opacity-30" title="Monter" aria-label="Monter">
                      <ArrowUp className="size-4" />
                    </button>
                  </form>
                  <form action={moveSessionTypeAction}>
                    <input type="hidden" name="name" value={t.name} />
                    <input type="hidden" name="dir" value="down" />
                    <button disabled={i === types.length - 1} className="rounded-lg p-2 text-muted hover:bg-slate-100 disabled:opacity-30" title="Descendre" aria-label="Descendre">
                      <ArrowDown className="size-4" />
                    </button>
                  </form>
                  <form action={toggleSessionTypeAction}>
                    <input type="hidden" name="name" value={t.name} />
                    <button className="rounded-lg p-2 text-muted hover:bg-slate-100" title={t.active === false ? "Afficher" : "Masquer"} aria-label={t.active === false ? "Afficher" : "Masquer"}>
                      {t.active === false ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                  </form>
                  <form action={deleteSessionTypeAction}>
                    <input type="hidden" name="name" value={t.name} />
                    <ConfirmButton message={`Supprimer le type « ${t.name} » ? Les séances existantes gardent leur type.`} className="h-9 px-2.5">
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
