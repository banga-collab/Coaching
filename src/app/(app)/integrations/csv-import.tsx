"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { importClients, type ImportRow } from "@/actions/integrations";
import { Badge, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const TEMPLATE =
  "﻿nom;email;téléphone;objectif;date de naissance\r\nKarim Exemple;karim@example.com;0612345678;Perte de poids;15/03/1990\r\nSalma Exemple;salma@example.com;0698765432;Tonification;1995-07-22\r\n";
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

type Parsed = ImportRow & { line: number; errors: string[] };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const ALIASES: Record<string, string[]> = {
  full_name: ["nom", "nomcomplet", "fullname", "name", "client", "nometprenom", "nomprenom", "prenomnom", "prenometnom"],
  first: ["prenom", "firstname"],
  last: ["nomdefamille", "lastname", "surname"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "emailaddress"],
  phone: ["telephone", "tel", "phone", "portable", "mobile", "gsm", "whatsapp", "numero", "phonenumber"],
  goal: ["objectif", "goal", "but", "objectifs"],
  birth_date: ["datedenaissance", "naissance", "datenaissance", "birthdate", "dateofbirth", "dob", "birthday"],
};

/** Découpe un CSV (guillemets gérés) avec le séparateur donné. */
function parseCsv(text: string, sep: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function toIsoDate(v: string): string | null | false {
  const s = v.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1900 || dt > new Date()) return false;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function analyse(text: string): { rows: Parsed[]; mapped: string[]; error?: string } {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const all = parseCsv(clean, sep);
  if (all.length < 2) return { rows: [], mapped: [], error: "Le fichier doit contenir une ligne d'en-tête et au moins un client." };
  const header = all[0]!.map(norm);
  const idx: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) idx[key] = i;
  }
  // "nom" + "prénom" séparés
  if (idx.first !== undefined && idx.full_name !== undefined && header[idx.full_name] === "nom") {
    idx.last = idx.full_name;
    delete idx.full_name;
  }
  if (idx.full_name === undefined && idx.first === undefined && idx.last === undefined) {
    return { rows: [], mapped: [], error: "Colonne « nom » introuvable. Utilise le modèle pour vérifier les en-têtes." };
  }
  const mapped = [
    idx.full_name !== undefined || idx.first !== undefined || idx.last !== undefined ? "Nom" : null,
    idx.email !== undefined ? "E-mail" : null,
    idx.phone !== undefined ? "Téléphone" : null,
    idx.goal !== undefined ? "Objectif" : null,
    idx.birth_date !== undefined ? "Date de naissance" : null,
  ].filter((x): x is string => !!x);

  const get = (r: string[], k: string) => (idx[k] !== undefined ? (r[idx[k]!] ?? "").trim() : "");
  const seen = new Set<string>();
  const rows = all.slice(1).map((r, i) => {
    const errors: string[] = [];
    const full_name = get(r, "full_name") || [get(r, "first"), get(r, "last")].filter(Boolean).join(" ");
    const email = get(r, "email").toLowerCase();
    const bd = toIsoDate(get(r, "birth_date"));
    if (!full_name) errors.push("Nom manquant");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("E-mail invalide");
    if (email && seen.has(email)) errors.push("E-mail en double");
    if (email) seen.add(email);
    if (bd === false) errors.push("Date invalide");
    return {
      line: i + 2,
      full_name,
      email: email || null,
      phone: get(r, "phone") || null,
      goal: get(r, "goal") || null,
      birth_date: bd || null,
      errors,
    };
  });
  return { rows, mapped };
}

export function CsvImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Parsed[]>([]);
  const [mapped, setMapped] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.length - valid.length;

  function reset() {
    setFileName(null);
    setRows([]);
    setMapped([]);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function load(file: File | undefined) {
    if (!file) return;
    reset();
    if (file.size > 2_000_000) return setError("Fichier trop volumineux (2 Mo maximum).");
    setFileName(file.name);
    const out = analyse(await file.text());
    if (out.error) return setError(out.error);
    if (out.rows.length > 1000) return setError("1 000 lignes maximum par import.");
    setRows(out.rows);
    setMapped(out.mapped);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await importClients(valid.map(({ full_name, email, phone, goal, birth_date }) => ({ full_name, email, phone, goal, birth_date })));
      if (res.error) setError(res.error);
      else {
        setResult({ imported: res.imported ?? 0, skipped: (res.skipped ?? 0) + invalid });
        setRows([]);
      }
    });
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <p className="mt-3 font-display text-lg font-bold text-ink">
          {result.imported} client{result.imported > 1 ? "s" : ""} importé{result.imported > 1 ? "s" : ""}
        </p>
        {result.skipped > 0 && <p className="mt-1 text-sm text-muted">{result.skipped} ligne(s) ignorée(s) car invalides.</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/clients" className={buttonClass("brand")}>
            Voir les clients
          </Link>
          <button type="button" onClick={reset} className={buttonClass("secondary")}>
            <RotateCcw className="size-4" /> Nouvel import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!rows.length && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void load(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            drag ? "border-brand-400 bg-brand-50" : "border-line bg-canvas/60 hover:border-brand-300 hover:bg-brand-50/40",
          )}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-500 shadow-card">
            <FileUp className="size-6" />
          </span>
          <span className="mt-3 text-sm font-semibold text-ink">Glisse ton fichier CSV ici ou clique pour choisir</span>
          <span className="mt-1 text-xs text-muted">Séparateur « ; » ou « , » · 1re ligne = en-têtes · 2 Mo max</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void load(e.target.files?.[0])} />
        </label>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {rows.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{fileName}</span>
            <Badge tone="green">{valid.length} valide{valid.length > 1 ? "s" : ""}</Badge>
            {invalid > 0 && <Badge tone="red">{invalid} en erreur</Badge>}
            <button type="button" onClick={reset} className="ml-auto grid size-8 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink" aria-label="Annuler">
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Colonnes reconnues : {mapped.join(", ")}</p>

          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Ligne</th>
                  <th className="px-3 py-2.5">Nom</th>
                  <th className="px-3 py-2.5">E-mail</th>
                  <th className="px-3 py-2.5">Téléphone</th>
                  <th className="px-3 py-2.5">Objectif</th>
                  <th className="px-3 py-2.5">Naissance</th>
                  <th className="px-3 py-2.5">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.line} className={r.errors.length ? "bg-red-50/50" : undefined}>
                    <td className="px-3 py-2 text-xs text-muted">{r.line}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{r.full_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.goal ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.birth_date ? r.birth_date.split("-").reverse().join("/") : "—"}</td>
                    <td className="px-3 py-2">{r.errors.length ? <Badge tone="red">{r.errors.join(" · ")}</Badge> : <Badge tone="green">OK</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="mt-1.5 text-xs text-muted">Aperçu limité aux 200 premières lignes ({rows.length} au total).</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!valid.length || pending} onClick={submit} className={buttonClass("primary")}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {pending ? "Import en cours…" : `Importer ${valid.length} client${valid.length > 1 ? "s" : ""}`}
            </button>
            {invalid > 0 && <span className="text-xs text-muted">Les lignes en erreur seront ignorées.</span>}
          </div>
        </div>
      )}

      <a href={TEMPLATE_HREF} download="modele-import-clients.csv" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
        <Download className="size-4" /> Télécharger le modèle CSV
      </a>
    </div>
  );
}
