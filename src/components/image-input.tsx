"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Réduit une image (côté navigateur) : plus grand côté `max` px, JPEG `quality` → data URL */
async function compress(file: File, max = 1280, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let q = quality;
    let out = c.toDataURL("image/jpeg", q);
    while (out.length > 650_000 && q > 0.35) {
      q -= 0.12;
      out = c.toDataURL("image/jpeg", q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Champ photo avec compression automatique avant l'envoi.
 * La photo compressée est envoyée dans un champ caché `name` (data URL JPEG).
 */
export function ImageInput({ name, label, hint, removeLabel, className }: { name: string; label: string; hint?: string; removeLabel?: string; className?: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      setValue(await compress(f));
    } catch {
      setValue("");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input type="hidden" name={name} value={value} />
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="max-h-64 w-full object-cover" />
          <button type="button" onClick={() => setValue("")} className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-ink/70 text-white" aria-label={removeLabel ?? "×"}>
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-canvas/50 p-4 transition hover:border-brand-300 hover:bg-brand-50/40")}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-500 shadow-card">{busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{label}</span>
            {hint && <span className="block text-xs text-muted">{hint}</span>}
          </span>
          <input ref={file} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}
