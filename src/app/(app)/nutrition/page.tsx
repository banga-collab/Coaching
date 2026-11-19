import Link from "next/link";
import { Apple, BookOpen, CheckCircle2, LayoutTemplate, Pencil, Plus, Search, Trash2, Users, UtensilsCrossed } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Food, MealPlan } from "@/lib/types";
import { cn, num } from "@/lib/utils";
import { normName } from "@/lib/video";
import { Badge, Card, CardHeader, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
import { ConfirmIcon } from "@/components/phase1/confirm-icon";
import { PlanCard } from "@/components/nutrition/plan-card";
import { FoodForm } from "@/components/nutrition/food-form";
import { FOOD_CATEGORIES, MACRO_COLORS } from "@/components/nutrition/shared";
import { deleteFoodAction } from "@/actions/nutrition";
import { ListToolbar } from "@/components/list-toolbar";
import { Fold } from "@/components/fold";

export const metadata = { title: "Nutrition" };

type SP = { vue?: string; q?: string; cat?: string; edit?: string; ok?: string; filtre?: string; type?: string };

export default async function NutritionPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff();
  const sp = await searchParams;
  const vue = sp.vue === "aliments" ? "aliments" : "plans";
  const supabase = await createClient();
  const [{ data: pData }, { data: fData }, { data: cData }] = await Promise.all([
    supabase.from("meal_plans").select("*").order("created_at", { ascending: false }),
    supabase.from("foods").select("*").order("name"),
    supabase.from("clients").select("id, full_name").order("full_name"),
  ]);
  const plans = (pData ?? []) as MealPlan[];
  const foods = (fData ?? []) as Food[];
  const clients = (cData ?? []) as Pick<Client, "id" | "full_name">[];
  const clientName = new Map(clients.map((c) => [c.id, c.full_name]));

  const templates = plans.filter((p) => p.client_id === null);
  const clientPlans = plans.filter((p) => p.client_id !== null);
  const activePlans = clientPlans.filter((p) => p.active);
  const moroccanCount = foods.filter((f) => f.moroccan).length;

  const tabs = [
    { key: "plans", label: "Plans alimentaires", icon: UtensilsCrossed, count: plans.length },
    { key: "aliments", label: "Aliments", icon: Apple, count: foods.length },
  ];

  return (
    <>
      <PageHeader
        title="Nutrition"
        subtitle="Plans alimentaires, bibliothèque d'aliments et plats marocains, suivi des journaux."
        actions={
          <LinkButton href="/nutrition/nouveau">
            <Plus className="size-4" /> Nouveau plan
          </LinkButton>
        }
      />

      <Fold id="nutrition-kpis">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Modèles" value={templates.length} icon={<LayoutTemplate className="size-4" />} />
          <Kpi label="Plans actifs" value={activePlans.length} icon={<Users className="size-4" />} tone="accent" />
          <Kpi label="Aliments" value={foods.length} icon={<Apple className="size-4" />} />
          <Kpi label="Plats marocains" value={moroccanCount} icon={<BookOpen className="size-4" />} tone="accent" />
        </div>
      </Fold>

      <div className="-mx-4 mb-3 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex w-max gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "plans" ? "/nutrition" : "/nutrition?vue=aliments"}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition",
                vue === t.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink",
              )}
              aria-current={vue === t.key ? "page" : undefined}
            >
              <t.icon className="size-4" /> {t.label}
              <span className={cn("rounded-full px-1.5 text-[11px]", vue === t.key ? "bg-white/20" : "bg-canvas")}>{t.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {vue === "plans" ? <PlansView templates={templates} clientPlans={clientPlans} clientName={clientName} sp={sp} /> : <FoodsView foods={foods} sp={sp} />}
    </>
  );
}

function PlansView({ templates: allTemplates, clientPlans, clientName, sp }: { templates: MealPlan[]; clientPlans: MealPlan[]; clientName: Map<string, string>; sp: SP }) {
  const q = sp.q ?? "";
  const filtre = sp.filtre === "actifs" || sp.filtre === "inactifs" ? sp.filtre : "";
  const type = sp.type === "modeles" || sp.type === "clients" ? sp.type : "";
  // Recherche (insensible à la casse et aux accents) : nom, objectif, client
  const needle = normName(q);
  const match = (p: MealPlan) => !needle || normName([p.name, p.goal, p.client_id ? clientName.get(p.client_id) : null].filter(Boolean).join(" ")).includes(needle);
  const templates = allTemplates.filter(match);
  const searchedClient = clientPlans.filter(match);
  const shown = filtre ? searchedClient.filter((p) => p.active === (filtre === "actifs")) : searchedClient;
  const activeCount = searchedClient.filter((p) => p.active).length;
  const filters = [
    {
      param: "type",
      label: "Type",
      options: [
        { value: "modeles", label: "Modèles", count: templates.length },
        { value: "clients", label: "Plans des clients", count: searchedClient.length },
      ],
    },
    {
      param: "filtre",
      label: "Plans des clients",
      options: [
        { value: "actifs", label: "Actifs", count: activeCount },
        { value: "inactifs", label: "Inactifs", count: searchedClient.length - activeCount },
      ],
    },
  ];
  const filtered = !!(q || filtre || type);
  return (
    <div className="space-y-6">
      <ListToolbar className="mb-0!" placeholder="Plan, objectif ou client…" filters={filters} exportKind="nutrition" />
      {type !== "clients" && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Modèles</h2>
              <p className="text-sm text-muted">Plans réutilisables à dupliquer pour un client</p>
            </div>
          </div>
          {templates.length === 0 ? (
            <Card>
              {filtered ? (
                <Empty icon={<LayoutTemplate className="size-6" />} title="Aucun modèle trouvé" text="Essaie une autre recherche." />
              ) : (
                <Empty
                  icon={<LayoutTemplate className="size-6" />}
                  title="Aucun modèle"
                  text="Crée un plan type (sèche, prise de masse, rééquilibrage marocain…) pour l'assigner en un clic."
                  action={
                    <LinkButton href="/nutrition/nouveau">
                      <Plus className="size-4" /> Créer un modèle
                    </LinkButton>
                  }
                />
              )}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
          )}
        </section>
      )}

      {type !== "modeles" && (
        <section>
          <div className="mb-3">
            <h2 className="font-display text-lg font-bold text-ink">Plans des clients</h2>
            <p className="text-sm text-muted">
              {shown.length} plan{shown.length > 1 ? "s" : ""} {filtre === "actifs" ? "actif" + (shown.length > 1 ? "s" : "") : filtre === "inactifs" ? "inactif" + (shown.length > 1 ? "s" : "") : `au total · ${activeCount} actif${activeCount > 1 ? "s" : ""}`}
            </p>
          </div>
          {shown.length === 0 ? (
            <Card>
              <Empty
                icon={<Users className="size-6" />}
                title={filtered ? "Aucun plan trouvé" : "Aucun plan client"}
                text={filtered ? "Essaie une autre recherche ou un autre filtre." : "Assigne un modèle à un client ou compose un plan sur mesure depuis sa fiche."}
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => (
                <PlanCard key={p.id} plan={p} clientName={clientName.get(p.client_id!) ?? "Client"} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FoodsView({ foods, sp }: { foods: Food[]; sp: SP }) {
  const q = (sp.q ?? "").trim();
  const cat = sp.cat ?? "";
  const norm = normName;
  const needle = norm(q);
  const list = foods.filter((f) => (!cat || (cat === "maroc" ? f.moroccan : f.category === cat)) && (!needle || norm(`${f.name} ${f.category}`).includes(needle)));
  const catCount = new Map<string, number>();
  let moroccan = 0;
  for (const f of foods) {
    if (needle && !norm(`${f.name} ${f.category}`).includes(needle)) continue;
    catCount.set(f.category, (catCount.get(f.category) ?? 0) + 1);
    if (f.moroccan) moroccan++;
  }
  const present = new Set(foods.map((f) => f.category));
  const cats = FOOD_CATEGORIES.filter((c) => present.has(c));
  const filters = [
    {
      param: "cat",
      label: "Catégorie",
      options: [
        { value: "maroc", label: "Plats marocains", count: moroccan },
        ...cats.filter((c) => c !== "Plats marocains").map((c) => ({ value: c, label: c, count: catCount.get(c) ?? 0 })),
      ],
    },
  ];
  const editing = sp.edit ? (foods.find((f) => f.id === sp.edit) ?? null) : null;
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams({ vue: "aliments" });
    const next = { q: sp.q, cat: sp.cat, ...patch };
    if (next.q) p.set("q", next.q);
    if (next.cat) p.set("cat", next.cat);
    if (patch.edit) p.set("edit", patch.edit);
    return `/nutrition?${p.toString()}`;
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        {sp.ok && (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
            <CheckCircle2 className="size-4" /> {sp.ok === "maj" ? "Aliment mis à jour." : "Aliment ajouté à la bibliothèque."}
          </p>
        )}
        <ListToolbar className="mb-0!" placeholder="Aliment ou plat (harira, tajine, poulet…)" filters={filters} exportKind="nutrition" />

        <Card className="overflow-hidden">
          <CardHeader title="Bibliothèque d'aliments" subtitle={`${list.length} résultat${list.length > 1 ? "s" : ""} · valeurs pour une portion`} icon={<Apple className="size-4" />} />
          {list.length === 0 ? (
            <Empty icon={<Search className="size-6" />} title="Aucun aliment trouvé" text="Essaie un autre mot-clé ou ajoute l'aliment à la bibliothèque." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {list.map((f) => (
                <li key={f.id} className={cn("group flex items-center gap-3 px-4 py-2.5 transition hover:bg-canvas/60 sm:px-5", editing?.id === f.id && "bg-brand-50/50")}>
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", f.moroccan ? "bg-accent-50 text-accent-600" : "bg-brand-50 text-brand-500")}>
                    {f.moroccan ? <UtensilsCrossed className="size-4" /> : <Apple className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-ink">{f.name}</p>
                      {f.moroccan && <Badge tone="accent">Plats marocains</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {f.portion ?? `${num(f.grams)} g`} · {f.category}
                    </p>
                    <div className="mt-1.5 flex gap-3 text-[11px] text-muted sm:hidden">
                      <MacroPill c={MACRO_COLORS.protein} l="P" v={f.protein} />
                      <MacroPill c={MACRO_COLORS.carbs} l="G" v={f.carbs} />
                      <MacroPill c={MACRO_COLORS.fat} l="L" v={f.fat} />
                    </div>
                  </div>
                  <div className="hidden gap-4 text-xs text-muted sm:flex">
                    <MacroPill c={MACRO_COLORS.protein} l="P" v={f.protein} />
                    <MacroPill c={MACRO_COLORS.carbs} l="G" v={f.carbs} />
                    <MacroPill c={MACRO_COLORS.fat} l="L" v={f.fat} />
                  </div>
                  <p className="w-16 shrink-0 text-end font-display text-sm font-extrabold text-ink">
                    {num(f.kcal)}
                    <span className="block text-[10px] font-semibold text-muted">kcal</span>
                  </p>
                  <div className="flex shrink-0 items-center">
                    <Link href={href({ edit: f.id })} className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600" aria-label={`Modifier ${f.name}`} title="Modifier">
                      <Pencil className="size-4" />
                    </Link>
                    <form action={deleteFoodAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <ConfirmIcon message={`Supprimer « ${f.name} » de la bibliothèque ? Les plans existants ne sont pas modifiés.`} label="Supprimer" className="size-9">
                        <Trash2 className="size-4" />
                      </ConfirmIcon>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="lg:sticky lg:top-6">
        <CardHeader
          title={editing ? "Modifier l'aliment" : "Ajouter un aliment"}
          subtitle={editing ? editing.name : "Valeurs nutritionnelles pour une portion"}
          icon={editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        />
        <div className="px-5 pb-5">
          <FoodForm key={editing?.id ?? "new"} food={editing} />
        </div>
      </Card>
    </div>
  );
}

function MacroPill({ c, l, v }: { c: string; l: string; v: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {l} <b className="text-ink">{num(v)}</b>
    </span>
  );
}
