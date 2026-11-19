import Link from "next/link";
import { AlertTriangle, CheckCircle2, ImageIcon, Megaphone, MessageSquareReply, Plus, QrCode, RotateCcw, Timer, User } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, COACH_CATEGORIES, RECLAMATION_CATEGORIES, STATUS_LABEL, sourceOf, type Reclamation, type ReclamationSource, type ReclamationStatus } from "@/lib/reclamations";
import { normName } from "@/lib/video";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { respondReclamationAction, setReclamationStatusAction } from "@/actions/reclamations";
import { Badge, Card, Empty, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { ListToolbar } from "@/components/list-toolbar";
import { Fold } from "@/components/fold";

export const metadata = { title: "Réclamations" };

const TONE: Record<ReclamationStatus, "red" | "amber" | "green"> = { nouvelle: "red", en_cours: "amber", resolue: "green" };
type Row = Omit<Reclamation, "photo">;

export default async function ReclamationsPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; categorie?: string; photo?: string; source?: string }> }) {
  const me = await requireStaff();
  const manager = isManager(me.role);
  const sp = await searchParams;
  const { q = "", statut = "", categorie = "", photo } = sp;
  // Onglet : réclamations des coachs (par défaut) ou signalements de la salle
  const source: ReclamationSource = sp.source === "adherent" ? "adherent" : "coach";
  const supabase = await createClient();
  // La photo (lourde) n'est chargée que pour la réclamation ouverte
  const COLS = "id, created_at, source, category, location, description, contact_name, contact_phone, status, task_id, resolved_at, author_id, client_id, urgent, response, responded_by, responded_at";
  const [{ data }, { data: withPhoto }, { data: shownData }, { data: people }] = await Promise.all([
    supabase.from("reclamations").select(COLS).order("created_at", { ascending: false }).limit(500),
    supabase.from("reclamations").select("id").not("photo", "is", null).limit(500),
    photo ? supabase.from("reclamations").select("id, photo").eq("id", photo).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "head_coach", "coach"]),
  ]);
  // Réclamations de coach : privées (auteur + managers). La base applique la même règle (RLS).
  const visible = ((data ?? []) as Row[]).filter((r) => sourceOf(r) === "adherent" || manager || r.author_id === me.id);
  const hasPhoto = new Set(((withPhoto ?? []) as { id: string }[]).map((x) => x.id));
  const staffName = new Map(((people ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p.full_name || p.email]));

  const clientIds = [...new Set(visible.map((r) => r.client_id).filter((x): x is string => !!x))];
  const { data: cl } = clientIds.length ? await supabase.from("clients").select("id, full_name").in("id", clientIds) : { data: [] };
  const clientName = new Map(((cl ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name]));

  const openBySource = { coach: 0, adherent: 0 };
  for (const r of visible) if (r.status !== "resolue") openBySource[sourceOf(r)]++;
  const all = visible.filter((r) => sourceOf(r) === source);

  const counts = { nouvelle: 0, en_cours: 0, resolue: 0 } as Record<ReclamationStatus, number>;
  const byCat = new Map<string, number>();
  for (const r of all) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
  }
  const needle = normName(q);
  const list = all
    .filter(
      (r) =>
        (!statut || r.status === statut) &&
        (!categorie || r.category === categorie) &&
        (!needle ||
          normName([r.description, r.location, r.contact_name, CATEGORY_LABEL[r.category], r.client_id ? clientName.get(r.client_id) : null, r.response].filter(Boolean).join(" ")).includes(needle)),
    )
    // Urgentes non résolues en premier
    .sort((a, b) => Number(!!b.urgent && b.status !== "resolue") - Number(!!a.urgent && a.status !== "resolue"));
  const shown = shownData as Pick<Reclamation, "id" | "photo"> | null;
  const cats = source === "coach" ? COACH_CATEGORIES : RECLAMATION_CATEGORIES;
  const tabHref = (s: ReclamationSource) => (s === "coach" ? "/reclamations" : "/reclamations?source=adherent");
  const canHandle = (r: Row) => sourceOf(r) === "adherent" || manager;

  return (
    <>
      <PageHeader
        title="Réclamations"
        subtitle={
          source === "coach"
            ? manager
              ? "Problèmes remontés par les coachs : répondez et suivez jusqu'à la résolution"
              : "Signalez un problème à la direction et suivez sa réponse"
            : "Signalements envoyés par les adhérents en scannant le QR code de la salle"
        }
        actions={
          source === "coach" ? (
            me.role !== "admin" && (
              <LinkButton href="/reclamations/nouvelle">
                <Plus className="size-4" /> Nouvelle réclamation
              </LinkButton>
            )
          ) : (
            <LinkButton href="/reclamations/affiche" variant="brand">
              <QrCode className="size-4" /> Affiche QR à imprimer
            </LinkButton>
          )
        }
      />

      <nav className="mb-5 flex gap-1 rounded-2xl border border-line bg-white p-1 text-sm font-semibold shadow-card sm:inline-flex" aria-label="Origine">
        {(["coach", "adherent"] as const).map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            aria-current={s === source ? "page" : undefined}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 transition sm:flex-none", s === source ? "bg-brand-500 text-white" : "text-muted hover:bg-canvas hover:text-ink")}
          >
            {s === "coach" ? (manager ? "Des coachs" : "Mes réclamations") : "Salle (QR code)"}
            {openBySource[s] > 0 && <span className={cn("rounded-full px-1.5 text-[11px]", s === source ? "bg-white/25" : "bg-red-50 text-red-600")}>{openBySource[s]}</span>}
          </Link>
        ))}
      </nav>

      <Fold id="reclamations-kpis">
        <div className="grid grid-cols-3 gap-3">
          {(["nouvelle", "en_cours", "resolue"] as const).map((s) => (
            <Card key={s} className="p-4">
              <p className="text-xs font-semibold text-muted">{s === "nouvelle" ? "Nouvelles" : s === "en_cours" ? "En cours" : "Résolues"}</p>
              <p className={`mt-1 font-display text-2xl font-extrabold ${s === "nouvelle" ? "text-red-600" : s === "en_cours" ? "text-amber-600" : "text-emerald-600"}`}>{counts[s]}</p>
            </Card>
          ))}
        </div>
      </Fold>
      <ListToolbar
        placeholder="Rechercher une réclamation…"
        exportKind={source === "adherent" ? "reclamations" : undefined}
        filters={[
          { param: "statut", label: "Statut", options: (["nouvelle", "en_cours", "resolue"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts[s] })) },
          { param: "categorie", label: "Type", options: cats.map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: byCat.get(c) ?? 0 })) },
        ]}
      />
      {shown?.photo && (
        <Card className="mb-4 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.photo} alt="Photo jointe" className="max-h-[480px] w-full bg-slate-900 object-contain" />
        </Card>
      )}
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty
            icon={<Megaphone className="size-6" />}
            title={all.length ? "Aucun résultat" : "Aucune réclamation"}
            text={
              all.length
                ? "Essaie une autre recherche ou un autre filtre."
                : source === "coach"
                  ? manager
                    ? "Les réclamations envoyées par les coachs arriveront ici."
                    : "Un souci avec un client, le planning ou le matériel ? Envoyez une réclamation à la direction."
                  : "Imprime l'affiche QR et place-la dans la salle : les signalements arriveront ici."
            }
            action={
              source === "coach" && !all.length && me.role !== "admin" ? (
                <LinkButton href="/reclamations/nouvelle">
                  <Plus className="size-4" /> Nouvelle réclamation
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => {
              const isCoach = sourceOf(r) === "coach";
              return (
                <li key={r.id} id={`r-${r.id}`} className={cn("scroll-mt-24 px-5 py-4", r.urgent && r.status !== "resolue" && "bg-red-50/40")}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[min(100%,280px)] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge dot tone={TONE[r.status]}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                        {r.urgent && r.status !== "resolue" && (
                          <Badge tone="red">
                            <AlertTriangle className="size-3" /> Urgent
                          </Badge>
                        )}
                        <span className="text-sm font-semibold text-ink">{CATEGORY_LABEL[r.category] ?? r.category}</span>
                        {r.location && <span className="text-sm text-muted">· {r.location}</span>}
                      </div>
                      {isCoach && r.client_id && clientName.has(r.client_id) && (
                        <Link href={`/clients/${r.client_id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                          <User className="size-3.5" /> Client : {clientName.get(r.client_id)}
                        </Link>
                      )}
                      <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{r.description}</p>
                      <p className="mt-1.5 text-xs text-muted">
                        {fmtDate(r.created_at, { day: "numeric", month: "short" })} à {fmtTime(r.created_at)}
                        {isCoach ? ` · par ${r.author_id === me.id ? "moi" : staffName.get(r.author_id ?? "") ?? r.contact_name ?? "un coach"}` : r.contact_name && ` · ${r.contact_name}`}
                        {!isCoach && r.contact_phone && ` · ${r.contact_phone}`}
                        {r.task_id && (
                          <>
                            {" · "}
                            <Link href="/taches" className="font-semibold text-brand-500 hover:underline">
                              tâche
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {hasPhoto.has(r.id) && (
                        <Link href={`/reclamations?${source === "adherent" ? "source=adherent&" : ""}photo=${r.id}`} scroll={false} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-slate-600 hover:bg-canvas">
                          <ImageIcon className="size-4" /> Photo
                        </Link>
                      )}
                      {canHandle(r) && (
                        <form action={setReclamationStatusAction} className="flex gap-1.5">
                          <input type="hidden" name="id" value={r.id} />
                          {r.status === "nouvelle" && (
                            <button name="status" value="en_cours" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                              <Timer className="size-4" /> Prendre en charge
                            </button>
                          )}
                          {r.status !== "resolue" ? (
                            <button name="status" value="resolue" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                              <CheckCircle2 className="size-4" /> Résolue
                            </button>
                          ) : (
                            <button name="status" value="en_cours" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-slate-600 hover:bg-canvas">
                              <RotateCcw className="size-4" /> Rouvrir
                            </button>
                          )}
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Réponse de la direction */}
                  {isCoach && r.response && (
                    <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-brand-700">
                        <MessageSquareReply className="size-3.5" /> Réponse de {staffName.get(r.responded_by ?? "") ?? "la direction"}
                        {r.responded_at && <span className="font-medium text-muted">· {fmtDate(r.responded_at, { day: "numeric", month: "short" })} à {fmtTime(r.responded_at)}</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.response}</p>
                    </div>
                  )}
                  {isCoach && !r.response && !manager && r.status !== "resolue" && <p className="mt-2 text-xs italic text-muted">En attente de réponse de la direction.</p>}
                  {isCoach && manager && r.author_id !== me.id && r.status !== "resolue" && (
                    <details className="mt-3 group">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-canvas">
                        <MessageSquareReply className="size-4" /> {r.response ? "Compléter la réponse" : "Répondre au coach"}
                      </summary>
                      <form action={respondReclamationAction} className="mt-2 space-y-2">
                        <input type="hidden" name="id" value={r.id} />
                        <Textarea name="response" required rows={3} maxLength={2000} defaultValue={r.response ?? ""} placeholder="Votre réponse ou la décision prise…" />
                        <div className="flex flex-wrap gap-2">
                          <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600">Envoyer la réponse</button>
                          <button name="resolve" value="1" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                            <CheckCircle2 className="size-4" /> Répondre et clore
                          </button>
                        </div>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
