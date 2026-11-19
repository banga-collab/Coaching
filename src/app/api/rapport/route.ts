import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { ClientStatus } from "@/lib/types";
import { dayKey, STATUS_LABEL } from "@/lib/utils";
import { exportLogo, fileName, fileResponse, fold, XLSX_TYPE } from "@/lib/export";
import { loadReport, reportHtml, reportMeta, reportXlsx } from "@/lib/export/report";
import { parseSections } from "@/lib/export/report-sections";

export const dynamic = "force-dynamic";

/**
 * Rapports clients : /api/rapport?clients=<id,id…|all>&statut=&from=AAAA-MM-JJ&to=AAAA-MM-JJ&sections=progression,sante,seances,presence&format=pdf|xlsx
 */
const isDay = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(req: NextRequest) {
  const me = await getProfile();
  if (me.role === "client") return new NextResponse("Accès réservé à l'équipe.", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "pdf";
  const rawClients = (sp.get("clients") ?? sp.get("client") ?? "").trim();
  const all = rawClients === "all" || rawClients === "tous";
  const ids = all ? [] : [...new Set(rawClients.split(",").map((s) => s.trim()).filter((s) => /^[0-9a-zA-Z-]{6,64}$/.test(s)))].slice(0, 1000);
  if (!all && !ids.length) return new NextResponse("Choisissez au moins un client.", { status: 400 });
  const statut = (["actif", "pause", "termine"] as const).find((s) => s === sp.get("statut")) ?? null;

  const today = dayKey(new Date());
  let to = isDay(sp.get("to")) ?? today;
  let from = isDay(sp.get("from")) ?? new Date(new Date(`${to}T12:00:00Z`).getTime() - 90 * 86400000).toISOString().slice(0, 10);
  if (from > to) [from, to] = [to, from];

  const supabase = await createClient();
  const data = await loadReport(supabase, { clients: all ? "all" : ids, statut: all ? statut : null, from, to, sections: parseSections(sp.get("sections")) });
  const meta = reportMeta(data, me.full_name || me.email, statut ? STATUS_LABEL[statut as ClientStatus] : undefined);

  const kind =
    data.reports.length === 1
      ? `rapport-${fold(data.reports[0]!.client.full_name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client"}`
      : "rapports-clients";
  const date = meta.date ?? new Date();
  if (format === "xlsx") return fileResponse(reportXlsx(data, meta), XLSX_TYPE, fileName(kind, "xlsx", date));
  const name = fileName(kind, "pdf", date).replace(/\.pdf$/, "");
  return fileResponse(reportHtml(data, meta, await exportLogo(), name), "text/html; charset=utf-8", `${name}.html`, true);
}
