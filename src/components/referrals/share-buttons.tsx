"use client";

import { useState } from "react";
import { MessageCircle, Share2 } from "lucide-react";
import { CopyButton } from "./copy-button";

/** Boutons de partage du code parrain : WhatsApp, partage natif, copie du lien. */
export function ShareButtons({ message, url }: { message: string; url: string }) {
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[.98]"
      >
        <MessageCircle className="size-[18px]" /> WhatsApp
      </a>
      <button
        type="button"
        onClick={() => {
          if (canShare) navigator.share({ title: "Moov'Up", text: message, url }).catch(() => undefined);
          else window.open(wa, "_blank", "noopener");
        }}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-canvas active:scale-[.98]"
      >
        <Share2 className="size-[18px] text-brand-500" /> Partager
      </button>
      <CopyButton value={url} label="Copier le lien" className="h-12 border border-line" />
    </div>
  );
}
