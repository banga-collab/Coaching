"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Smartphone, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { fmtDate } from "@/lib/utils";
import { createHealthTokenAction, revokeHealthTokenAction } from "@/actions/health-data";

export type TokenRow = { id: string; label: string | null; created_at: string; last_used_at: string | null };

/** Jetons personnels : permettent à l'application mobile d'envoyer les données de la montre automatiquement. */
export function HealthTokenCard({ clientId, tokens, endpoint }: { clientId: string; tokens: TokenRow[]; endpoint: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      setError(null);
      const r = await createHealthTokenAction(clientId, label);
      if (r.ok) {
        setToken(r.token);
        setLabel("");
        router.refresh();
      } else setError(r.error);
    });

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Application mobile" subtitle="Synchronisation automatique de la montre (bientôt sur Android)" icon={<Smartphone className="size-4" />} />
      <div className="space-y-4 px-5 pb-5 text-sm">
        <p className="text-muted">
          L&apos;application Moov&apos;Up pour Android lira Health Connect (Samsung Galaxy Watch, Wear OS, Fitbit…) et enverra chaque jour ton sommeil, tes pas et ta fréquence cardiaque. Crée un code d&apos;accès et colle-le dans l&apos;application.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom de l'appareil (ex. Galaxy S24)" maxLength={40} className="h-10 min-w-0 flex-1 basis-48" />
          <Button type="button" variant="brand" onClick={create} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Créer un code
          </Button>
        </div>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        {token && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">Copie ce code maintenant : il ne sera plus jamais affiché.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-ink">{token}</code>
              <Button type="button" variant="secondary" className="h-9 px-3" onClick={copy} aria-label="Copier le code">
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        )}
        {tokens.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{t.label || "Appareil"}</p>
                  <p className="text-xs text-muted">
                    Créé le {fmtDate(t.created_at)} · {t.last_used_at ? `dernier envoi le ${fmtDate(t.last_used_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "jamais utilisé"}
                  </p>
                </div>
                <form action={revokeHealthTokenAction}>
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="id" value={t.id} />
                  <ConfirmButton message="Révoquer ce code ? L'appareil ne pourra plus envoyer de données." className="h-8 px-3 text-xs">
                    <Trash2 className="size-3.5" /> Révoquer
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-xl bg-canvas px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">Pour les développeurs : API de synchronisation</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-white p-2 font-mono text-[11px] leading-relaxed text-ink">{`POST ${endpoint}
Authorization: Bearer mvh_…
Content-Type: application/json

{ "source": "health_connect",
  "samples": [
    { "date": "2026-11-17", "type": "steps", "value": 8421 },
    { "date": "2026-11-17", "type": "sleep", "value": 432,
      "details": { "deep": 80, "rem": 95, "light": 230 } },
    { "date": "2026-11-17", "type": "hr_resting", "value": 61 } ] }`}</pre>
          <p className="mt-1">Types : sleep (min), steps, hr_resting, hr_avg (bpm), active_kcal, vo2max, weight (kg). GET avec le même en-tête pour tester le code.</p>
        </details>
      </div>
    </Card>
  );
}
