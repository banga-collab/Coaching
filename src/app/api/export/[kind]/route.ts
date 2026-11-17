import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { Client, HealthCheck, Invoice, Measurement, Profile, Session } from "@/lib/types";
import { dayKey, fmtDate, fmtTime, SESSION_LABEL, STATUS_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KINDS = ["clients", "seances", "mesures", "bilans", "factures"] as const;
type Kind = (typeof KINDS)[number];
type Cell = string | number | boolean | null | undefined;

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false });
const INVOICE_LABEL: Record<Invoice["status"], string> = { brouillon: "Brouillon", envoyee: "Envoyée", payee: "Payée", annulee: "Annulée" };
const CHECK_LABEL: Record<HealthCheck["kind"], string> = { initial: "Initial", mensuel: "Mensuel", hebdo: "Hebdomadaire" };

function cell(v: Cell) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? nf.format(v) : typeof v === "boolean" ? (v ? "Oui" : "Non") : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const d = (v: string | null | undefined) => (v ? fmtDate(v.length === 10 ? `${v}T12:00:00Z` : v, { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const n = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));
const isDay = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const profile: Profile = await getProfile();
  if (profile.role === "client") return new NextResponse("Accès réservé à l'équipe.", { status: 403 });

  const { kind: raw } = await params;
  if (!(KINDS as readonly string[]).includes(raw)) return new NextResponse("Export inconnu.", { status: 404 });
  const kind = raw as Kind;
  const from = isDay(req.nextUrl.searchParams.get("from"));
  const to = isDay(req.nextUrl.searchParams.get("to"));

  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").order("full_name");
  const clients = (cData ?? []) as Client[];
  const name = new Map(clients.map((c) => [c.id, c.full_name]));
  const { data: pData } = await supabase.from("profiles").select("*");
  const people = new Map(((pData ?? []) as Profile[]).map((p) => [p.id, p.full_name || p.email]));

  let header: string[] = [];
  let rows: Cell[][] = [];

  if (kind === "clients") {
    const list = clients.filter((c) => (!from || c.start_date >= from) && (!to || c.start_date <= to));
    header = ["Nom", "E-mail", "Téléphone", "Sexe", "Date de naissance", "Taille (cm)", "Objectif", "Fréquence", "Statut", "Coach", "Date de début", "Notes"];
    rows = list.map((c) => [c.full_name, c.email, c.phone, c.sex, d(c.birth_date), n(c.height_cm), c.goal, c.frequency, STATUS_LABEL[c.status], people.get(c.coach_id), d(c.start_date), c.notes]);
  } else if (kind === "seances") {
    let q = supabase.from("sessions").select("*");
    if (from) q = q.gte("starts_at", new Date(`${from}T00:00:00Z`).toISOString());
    if (to) q = q.lt("starts_at", new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000).toISOString());
    const { data } = await q.order("starts_at", { ascending: true }).limit(20000);
    header = ["Date", "Heure", "Client", "Coach", "Type", "Durée (min)", "Statut", "RPE", "Notes"];
    rows = ((data ?? []) as Session[]).map((s) => [d(s.starts_at), fmtTime(s.starts_at), name.get(s.client_id), people.get(s.coach_id), s.type, s.duration_min, SESSION_LABEL[s.status], n(s.rpe), s.notes]);
  } else if (kind === "mesures") {
    let q = supabase.from("measurements").select("*");
    if (from) q = q.gte("measured_on", from);
    if (to) q = q.lte("measured_on", to);
    const { data } = await q.order("measured_on", { ascending: true }).limit(20000);
    header = ["Date", "Client", "Poids (kg)", "Masse grasse (%)", "Masse musculaire (kg)", "Taille (cm)", "Hanches (cm)", "Poitrine (cm)", "Bras (cm)", "Cuisse (cm)", "Squat (kg)", "Développé couché (kg)", "Soulevé de terre (kg)", "Notes"];
    rows = ((data ?? []) as Measurement[]).map((m) => [
      d(m.measured_on), name.get(m.client_id), n(m.weight_kg), n(m.body_fat), n(m.muscle_kg), n(m.waist_cm), n(m.hips_cm), n(m.chest_cm), n(m.arm_cm), n(m.thigh_cm), n(m.squat_kg), n(m.bench_kg), n(m.deadlift_kg), m.notes,
    ]);
  } else if (kind === "bilans") {
    let q = supabase.from("health_checks").select("*");
    if (from) q = q.gte("checked_on", from);
    if (to) q = q.lte("checked_on", to);
    const { data } = await q.order("checked_on", { ascending: true }).limit(20000);
    header = ["Date", "Client", "Type", "Tension sys.", "Tension dia.", "FC repos", "Sommeil /10", "Énergie /10", "Stress /10", "Motivation /10", "Nutrition /10", "Récupération /10", "Zones douloureuses", "Pathologies", "Traitements", "Blessures", "PAR-Q positif", "Consentement", "Notes"];
    rows = ((data ?? []) as HealthCheck[]).map((h) => [
      d(h.checked_on), name.get(h.client_id), CHECK_LABEL[h.kind] ?? h.kind, n(h.systolic), n(h.diastolic), n(h.resting_hr), n(h.sleep), n(h.energy), n(h.stress), n(h.motivation), n(h.nutrition), n(h.recovery),
      (h.pain_zones ?? []).join(", "), h.conditions, h.medications, h.injuries, h.parq_positive, h.consent, h.notes,
    ]);
  } else {
    let q = supabase.from("invoices").select("*");
    if (from) q = q.gte("issued_on", from);
    if (to) q = q.lte("issued_on", to);
    const { data } = await q.order("issued_on", { ascending: true }).limit(20000);
    header = ["Numéro", "Date d'émission", "Échéance", "Client", "Désignation", "Montant (MAD)", "Statut", "Payée le", "Moyen de paiement", "Notes"];
    rows = ((data ?? []) as Invoice[]).map((i) => [
      i.number, d(i.issued_on), d(i.due_on), name.get(i.client_id), (i.lines ?? []).map((l) => (l.qty > 1 ? `${l.qty} × ${l.label}` : l.label)).join(" + "), n(i.amount_mad), INVOICE_LABEL[i.status] ?? i.status, d(i.paid_on), i.method, i.notes,
    ]);
  }

  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moovup-${kind}-${dayKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
