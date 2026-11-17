import Link from "next/link";
import { Award, CheckCircle2, Crown, Gift, Percent, Phone, Settings2, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { waLink } from "@/lib/whatsapp";
import type { Client, Referral } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Field, Input, Kpi, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { LinkClientForm } from "@/components/referrals/link-client-form";
import { createReferralAction, markReferralRewardedAction, updateReferralSettingsAction } from "@/actions/referrals";

export const metadata = { title: "Parrainage" };

const STATUS: Record<Referral["status"], { label: string; tone: "amber" | "brand" | "green" }> = {
  en_attente: { label: "En attente", tone: "amber" },
  inscrit: { label: "Inscrit", tone: "brand" },
  recompense: { label: "Récompensé", tone: "green" },
};
const FILTERS: { key: "" | Referral["status"]; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "en_attente", label: "En attente" },
  { key: "inscrit", label: "Inscrits" },
  { key: "recompense", label: "Récompensés" },
];
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const mad = (v: number) => `${nf.format(v)} MAD`;

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ statut?: string; ok?: string }> }) {
  const me = await requireStaff();
  const { statut = "", ok } = await searchParams;
  const filter = FILTERS.some((f) => f.key === statut) ? statut : "";
  const supabase = await createClient();
  const [{ data: rData }, { data: cData }, settings] = await Promise.all([
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("full_name"),
    getSettings(),
  ]);
  const referrals = (rData ?? []) as Referral[];
  const clientList = (cData ?? []) as Client[];
  const clients = new Map(clientList.map((c) => [c.id, c]));
  const reward = Number(settings.referral_reward_mad ?? 200);
  const discount = Number(settings.referral_discount_pct ?? 10);
  const isAdmin = me.role === "admin";

  const converted = referrals.filter((r) => r.status !== "en_attente");
  const rewarded = referrals.filter((r) => r.status === "recompense");
  const toReward = referrals.filter((r) => r.status === "inscrit");
  const paid = rewarded.reduce((s, r) => s + Number(r.reward_mad ?? 0), 0);
  const rate = referrals.length ? Math.round((converted.length / referrals.length) * 100) : 0;

  const board = [...referrals.reduce((map, r) => {
    const x = map.get(r.referrer_client_id) ?? { id: r.referrer_client_id, total: 0, won: 0, earned: 0 };
    x.total += 1;
    if (r.status !== "en_attente") x.won += 1;
    x.earned += Number(r.reward_mad ?? 0);
    return map.set(r.referrer_client_id, x);
  }, new Map<string, { id: string; total: number; won: number; earned: number }>()).values()]
    .sort((a, b) => b.won - a.won || b.total - a.total)
    .slice(0, 5);

  const rows = referrals.filter((r) => !filter || r.status === filter);
  const pickable = clientList.map((c) => ({ id: c.id, full_name: c.full_name }));

  return (
    <>
      <PageHeader title="Parrainage" subtitle="Vos membres sont vos meilleurs ambassadeurs" />

      {ok && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> {ok === "reglages" ? "Réglages du parrainage enregistrés." : "Parrainage ajouté."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi label="Recommandations" value={referrals.length} icon={<Users className="size-[18px]" />} delta={`${referrals.filter((r) => r.status === "en_attente").length} en attente`} />
        <Kpi label="Filleuls inscrits" value={converted.length} tone="accent" icon={<UserPlus className="size-[18px]" />} delta={`${rate} % de conversion`} positive={rate >= 30 ? true : undefined} />
        <Kpi label="Récompenses versées" value={<span className="text-[22px] sm:text-[28px]">{mad(paid)}</span>} icon={<Wallet className="size-[18px]" />} delta={`${rewarded.length} parrain${rewarded.length > 1 ? "s" : ""} récompensé${rewarded.length > 1 ? "s" : ""}`} />
        <Kpi
          label="À récompenser"
          value={toReward.length}
          tone="accent"
          icon={<Gift className="size-[18px]" />}
          delta={toReward.length ? `${mad(toReward.length * reward)} à prévoir` : "À jour"}
          positive={toReward.length === 0 ? true : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex w-max gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={{ pathname: "/parrainage", query: f.key ? { statut: f.key } : {} }}
                  className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", filter === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
                >
                  {f.label}
                  {f.key === "inscrit" && toReward.length > 0 && (
                    <span className={cn("ml-1.5 rounded-full px-1.5 text-[10px]", filter === f.key ? "bg-white/20" : "bg-accent-50 text-accent-700")}>{toReward.length}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <Card>
            {rows.length === 0 ? (
              <Empty
                icon={<Gift className="size-6" />}
                title={filter ? "Aucun parrainage dans cette catégorie" : "Aucun parrainage pour l'instant"}
                text="Les membres recommandent leurs amis depuis leur espace (Parrainage). Vous pouvez aussi en ajouter un ci-contre."
              />
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => {
                  const parrain = clients.get(r.referrer_client_id);
                  const filleul = r.referred_client_id ? clients.get(r.referred_client_id) : null;
                  const s = STATUS[r.status];
                  const wa = waLink(r.referred_phone, `Bonjour ${r.referred_name.split(" ")[0]} 👋 ${parrain?.full_name.split(" ")[0] ?? "Un ami"} nous a parlé de toi ! Avec son code ${parrain?.referral_code ?? ""}, tu profites de ${discount} % sur ta première formule au Complexe Moov'Up.`);
                  return (
                    <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={r.referred_name} size={40} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2">
                            {filleul ? (
                              <Link href={`/clients/${filleul.id}`} className="truncate font-semibold text-ink hover:text-brand-600">
                                {r.referred_name}
                              </Link>
                            ) : (
                              <span className="truncate font-semibold text-ink">{r.referred_name}</span>
                            )}
                            <Badge tone={s.tone} dot>
                              {s.label}
                            </Badge>
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                            <span>
                              Parrain :{" "}
                              {parrain ? (
                                <Link href={`/clients/${parrain.id}`} className="font-medium text-slate-700 hover:text-brand-600">
                                  {parrain.full_name}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </span>
                            {r.referred_phone &&
                              (wa ? (
                                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
                                  <Phone className="size-3" /> {r.referred_phone}
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="size-3" /> {r.referred_phone}
                                </span>
                              ))}
                            <span>{fmtDate(r.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 md:justify-end">
                        {r.status === "en_attente" && <LinkClientForm id={r.id} clients={pickable.filter((c) => c.id !== r.referrer_client_id)} />}
                        {r.status === "inscrit" && (
                          <form action={markReferralRewardedAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton className="h-9 px-3 text-xs" pendingText="…">
                              <Award className="size-3.5" /> Marquer récompensé ({mad(reward)})
                            </SubmitButton>
                          </form>
                        )}
                        {r.status === "recompense" && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                            <Gift className="size-3.5" /> {mad(Number(r.reward_mad ?? 0))} versés
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Meilleurs ambassadeurs" subtitle="Classés par filleuls inscrits" icon={<Crown className="size-4" />} />
            {board.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Le classement apparaîtra avec les premiers parrainages.</p>
            ) : (
              <ol className="space-y-1 px-3 pb-4">
                {board.map((b, i) => {
                  const c = clients.get(b.id);
                  return (
                    <li key={b.id}>
                      <Link href={`/clients/${b.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-canvas">
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                            i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-canvas text-muted",
                          )}
                        >
                          {i + 1}
                        </span>
                        <Avatar name={c?.full_name ?? "?"} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{c?.full_name ?? "Membre"}</span>
                          <span className="block text-xs text-muted">
                            {b.won} inscrit{b.won > 1 ? "s" : ""} · {b.total} recommandé{b.total > 1 ? "s" : ""}
                          </span>
                        </span>
                        {b.earned > 0 && <span className="text-xs font-bold text-emerald-600">{mad(b.earned)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader title="Réglages" subtitle={isAdmin ? "Appliqués aux prochains parrainages" : "Modifiables par un administrateur"} icon={<Settings2 className="size-4" />} />
            {isAdmin ? (
              <ActionForm action={updateReferralSettingsAction} className="space-y-3 px-5 pb-5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Récompense parrain">
                    <span className="relative block">
                      <Input name="referral_reward_mad" inputMode="decimal" defaultValue={reward} className="pr-14" />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">MAD</span>
                    </span>
                  </Field>
                  <Field label="Remise filleul">
                    <span className="relative block">
                      <Input name="referral_discount_pct" inputMode="numeric" defaultValue={discount} className="pr-9" />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">%</span>
                    </span>
                  </Field>
                </div>
                <SubmitButton variant="brand" className="w-full">
                  Enregistrer
                </SubmitButton>
              </ActionForm>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                <div className="rounded-xl bg-brand-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Wallet className="size-3.5" /> Parrain
                  </p>
                  <p className="font-display text-lg font-extrabold text-brand-600">{mad(reward)}</p>
                </div>
                <div className="rounded-xl bg-accent-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Percent className="size-3.5" /> Filleul
                  </p>
                  <p className="font-display text-lg font-extrabold text-accent-600">−{discount} %</p>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Ajouter un parrainage" subtitle="Recommandation reçue à l'accueil" icon={<TrendingUp className="size-4" />} />
            <ActionForm action={createReferralAction} className="space-y-3 px-5 pb-5">
              <Field label="Parrain">
                <Select name="referrer_client_id" defaultValue="" required>
                  <option value="" disabled>
                    Choisir le membre…
                  </option>
                  {pickable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ami(e) recommandé(e)">
                <Input name="referred_name" required placeholder="Prénom Nom" />
              </Field>
              <Field label="Téléphone">
                <Input name="referred_phone" type="tel" inputMode="tel" placeholder="06 12 34 56 78" />
              </Field>
              <SubmitButton variant="secondary" className="w-full">
                <UserPlus className="size-4" /> Ajouter
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
