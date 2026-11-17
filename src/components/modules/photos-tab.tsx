import { CalendarDays, Camera, Images, Lock, Megaphone, Scale, Trash2, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import type { ProgressPhoto } from "@/lib/types";
import { cn, dayKey, fmtDate, num, signed } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import { ConfirmIcon } from "@/components/phase1/confirm-icon";
import { PhotoCompare } from "@/components/photos/photo-compare";
import { PhotoUploadForm } from "@/components/photos/photo-upload-form";
import { POSES, POSE_LABEL } from "@/components/photos/shared";
import { deletePhotoAction, togglePhotoSharedAction } from "@/actions/photos";

const fmt = (d: string, o?: Intl.DateTimeFormatOptions) => fmtDate(`${d}T12:00:00Z`, o ?? { day: "numeric", month: "long", year: "numeric" });

export async function PhotosTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("progress_photos").select("*").eq("client_id", clientId).order("taken_on", { ascending: false });
  const photos = ((data ?? []) as ProgressPhoto[]).sort((a, b) => b.taken_on.localeCompare(a.taken_on) || POSES.indexOf(a.pose) - POSES.indexOf(b.pose));

  const dates = [...new Set(photos.map((p) => p.taken_on))];
  const weightOn = (d: string) => {
    const w = photos.find((p) => p.taken_on === d && p.weight_kg !== null)?.weight_kg;
    return w === undefined || w === null ? null : Number(w);
  };
  const firstDate = dates.at(-1) ?? null;
  const lastDate = dates[0] ?? null;
  const w0 = firstDate ? weightOn(firstDate) : null;
  const w1 = lastDate ? weightOn(lastDate) : null;
  const totalDelta = w0 !== null && w1 !== null && firstDate !== lastDate ? Math.round((w1 - w0) * 10) / 10 : null;
  const lastWeight = [...dates].map(weightOn).find((w) => w !== null) ?? null;
  const today = dayKey(new Date());
  const daysSince = lastDate ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000) : null;
  const sharedCount = photos.filter((p) => p.shared_publicly).length;

  const upload = (
    <Card className="lg:sticky lg:top-6">
      <CardHeader
        title={canEdit ? "Ajouter une photo" : "Ajouter mes photos"}
        subtitle={canEdit ? "Une photo par pose, idéalement chaque mois" : "Une fois par mois : face, profil et dos"}
        icon={<Upload className="size-4" />}
      />
      <div className="px-5 pb-5">
        <PhotoUploadForm clientId={clientId} demo={DEMO} today={today} lastWeight={lastWeight} member={!canEdit} />
      </div>
    </Card>
  );

  const reminder =
    daysSince !== null && daysSince >= 28 ? (
      <p className="flex items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">
        <Camera className="size-4 shrink-0" />
        {canEdit ? `Dernières photos il y a ${daysSince} jours : pense à refaire la série du mois.` : `Tes dernières photos datent de ${daysSince} jours : c'est le moment de faire celles du mois 📸`}
      </p>
    ) : null;

  if (!photos.length) {
    return (
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <Empty
            icon={<Images className="size-6" />}
            title="Aucune photo de progression"
            text={
              canEdit
                ? "Ajoute une première série (face, profil, dos) pour garder une trace visuelle et comparer les résultats mois après mois."
                : "Prends ta première série de photos : dans quelques semaines, tu pourras comparer et voir tes progrès. Elles restent privées entre toi et ton coach."
            }
          />
        </Card>
        {upload}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className={cn("min-w-0 space-y-5", !canEdit && "order-2 lg:order-1")}>
        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={<Images className="size-4" />} label="Photos" value={String(photos.length)} />
          <Stat icon={<CalendarDays className="size-4" />} label="Séries" value={String(dates.length)} />
          <Stat
            icon={totalDelta !== null && totalDelta > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            label={firstDate ? `Depuis le ${fmt(firstDate, { day: "numeric", month: "short" })}` : "Évolution"}
            value={totalDelta !== null ? signed(totalDelta, "kg") : "–"}
            tone={totalDelta !== null && totalDelta < 0 ? "green" : "accent"}
          />
          {canEdit ? (
            <Stat icon={<Megaphone className="size-4" />} label="Autorisées comm." value={String(sharedCount)} />
          ) : (
            <Stat icon={<Scale className="size-4" />} label="Dernier poids" value={lastWeight !== null ? `${num(lastWeight)} kg` : "–"} />
          )}
        </div>

        {reminder}

        {dates.length >= 2 ? (
          <PhotoCompare photos={photos.map((p) => ({ id: p.id, taken_on: p.taken_on, pose: p.pose, weight_kg: p.weight_kg === null ? null : Number(p.weight_kg) }))} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-5 text-center text-sm text-muted">
            La comparaison avant / après sera disponible dès la deuxième série de photos.
          </p>
        )}

        {/* Chronologie */}
        <div className="space-y-6">
          {dates.map((d, i) => {
            const items = photos.filter((p) => p.taken_on === d);
            const w = weightOn(d);
            const prevDate = dates[i + 1];
            const prevW = prevDate ? weightOn(prevDate) : null;
            const delta = w !== null && prevW !== null ? Math.round((w - prevW) * 10) / 10 : null;
            return (
              <section key={d}>
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="relative grid size-3 place-items-center">
                    <span className={cn("size-3 rounded-full ring-4", i === 0 ? "bg-accent-500 ring-accent-100" : "bg-brand-500 ring-brand-100")} />
                  </span>
                  <h4 className="font-display text-[15px] font-bold capitalize text-ink">{fmt(d)}</h4>
                  {i === dates.length - 1 && dates.length > 1 && <Badge tone="gray">Départ</Badge>}
                  {i === 0 && dates.length > 1 && <Badge tone="accent">Dernière</Badge>}
                  <span className="ml-auto flex items-center gap-2 text-sm">
                    {w !== null && <b className="text-ink">{num(w)} kg</b>}
                    {delta !== null && delta !== 0 && <span className={cn("text-xs font-semibold", delta < 0 ? "text-emerald-600" : "text-accent-600")}>{signed(delta, "kg")}</span>}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {items.map((p) => (
                    <figure key={p.id} className="group relative overflow-hidden rounded-2xl border border-line bg-slate-900 shadow-card">
                      <a href={`/api/photos/${p.id}`} target="_blank" rel="noopener" className="block">
                        <div className="relative aspect-[3/4]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/photos/${p.id}`} alt={`${POSE_LABEL[p.pose]} – ${fmt(d)}`} loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                          <span className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-0.5 text-[11px] font-bold text-ink backdrop-blur">{POSE_LABEL[p.pose]}</span>
                          {p.weight_kg !== null && (
                            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-sm font-bold text-white drop-shadow">
                              <Scale className="size-3.5" /> {num(Number(p.weight_kg))} kg
                            </span>
                          )}
                          {canEdit && p.shared_publicly && (
                            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm" title="Autorisée pour la communication">
                              <Megaphone className="size-3.5" />
                            </span>
                          )}
                        </div>
                      </a>
                      {(p.notes || canEdit) && (
                        <figcaption className="bg-white px-2.5 py-2">
                          {p.notes && <p className="line-clamp-2 text-xs text-muted">{p.notes}</p>}
                          {canEdit && (
                            <div className={cn("flex items-center justify-between gap-1", p.notes && "mt-1.5")}>
                              <form action={togglePhotoSharedAction}>
                                <input type="hidden" name="id" value={p.id} />
                                <input type="hidden" name="client_id" value={clientId} />
                                <input type="hidden" name="shared" value={p.shared_publicly ? "0" : "1"} />
                                <button
                                  className={cn(
                                    "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition",
                                    p.shared_publicly ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "text-slate-500 hover:bg-canvas hover:text-ink",
                                  )}
                                  title={p.shared_publicly ? "Retirer l'autorisation de communication" : "Marquer comme autorisée pour la communication"}
                                  aria-pressed={p.shared_publicly}
                                >
                                  {p.shared_publicly ? <Megaphone className="size-3.5" /> : <Lock className="size-3.5" />}
                                  {p.shared_publicly ? "Comm. OK" : "Privée"}
                                </button>
                              </form>
                              <form action={deletePhotoAction}>
                                <input type="hidden" name="id" value={p.id} />
                                <input type="hidden" name="client_id" value={clientId} />
                                <ConfirmIcon message="Supprimer cette photo ? Elle sera définitivement effacée." label="Supprimer la photo">
                                  <Trash2 className="size-4" />
                                </ConfirmIcon>
                              </form>
                            </div>
                          )}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {canEdit && (
          <p className="flex items-start gap-2 text-xs text-muted">
            <Megaphone className="mt-0.5 size-3.5 shrink-0" />
            « Autorisée pour la communication » : à n&apos;activer qu&apos;avec l&apos;accord écrit du client (réseaux sociaux, affichage en salle).
          </p>
        )}
      </div>
      <div className={cn(!canEdit && "order-1 lg:order-2")}>{upload}</div>
    </div>
  );
}

function Stat({ icon, label, value, tone = "brand" }: { icon: React.ReactNode; label: string; value: string; tone?: "brand" | "green" | "accent" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white py-2 pl-2 pr-3 shadow-card">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "accent" ? "bg-accent-50 text-accent-500" : "bg-brand-50 text-brand-500")}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate font-display text-base font-extrabold leading-none text-ink">{value}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}
