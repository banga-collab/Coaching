import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Gift, Hourglass, PartyPopper, Send, Share2, UserPlus, Users } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import type { Client, Referral } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Field, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/referrals/copy-button";
import { ShareButtons } from "@/components/referrals/share-buttons";
import { createReferralAction } from "@/actions/referrals";

export const metadata = { title: "Parrainage" };

const STATUS: Record<Referral["status"], { label: string; tone: "amber" | "brand" | "green"}> = {
  en_attente: { label: "En attente", tone: "amber" },
  inscrit: { label: "Inscrit 🎉", tone: "brand" },
  recompense: { label: "Récompensé", tone: "green" },
};
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default async function MyReferralPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const me = await getProfile();
  if (me.role !== "client") redirect("/parrainage");
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  const client = cData as Client | null;

  if (!client) {
    return (
      <>
        <PageHeader title="Parrainage" />
        <Card>
          <Empty icon={<Hourglass className="size-6" />} title="Ton dossier n'est pas encore relié" text={`Demande à ton coach d'ajouter ton e-mail (${me.email}) à ta fiche.`} />
        </Card>
      </>
    );
  }

  const [{ data: rData }, settings, h] = await Promise.all([
    supabase.from("referrals").select("*").eq("referrer_client_id", client.id).order("created_at", { ascending: false }),
    getSettings(),
    headers(),
  ]);
  const referrals = (rData ?? []) as Referral[];
  const reward = Number(settings.referral_reward_mad ?? 200);
  const discount = Number(settings.referral_discount_pct ?? 10);
  const earned = referrals.reduce((s, r) => s + (r.status === "recompense" ? Number(r.reward_mad ?? 0) : 0), 0);
  const signedUp = referrals.filter((r) => r.status !== "en_attente").length;
  const pending = referrals.filter((r) => r.status === "inscrit").length;

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const code = client.referral_code ?? "";
  const bookingUrl = `${proto}://${host}/reserver${code ? `?ref=${encodeURIComponent(code)}` : ""}`;
  const first = client.full_name.split(" ")[0];
  const brand = settings.brand_name || "Complexe Moov'Up Sports";
  const message =
    `Salut ! 👋 Je m'entraîne au ${brand} à Agadir et j'adore 💪\n` +
    `Avec mon code parrain *${code}*, tu as -${discount} % sur ta première formule.\n` +
    `Réserve ta séance découverte ici 👉 ${bookingUrl}\n— ${first}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Parraine tes amis 🎁" subtitle={`${nf.format(reward)} MAD pour toi, −${discount} % pour ton ami(e)`} />

      {ok && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <PartyPopper className="size-4" /> Merci ! On contacte ton ami(e) très vite.
        </p>
      )}

      {/* Code */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-accent-600 via-accent-500 to-accent-400 p-5 text-white shadow-pop animate-fade-up sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/15" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-brand-600/30 blur-2xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Ton code parrain</p>
        <div className="relative mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-4xl font-extrabold tracking-[0.12em] sm:text-5xl">{code || "—"}</p>
          {code && <CopyButton value={code} label="Copier le code" />}
        </div>
        <p className="relative mt-3 text-sm text-white/90">Ton ami(e) donne ce code à l&apos;accueil lors de son inscription.</p>
        <div className="relative mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-white/15 p-3 text-center ring-1 ring-inset ring-white/25">
          <div>
            <p className="font-display text-2xl font-extrabold">{referrals.length}</p>
            <p className="text-[11px] font-medium text-white/80">recommandé{referrals.length > 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold">{signedUp}</p>
            <p className="text-[11px] font-medium text-white/80">inscrit{signedUp > 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold">{nf.format(earned)}</p>
            <p className="text-[11px] font-medium text-white/80">MAD gagnés</p>
          </div>
        </div>
      </div>

      {/* Partage */}
      <Card className="mt-4 p-4 sm:p-5">
        <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-ink">
          <Share2 className="size-4 text-brand-500" /> Partage ton code
        </p>
        <ShareButtons message={message} url={bookingUrl} />
      </Card>

      {/* Comment ça marche */}
      <Card className="mt-4 p-4 sm:p-5">
        <p className="mb-4 font-display text-[15px] font-bold text-ink">Comment ça marche ?</p>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Send, title: "Partage", text: "Envoie ton code à un ami par WhatsApp ou recommande-le ci-dessous." },
            { icon: UserPlus, title: "Il s'inscrit", text: `Il profite de −${discount} % sur sa première formule.` },
            { icon: Gift, title: "Tu gagnes", text: `${nf.format(reward)} MAD de récompense pour toi, à chaque ami inscrit.` },
          ].map((s, i) => (
            <li key={s.title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <s.icon className="size-5" />
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-accent-500 text-[11px] font-bold text-white">{i + 1}</span>
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{s.title}</span>
                <span className="block text-sm text-muted">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Recommander */}
      <Card className="mt-4">
        <CardHeader title="Recommander un ami" subtitle="On le contacte de ta part, sans engagement" icon={<UserPlus className="size-4" />} />
        <ActionForm action={createReferralAction} className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Son prénom et nom">
              <Input name="referred_name" required minLength={2} maxLength={120} autoComplete="off" placeholder="Ex. Yassine Benali" className="h-12 text-base" />
            </Field>
            <Field label="Son téléphone">
              <Input name="referred_phone" type="tel" inputMode="tel" autoComplete="off" placeholder="06 12 34 56 78" className="h-12 text-base" />
            </Field>
          </div>
          <SubmitButton className="mt-4 h-12 w-full text-[15px]" pendingText="Envoi…">
            <Send className="size-4" /> Recommander
          </SubmitButton>
        </ActionForm>
      </Card>

      {/* Mes filleuls */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Mes filleuls"
          subtitle={pending ? `${pending} récompense${pending > 1 ? "s" : ""} en préparation 🎁` : earned ? `${nf.format(earned)} MAD gagnés au total` : undefined}
          icon={<Users className="size-4" />}
        />
        {referrals.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Tu n&apos;as encore recommandé personne. Lance-toi, tes amis te remercieront 💪</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {referrals.map((r) => {
              const s = STATUS[r.status];
              return (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={r.referred_name} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{r.referred_name}</span>
                    <span className="block text-xs text-muted">Recommandé le {fmtDate(r.created_at, { day: "numeric", month: "long" })}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {r.status === "recompense" && r.reward_mad ? (
                      <span className="text-xs font-bold text-emerald-600">+{nf.format(Number(r.reward_mad))} MAD</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
