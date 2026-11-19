"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { runAccessTestAction, type AccessTestResult } from "@/actions/admin";
import { buttonClass } from "@/components/ui";
import { EXPECTED_LABEL, ROLES } from "./access-spec";

const OUT: Record<string, string> = { ok: "200 autorisé", redirect: "redirigé", notfound: "404", error: "erreur" };

/** Bouton « Lancer le test » : rejoue le test des accès depuis le serveur (mode démo). */
export function AccessTest({ demo }: { demo: boolean }) {
  const [res, setRes] = useState<AccessTestResult>();
  const [pending, start] = useTransition();
  const checks = res?.checks ?? [];
  const failed = checks.filter((c) => !c.pass);

  return (
    <div>
      <button type="button" disabled={pending || !demo} onClick={() => start(async () => setRes(await runAccessTestAction()))} className={buttonClass("brand")}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {pending ? "Test en cours… (jusqu'à 1-2 min au premier lancement)" : "Lancer le test des accès"}
      </button>
      {!demo && <p className="mt-2 text-xs text-muted">Disponible en mode démo uniquement ; sinon utilise le script en ligne de commande.</p>}
      {res?.error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{res.error}</p>}
      {checks.length > 0 && (
        <div className="mt-4">
          <p className={`flex items-center gap-2 text-sm font-semibold ${failed.length ? "text-red-600" : "text-emerald-700"}`}>
            {failed.length ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {failed.length ? `${failed.length} échec${failed.length > 1 ? "s" : ""} sur ${checks.length} vérifications` : `Tout est conforme : ${checks.length} vérifications`}
            <span className="font-normal text-muted">· {res?.base} · {Math.round((res?.ms ?? 0) / 1000)} s</span>
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Compte</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Attendu</th>
                  <th className="px-3 py-2">Obtenu</th>
                  <th className="px-3 py-2">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...failed, ...checks.filter((c) => c.pass)].map((c) => (
                  <tr key={c.role + c.route} className={c.pass ? "" : "bg-red-50/60"}>
                    <td className="px-3 py-1.5">{ROLES.find((r) => r.key === c.role)?.label}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{c.route}</td>
                    <td className="px-3 py-1.5">{EXPECTED_LABEL[c.expected]}</td>
                    <td className="px-3 py-1.5">
                      {OUT[c.got]} {c.status ? <span className="text-xs text-muted">({c.status}{c.location ? ` → ${c.location}` : ""})</span> : null}
                      {c.detail && !c.location && <span className="block text-xs text-muted">{c.detail}</span>}
                    </td>
                    <td className="px-3 py-1.5">{c.pass ? <span className="font-semibold text-emerald-700">PASS</span> : <span className="font-semibold text-red-600">FAIL</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
