"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/** Enregistre le service worker (production uniquement, pour ne pas gêner le rechargement à chaud). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const KEY = "moovup-install-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function remember() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* stockage indisponible : on masque seulement pour cette visite */
  }
}

/** Bandeau « Installer l'app » sur mobile (Android : beforeinstallprompt ; iOS : astuce Partager). */
export function InstallPrompt({ appName = "Moov'Up" }: { appName?: string }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || wasDismissed()) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua)) {
      timer = setTimeout(() => {
        setIos(true);
        setOpen(true);
      }, 2500);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!open) return null;

  const close = () => {
    remember();
    setOpen(false);
  };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") remember();
    setOpen(false);
  };

  return (
    <div className="no-print fixed inset-x-3 bottom-[88px] z-50 animate-fade-up lg:hidden" role="dialog" aria-label="Installer l'application">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3 pr-2 shadow-pop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl border border-line" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink">Installer l&apos;app {appName}</p>
          {ios ? (
            <p className="mt-0.5 text-xs text-muted">
              Touchez <Share className="inline size-3.5 -translate-y-px text-brand-500" /> Partager puis « Sur l&apos;écran d&apos;accueil ».
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">Accès en un geste, en plein écran, comme une vraie app.</p>
          )}
        </div>
        {!ios && evt && (
          <button
            type="button"
            onClick={install}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white transition hover:bg-brand-600"
          >
            <Download className="size-3.5" /> Installer
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
