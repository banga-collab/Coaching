"use client";

import { Ban } from "lucide-react";

/** Élément de menu « Annuler » avec confirmation. */
export function ConfirmItem({ message, label = "Annuler l'abonnement" }: { message: string; label?: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
      <Ban className="size-4" /> {label}
    </button>
  );
}
