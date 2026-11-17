"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Dumbbell,
  FileText,
  HandHeart,
  Loader2,
  MessageCircle,
  MessagesSquare,
  PartyPopper,
  PenLine,
  RefreshCw,
  Search,
  SendHorizontal,
  Sparkles,
  Target,
  UserRoundSearch,
  Zap,
} from "lucide-react";
import { aiAdjustAction, aiAskAction, aiDraftAction, aiSummaryAction } from "@/actions/platform";
import type { AiSections, AiText, ChatTurn, DraftIntent } from "@/lib/ai";
import type { ClientStatus } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Card, buttonClass } from "@/components/ui";
import { AiSkeleton, CopyButton, Note, SectionsView, SourceBadge, sectionsToText } from "@/components/platform/ai-ui";

export type PickClient = { id: string; name: string; goal: string | null; status: ClientStatus; phone: string | null };
type Tab = "resume" | "message" | "ajustements" | "question";
type Bubble = ChatTurn & { source?: AiText["source"]; note?: string };

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "resume", label: "Résumé", icon: FileText },
  { key: "message", label: "Rédiger un message", icon: PenLine },
  { key: "ajustements", label: "Ajustements", icon: Dumbbell },
  { key: "question", label: "Question libre", icon: MessagesSquare },
];

const INTENTS: { key: DraftIntent; label: string; icon: typeof Zap }[] = [
  { key: "motivation", label: "Motivation", icon: Zap },
  { key: "rappel", label: "Rappel séance", icon: CalendarClock },
  { key: "felicitations", label: "Félicitations", icon: PartyPopper },
  { key: "relance", label: "Relance absence", icon: HandHeart },
];

const SUGGESTIONS = ["Comment évolue son poids ?", "Est-il assidu ces dernières semaines ?", "Y a-t-il des points de santé à surveiller ?", "Quels ajustements de programme proposer ?"];

const STATUS: Record<ClientStatus, { label: string; tone: "green" | "amber" | "gray" }> = {
  actif: { label: "Actif", tone: "green" },
  pause: { label: "En pause", tone: "amber" },
  termine: { label: "Terminé", tone: "gray" },
};

export function AssistantWorkspace({ clients, initialId }: { clients: PickClient[]; initialId: string | null }) {
  const [id, setId] = useState<string | null>(initialId);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(!initialId);
  const [tab, setTab] = useState<Tab>("resume");
  const client = clients.find((c) => c.id === id) ?? null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? clients.filter((c) => c.name.toLowerCase().includes(s) || c.goal?.toLowerCase().includes(s)) : clients;
  }, [clients, q]);

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] animate-fade-up">
      {/* Sélection du client */}
      <Card className={cn("flex flex-col overflow-hidden lg:sticky lg:top-6 lg:max-h-[calc(100dvh-48px)]", !picking && client && "hidden lg:flex")}>
        <div className="border-b border-line p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un client…"
              aria-label="Rechercher un client"
              className="h-10 w-full rounded-xl border border-line bg-canvas/60 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
            />
          </label>
        </div>
        <ul className="max-h-80 flex-1 overflow-y-auto p-2 lg:max-h-none" role="listbox" aria-label="Clients">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === id}
                onClick={() => {
                  setId(c.id);
                  setPicking(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                  c.id === id ? "bg-brand-50 ring-1 ring-inset ring-brand-100" : "hover:bg-canvas",
                )}
              >
                <Avatar name={c.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-semibold", c.id === id ? "text-brand-700" : "text-ink")}>{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.goal ?? "Objectif non précisé"}</span>
                </span>
                {c.status !== "actif" && <span className={cn("size-2 shrink-0 rounded-full", c.status === "pause" ? "bg-amber-400" : "bg-slate-300")} title={STATUS[c.status].label} />}
              </button>
            </li>
          ))}
          {!filtered.length && <li className="px-3 py-8 text-center text-sm text-muted">Aucun client ne correspond.</li>}
        </ul>
      </Card>

      {/* Espace de travail */}
      {client ? (
        <div className="min-w-0 space-y-4">
          <Card className="relative overflow-hidden p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-gradient-to-br from-brand-100 to-accent-100 opacity-60 blur-2xl" />
            <div className="relative flex flex-wrap items-center gap-3">
              <Avatar name={client.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-lg font-extrabold text-ink">{client.name}</h2>
                  <Badge dot tone={STATUS[client.status].tone}>
                    {STATUS[client.status].label}
                  </Badge>
                </div>
                {client.goal && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted">
                    <Target className="size-3.5 text-accent-500" /> {client.goal}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPicking(true)} className={buttonClass("secondary", "h-9 px-3 lg:hidden")}>
                  <UserRoundSearch className="size-4" /> Changer
                </button>
                <Link href={`/clients/${client.id}`} className={buttonClass("secondary", "h-9 px-3")}>
                  Fiche <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
          </Card>

          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1 shadow-card" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                  tab === t.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* key = client : l'état de chaque onglet repart à zéro au changement de client */}
          <div key={client.id}>
            <div hidden={tab !== "resume"}>
              <SectionsPanel clientId={client.id} kind="resume" active={tab === "resume"} />
            </div>
            <div hidden={tab !== "ajustements"}>
              <SectionsPanel clientId={client.id} kind="ajustements" active={tab === "ajustements"} />
            </div>
            <div hidden={tab !== "message"}>
              <MessagePanel client={client} />
            </div>
            <div hidden={tab !== "question"}>
              <ChatPanel client={client} />
            </div>
          </div>
        </div>
      ) : (
        <Card className="grid min-h-[420px] place-items-center p-8 text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-pop">
              <Sparkles className="size-7" />
            </span>
            <h2 className="mt-5 font-display text-lg font-extrabold text-ink">Choisissez un client</h2>
            <p className="mt-1.5 text-sm text-muted">
              L&apos;assistant analyse ses mesures, bilans, séances et objectifs pour vous proposer une synthèse, un message ou des ajustements.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-left text-xs">
              {TABS.map((t) => (
                <span key={t.key} className="flex items-center gap-2 rounded-xl border border-line bg-canvas/60 px-3 py-2 font-semibold text-slate-600">
                  <t.icon className="size-3.5 text-brand-500" /> {t.label}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Résumé / Ajustements ---------- */
function SectionsPanel({ clientId, kind, active }: { clientId: string; kind: "resume" | "ajustements"; active: boolean }) {
  const [data, setData] = useState<AiSections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [requested, setRequested] = useState(false);

  const run = () => {
    setRequested(true);
    start(async () => {
      setError(null);
      try {
        setData(kind === "resume" ? await aiSummaryAction(clientId) : await aiAdjustAction(clientId));
      } catch {
        setError("La génération a échoué. Réessayez dans un instant.");
      }
    });
  };

  // Lancement automatique à la première ouverture de l'onglet
  useEffect(() => {
    if (active && !requested) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="font-display text-[15px] font-bold text-ink">{kind === "resume" ? "Synthèse du suivi" : "Ajustements du programme"}</h3>
          <div className="mt-1 h-5">{data && !pending && <SourceBadge source={data.source} />}</div>
        </div>
        <div className="flex gap-2">
          <CopyButton text={data && !pending ? sectionsToText(data) : ""} />
          <button type="button" onClick={run} disabled={pending} className={buttonClass("brand", "h-9 px-3.5")}>
            <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Régénérer
          </button>
        </div>
      </div>
      <div className="p-5">
        {pending || !data ? error ? <Note text={error} /> : <AiSkeleton rows={kind === "resume" ? 3 : 2} /> : <SectionsView data={data} />}
      </div>
    </Card>
  );
}

/* ---------- Rédaction de message ---------- */
function MessagePanel({ client }: { client: PickClient }) {
  const [intent, setIntent] = useState<DraftIntent>("motivation");
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<Omit<AiText, "text"> | null>(null);
  const [pending, start] = useTransition();

  const run = (i = intent) =>
    start(async () => {
      try {
        const r = await aiDraftAction(client.id, i);
        setText(r.text);
        setMeta({ source: r.source, note: r.note });
      } catch {
        setMeta({ source: "auto", note: "La génération a échoué. Réessayez dans un instant." });
      }
    });

  const wa = waLink(client.phone, text);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h3 className="font-display text-[15px] font-bold text-ink">Rédiger un message</h3>
        <p className="mt-0.5 text-xs text-muted">Choisissez l&apos;intention : le message est personnalisé avec les données de {client.name.split(" ")[0]}.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INTENTS.map((it) => (
            <button
              key={it.key}
              type="button"
              disabled={pending}
              onClick={() => {
                setIntent(it.key);
                run(it.key);
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-60",
                intent === it.key && (text || pending) ? "border-brand-300 bg-brand-50 text-brand-700 ring-4 ring-brand-50" : "border-line bg-white text-slate-700 hover:border-slate-300 hover:bg-canvas",
              )}
            >
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", intent === it.key && (text || pending) ? "bg-brand-500 text-white" : "bg-accent-50 text-accent-600")}>
                <it.icon className="size-3.5" />
              </span>
              {it.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-5">
        {meta?.note && <Note text={meta.note} />}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Choisissez une intention ci-dessus pour générer un brouillon, puis modifiez-le librement."
            className="w-full resize-y rounded-2xl border border-line bg-[#f7faf8] px-4 py-3.5 text-sm leading-relaxed text-ink placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
          {pending && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-[1px]">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
                <Loader2 className="size-4 animate-spin" /> Rédaction en cours…
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto h-5">{meta && text && !pending && <SourceBadge source={meta.source} />}</div>
          <button type="button" onClick={() => run()} disabled={pending || !text} className={buttonClass("secondary", "h-9 px-3.5")}>
            <RefreshCw className="size-4" /> Régénérer
          </button>
          <CopyButton text={text} />
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!text}
              className={cn(
                "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-[#25D366] px-3.5 text-sm font-semibold text-white shadow-sm shadow-[#25D366]/25 transition hover:bg-[#1fb457]",
                !text && "pointer-events-none opacity-50",
              )}
            >
              <MessageCircle className="size-4" /> Envoyer sur WhatsApp
            </a>
          ) : (
            <span className="text-xs text-muted">Aucun numéro WhatsApp valide pour ce client.</span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------- Question libre ---------- */
function ChatPanel({ client }: { client: PickClient }) {
  const [turns, setTurns] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, pending]);

  const send = (question: string) => {
    const qn = question.trim();
    if (!qn || pending) return;
    const history: ChatTurn[] = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: qn }]);
    setInput("");
    start(async () => {
      try {
        const r = await aiAskAction(client.id, qn, history);
        setTurns((t) => [...t, { role: "assistant", content: r.text, source: r.source, note: r.note }]);
      } catch {
        setTurns((t) => [...t, { role: "assistant", content: "Désolé, je n'ai pas pu répondre. Réessayez dans un instant.", source: "auto" }]);
      }
    });
  };

  const first = client.name.split(" ")[0];

  return (
    <Card className="flex min-h-[460px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="font-display text-[15px] font-bold text-ink">Question libre</h3>
          <p className="mt-0.5 text-xs text-muted">Posez une question sur le suivi de {first}.</p>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} className={buttonClass("ghost", "h-8 px-2.5 text-xs")}>
            Effacer
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-canvas/40 px-4 py-5 sm:px-5" aria-live="polite">
        {!turns.length && (
          <div className="mx-auto max-w-md py-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
              <MessagesSquare className="size-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Que voulez-vous savoir ?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm text-white shadow-sm">{t.content}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 max-w-[85%] space-y-2">
                <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-card">{t.content}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {t.source && <SourceBadge source={t.source} />}
                  {t.note && <span className="text-[11px] text-amber-700">{t.note}</span>}
                </div>
              </div>
            </div>
          ),
        )}
        {pending && (
          <div className="flex gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-line bg-white p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={`Ex. : ${first} récupère-t-il bien entre les séances ?`}
          aria-label="Votre question"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
        />
        <button type="submit" disabled={pending || !input.trim()} className={buttonClass("primary", "h-11 w-11 px-0")} aria-label="Envoyer">
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </Card>
  );
}
