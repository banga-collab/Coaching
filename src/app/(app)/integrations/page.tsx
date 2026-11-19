import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  EllipsisVertical,
  FileSpreadsheet,
  Info,
  MessageCircle,
  RefreshCw,
  Smartphone,
  Webhook,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DEMO } from "@/lib/demo";
import { regenerateCalendarToken } from "@/actions/integrations";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyField } from "./copy-field";
import { WebhookForms } from "./webhook-forms";
import { CsvImport } from "./csv-import";

function Steps({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <div className="rounded-xl bg-canvas p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{title}</p>
      <ol className="mt-2.5 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-slate-600">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-600 ring-1 ring-line">{i + 1}</span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InfoCard({ icon, title, status, children }: { icon: ReactNode; title: string; status: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} icon={icon} action={status} />
      <div className="flex-1 space-y-2 px-5 pb-5 text-sm text-slate-600">{children}</div>
    </Card>
  );
}

export default async function IntegrationsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const feed = settings.calendar_token ? `${origin}/api/calendar/${settings.calendar_token}` : null;
  const webcal = feed?.replace(/^https?:/, "webcal:");

  return (
    <>
      <PageHeader title="Intégrations" subtitle="Connecte Moov'Up Coach à tes outils : agenda, tableurs, automatisations." />

      {/* Calendrier */}
      <Card>
        <CardHeader
          title="Calendrier (Google, Apple, Outlook)"
          subtitle="Abonnement iCal : les séances des 30 derniers jours et des 90 prochains jours"
          icon={<CalendarDays className="size-4" />}
          action={feed ? <Badge tone="green" dot>Actif</Badge> : <Badge tone="amber">Non configuré</Badge>}
        />
        <div className="space-y-4 px-5 pb-5">
          {feed ? (
            <>
              <CopyField value={feed} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Info className="size-3.5 text-brand-500" /> Lien privé : toute personne qui le possède voit le planning. Mise à jour toutes les heures environ.
                </span>
                {webcal && (
                  <a href={webcal} className="font-semibold text-brand-600 hover:text-brand-700">
                    Ouvrir dans l&apos;app Calendrier
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Aucun jeton de calendrier. Génère un lien ci-dessous.</p>
          )}
          {!DEMO && !process.env.SUPABASE_SERVICE_ROLE_KEY && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Info className="mt-0.5 size-4 shrink-0" />
              Pour que le flux fonctionne, ajoute la variable <code className="rounded bg-white/70 px-1 font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> sur le serveur (Supabase › Project Settings › API).
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Steps
              title="Google Agenda (ordinateur)"
              items={[
                <>Copie le lien ci-dessus.</>,
                <>
                  Ouvre <b>calendar.google.com</b>, puis à gauche « Autres agendas » › <b>+</b> › <b>À partir de l&apos;URL</b>.
                </>,
                <>Colle le lien et clique sur « Ajouter l&apos;agenda ».</>,
                <>L&apos;agenda apparaît aussi sur ton téléphone (Google synchronise toutes les quelques heures).</>,
              ]}
            />
            <Steps
              title="iPhone / iPad (Calendrier Apple)"
              items={[
                <>Copie le lien ci-dessus.</>,
                <>
                  Ouvre <b>Réglages</b> › <b>Calendrier</b> › <b>Comptes</b> › <b>Ajouter un compte</b> › <b>Autre</b>.
                </>,
                <>
                  Choisis <b>Ajouter un calendrier avec abonnement</b> et colle le lien.
                </>,
                <>Valide : les séances s&apos;affichent dans l&apos;app Calendrier.</>,
              ]}
            />
          </div>
          <form action={regenerateCalendarToken} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <ConfirmButton message="Générer un nouveau lien ? L'ancien lien cessera de fonctionner dans tous les agendas abonnés.">
              <RefreshCw className="size-4" /> {feed ? "Régénérer le lien" : "Générer un lien"}
            </ConfirmButton>
            <span className="text-xs text-muted">À faire si le lien a été partagé par erreur. Outlook : « Ajouter un calendrier » › « S&apos;abonner à partir du web ».</span>
          </form>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        {/* Import CSV */}
        <Card>
          <CardHeader title="Import CSV de clients" subtitle="Depuis Excel, Google Sheets ou un autre logiciel" icon={<FileSpreadsheet className="size-4" />} />
          <div className="px-5 pb-5">
            <p className="mb-4 text-sm text-slate-600">
              Colonnes reconnues : <b>nom</b> (obligatoire), <b>email</b>, <b>téléphone</b>, <b>objectif</b>, <b>date de naissance</b> (JJ/MM/AAAA ou AAAA-MM-JJ). Les clients importés te sont rattachés, avec le statut « Actif ».
            </p>
            <CsvImport />
          </div>
        </Card>

        {/* Webhook */}
        <Card>
          <CardHeader
            title="Webhook (Zapier, Make, n8n)"
            subtitle="Envoie les événements vers tes automatisations"
            icon={<Webhook className="size-4" />}
            action={settings.webhook_url ? <Badge tone="green" dot>Configuré</Badge> : <Badge tone="gray">Inactif</Badge>}
          />
          <div className="space-y-4 px-5 pb-5">
            <WebhookForms url={settings.webhook_url} />
            <div className="rounded-xl bg-canvas p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Événements envoyés (POST JSON)</p>
              <ul className="mt-2.5 space-y-2 text-sm text-slate-600">
                {[
                  ["client.created", "Nouveau client"],
                  ["session.completed", "Séance réalisée"],
                ].map(([code, label]) => (
                  <li key={code} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    <span className="flex-1">{label}</span>
                    <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-500 ring-1 ring-line">{code}</code>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Format : <code className="font-mono">{`{ "event": "…", "sent_at": "…", "data": { … } }`}</code>. Dans Zapier, choisis le déclencheur « Webhooks by Zapier › Catch Hook » et colle son URL ici.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Bientôt */}
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <InfoCard icon={<MessageCircle className="size-4" />} title="WhatsApp" status={<Badge tone="green" dot>Clic-pour-discuter</Badge>}>
          <p>Les boutons WhatsApp ouvrent une conversation pré-remplie avec le client (rappels, relances, bilans). Aucun compte supplémentaire requis.</p>
          <p className="text-xs text-muted">L&apos;envoi automatique (API WhatsApp Business) nécessite un compte Meta Business vérifié : bientôt disponible.</p>
        </InfoCard>
        <InfoCard icon={<CalendarClock className="size-4" />} title="Google Agenda bidirectionnel" status={<Badge tone="amber">Bientôt</Badge>}>
          <p>Créer ou déplacer une séance depuis Google Agenda et la retrouver dans Moov&apos;Up Coach.</p>
          <p className="text-xs text-muted">Aujourd&apos;hui, l&apos;abonnement iCal ci-dessus affiche les séances en lecture seule dans n&apos;importe quel agenda.</p>
        </InfoCard>
        <InfoCard icon={<Smartphone className="size-4" />} title="Application mobile" status={<Badge tone="green" dot>Disponible</Badge>}>
          <p>Moov&apos;Up Coach s&apos;installe comme une application (PWA), pour les coachs comme pour les clients.</p>
          <Link href="#pwa" className="inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700">
            Voir comment l&apos;installer
          </Link>
        </InfoCard>
      </div>

      <Card className="mt-5 scroll-mt-24" id="pwa">
        <CardHeader title="Installer l'application sur le téléphone" subtitle="Icône sur l'écran d'accueil, plein écran, sans passer par un store" icon={<Smartphone className="size-4" />} />
        <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
          <Steps
            title="iPhone (Safari)"
            items={[
              <>Ouvre {origin.replace(/^https?:\/\//, "")} dans Safari.</>,
              <>
                Touche le bouton <b>Partager</b> (carré avec une flèche).
              </>,
              <>
                Choisis <b>Sur l&apos;écran d&apos;accueil</b>, puis <b>Ajouter</b>.
              </>,
            ]}
          />
          <Steps
            title="Android (Chrome)"
            items={[
              <>Ouvre {origin.replace(/^https?:\/\//, "")} dans Chrome.</>,
              <>
                Touche le menu <EllipsisVertical className="inline size-4 align-text-bottom" /> en haut à droite.
              </>,
              <>
                Choisis <b>Installer l&apos;application</b> (ou « Ajouter à l&apos;écran d&apos;accueil »).
              </>,
            ]}
          />
        </div>
      </Card>
    </>
  );
}
