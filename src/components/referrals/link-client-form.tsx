import { Link2 } from "lucide-react";
import { linkReferralAction } from "@/actions/referrals";
import { SubmitButton } from "@/components/submit-button";

/** Relie un filleul à une fiche client existante → statut « inscrit ». */
export function LinkClientForm({ id, clients, defaultId }: { id: string; clients: { id: string; full_name: string }[]; defaultId?: string | null }) {
  return (
    <form action={linkReferralAction} className="flex min-w-0 items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <select
        name="client_id"
        required
        defaultValue={defaultId ?? ""}
        aria-label="Fiche client du filleul"
        className="h-9 min-w-0 max-w-[180px] flex-1 rounded-lg border border-line bg-white px-2 text-xs text-ink focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
      >
        <option value="" disabled>
          Relier à un client…
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>
      <SubmitButton variant="secondary" className="h-9 px-2.5 text-xs" pendingText="…">
        <Link2 className="size-3.5" /> Inscrit
      </SubmitButton>
    </form>
  );
}
