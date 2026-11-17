"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Formulaire POST auto-soumis vers la passerelle CMI (3D Pay Hosting). */
export function CmiRedirect({ gateway, fields }: { gateway: string; fields: Record<string, string> }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.submit(), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <form ref={ref} method="post" action={gateway} acceptCharset="UTF-8">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={buttonClass("primary", "h-12 w-full text-base")}>
        Continuer vers le CMI <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
