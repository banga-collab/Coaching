"use client";

import { useEffect, useRef } from "react";

/**
 * React 19 vide un <form action> après l'envoi, même quand l'action renvoie une erreur.
 * Ce hook garde la dernière saisie et la remet dans le formulaire quand `failed` est vrai.
 */
export function useRestoreOnError(failed: boolean, state: unknown) {
  const last = useRef<FormData | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!failed || !last.current) return;
    const fd = last.current;
    const t = setTimeout(() => {
      const form = ref.current;
      if (form) restoreForm(form, fd);
    }, 0);
    return () => clearTimeout(t);
  }, [failed, state]);
  const remember = (fd: FormData) => {
    last.current = fd;
  };
  return { ref, remember };
}

export function restoreForm(form: HTMLFormElement, fd: FormData) {
  const names = new Set<string>();
  for (const [name] of fd.entries()) if (!name.startsWith("$")) names.add(name);
  // Les cases à cocher absentes de FormData étaient décochées
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.name && !el.name.startsWith("$")) {
      el.checked = fd.getAll(el.name).map(String).includes(el.value);
    }
  }
  // Listes d'abord (elles peuvent afficher des champs supplémentaires), puis le reste
  const fields = Array.from(form.elements).filter(
    (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && !!el.name && names.has(el.name),
  );
  const used = new Map<string, number>();
  const ordered = [...fields.filter((f) => f instanceof HTMLSelectElement), ...fields.filter((f) => !(f instanceof HTMLSelectElement))];
  for (const el of ordered) {
    if (el instanceof HTMLInputElement && ["checkbox", "radio", "file", "hidden", "submit", "button"].includes(el.type)) continue;
    const values = fd.getAll(el.name).map((v) => (typeof v === "string" ? v : ""));
    // Champs répétés (même nom) : on les remplit dans l'ordre
    const sameName = fields.filter((f) => f.name === el.name);
    const idx = sameName.indexOf(el);
    const value = values[idx] ?? values[used.get(el.name) ?? 0];
    used.set(el.name, (used.get(el.name) ?? 0) + 1);
    if (value === undefined || el.value === value) continue;
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }
}
