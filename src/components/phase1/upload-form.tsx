"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, UploadCloud } from "lucide-react";
import type { FormState } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { uploadDocumentAction } from "@/actions/phase1";
import { DOC_CATEGORIES, fmtSize } from "./shared";

export function UploadForm({ clientId, demo }: { clientId: string; demo: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [ok, setOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    setOk(false);
    const res = await uploadDocumentAction(prev, fd);
    if (!res?.error) {
      setFile(null);
      setOk(true);
    }
    return res;
  }, undefined);

  const pickFiles = (list: FileList | null) => {
    const f = list?.[0] ?? null;
    setFile(f);
    setOk(false);
    if (f && inputRef.current && list && inputRef.current.files !== list) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {ok && (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Document ajouté.
        </p>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pickFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
          drag ? "border-brand-400 bg-brand-50" : file ? "border-brand-200 bg-brand-50/40" : "border-line hover:border-brand-200 hover:bg-canvas",
        )}
      >
        <UploadCloud className={cn("size-7", file ? "text-brand-500" : "text-slate-400")} />
        {file ? (
          <>
            <span className="mt-2 max-w-full truncate text-sm font-semibold text-ink">{file.name}</span>
            <span className="text-xs text-muted">{fmtSize(file.size)} · cliquer pour changer</span>
          </>
        ) : (
          <>
            <span className="mt-2 text-sm font-semibold text-ink">Glisse un fichier ou clique pour choisir</span>
            <span className="text-xs text-muted">PDF, image, document… 10 Mo max.</span>
          </>
        )}
        <input ref={inputRef} type="file" name="file" className="sr-only" onChange={(e) => pickFiles(e.target.files)} />
      </label>

      <Field label="Catégorie">
        <Select name="category" defaultValue="Certificat médical">
          {DOC_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition hover:bg-canvas">
        <input type="checkbox" name="shared" defaultChecked className="mt-0.5 size-4 accent-brand-500" />
        <span>
          <span className="block text-sm font-semibold text-ink">Visible par le client</span>
          <span className="block text-xs text-muted">Le client pourra le consulter depuis son espace.</span>
        </span>
      </label>

      {demo && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          <Info className="mt-0.5 size-3.5 shrink-0" /> Mode démo : le fichier n&apos;est pas stocké, seules ses informations sont enregistrées.
        </p>
      )}

      <SubmitButton className="w-full" pendingText="Envoi…">
        <UploadCloud className="size-4" /> Ajouter le document
      </SubmitButton>
    </form>
  );
}
