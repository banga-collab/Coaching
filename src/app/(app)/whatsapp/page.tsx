import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  MessageCircle,
  MessagesSquare,
  Phone,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { whatsappEnv, whatsappMode } from "@/lib/whatsapp-api";
import type { Client, WhatsAppMessage } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
import { WhatsAppSendForm } from "@/components/whatsapp/send-form";
import { WaBubble, WaWall } from "@/components/whatsapp/bubble";
import { WA_CATALOG, WA_TEMPLATE_KEYS, waTemplateLabel } from "@/components/whatsapp/templates";

export const metadata = { title: "WhatsApp" };

const STATUS: Record<WhatsAppMessage["status"], { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  envoye: { label: "Envoyé", tone: "green" },
  simule: { label: "Simulé", tone: "amber" },
  echec: { label: "Échec", tone: "red" },
  en_attente: { label: "En attente", tone: "gray" },
};

const TEMPLATE_TONE: Record<string, "brand" | "accent" | "red" | "green" | "amber" | "gray"> = {
  session_reminder: "brand",
  invoice_overdue: "red",
  checkin_missing: "accent",
  membership_expiring: "amber",
  welcome: "green",
  manuel: "gray",
};

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "envoye", label: "Envoyés" },
  { key: "simule", label: "Simulés" },
  { key: "echec", label: "Échecs" },
];

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ statut?: string; client?: string }> }) {
  const me = await requireStaff();
  const { statut = "", client: preset } = await searchParams;
  const supabase = await createClient();
  const [settings, { data: mData }, { data: cData }] = await Promise.all([
    getSettings(),
    supabase.from("whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("clients").select("*").order("full_name"),
  ]);
  const messages = (mData ?? []) as WhatsAppMessage[];
  const clients = (cData ?? []) as Client[];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const env = whatsappEnv();
  const mode = whatsappMode(settings.whatsapp_enabled);

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const recent = messages.filter((m) => m.created_at >= since);
  const count = (s: WhatsAppMessage["status"]) => recent.filter((m) => m.status === s).length;
  const rows = messages.filter((m) => !statut || m.status === statut).slice(0, 60);
  const options = clients.filter((c) => c.status !== "termine").map((c) => ({ id: c.id, name: c.full_name, phone: c.phone }));

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle="Rappels automatiques et messages aux membres via WhatsApp Business"
        actions={
          <>
            <LinkButton href="/automatisations" variant="secondary">
              <MessagesSquare className="size-4" /> Rappels automatiques
            </LinkButton>
            {me.role === "admin" && (
              <LinkButton href="/parametres#whatsapp" variant="secondary">
                <Settings className="size-4" /> Paramètres
              </LinkButton>
            )}
          </>
        }
      />

      {/* Statut */}
      <Card className="relative mb-6 overflow-hidden animate-fade-up">
        <div className={cn("absolute inset-y-0 left-0 w-1", mode.live ? "bg-emerald-500" : "bg-amber-400")} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", mode.live ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
            {mode.live ? <MessageCircle className="size-6" /> : <FlaskConical className="size-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-ink">{mode.live ? "Connecté à WhatsApp Business" : "Mode simulation"}</h2>
              {mode.live ? <Badge tone="green" dot>Connecté</Badge> : <Badge tone="amber" dot>Simulation</Badge>}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              {mode.live
                ? "Les messages partent réellement depuis votre numéro WhatsApp Business. Les rappels automatiques utilisent vos modèles approuvés lorsqu'ils sont configurés."
                : "Les messages sont enregistrés dans l'historique avec le statut « Simulé » mais ne sont pas envoyés. Pour passer en envoi réel, il manque :"}
            </p>
            {!mode.live && (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {mode.missing.map((m) => (
                  <li key={m} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-100">
                    <AlertTriangle className="size-3.5" /> {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:w-64">
            {[
              { k: "Jeton", ok: env.token },
              { k: "Phone ID", ok: env.phoneId },
              { k: "Activé", ok: !!settings.whatsapp_enabled },
              { k: "Modèles", ok: env.templates.some((t) => t.set), label: `${env.templates.filter((t) => t.set).length}/${env.templates.length}` },
            ].map((x) => (
              <div key={x.k} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-2.5 py-2">
                <dt className="text-muted">{x.k}</dt>
                <dd className={cn("inline-flex items-center gap-1 font-semibold", x.ok ? "text-emerald-600" : "text-slate-400")}>
                  {x.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {x.label ?? (x.ok ? "OK" : "—")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {/* Statistiques 30 jours */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Envoyés (30 j)" value={count("envoye")} icon={<Send className="size-5" />} />
        <Kpi label="Simulés (30 j)" value={count("simule")} tone="accent" icon={<FlaskConical className="size-5" />} />
        <Kpi label="Échecs (30 j)" value={count("echec")} icon={<XCircle className="size-5" />} delta={count("echec") ? "Voir les détails ci-dessous" : "Aucun échec"} positive={count("echec") === 0} />
        <Kpi label="Total (30 j)" value={recent.length} tone="accent" icon={<MessageCircle className="size-5" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* Envoi */}
          <Card>
            <CardHeader title="Envoyer un message" subtitle="Choisissez un client et un modèle, puis ajustez le texte" icon={<Send className="size-4" />} />
            <WhatsAppSendForm clients={options} live={mode.live} defaultClient={preset && byId.has(preset) ? preset : undefined} />
          </Card>

          {/* Historique */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Historique des messages"
              subtitle={`${messages.length} message${messages.length > 1 ? "s" : ""} enregistré${messages.length > 1 ? "s" : ""}`}
              icon={<MessagesSquare className="size-4" />}
            />
            <div className="flex gap-1.5 overflow-x-auto px-5 pb-3">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key ? `/whatsapp?statut=${f.key}` : "/whatsapp"}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition",
                    statut === f.key ? "bg-brand-500 text-white" : "bg-canvas text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            {rows.length === 0 ? (
              <Empty icon={<MessageCircle className="size-6" />} title="Aucun message" text="Les messages envoyés ou simulés apparaîtront ici." />
            ) : (
              <>
                {/* Mobile : liste */}
                <ul className="divide-y divide-line border-t border-line md:hidden">
                  {rows.map((m) => {
                    const c = m.client_id ? byId.get(m.client_id) : undefined;
                    const st = STATUS[m.status];
                    return (
                      <li key={m.id} className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c?.full_name ?? m.to_phone} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{c?.full_name ?? m.to_phone}</p>
                            <p className="text-[11px] text-muted">
                              {fmtDate(m.created_at, { day: "numeric", month: "short" })} · {fmtTime(m.created_at)}
                            </p>
                          </div>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{m.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={TEMPLATE_TONE[m.template] ?? "gray"}>{waTemplateLabel(m.template)}</Badge>
                          {m.error && <span className="text-xs text-red-600">{m.error}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {/* Desktop : tableau */}
                <div className="hidden overflow-x-auto border-t border-line md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-canvas/60 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Client</th>
                        <th className="px-3 py-2.5">Modèle</th>
                        <th className="px-3 py-2.5">Message</th>
                        <th className="px-5 py-2.5 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((m) => {
                        const c = m.client_id ? byId.get(m.client_id) : undefined;
                        const st = STATUS[m.status];
                        return (
                          <tr key={m.id} className="align-top transition hover:bg-canvas/50">
                            <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                              <span className="block font-medium text-slate-600">{fmtDate(m.created_at, { day: "numeric", month: "short" })}</span>
                              {fmtTime(m.created_at)}
                            </td>
                            <td className="px-3 py-3">
                              {c ? (
                                <Link href={`/clients/${c.id}`} className="flex items-center gap-2 font-semibold text-ink hover:text-brand-600">
                                  <Avatar name={c.full_name} size={28} />
                                  <span className="truncate">{c.full_name}</span>
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                  <Phone className="size-3.5" /> {m.to_phone}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <Badge tone={TEMPLATE_TONE[m.template] ?? "gray"}>{waTemplateLabel(m.template)}</Badge>
                            </td>
                            <td className="max-w-[320px] px-3 py-3">
                              <p className="line-clamp-2 text-slate-600" title={m.body}>
                                {m.body}
                              </p>
                              {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Badge tone={st.tone} dot>
                                {st.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Modèles */}
          <Card>
            <CardHeader title="Modèles de messages" subtitle="Aperçu tel que reçu par le membre" icon={<Smartphone className="size-4" />} />
            <ul className="space-y-4 px-5 pb-5">
              {WA_TEMPLATE_KEYS.map((k) => {
                const t = WA_CATALOG[k];
                const tpl = env.templates.find((x) => x.key === k);
                return (
                  <li key={k}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{t.label}</p>
                      {tpl ? (
                        tpl.set ? (
                          <Badge tone="green">Modèle Meta</Badge>
                        ) : (
                          <Badge tone="gray">Texte libre</Badge>
                        )
                      ) : null}
                    </div>
                    <p className="mb-2 text-xs text-muted">{t.description}</p>
                    <WaWall>
                      <WaBubble text={t.build(t.sample)} />
                    </WaWall>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Guide */}
          <Card>
            <CardHeader title="Mise en service" subtitle="WhatsApp Business Cloud API (Meta)" icon={<BookOpen className="size-4" />} />
            <ol className="space-y-3.5 px-5 pb-5 text-sm">
              {[
                {
                  icon: ShieldCheck,
                  t: "Compte Meta Business",
                  d: "Créez (ou utilisez) un compte sur business.facebook.com, puis une app de type « Business » sur developers.facebook.com avec le produit WhatsApp.",
                },
                {
                  icon: Phone,
                  t: "Numéro et Phone number ID",
                  d: "Dans WhatsApp > Configuration de l'API, ajoutez le numéro de la salle (non utilisé dans l'app WhatsApp classique) et copiez son « Phone number ID » → WHATSAPP_PHONE_ID.",
                },
                {
                  icon: KeyRound,
                  t: "Jeton d'accès permanent",
                  d: "Dans Paramètres de l'entreprise > Utilisateurs système, créez un utilisateur admin, générez un jeton avec les droits whatsapp_business_messaging → WHATSAPP_TOKEN (variable serveur, jamais partagée).",
                },
                {
                  icon: MessagesSquare,
                  t: "Modèles approuvés",
                  d: "Hors fenêtre de 24 h, Meta n'accepte que des modèles approuvés. Créez-les dans le WhatsApp Manager (langue « fr », variables {{1}}, {{2}}…) puis indiquez leur nom dans WHATSAPP_TEMPLATE_SESSION_REMINDER, …_INVOICE_OVERDUE, …_CHECKIN_MISSING, …_MEMBERSHIP_EXPIRING.",
                },
                {
                  icon: Settings,
                  t: "Activer l'envoi",
                  d: "Redéployez avec les variables, puis activez WhatsApp dans Paramètres. Aucun webhook n'est nécessaire pour envoyer des messages.",
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 font-display text-xs font-bold text-emerald-700">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold text-ink">
                      <s.icon className="size-3.5 text-emerald-600" /> {s.t}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
