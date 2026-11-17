"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Contact,
  ExternalLink,
  Image as ImageIcon,
  Palette,
  Receipt,
  RotateCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import { saveSettingsAction } from "@/actions/platform";
import type { Settings } from "@/lib/types";
import type { SettingsState } from "@/components/platform/types";
import { DEFAULT_ACCENT, DEFAULT_PRIMARY, isHex, readableOn, shades } from "@/components/platform/colors";
import { WEEKDAYS } from "@/components/platform/slots";
import { cn } from "@/lib/utils";
import { Card, CardHeader, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSettingsAction, undefined);
  const [primary, setPrimary] = useState(s.primary_color);
  const [accent, setAccent] = useState(s.accent_color);
  const [logo, setLogo] = useState(s.logo_url ?? "");
  const [brandName, setBrandName] = useState(s.brand_name);
  const [enabled, setEnabled] = useState(s.booking_enabled);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!state?.ok) return;
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [state?.ok]);

  return (
    <form action={action} className="grid gap-5 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
      <div className="min-w-0 space-y-5">
        {state?.error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        )}

        {/* Identité */}
        <Card>
          <CardHeader icon={<Building2 className="size-4" />} title="Identité" subtitle="Nom affiché dans l'application, les factures et la page de réservation." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nom de la salle">
              <Input name="brand_name" required value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </Field>
            <Field label="Nom de l'application">
              <Input name="app_name" required defaultValue={s.app_name} />
            </Field>
            <Field label="URL du logo" hint="Image PNG/SVG hébergée (https://…) ou chemin local (/logo.png). Vide = logo par défaut." className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white px-2">
                  {logo && /^(https:\/\/|\/)/.test(logo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Aperçu du logo" className="max-h-8 w-auto object-contain" />
                  ) : logo ? (
                    <ImageIcon className="size-5 text-slate-300" />
                  ) : (
                    <Image src="/logo.png" alt="Logo par défaut" width={473} height={136} className="h-auto w-24" />
                  )}
                </span>
                <Input name="logo_url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" />
              </div>
            </Field>
          </div>
        </Card>

        {/* Couleurs */}
        <Card>
          <CardHeader icon={<Palette className="size-4" />} title="Couleurs" subtitle="Appliquées à toute l'application après l'enregistrement." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <ColorField label="Couleur principale" name="primary_color" value={primary} onChange={setPrimary} fallback={DEFAULT_PRIMARY} />
            <ColorField label="Couleur d'accent" name="accent_color" value={accent} onChange={setAccent} fallback={DEFAULT_ACCENT} />
          </div>
          <div className="px-5 pb-5 lg:hidden">
            <Preview primary={primary} accent={accent} name={brandName} />
          </div>
        </Card>

        {/* Coordonnées */}
        <Card>
          <CardHeader icon={<Contact className="size-4" />} title="Coordonnées" subtitle="Affichées sur les factures, les rapports et la page de réservation." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Téléphone">
              <Input name="phone" type="tel" defaultValue={s.phone ?? ""} placeholder="05 28 00 00 00" />
            </Field>
            <Field label="WhatsApp" hint="Utilisé pour le bouton de contact des visiteurs.">
              <Input name="whatsapp" type="tel" defaultValue={s.whatsapp ?? ""} placeholder="06 12 34 56 78" />
            </Field>
            <Field label="E-mail">
              <Input name="email" type="email" defaultValue={s.email ?? ""} placeholder="contact@salle.ma" />
            </Field>
            <Field label="ICE" hint="Identifiant commun de l'entreprise (factures).">
              <Input name="ice" defaultValue={s.ice ?? ""} inputMode="numeric" placeholder="001234567000089" />
            </Field>
            <Field label="Adresse" className="sm:col-span-2">
              <Input name="address" defaultValue={s.address ?? ""} placeholder="Quartier, ville" />
            </Field>
          </div>
        </Card>

        {/* Facturation */}
        <Card>
          <CardHeader icon={<Receipt className="size-4" />} title="Facturation" subtitle="Texte imprimé en bas de chaque facture." />
          <div className="px-5 pb-5">
            <Field label="Pied de facture">
              <Textarea name="invoice_footer" rows={3} defaultValue={s.invoice_footer ?? ""} placeholder="Merci pour votre confiance. Paiement à réception." />
            </Field>
          </div>
        </Card>

        {/* Réservation */}
        <Card>
          <CardHeader
            icon={<CalendarCheck className="size-4" />}
            title="Réservation en ligne"
            subtitle="Page publique /reserver pour les nouveaux clients."
            action={
              <a href="/reserver" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                Voir la page <ExternalLink className="size-3.5" />
              </a>
            }
          />
          <div className="space-y-5 px-5 pb-5">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-canvas/60 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-ink">Accepter les réservations</span>
                <span className="block text-xs text-muted">{enabled ? "La page est ouverte au public." : "La page affiche un message « fermé »."}</span>
              </span>
              <input type="checkbox" name="booking_enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer sr-only" />
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
            </label>

            <div className={cn("grid gap-4 sm:grid-cols-2 transition", !enabled && "opacity-60")}>
              <Field label="Types de rendez-vous" hint="Un par ligne (ou séparés par des virgules)." className="sm:col-span-2">
                <Textarea name="booking_types" rows={3} defaultValue={s.booking_types.join("\n")} />
              </Field>
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Jours ouverts</span>
                <div className="flex flex-wrap gap-2">
                  {DAY_ORDER.map((d) => (
                    <label key={d} className="cursor-pointer">
                      <input type="checkbox" name="days" value={d} defaultChecked={s.booking_hours.days.includes(d)} className="peer sr-only" />
                      <span className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100">
                        {WEEKDAYS[d]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <Field label="Ouverture">
                  <Input name="start" type="time" step={900} defaultValue={s.booking_hours.start} required />
                </Field>
                <Field label="Fermeture">
                  <Input name="end" type="time" step={900} defaultValue={s.booking_hours.end} required />
                </Field>
                <Field label="Créneau (min)">
                  <Input name="slot" type="number" min={15} max={240} step={15} defaultValue={s.booking_hours.slot} required />
                </Field>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Colonne aperçu + enregistrement */}
      <div className="hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <Preview primary={primary} accent={accent} name={brandName} />
          <SaveBar saved={saved} />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-[calc(55px+max(env(safe-area-inset-bottom),6px))] z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <SaveBar saved={saved} compact />
      </div>
    </form>
  );
}

function SaveBar({ saved, compact }: { saved: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "justify-between" : "flex-col items-stretch")}>
      {saved ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
          <CheckCircle2 className="size-4" /> Paramètres enregistrés
        </span>
      ) : (
        compact && <span className="text-xs text-muted">Modifications non enregistrées</span>
      )}
      <SubmitButton className={compact ? "" : "w-full"}>Enregistrer les paramètres</SubmitButton>
    </div>
  );
}

function ColorField({ label, name, value, onChange, fallback }: { label: string; name: string; value: string; onChange: (v: string) => void; fallback: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = isHex(value);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-line shadow-sm" style={{ background: valid ? value : fallback }}>
          <input
            type="color"
            aria-label={`${label} (sélecteur)`}
            value={valid ? value : fallback}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
        <Input
          name={name}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = `#${v}`;
            setText(v);
            if (isHex(v)) onChange(v.toLowerCase());
          }}
          className={cn("font-mono uppercase", !isHex(text) && "border-red-300 focus:border-red-400 focus:ring-red-50")}
        />
        {value.toLowerCase() !== fallback && (
          <button type="button" onClick={() => onChange(fallback)} title="Couleur par défaut" className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:bg-canvas hover:text-ink">
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-2 flex overflow-hidden rounded-lg">
        {Object.entries(shades(valid ? value : fallback, name === "primary_color" ? "brand" : "accent")).map(([k, c]) => (
          <span key={k} title={`${k} · ${c}`} className="h-3 flex-1" style={{ background: c }} />
        ))}
      </div>
    </Field>
  );
}

/** Aperçu en direct : boutons, badges, KPI avec les couleurs choisies. */
function Preview({ primary, accent, name }: { primary: string; accent: string; name: string }) {
  const p = shades(isHex(primary) ? primary : DEFAULT_PRIMARY, "brand");
  const a = shades(isHex(accent) ? accent : DEFAULT_ACCENT, "accent");
  return (
    <Card className="overflow-hidden">
      <div className="relative px-4 py-4 text-white" style={{ background: `linear-gradient(120deg, ${p[700]}, ${p[500]} 60%, ${p[400]})` }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Aperçu en direct</p>
        <p className="mt-0.5 truncate font-display text-base font-extrabold">{name || "Votre salle"}</p>
        <span className="absolute right-4 top-4 size-3 rounded-sm" style={{ background: a[400] }} />
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold shadow-sm" style={{ background: a[500], color: readableOn(a[500]!) }}>
            Action
          </span>
          <span className="inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold shadow-sm" style={{ background: p[500], color: readableOn(p[500]!) }}>
            Principal
          </span>
          <span className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink">Secondaire</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset" style={{ background: p[50], color: p[600], boxShadow: `inset 0 0 0 1px ${p[100]}` }}>
            Actif
          </span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: a[50], color: a[700], boxShadow: `inset 0 0 0 1px ${a[100]}` }}>
            Nouvelle
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Clients actifs", value: "42", c: p, Icon: Users },
            { label: "Progression", value: "+8 %", c: a, Icon: TrendingUp },
          ].map(({ label, value, c, Icon }) => (
            <div key={label} className="relative overflow-hidden rounded-xl border border-line p-3">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: c[500] }} />
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-medium text-muted">{label}</p>
                <span className="grid size-6 place-items-center rounded-lg" style={{ background: c[50], color: c[500] }}>
                  <Icon className="size-3.5" />
                </span>
              </div>
              <p className="mt-1 font-display text-xl font-extrabold" style={{ color: c[500] }}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: p[100] }}>
          <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${p[500]}, ${a[500]})` }} />
        </div>
      </div>
    </Card>
  );
}
