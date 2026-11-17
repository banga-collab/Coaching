import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Dumbbell, Pencil, Trash2, UserX } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Session, SessionExercise } from "@/lib/types";
import { SESSION_LABEL, fmtDate, fmtTime, num } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, LinkButton, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteSessionAction, setSessionStatusAction } from "../../actions";

export const metadata = { title: "Séance" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data: sData }, { data: exData }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).single(),
    supabase.from("session_exercises").select("*").eq("session_id", id).order("position"),
  ]);
  if (!sData) notFound();
  const s = sData as Session;
  const ex = (exData ?? []) as SessionExercise[];
  const { data: cData } = await supabase.from("clients").select("id, full_name, goal").eq("id", s.client_id).single();
  const c = cData as Pick<Client, "id" | "full_name" | "goal">;
  const volume = ex.reduce((t, e) => t + (e.sets ?? 0) * (Number.parseInt(e.reps ?? "") || 0) * Number(e.load_kg ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={<BackLink href="/seances" label="Séances" />}
        title={s.type}
        subtitle={`${fmtDate(s.starts_at, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(s.starts_at)} · ${s.duration_min} min`}
        actions={
          <LinkButton href={`/seances/${id}/modifier`} variant="secondary">
            <Pencil className="size-4" /> Modifier
          </LinkButton>
        }
      />

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden">
          <CardHeader title="Exercices" subtitle={volume ? `Volume total : ${num(volume)} kg` : undefined} icon={<Dumbbell className="size-4" />} />
          {ex.length === 0 ? (
            <Empty icon={<Dumbbell className="size-6" />} title="Aucun exercice" text="Ajoute les exercices en modifiant la séance." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Exercice</th>
                  <th className="px-3 py-2.5 text-center">Séries</th>
                  <th className="px-3 py-2.5 text-center">Reps</th>
                  <th className="px-3 py-2.5 text-right">Charge</th>
                  <th className="px-5 py-2.5 text-right">RPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ex.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 font-medium">{e.name}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{e.sets ?? "–"}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{e.reps ?? "–"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{e.load_kg !== null ? num(e.load_kg, "kg") : "–"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{e.rpe ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.notes && <p className="m-5 whitespace-pre-line rounded-xl bg-canvas p-4 text-sm text-slate-700">{s.notes}</p>}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <Link href={`/clients/${c.id}?tab=seances`} className="flex items-center gap-3">
              <Avatar name={c.full_name} size={44} />
              <span>
                <span className="block font-semibold hover:text-brand-600">{c.full_name}</span>
                <span className="block text-xs text-muted">{c.goal ?? "—"}</span>
              </span>
            </Link>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
              <span className="text-muted">Statut</span>
              <Badge tone={s.status === "realisee" ? "green" : s.status === "absent" ? "red" : s.status === "annulee" ? "gray" : "brand"}>{SESSION_LABEL[s.status]}</Badge>
            </div>
            {s.rpe && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">RPE global</span>
                <b>{s.rpe}/10</b>
              </div>
            )}
          </Card>
          {s.status === "planifiee" && (
            <Card className="space-y-2 p-5">
              <p className="mb-1 text-sm font-semibold">Marquer comme</p>
              {[
                ["realisee", "Réalisée", Check, "brand"],
                ["absent", "Absent", UserX, "secondary"],
                ["annulee", "Annulée", Clock, "secondary"],
              ].map(([st, label, Icon, v]) => {
                const I = Icon as typeof Check;
                return (
                  <form key={st as string} action={setSessionStatusAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="status" value={st as string} />
                    <button className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${v === "brand" ? "bg-brand-500 text-white hover:bg-brand-600" : "border border-line bg-white hover:bg-canvas"}`}>
                      <I className="size-4" /> {label as string}
                    </button>
                  </form>
                );
              })}
            </Card>
          )}
          <form action={deleteSessionAction}>
            <input type="hidden" name="id" value={s.id} />
            <ConfirmButton message="Supprimer cette séance ?" className="w-full">
              <Trash2 className="size-4" /> Supprimer
            </ConfirmButton>
          </form>
        </div>
      </div>
    </div>
  );
}
