"use client";

import { useState } from "react";
import { AlignLeft, ArrowDown, ArrowUp, Copy, Eye, Gauge, Hash, ListChecks, Plus, ToggleLeft, Trash2, X } from "lucide-react";
import type { AssessmentField, AssessmentTemplate, FieldType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Input, LinkButton, SectionTitle, Textarea } from "@/components/ui";
import { saveTemplateAction } from "@/actions/phase1";
import { AssessmentFieldInput } from "./field-input";
import { FIELD_TYPE_LABEL, TEMPLATE_CATEGORIES } from "./shared";

const TYPE_ICON: Record<FieldType, typeof Hash> = { number: Hash, scale: Gauge, text: AlignLeft, choice: ListChecks, yesno: ToggleLeft };
const TYPES: FieldType[] = ["number", "scale", "choice", "yesno", "text"];
const newId = () => `f_${Math.random().toString(36).slice(2, 10)}`;

const cell =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

export function TemplateBuilder({ template }: { template?: AssessmentTemplate }) {
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [fields, setFields] = useState<AssessmentField[]>(template?.fields ?? []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const patch = (id: string, p: Partial<AssessmentField>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const add = (type: FieldType) => {
    const f: AssessmentField = { id: newId(), label: "", type, ...(type === "choice" ? { options: ["", ""] } : {}) };
    setFields((fs) => [...fs, f]);
    setOpenId(f.id);
  };
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  const duplicate = (i: number) => {
    const f = fields[i]!;
    const c = { ...f, id: newId(), label: `${f.label} (copie)`, options: f.options ? [...f.options] : undefined };
    setFields([...fields.slice(0, i + 1), c, ...fields.slice(i + 1)]);
    setOpenId(c.id);
  };
  const remove = (id: string) => setFields((fs) => fs.filter((f) => f.id !== id));

  const payload = fields.map((f) => ({
    ...f,
    label: f.label.trim(),
    options: f.type === "choice" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
    unit: f.type === "number" ? f.unit?.trim() || undefined : undefined,
  }));
  const preview = payload;

  return (
    <ActionForm action={saveTemplateAction}>
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="fields" value={JSON.stringify(payload)} />

      {/* Bascule mobile édition / aperçu */}
      <div className="mb-4 grid grid-cols-2 rounded-xl border border-line bg-white p-1 lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("h-9 rounded-lg text-sm font-semibold transition", tab === t ? "bg-brand-500 text-white" : "text-muted")}
          >
            {t === "edit" ? "Construire" : `Aperçu (${fields.length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* ---------- Construction ---------- */}
        <div className={cn("space-y-5", tab === "preview" && "hidden lg:block")}>
          <Card className="p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
              <Field label="Nom du modèle">
                <Input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Tests de condition physique" required />
              </Field>
              <Field label="Catégorie">
                <Input name="category" list="tpl-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Performance" />
                <datalist id="tpl-categories">
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field label="Description" className="mt-4">
              <Textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="À quoi sert ce bilan, quand le refaire…" className="min-h-[72px]" />
            </Field>
          </Card>

          <div>
            <SectionTitle icon={<ListChecks className="size-4" />}>Champs ({fields.length})</SectionTitle>
            {fields.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-line bg-white/60 px-6 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                  <Plus className="size-6" />
                </span>
                <p className="mt-3 font-display font-bold">Ajoute ton premier champ</p>
                <p className="mt-1 text-sm text-muted">Choisis un type ci-dessous : mesure chiffrée, note sur 10, choix, oui/non ou texte.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {fields.map((f, i) => {
                  const Icon = TYPE_ICON[f.type];
                  const open = openId === f.id || !f.label;
                  return (
                    <li key={f.id} className={cn("rounded-2xl border bg-white shadow-card transition", open ? "border-brand-200 ring-4 ring-brand-50" : "border-line hover:border-slate-300")}>
                      <div className="flex items-center gap-2 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
                          <Icon className="size-4" />
                        </span>
                        <button type="button" onClick={() => setOpenId(open && f.label ? null : f.id)} className="min-w-0 flex-1 text-left">
                          <p className={cn("truncate text-sm font-semibold", !f.label && "italic text-slate-400")}>{f.label || "Nouveau champ"}</p>
                          <p className="text-xs text-muted">
                            {FIELD_TYPE_LABEL[f.type]}
                            {f.type === "number" && f.unit ? ` · ${f.unit}` : ""}
                            {f.type === "choice" ? ` · ${(f.options ?? []).filter((o) => o.trim()).length} options` : ""}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center">
                          <IconBtn label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                            <ArrowUp className="size-4" />
                          </IconBtn>
                          <IconBtn label="Descendre" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>
                            <ArrowDown className="size-4" />
                          </IconBtn>
                          <IconBtn label="Dupliquer" onClick={() => duplicate(i)} className="hidden sm:grid">
                            <Copy className="size-4" />
                          </IconBtn>
                          <IconBtn label="Supprimer" danger onClick={() => remove(f.id)}>
                            <Trash2 className="size-4" />
                          </IconBtn>
                        </div>
                      </div>

                      {open && (
                        <div className="space-y-4 border-t border-line p-4">
                          <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Libellé</span>
                              <input autoFocus={!f.label} value={f.label} onChange={(e) => patch(f.id, { label: e.target.value })} placeholder="Ex. Pompes en 1 min" className={cell} />
                            </label>
                            {f.type === "number" && (
                              <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Unité</span>
                                <input value={f.unit ?? ""} onChange={(e) => patch(f.id, { unit: e.target.value })} placeholder="kg, cm, s, reps…" className={cell} />
                              </label>
                            )}
                          </div>
                          <div>
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Type</span>
                            <div className="flex flex-wrap gap-1.5">
                              {TYPES.map((t) => {
                                const TI = TYPE_ICON[t];
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => patch(f.id, { type: t, ...(t === "choice" && !f.options?.length ? { options: ["", ""] } : {}) })}
                                    className={cn(
                                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition",
                                      f.type === t ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white text-slate-600 hover:bg-canvas",
                                    )}
                                  >
                                    <TI className="size-3.5" /> {FIELD_TYPE_LABEL[t]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {f.type === "choice" && <OptionsEditor options={f.options ?? []} onChange={(options) => patch(f.id, { options })} />}
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Aide (optionnel)</span>
                            <input value={f.help ?? ""} onChange={(e) => patch(f.id, { help: e.target.value })} placeholder="Consigne affichée sous le libellé" className={cell} />
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-4 rounded-2xl border border-line bg-white p-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Ajouter un champ</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TYPES.map((t) => {
                  const TI = TYPE_ICON[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => add(t)}
                      className="group flex flex-col items-center gap-1.5 rounded-xl border border-line px-2 py-3 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-canvas text-brand-500 transition group-hover:bg-white">
                        <TI className="size-4" />
                      </span>
                      {FIELD_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Aperçu ---------- */}
        <div className={cn(tab === "edit" && "hidden lg:block")}>
          <div className="lg:sticky lg:top-6">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line bg-canvas/60 px-5 py-3">
                <Eye className="size-4 text-brand-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aperçu en direct</p>
              </div>
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-5">
                <p className="font-display text-lg font-extrabold text-ink">{name || <span className="text-slate-300">Nom du modèle</span>}</p>
                {category && <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-accent-600">{category}</p>}
                {description && <p className="mt-2 text-sm text-muted">{description}</p>}
                <div className="mt-5 space-y-3">
                  {preview.length ? (
                    preview.map((f, i) => <AssessmentFieldInput key={f.id} field={f} index={i} />)
                  ) : (
                    <p className="rounded-xl bg-canvas px-4 py-8 text-center text-sm text-muted">Les champs ajoutés apparaîtront ici, tels que le coach les remplira.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
        <LinkButton href="/evaluations" variant="secondary">
          Annuler
        </LinkButton>
        <SubmitButton>{template ? "Enregistrer les modifications" : "Créer le modèle"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function IconBtn({ children, label, onClick, disabled, danger, className }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-slate-400 transition disabled:pointer-events-none disabled:opacity-30",
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-canvas hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const set = (i: number, v: string) => onChange(options.map((o, j) => (j === i ? v : o)));
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">Options</span>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-slate-200 text-[10px] font-bold text-slate-400">{i + 1}</span>
            <input
              value={o}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onChange([...options, ""]);
                }
              }}
              placeholder={`Option ${i + 1}`}
              className={cell}
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              disabled={options.length <= 2}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              aria-label="Retirer l'option"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
      {options.length < 12 && (
        <button type="button" onClick={() => onChange([...options, ""])} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-500 hover:bg-brand-50">
          <Plus className="size-4" /> Ajouter une option
        </button>
      )}
    </div>
  );
}
