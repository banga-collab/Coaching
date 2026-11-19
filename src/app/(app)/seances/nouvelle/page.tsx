import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadStaff } from "@/lib/planning";
import { sessionTypeOptions } from "@/lib/session-extras";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { SessionForm } from "../session-form";

export const metadata = { title: "Nouvelle séance" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ client?: string; date?: string; heure?: string; coach?: string }> }) {
  const { client, date, heure, coach } = await searchParams;
  const me = await requireStaff();
  const manager = isManager(me.role);
  const supabase = await createClient();
  let q = supabase.from("clients").select("id, full_name, coach_id").neq("status", "termine").order("full_name");
  // Un coach planifie pour ses propres clients ; le head coach / l'admin pour tous
  if (!manager) q = q.eq("coach_id", me.id);
  const [{ data }, staff, types] = await Promise.all([q, manager ? loadStaff(supabase) : Promise.resolve([]), sessionTypeOptions(supabase)]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={<BackLink href="/seances" label="Séances" />}
        title="Nouvelle séance"
        subtitle={
          manager
            ? "Affecte une séance à un coach (il devra la confirmer) ou enregistre une séance déjà faite."
            : "Planifie une séance dans tes créneaux libres (acceptée directement) ou enregistre une séance déjà faite."
        }
      />
      <SessionForm
        clients={(data ?? []) as { id: string; full_name: string }[]}
        defaultClient={client}
        defaultDate={date}
        defaultTime={heure && /^\d{2}:\d{2}$/.test(heure) ? heure : undefined}
        coaches={manager ? staff : undefined}
        defaultCoach={coach}
        types={types.names}
        prices={types.prices}
        selfId={me.id}
      />
    </div>
  );
}
