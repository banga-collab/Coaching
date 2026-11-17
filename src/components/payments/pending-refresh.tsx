"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Recharge la page toutes les 3 s tant que la confirmation bancaire n'est pas arrivée (max ~1 min). */
export function PendingRefresh() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= 20) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [tries, router]);
  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin" /> {tries >= 20 ? "La confirmation prend plus de temps que prévu." : "Confirmation par la banque en cours…"}
    </p>
  );
}
