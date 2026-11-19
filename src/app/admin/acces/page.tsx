import { Check, Eye, KeyRound, Minus, ShieldCheck, Terminal, UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AccessTest } from "@/components/admin/access-test";
import { FEATURES, ROLES, ROUTE_EXPECTATIONS, type Level } from "@/components/admin/access-spec";

export const metadata = { title: "Accès & rôles" };

const LEVEL: Record<Level, { label: string; cls: string; icon: React.ReactNode }> = {
  yes: { label: "Oui", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100", icon: <Check className="size-3.5" /> },
  own: { label: "Les siens", cls: "bg-brand-50 text-brand-600 ring-brand-100", icon: <UserRound className="size-3.5" /> },
  view: { label: "Lecture", cls: "bg-amber-50 text-amber-700 ring-amber-100", icon: <Eye className="size-3.5" /> },
  no: { label: "Non", cls: "bg-slate-50 text-slate-500 ring-slate-200", icon: <Minus className="size-3.5" /> },
};

export default async function AdminAccessPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Accès & rôles" subtitle="Qui voit quoi dans Moov'Up. Les règles sont appliquées côté serveur (pages, actions) et en base (RLS), pas seulement masquées dans le menu." />

      <Card className="overflow-hidden">
        <CardHeader title="Matrice des accès" subtitle="Rôles × fonctionnalités" icon={<KeyRound className="size-4" />} />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Fonctionnalité</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="px-3 py-2.5 text-center">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {FEATURES.map((f) => (
                <tr key={f.label} className="align-top">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold">{f.label}</span>
                    {f.route && <span className="ms-2 font-mono text-xs text-muted">{f.route}</span>}
                    {f.note && <span className="block text-xs text-muted">{f.note}</span>}
                  </td>
                  {ROLES.map((r) => {
                    const l = LEVEL[f.levels[r.key]];
                    return (
                      <td key={r.key} className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${l.cls}`}>
                          {l.icon} {l.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-bold">
            <ShieldCheck className="size-4 text-brand-500" /> Test automatique des accès
          </h3>
          <p className="mt-1 text-sm text-muted">
            Chaque compte de démonstration (admin, head coach, coach, adhérent) ouvre {ROUTE_EXPECTATIONS.length} pages sans suivre les redirections.
            Attendu : <b>200</b> = autorisé, <b>redirection 30x</b> = refusé, <b>404</b> pour les pages retirées (fonctions d&apos;argent supprimées).
            Une page plantée, ou un 404 inattendu, compte comme un échec.
          </p>
          <div className="mt-4">
            <AccessTest demo={DEMO} />
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-bold">
            <Terminal className="size-4 text-[#e8782a]" /> En ligne de commande
          </h3>
          <p className="mt-1 text-sm text-muted">Serveur lancé en mode démo (NEXT_PUBLIC_DEMO=1), puis :</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[#0b2a37] px-4 py-3 font-mono text-xs text-[#d2e9f2]">node scripts/test-acces.mjs http://localhost:3100</pre>
          <p className="mt-2 text-xs text-muted">Affiche un tableau PASS / FAIL et sort avec le code 1 en cas d&apos;échec (utilisable en CI).</p>
          <ul className="mt-4 space-y-1.5 text-xs">
            {ROUTE_EXPECTATIONS.map((r) => (
              <li key={r.route} className="flex flex-wrap items-baseline gap-2">
                <span className="w-36 shrink-0 font-mono">{r.route}</span>
                <span className="text-muted">
                  {r.gone ? "retirée (404)" : r.allowed.length ? r.allowed.map((k) => ROLES.find((x) => x.key === k)?.label).join(", ") : "redirection pour tous"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
