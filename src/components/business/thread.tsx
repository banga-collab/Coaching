import { CheckCheck, MessageCircle } from "lucide-react";
import type { Message } from "@/lib/types";
import { cn, dayKey, fmtTime } from "@/lib/utils";
import { AutoScroll } from "./auto-scroll";
import { dayLabel } from "./format";

/** Fil de discussion. `mine` = les messages de l'utilisateur courant (à droite, en bleu). */
export function Thread({ messages, mine, emptyText }: { messages: Message[]; mine: "coach" | "client"; emptyText: string }) {
  const groups: { key: string; items: Message[] }[] = [];
  for (const m of messages) {
    const k = dayKey(m.created_at);
    const g = groups.at(-1);
    if (g && g.key === k) g.items.push(m);
    else groups.push({ key: k, items: [m] });
  }
  const last = messages.at(-1);

  return (
    <AutoScroll
      depKey={`${messages.length}-${last?.id ?? ""}`}
      className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,#e9eef2_1px,transparent_0)] bg-[length:22px_22px] bg-canvas/50 px-3 py-4 sm:px-6"
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-white text-brand-500 shadow-card ring-1 ring-line">
            <MessageCircle className="size-6" />
          </span>
          <p className="mt-4 font-display font-bold text-ink">Aucun message</p>
          <p className="mt-1 max-w-xs text-sm text-muted">{emptyText}</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div className="sticky top-0 z-10 my-3 flex justify-center">
              <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold capitalize text-slate-500 shadow-sm ring-1 ring-line backdrop-blur">
                {dayLabel(g.key)}
              </span>
            </div>
            <div className="space-y-1.5">
              {g.items.map((m, i) => {
                const isMine = mine === "client" ? m.from_client : !m.from_client;
                const next = g.items[i + 1];
                const tail = !next || next.from_client !== m.from_client;
                return (
                  <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start", tail && "mb-3")}>
                    <div
                      className={cn(
                        "max-w-[82%] px-3.5 py-2 text-sm leading-relaxed shadow-sm sm:max-w-[68%]",
                        isMine ? "rounded-2xl bg-brand-500 text-white" : "rounded-2xl bg-white text-ink ring-1 ring-line",
                        tail && (isMine ? "rounded-br-md" : "rounded-bl-md"),
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px] font-medium", isMine ? "text-brand-100" : "text-slate-400")}>
                        {fmtTime(m.created_at)}
                        {isMine && <CheckCheck className={cn("size-3", m.read_at ? "text-sky-200" : "text-brand-200/70")} />}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </AutoScroll>
  );
}
