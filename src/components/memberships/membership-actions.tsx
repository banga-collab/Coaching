import { MoreHorizontal, PauseCircle, PlayCircle, Receipt, RefreshCw } from "lucide-react";
import type { Membership } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cancelMembershipAction, renewMembershipAction, toggleSuspendMembershipAction } from "@/actions/memberships";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmItem } from "./confirm-item";

const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-canvas";

/** Actions staff sur un abonnement : renouveler (avec ou sans facture), suspendre/réactiver, annuler. */
export function MembershipActions({ m, className, highlight }: { m: Membership; className?: string; highlight?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <form action={renewMembershipAction}>
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="with_invoice" value="0" />
        <SubmitButton variant={highlight ? "primary" : "secondary"} className="h-9 px-3" pendingText="…">
          <RefreshCw className="size-3.5" /> Renouveler
        </SubmitButton>
      </form>
      <details key={`${m.id}-${m.status}`} className="group relative">
        <summary
          aria-label="Plus d'actions"
          className="grid size-9 cursor-pointer list-none place-items-center rounded-xl border border-line bg-white text-muted transition hover:bg-canvas hover:text-ink group-open:bg-canvas [&::-webkit-details-marker]:hidden"
        >
          <MoreHorizontal className="size-4" />
        </summary>
        <div className="absolute right-0 z-30 mt-1.5 w-60 rounded-xl border border-line bg-white p-1.5 shadow-pop animate-fade-up">
          <form action={renewMembershipAction}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="with_invoice" value="1" />
            <button type="submit" className={item}>
              <Receipt className="size-4 text-brand-500" /> Renouveler + facture
            </button>
          </form>
          {m.status !== "annule" && (
            <form action={toggleSuspendMembershipAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className={item}>
                {m.status === "suspendu" ? (
                  <>
                    <PlayCircle className="size-4 text-emerald-600" /> Réactiver
                  </>
                ) : (
                  <>
                    <PauseCircle className="size-4 text-amber-500" /> Suspendre
                  </>
                )}
              </button>
            </form>
          )}
          {m.status !== "annule" && (
            <form action={cancelMembershipAction} className="mt-1 border-t border-line pt-1">
              <input type="hidden" name="id" value={m.id} />
              <ConfirmItem message={`Annuler l'abonnement « ${m.name} » ? Le membre n'aura plus accès à la salle.`} />
            </form>
          )}
        </div>
      </details>
    </div>
  );
}

