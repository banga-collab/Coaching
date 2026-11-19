"use client";

import { useActionState, useState } from "react";
import { BrushCleaning, CheckCircle2, CircleHelp, Headset, Loader2, ShieldAlert, Wrench } from "lucide-react";
import { submitReclamationAction, type ReportState } from "@/actions/reclamations";
import { RECLAMATION_CATEGORIES } from "@/lib/reclamations";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Card, Field, Input, Textarea, buttonClass } from "@/components/ui";
import { ImageInput } from "@/components/image-input";

const ICON: Record<(typeof RECLAMATION_CATEGORIES)[number], typeof Wrench> = { panne: Wrench, proprete: BrushCleaning, securite: ShieldAlert, service: Headset, autre: CircleHelp };

/** Formulaire public de signalement (QR code dans la salle) */
export function ReportForm({ location }: { location?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReclamationAction, undefined);
  const [cat, setCat] = useState<(typeof RECLAMATION_CATEGORIES)[number] | "">("");
  const [key, setKey] = useState(0);

  if (state?.ok) {
    return (
      <Card className="p-8 text-center animate-fade-up">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h2 className="mt-4 font-display text-xl font-extrabold text-ink">{t("report.sentTitle")}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{t("report.sentText")}</p>
        <a href={location ? `/signaler?lieu=${encodeURIComponent(location)}` : "/signaler"} className={buttonClass("secondary", "mt-6")} onClick={() => setKey((k) => k + 1)}>
          {t("report.again")}
        </a>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-7 animate-fade-up" key={key}>
      <form action={action} className="space-y-5">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-600">{t("report.category")}</legend>
          <input type="hidden" name="category" value={cat} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RECLAMATION_CATEGORIES.map((c) => {
              const I = ICON[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={cat === c}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center text-sm font-semibold transition",
                    cat === c ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-50" : "border-line bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  <I className="size-6" />
                  {t(`report.cat.${c}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label={t("report.location")}>
          <Input name="location" defaultValue={location} maxLength={120} placeholder={t("report.locationPh")} />
        </Field>
        <Field label={t("report.description")}>
          <Textarea name="description" required minLength={3} maxLength={2000} placeholder={t("report.descriptionPh")} />
        </Field>
        <ImageInput name="photo" label={t("report.photo")} hint={t("report.photoHint")} removeLabel={t("report.photoRemove")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("report.name")} (${t("report.optional")})`}>
            <Input name="name" maxLength={80} autoComplete="name" />
          </Field>
          <Field label={`${t("report.phone")} (${t("report.optional")})`}>
            <Input name="phone" type="tel" maxLength={30} autoComplete="tel" dir="ltr" />
          </Field>
        </div>
        {state?.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending || !cat} className={buttonClass("primary", "h-12 w-full text-[15px]")}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t("report.submit")}
        </button>
      </form>
    </Card>
  );
}
