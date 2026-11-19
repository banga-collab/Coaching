"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, Lock, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { confirmSessionAction, type FeedbackState } from "@/actions/controle";
import { cn } from "@/lib/utils";
import { Textarea, buttonClass } from "@/components/ui";

export type PendingSession = { id: string; when: string; type: string; coach: string };

/** « Ta séance a-t-elle bien eu lieu ? » : confirmation + note, envoyées à la direction seulement */
export function ConfirmSessions({ sessions }: { sessions: PendingSession[] }) {
  if (!sessions.length) return null;
  return (
    <section id="confirmer" className="mb-5 scroll-mt-20 rounded-2xl border border-accent-200 bg-accent-50/60 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-ink">Confirme tes séances</h2>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <Lock className="size-3.5" /> Ta réponse va à la direction du club, pas à ta coach.
      </p>
      <div className="mt-3 space-y-3">
        {sessions.map((s) => (
          <ConfirmOne key={s.id} s={s} />
        ))}
      </div>
    </section>
  );
}

function ConfirmOne({ s }: { s: PendingSession }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(confirmSessionAction, undefined);
  const [answer, setAnswer] = useState<"oui" | "non" | "">("");
  const [rating, setRating] = useState(0);

  if (state?.ok) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-card">
        <CheckCircle2 className="size-4" /> Merci ! Réponse envoyée pour la séance du {s.when}.
      </p>
    );
  }
  return (
    <form action={action} className="rounded-xl bg-white p-4 shadow-card">
      <input type="hidden" name="session_id" value={s.id} />
      <input type="hidden" name="happened" value={answer} />
      <input type="hidden" name="rating" value={rating || ""} />
      <p className="text-sm font-semibold text-ink">
        {s.type} avec {s.coach}
      </p>
      <p className="text-xs text-muted">{s.when}</p>
      <p className="mt-3 text-sm text-ink">La séance a-t-elle bien eu lieu, en entier ?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAnswer("oui")}
          aria-pressed={answer === "oui"}
          className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition", answer === "oui" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line text-ink hover:bg-canvas")}
        >
          <ThumbsUp className="size-4" /> Oui
        </button>
        <button
          type="button"
          onClick={() => {
            setAnswer("non");
            setRating(0);
          }}
          aria-pressed={answer === "non"}
          className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition", answer === "non" ? "border-red-500 bg-red-50 text-red-700" : "border-line text-ink hover:bg-canvas")}
        >
          <ThumbsDown className="size-4" /> Non
        </button>
      </div>

      {answer === "oui" && (
        <div className="mt-3">
          <p className="text-sm text-ink">Ta note (facultatif)</p>
          <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Note de la séance">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onClick={() => setRating(n)} className="p-1">
                <Star className={cn("size-7 transition", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
              </button>
            ))}
          </div>
        </div>
      )}
      {answer && (
        <Textarea
          name="comment"
          rows={2}
          maxLength={1000}
          required={answer === "non"}
          className="mt-3"
          placeholder={answer === "non" ? "Que s'est-il passé ? (coach absente, en retard, séance écourtée…)" : "Un commentaire ? (facultatif)"}
        />
      )}
      {state?.error && <p className="mt-2 text-sm font-medium text-red-600">{state.error}</p>}
      <button type="submit" disabled={!answer || pending} className={buttonClass("primary", "mt-3 w-full")}>
        {pending && <Loader2 className="size-4 animate-spin" />} Envoyer
      </button>
    </form>
  );
}
