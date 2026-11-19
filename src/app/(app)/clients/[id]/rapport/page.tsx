import Image from "next/image";
import { CalendarRange } from "lucide-react";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, HealthCheck, Measurement, Session } from "@/lib/types";
import { fmtDate, num, signed } from "@/lib/utils";
import { BackLink } from "@/components/back-link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { ACCENT, BRAND, TrendChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Rapport de progression" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: cData }, { data: m }, { data: h }, { data: s }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("measurements").select("*").eq("client_id", id).order("measured_on"),
    supabase.from("health_checks").select("*").eq("client_id", id).order("checked_on"),
    supabase.from("sessions").select("*").eq("client_id", id).gte("starts_at", since),
  ]);
  if (!cData) notFound();
  const c = cData as Client;
  const meas = (m ?? []) as Measurement[];
  const checks = (h ?? []) as HealthCheck[];
  const sess = (s ?? []) as Session[];
  const done = sess.filter((x) => x.status === "realisee").length;
  const counted = sess.filter((x) => x.status === "realisee" || x.status === "absent").length;

  const metric = (label: string, k: keyof Measurement, unit: string) => {
    const v = meas.filter((x) => x[k] !== null).map((x) => Number(x[k]));
    if (!v.length) return null;
    return { label, first: v[0]!, last: v.at(-1)!, delta: v.at(-1)! - v[0]!, unit };
  };
  const metrics = [
    metric("Poids", "weight_kg", "kg"),
    metric("Masse grasse", "body_fat", "%"),
    metric("Tour de taille", "waist_cm", "cm"),
    metric("Squat", "squat_kg", "kg"),
    metric("Développé couché", "bench_kg", "kg"),
    metric("Soulevé de terre", "deadlift_kg", "kg"),
  ].filter(Boolean) as { label: string; first: number; last: number; delta: number; unit: string }[];
  const last = checks.at(-1);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <BackLink href={`/clients/${id}`} label={c.full_name} />
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/rapports?client=${id}`} variant="secondary">
            <CalendarRange className="size-4" /> Rapport par période
          </LinkButton>
          <PrintButton />
        </div>
      </div>
      <div className="space-y-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-line sm:p-10 print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-accent-500 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-500">Rapport de progression</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{c.full_name}</h1>
            <p className="mt-1 text-sm text-muted">
              {c.goal ? `Objectif : ${c.goal} · ` : ""}Suivi depuis le {fmtDate(c.start_date)}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Édité le {fmtDate(new Date())} par {me.full_name || "le coach"}
            </p>
          </div>
          <Image src="/logo.png" alt="Complexe Moov'Up Sports" width={473} height={136} className="h-auto w-40 shrink-0" />
        </header>

        <section className="grid grid-cols-3 gap-3">
          {[
            ["Séances (30 j)", done],
            ["Assiduité", counted ? `${Math.round((done / counted) * 100)} %` : "–"],
            ["Mesures relevées", meas.length],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-brand-50 p-4 text-center">
              <p className="font-display text-2xl font-extrabold text-brand-600">{v}</p>
              <p className="text-xs text-muted">{l}</p>
            </div>
          ))}
        </section>

        {metrics.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-brand-600">Résultats</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2">Mesure</th>
                  <th className="py-2 text-right">Départ</th>
                  <th className="py-2 text-right">Actuel</th>
                  <th className="py-2 text-right">Évolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map((x) => (
                  <tr key={x.label}>
                    <td className="py-2.5 font-medium">{x.label}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted">{num(x.first, x.unit)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{num(x.last, x.unit)}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-accent-600">{signed(x.delta, x.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {meas.length > 1 && (
          <Card className="shadow-none">
            <CardHeader title="Évolution du poids et de la masse grasse" />
            <div className="px-3 pb-4">
              <TrendChart
                height={220}
                data={meas.map((x) => ({ label: fmtDate(x.measured_on, { day: "numeric", month: "short" }), weight: x.weight_kg, fat: x.body_fat }))}
                series={[
                  { key: "weight", label: "Poids", unit: "kg", color: BRAND },
                  { key: "fat", label: "Masse grasse", unit: "%", color: ACCENT, right: true },
                ]}
              />
            </div>
          </Card>
        )}

        {last && (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-brand-600">Bien-être (dernier bilan, {fmtDate(last.checked_on)})</h2>
            <div className="grid grid-cols-3 gap-3 text-center text-sm sm:grid-cols-6">
              {[
                ["Sommeil", last.sleep],
                ["Énergie", last.energy],
                ["Stress", last.stress],
                ["Motivation", last.motivation],
                ["Alimentation", last.nutrition],
                ["Récupération", last.recovery],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-line p-3">
                  <p className="font-display text-xl font-bold">{v ?? "–"}<span className="text-xs text-muted">/10</span></p>
                  <p className="text-xs text-muted">{l}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-line pt-4 text-center text-xs text-muted">
          Complexe Moov&apos;Up Sports · Agadir — Document de suivi sportif, ne remplace pas un avis médical.
        </footer>
      </div>
    </div>
  );
}
