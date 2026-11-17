import Link from "next/link";
import { ArrowLeft, ExternalLink, MessageCircle, MessagesSquare, PenSquare, Search, UserRound } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { waLink, WA_TEMPLATES } from "@/lib/whatsapp";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { Thread } from "@/components/business/thread";
import { Composer } from "@/components/business/composer";
import { shortStamp } from "@/components/business/format";

export const metadata = { title: "Messages" };

type Conv = { client: Client; last: Message; unread: number };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ client?: string; q?: string }> }) {
  const me = await requireStaff();
  const { client: activeId = "", q = "" } = await searchParams;
  const supabase = await createClient();

  // Ouvrir un fil = marquer les messages du client comme lus (+ notifications liées)
  if (activeId) {
    await Promise.all([
      supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("client_id", activeId).eq("from_client", true).is("read_at", null),
      supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("link", `/messages?client=${activeId}`).eq("read", false),
    ]);
  }

  const [{ data: cData }, { data: mData }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("messages").select("*").order("created_at"),
  ]);
  const clients = (cData ?? []) as Client[];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const messages = (mData ?? []) as Message[];

  const convMap = new Map<string, Conv>();
  for (const m of messages) {
    const client = byId.get(m.client_id);
    if (!client) continue;
    const c = convMap.get(m.client_id) ?? { client, last: m, unread: 0 };
    c.last = m;
    if (m.from_client && !m.read_at) c.unread++;
    convMap.set(m.client_id, c);
  }
  const needle = q.trim().toLowerCase();
  const convs = [...convMap.values()]
    .filter((c) => !needle || c.client.full_name.toLowerCase().includes(needle) || c.last.body.toLowerCase().includes(needle))
    .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
  const totalUnread = [...convMap.values()].reduce((s, c) => s + c.unread, 0);

  const active = activeId ? byId.get(activeId) ?? null : null;
  const thread = active ? messages.filter((m) => m.client_id === active.id) : [];
  const wa = active ? waLink(active.phone, WA_TEMPLATES.generic(active.full_name.split(" ")[0] ?? "")) : null;
  const withoutConv = clients.filter((c) => !convMap.has(c.id) && c.status !== "termine");

  return (
    <>
      <div className={cn(active && "hidden lg:block")}>
        <PageHeader
          title="Messages"
          subtitle={totalUnread ? `${totalUnread} message${totalUnread > 1 ? "s" : ""} non lu${totalUnread > 1 ? "s" : ""}` : "Échangez avec vos clients"}
        />
      </div>

      <Card className="grid h-[calc(100dvh-210px)] min-h-[460px] overflow-hidden lg:h-[calc(100dvh-215px)] lg:grid-cols-[340px_1fr]">
        {/* ---------- Liste des conversations ---------- */}
        <aside className={cn("flex min-h-0 flex-col border-line lg:border-r", active && "hidden lg:flex")}>
          <div className="space-y-3 border-b border-line p-3">
            <div className="flex items-center gap-2">
              <form className="relative flex-1">
                {activeId && <input type="hidden" name="client" value={activeId} />}
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Rechercher…"
                  className="h-10 w-full rounded-xl border border-line bg-canvas/60 pl-9 pr-3 text-sm transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
                />
              </form>
              <details className="group relative">
                <summary
                  className="grid size-10 cursor-pointer list-none place-items-center rounded-xl bg-accent-500 text-white shadow-sm shadow-accent-500/20 transition hover:bg-accent-600 [&::-webkit-details-marker]:hidden"
                  title="Nouveau message"
                  aria-label="Nouveau message"
                >
                  <PenSquare className="size-[18px]" />
                </summary>
                <div className="absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
                  <p className="border-b border-line px-4 py-3 font-display text-sm font-bold text-ink">Nouveau message</p>
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {(withoutConv.length ? withoutConv : clients).map((c) => (
                      <li key={c.id}>
                        <Link href={`/messages?client=${c.id}`} className="flex items-center gap-3 px-4 py-2 transition hover:bg-canvas">
                          <Avatar name={c.full_name} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink">{c.full_name}</span>
                            <span className="block truncate text-xs text-muted">{c.goal ?? c.phone ?? "—"}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                    {clients.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Aucun client.</li>}
                  </ul>
                </div>
              </details>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {convs.length === 0 ? (
              <li className="flex flex-col items-center px-6 py-14 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                  <MessagesSquare className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">{needle ? "Aucun résultat" : "Aucune conversation"}</p>
                <p className="mt-0.5 text-xs text-muted">{needle ? "Essayez un autre nom." : "Démarrez-en une avec le bouton crayon."}</p>
              </li>
            ) : (
              convs.map(({ client, last, unread }) => {
                const isActive = client.id === activeId;
                return (
                  <li key={client.id}>
                    <Link
                      href={{ pathname: "/messages", query: { client: client.id, ...(q && { q }) } }}
                      className={cn(
                        "relative flex items-center gap-3 px-4 py-3 transition",
                        isActive ? "bg-brand-50" : "hover:bg-canvas",
                      )}
                    >
                      {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-500" />}
                      <Avatar name={client.full_name} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-sm", unread ? "font-bold text-ink" : "font-semibold text-slate-800")}>{client.full_name}</span>
                          <span className={cn("shrink-0 text-[11px] font-medium", unread ? "text-accent-600" : "text-slate-400")}>{shortStamp(last.created_at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={cn("truncate text-xs", unread ? "font-semibold text-slate-700" : "text-muted")}>
                            {!last.from_client && <span className="text-slate-400">Vous : </span>}
                            {last.body}
                          </span>
                          {unread > 0 && (
                            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* ---------- Fil ---------- */}
        <section className={cn("min-h-0 flex-col", active ? "flex" : "hidden lg:flex")}>
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-line bg-white px-3 py-3 sm:px-5">
                <Link href={q ? `/messages?q=${encodeURIComponent(q)}` : "/messages"} className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-canvas hover:text-ink lg:hidden" aria-label="Retour">
                  <ArrowLeft className="size-5" />
                </Link>
                <Avatar name={active.full_name} size={40} />
                <div className="min-w-0 flex-1">
                  <Link href={`/clients/${active.id}`} className="block truncate font-display text-[15px] font-bold text-ink transition hover:text-brand-600">
                    {active.full_name}
                  </Link>
                  <p className="truncate text-xs text-muted">{active.user_id ? "Compte membre relié · voit vos messages dans l'app" : "Pas encore de compte membre"}</p>
                </div>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100 transition hover:bg-emerald-100"
                  >
                    <MessageCircle className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
                <Link href={`/clients/${active.id}`} className="hidden size-9 place-items-center rounded-xl text-muted transition hover:bg-canvas hover:text-brand-600 sm:grid" title="Voir la fiche">
                  <UserRound className="size-[18px]" />
                </Link>
              </header>
              <Thread
                messages={thread}
                mine="coach"
                emptyText={active.user_id ? `Envoyez un premier message à ${active.full_name.split(" ")[0]}.` : "Ce client n'a pas encore de compte : il verra vos messages dès qu'il sera relié. Utilisez WhatsApp en attendant."}
              />
              <Composer key={active.id} clientId={active.id} placeholder={`Message à ${active.full_name.split(" ")[0]}…`} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-canvas/40 px-6 text-center">
              <span className="grid size-16 place-items-center rounded-2xl bg-white text-brand-500 shadow-card ring-1 ring-line">
                <MessagesSquare className="size-7" />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-ink">Sélectionnez une conversation</p>
              <p className="mt-1 max-w-sm text-sm text-muted">Choisissez un client à gauche ou démarrez une nouvelle discussion.</p>
              {activeId && !active && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-600">
                  <ExternalLink className="size-3.5" /> Ce client est introuvable.
                </p>
              )}
            </div>
          )}
        </section>
      </Card>
    </>
  );
}
