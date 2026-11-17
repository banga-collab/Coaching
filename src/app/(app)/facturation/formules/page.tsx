import Link from "next/link";
import { CalendarClock, Dumbbell, Package as PackageIcon, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Package } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { PackageForm } from "@/components/business/package-form";
import { togglePackageAction } from "@/actions/business";

export const metadata = { title: "Formules" };

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireAdmin();
  const { edit } = await searchParams;
  const supabase = await createClient();
  const [{ data: pData }, { data: iData }] = await Promise.all([
    supabase.from("packages").select("*").order("price_mad"),
    supabase.from("invoices").select("package_id, status"),
  ]);
  const packages = ((pData ?? []) as Package[]).sort((a, b) => Number(b.active) - Number(a.active));
  const sold = new Map<string, number>();
  for (const i of (iData ?? []) as Pick<Invoice, "package_id" | "status">[]) {
    if (i.package_id && i.status !== "annulee") sold.set(i.package_id, (sold.get(i.package_id) ?? 0) + 1);
  }
  const editing = edit ? packages.find((p) => p.id === edit) ?? null : null;

  return (
    <>
      <PageHeader
        back={<BackLink href="/facturation" label="Facturation" />}
        title="Formules"
        subtitle={`${packages.filter((p) => p.active).length} formule(s) active(s) · utilisées pour pré-remplir les factures`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div>
          {packages.length === 0 ? (
            <Card>
              <Empty icon={<PackageIcon className="size-6" />} title="Aucune formule" text="Créez vos offres (coaching, abonnement, bilan…) avec le formulaire." />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {packages.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-pop",
                    !p.active && "opacity-60",
                    editing?.id === p.id && "ring-2 ring-brand-400",
                  )}
                >
                  <div className={cn("absolute inset-x-0 top-0 h-1", p.active ? "bg-brand-500" : "bg-slate-300")} />
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-500">
                      <PackageIcon className="size-5" />
                    </span>
                    <Badge dot tone={p.active ? "green" : "gray"}>
                      {p.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-display text-base font-bold text-ink">{p.name}</h3>
                  {p.description && <p className="mt-1 text-sm text-muted line-clamp-2">{p.description}</p>}
                  <p className="mt-4 font-display text-2xl font-extrabold tracking-tight text-brand-500">
                    {nf.format(Number(p.price_mad))} <span className="text-sm font-bold text-slate-400">MAD</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-canvas px-2 py-1">
                      <Dumbbell className="size-3.5 text-accent-500" /> {p.sessions_count ? `${p.sessions_count} séance${p.sessions_count > 1 ? "s" : ""}` : "Illimité"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-canvas px-2 py-1">
                      <CalendarClock className="size-3.5 text-accent-500" /> {p.duration_days ? `${p.duration_days} jours` : "Sans durée"}
                    </span>
                  </div>
                  <div className="mt-auto pt-4"><div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="text-xs text-muted">
                      {sold.get(p.id) ?? 0} facture{(sold.get(p.id) ?? 0) > 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <form action={togglePackageAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                        <button type="submit" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-canvas hover:text-ink">
                          {p.active ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                      <Link
                        href={`/facturation/formules?edit=${p.id}`}
                        scroll={false}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                      >
                        <Pencil className="size-3.5" /> Modifier
                      </Link>
                    </div>
                  </div></div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="lg:sticky lg:top-6">
          <CardHeader
            title={editing ? "Modifier la formule" : "Nouvelle formule"}
            subtitle={editing ? editing.name : "Ajoutez une offre à votre catalogue"}
            icon={editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          />
          <PackageForm key={editing?.id ?? "new"} pkg={editing} />
        </Card>
      </div>
    </>
  );
}
