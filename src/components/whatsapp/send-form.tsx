"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, FlaskConical, Loader2, Send } from "lucide-react";
import { sendWhatsAppAction, type WaSendState } from "@/actions/whatsapp";
import { Field, Select, Textarea, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { WA_CATALOG, WA_TEMPLATE_KEYS, type WaTemplateKey } from "./templates";

type Opt = { id: string; name: string; phone: string | null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonClass("primary", "h-11 w-full sm:w-auto"), "bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600")}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      {pending ? "Envoi…" : "Envoyer"}
    </button>
  );
}

export function WhatsAppSendForm({ clients, live, defaultClient }: { clients: Opt[]; live: boolean; defaultClient?: string }) {
  const [state, action] = useActionState<WaSendState, FormData>(sendWhatsAppAction, undefined);
  const [clientId, setClientId] = useState(defaultClient ?? "");
  const [template, setTemplate] = useState<WaTemplateKey>("manuel");
  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const first = client?.name.split(" ")[0] ?? "";
  const build = (t: WaTemplateKey, name: string) => {
    const def = WA_CATALOG[t];
    return def.build(def.sample.map((s, i) => (i === 0 ? name || s : s)));
  };
  const [body, setBody] = useState(() => build("manuel", first));
  const [lastPrefill, setLastPrefill] = useState(body);
  const formRef = useRef<HTMLFormElement>(null);

  const prefill = (t: WaTemplateKey, name: string) => {
    const text = build(t, name);
    setBody(text);
    setLastPrefill(text);
  };

  useEffect(() => {
    if (state?.ok) formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-4 px-5 pb-5">
      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className={cn("flex items-start gap-2 rounded-xl border px-4 py-3 text-sm", state.status === "simule" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")} role="status">
          {state.status === "simule" ? <FlaskConical className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />} {state.detail}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" hint={client && !client.phone ? "Aucun numéro sur la fiche de ce client." : client?.phone ?? undefined}>
          <Select
            name="client_id"
            required
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const n = clients.find((c) => c.id === e.target.value)?.name.split(" ")[0] ?? "";
              if (!body.trim() || body === lastPrefill) prefill(template, n);
            }}
          >
            <option value="">Choisir un client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? "" : " (sans numéro)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Modèle">
          <Select
            name="template"
            value={template}
            onChange={(e) => {
              const t = e.target.value as WaTemplateKey;
              setTemplate(t);
              prefill(t, first);
            }}
          >
            {WA_TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {WA_CATALOG[k].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Message" hint={`${body.length} / 4096 · les variables d'exemple (date, montant…) sont à adapter avant l'envoi.`}>
        <Textarea name="body" rows={5} required maxLength={4096} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Bonjour 👋 …" className="min-h-[120px]" />
      </Field>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {live ? "Envoi réel via l'API WhatsApp Business." : "Mode simulation : le message est enregistré dans l'historique, rien n'est envoyé."}
        </p>
        <Submit />
      </div>
    </form>
  );
}
