"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Info, Loader2, Upload } from "lucide-react";
import { uploadPhotoAction } from "@/actions/photos";
import type { FormState } from "@/components/action-form";
import { Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { POSES, POSE_LABEL } from "./shared";

type State = (FormState & { ok?: number }) | undefined;

export function PhotoUploadForm({ clientId, demo, today, lastWeight, member }: { clientId: string; demo: boolean; today: string; lastWeight: number | null; member: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pose, setPose] = useState<(typeof POSES)[number]>("face");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<State, FormData>(async (prev, fd) => {
    const res = await uploadPhotoAction(prev, fd);
    if (res?.error) return res;
    return { ok: Date.now() };
  }, undefined);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setPreview((p) => {
        if (p) URL.revokeObjectURL(p);
        return null;
      });
    }
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="pose" value={pose} />
      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> {member ? "Photo ajoutée, bravo pour ta régularité !" : "Photo ajoutée."}
        </p>
      )}

      <label
        className={cn(
          "group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed text-center transition",
          preview ? "border-transparent bg-slate-900" : "border-line bg-canvas/50 hover:border-brand-300 hover:bg-brand-50/40",
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Aperçu de la photo" className="absolute inset-0 size-full object-contain" />
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">Changer</span>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-500 shadow-sm ring-1 ring-line transition group-hover:scale-105">
              <ImagePlus className="size-6" />
            </span>
            <span className="text-sm font-semibold text-ink">{member ? "Prendre ou choisir une photo" : "Choisir une photo"}</span>
            <span className="text-xs text-muted">JPG, PNG, WebP ou HEIC · 10 Mo max</span>
          </>
        )}
        <input
          type="file"
          name="file"
          accept="image/*"
          capture={member ? "environment" : undefined}
          required={!demo}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview((p) => {
              if (p) URL.revokeObjectURL(p);
              return f ? URL.createObjectURL(f) : null;
            });
          }}
        />
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">Pose</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1" role="radiogroup" aria-label="Pose">
          {POSES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pose === p}
              onClick={() => setPose(p)}
              className={cn("min-h-10 rounded-lg text-sm font-semibold transition", pose === p ? "bg-white text-brand-600 shadow-sm" : "text-muted hover:text-ink")}
            >
              {POSE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" name="taken_on" defaultValue={today} max={today} required />
        </Field>
        <Field label="Poids (kg)">
          <Input name="weight_kg" inputMode="decimal" placeholder={lastWeight ? String(lastWeight) : "72,5"} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" rows={2} className="min-h-[64px]" placeholder={member ? "Comment tu te sens ce mois-ci ?" : "Conditions, éclairage, ressenti…"} />
      </Field>

      {demo && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Mode démo : le fichier n&apos;est pas envoyé, une image d&apos;illustration est enregistrée à la place.
        </p>
      )}
      {member && (
        <p className="flex items-start gap-2 text-xs text-muted">
          <Camera className="mt-0.5 size-3.5 shrink-0" /> Astuce : même lumière, même tenue et même endroit chaque mois pour une comparaison fiable.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 text-sm font-bold text-white shadow-sm shadow-accent-500/20 transition hover:bg-accent-600 active:scale-[.99] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {pending ? "Envoi…" : "Ajouter la photo"}
      </button>
    </form>
  );
}
