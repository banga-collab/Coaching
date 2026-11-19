"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, ShieldCheck, X } from "lucide-react";
import { Button, Card, CardHeader, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { finishHealthImportAction, importHealthBatchAction } from "@/actions/health-data";
import { shiftDay } from "@/lib/health/aggregate";
import { parseAppleHealth } from "@/lib/health/apple";
import { parseTabularFiles } from "@/lib/health/tabular";
import { listZip } from "@/lib/health/zip";
import { SOURCE_LABEL, type DailyInput, type HealthSource } from "@/lib/health/types";

type Phase = "idle" | "reading" | "sending" | "done" | "error";
const BATCH = 400;

const pad = (n: number) => String(n).padStart(2, "0");
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const mb = (n: number) => `${(n / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} Mo`;

/** Faut-il utiliser le lecteur Apple Santé ? */
async function isApple(files: File[]) {
  if (files.length !== 1) return false;
  const f = files[0]!;
  if (/\.xml$/i.test(f.name)) return true;
  if (!/\.zip$/i.test(f.name)) return false;
  const entries = await listZip(f);
  return entries.some((e) => /\.xml$/i.test(e.name) && /export/i.test(e.name) && !/cda/i.test(e.name));
}

export function HealthImporter({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [range, setRange] = useState("90");
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState<string[]>([]);

  async function run(files: File[]) {
    if (!files.length) return;
    abort.current = new AbortController();
    setPhase("reading");
    setPct(0);
    setSummary([]);
    const since = shiftDay(localToday(), -Number(range) + 1);
    try {
      let samples: DailyInput[];
      let source: HealthSource;
      const notes: string[] = [];
      if (await isApple(files)) {
        source = "apple_health";
        setMsg(`Lecture de l'export Apple Santé (${mb(files[0]!.size)})… Cela peut prendre quelques minutes, gardez cet onglet ouvert.`);
        const r = await parseAppleHealth(files[0]!, { since, signal: abort.current.signal, onProgress: (d, t) => setPct(Math.round((d / Math.max(t, 1)) * 100)) });
        samples = r.samples;
        notes.push(`${r.records.toLocaleString("fr-FR")} mesures lues dans le fichier.`);
      } else {
        setMsg("Lecture des fichiers…");
        const r = await parseTabularFiles(files, { since, onProgress: (d, t) => setPct(Math.round((d / Math.max(t, 1)) * 100)) });
        samples = r.samples;
        source = r.source;
        if (r.recognized.length) notes.push(`Fichiers reconnus : ${r.recognized.length}.`);
        if (r.ignored.length) notes.push(`Ignorés (sans données utiles) : ${r.ignored.length}.`);
      }
      if (!samples.length) throw new Error("Aucune donnée de sommeil, de pas ou de fréquence cardiaque trouvée sur la période choisie.");

      setPhase("sending");
      setPct(0);
      setMsg(`Envoi de ${samples.length.toLocaleString("fr-FR")} valeurs journalières (${SOURCE_LABEL[source]})…`);
      let saved = 0;
      let rejected = 0;
      for (let i = 0; i < samples.length; i += BATCH) {
        if (abort.current.signal.aborted) throw new Error("Import annulé.");
        const res = await importHealthBatchAction(clientId, source, samples.slice(i, i + BATCH));
        if (!res.ok) throw new Error(res.error);
        saved += res.saved;
        rejected += res.rejected;
        setPct(Math.round(((i + BATCH) / samples.length) * 100));
      }
      await finishHealthImportAction(clientId);
      const days = new Set(samples.map((s) => s.day)).size;
      setSummary([`${saved.toLocaleString("fr-FR")} valeurs enregistrées sur ${days} jours.`, ...(rejected ? [`${rejected} valeurs hors limites ignorées.`] : []), ...notes]);
      setPhase("done");
      setMsg(`Import ${SOURCE_LABEL[source]} terminé.`);
      router.refresh();
    } catch (e) {
      setPhase("error");
      setMsg((e as Error).message || "Import impossible.");
    } finally {
      abort.current = null;
      if (input.current) input.current.value = "";
    }
  }

  const busy = phase === "reading" || phase === "sending";

  return (
    <Card id="importer">
      <CardHeader title="Importer depuis une montre" subtitle="Apple Watch (Santé iPhone), Samsung Health, Health Connect" icon={<FileUp className="size-4" />} />
      <div className="space-y-4 px-5 pb-5">
        <div
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition",
            busy ? "border-brand-200 bg-brand-50/40" : "border-line hover:border-brand-300",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) run([...e.dataTransfer.files]);
          }}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept=".zip,.xml,.csv,.json,application/zip,text/xml,text/csv,application/json"
            className="sr-only"
            id={`health-file-${clientId}`}
            disabled={busy}
            onChange={(e) => run([...(e.target.files ?? [])])}
          />
          <label htmlFor={`health-file-${clientId}`} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-500 px-4 h-11 text-sm font-semibold text-white hover:bg-brand-600", busy && "pointer-events-none opacity-60")}>
            <FileUp className="size-4" /> Choisir le fichier d&apos;export
          </label>
          <p className="text-xs text-muted">export.zip d&apos;Apple Santé, fichiers CSV/JSON de Samsung Health ou Health Connect (plusieurs fichiers possibles)</p>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Période
            <Select value={range} onChange={(e) => setRange(e.target.value)} disabled={busy} className="h-9 w-44 text-xs">
              <option value="90">3 derniers mois</option>
              <option value="365">12 derniers mois</option>
              <option value="3650">Tout l&apos;historique</option>
            </Select>
          </label>
        </div>

        {phase !== "idle" && (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              phase === "error" ? "border-red-200 bg-red-50 text-red-700" : phase === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-canvas text-slate-700",
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              {busy ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> : phase === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}
              <p className="min-w-0 flex-1">{msg}</p>
              {busy && (
                <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => abort.current?.abort()}>
                  Annuler
                </Button>
              )}
            </div>
            {busy && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            )}
            {summary.length > 0 && (
              <ul className="mt-1.5 list-inside list-disc text-xs">
                {summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          Le fichier est analysé sur cet appareil : seuls les totaux par jour (sommeil, pas, fréquence cardiaque, calories, VO2max, poids) sont envoyés. Réimporter remplace les jours déjà présents.
        </p>

        {!compact && <ExportHelp />}
      </div>
    </Card>
  );
}

export function ExportHelp() {
  return (
    <div className="space-y-2 text-sm">
      <details className="group rounded-xl border border-line bg-white px-4 py-3">
        <summary className="cursor-pointer font-semibold text-ink">Apple Watch / iPhone : exporter Santé</summary>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-700">
          <li>Ouvrez l&apos;app <b>Santé</b> sur l&apos;iPhone, touchez votre photo en haut à droite.</li>
          <li>Tout en bas : <b>Exporter toutes les données de santé</b> → Exporter (1 à 5 minutes).</li>
          <li>Enregistrez le fichier <b>export.zip</b> (« Enregistrer dans Fichiers ») puis choisissez-le ici, depuis l&apos;iPhone ou un ordinateur.</li>
        </ol>
      </details>
      <details className="group rounded-xl border border-line bg-white px-4 py-3">
        <summary className="cursor-pointer font-semibold text-ink">Samsung Galaxy Watch : Samsung Health</summary>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-700">
          <li>Samsung Health → menu ☰ → <b>Paramètres</b> → <b>Télécharger les données personnelles</b>.</li>
          <li>Le dossier <b>Samsung Health</b> est créé dans « Mes fichiers ». Sélectionnez ses fichiers CSV (pedometer, sleep, heart_rate, weight…) ou compressez le dossier en .zip.</li>
        </ol>
      </details>
      <details className="group rounded-xl border border-line bg-white px-4 py-3">
        <summary className="cursor-pointer font-semibold text-ink">Autres montres Android (Wear OS, Fitbit, Garmin…) : Health Connect</summary>
        <p className="mt-2 text-slate-700">
          Health Connect n&apos;exporte qu&apos;une base de données illisible ici. Utilisez une application d&apos;export Health Connect vers CSV/JSON, ou un tableur avec une ligne par jour (colonnes <i>date, pas, sommeil, fc_repos, poids</i>). L&apos;application Android Moov&apos;Up synchronisera ensuite automatiquement.
        </p>
      </details>
    </div>
  );
}
