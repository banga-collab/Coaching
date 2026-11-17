"use client";

import { useEffect, useRef } from "react";

/** Conteneur défilant qui reste collé en bas quand de nouveaux messages arrivent. */
export function AutoScroll({ children, depKey, className }: { children: React.ReactNode; depKey: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [depKey]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
