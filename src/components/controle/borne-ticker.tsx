"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Borne de l'accueil : compte à rebours du code, horloge, et nouveau code toutes les 30 s */
export function BorneTicker({ secondsLeft, period }: { secondsLeft: number; period: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(secondsLeft);
  const [clock, setClock] = useState("");

  useEffect(() => {
    setLeft(secondsLeft);
    const end = Date.now() + secondsLeft * 1000;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      setClock(new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
    };
    tick();
    const id = setInterval(tick, 250);
    const refresh = setTimeout(() => router.refresh(), secondsLeft * 1000 + 400);
    // Sécurité : si la page reste figée (veille, réseau), on recharge toutes les 2 minutes
    const reload = setTimeout(() => window.location.reload(), 120000);
    return () => {
      clearInterval(id);
      clearTimeout(refresh);
      clearTimeout(reload);
    };
  }, [secondsLeft, router]);

  return (
    <div className="w-full max-w-md">
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-accent-400 transition-[width] duration-300 ease-linear" style={{ width: `${(left / period) * 100}%` }} />
      </div>
      <p className="mt-3 flex items-center justify-between text-sm text-brand-100/90">
        <span>Nouveau code dans {left} s</span>
        <span className="font-mono tabular-nums">{clock}</span>
      </p>
    </div>
  );
}
