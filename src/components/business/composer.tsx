"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, SendHorizontal } from "lucide-react";
import { sendMessageAction } from "@/actions/business";

function SendBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Envoyer"
      className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/20 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-[18px] animate-spin" /> : <SendHorizontal className="size-[18px]" />}
    </button>
  );
}

/** Zone de saisie : Entrée pour envoyer, Maj+Entrée pour aller à la ligne. */
export function Composer({ clientId, placeholder = "Écrire un message…" }: { clientId: string; placeholder?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, [clientId]);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await sendMessageAction(fd);
        formRef.current?.reset();
        taRef.current?.focus();
      }}
      className="flex items-end gap-2 border-t border-line bg-white p-3 sm:p-4"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <textarea
        ref={taRef}
        name="body"
        rows={1}
        required
        maxLength={4000}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (e.currentTarget.value.trim()) formRef.current?.requestSubmit();
          }
        }}
        onInput={(e) => {
          const t = e.currentTarget;
          t.style.height = "auto";
          t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
        }}
        className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
      />
      <SendBtn />
    </form>
  );
}
