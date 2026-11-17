import { NextResponse } from "next/server";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import type { Client, Profile, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

const text = (body: string, status: number) => new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** Date ISO → AAAAMMJJTHHMMSSZ (UTC) */
function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
/** Repli des lignes à 75 octets (RFC 5545). */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let supabase: SupabaseClient;
  if (DEMO) {
    supabase = await createClient();
  } else {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      return text(
        "Flux calendrier indisponible : ajoutez la variable d'environnement SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API > service_role) sur le serveur pour activer l'abonnement iCal.",
        501,
      );
    }
    supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  const expected = (settings as { calendar_token?: string; brand_name?: string } | null)?.calendar_token;
  if (!expected || !token || token !== expected) return text("Lien de calendrier invalide.", 404);
  const brand = (settings as { brand_name?: string }).brand_name || "Moov'Up";

  const now = Date.now();
  const from = new Date(now - 30 * 86400000).toISOString();
  const to = new Date(now + 90 * 86400000).toISOString();
  const [{ data: sData }, { data: cData }, { data: pData }] = await Promise.all([
    supabase.from("sessions").select("*").gte("starts_at", from).lte("starts_at", to).neq("status", "annulee").order("starts_at").limit(5000),
    supabase.from("clients").select("*"),
    supabase.from("profiles").select("*"),
  ]);
  const clients = new Map(((cData ?? []) as Client[]).map((c) => [c.id, c.full_name]));
  const coaches = new Map(((pData ?? []) as Profile[]).map((p) => [p.id, p.full_name]));
  const stamp = icsDate(new Date());
  const host = "moovup-coach";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(brand)}//Moov'Up Coach//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`${brand} – Séances`)}`,
    "X-WR-TIMEZONE:Africa/Casablanca",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const s of (sData ?? []) as Session[]) {
    if (s.status === "annulee") continue;
    const start = new Date(s.starts_at);
    const end = new Date(start.getTime() + (s.duration_min || 60) * 60000);
    const client = clients.get(s.client_id) ?? "Client";
    const desc = [`Client : ${client}`, coaches.get(s.coach_id) && `Coach : ${coaches.get(s.coach_id)}`, s.status === "realisee" ? "Statut : réalisée" : s.status === "absent" ? "Statut : absent" : null, s.notes]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${esc(`${s.type} – ${client}`)}`,
      `DESCRIPTION:${esc(desc)}`,
      `LOCATION:${esc(brand)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="moovup-seances.ics"',
      "Cache-Control": "no-store",
    },
  });
}
