-- =============================================================
-- Moov'Up Coach — V5 : rôles (head coach), fiche coach, espace admin
--
-- ORDRE D'EXÉCUTION :
--   schema.sql → v5-roles.sql (CE FICHIER) → v5-planning.sql → v5-planning-2.sql → v5-bilan.sql
--   → health-data.sql → reclamations.sql → v5-securite.sql (toujours en dernier)
-- Après toute ré-exécution de schema.sql : relancer ce fichier puis v5-securite.sql.
--
-- Idempotent : peut être relancé sans risque.
--
-- ⚠ Postgres n'autorise pas l'utilisation d'une nouvelle valeur d'enum dans la même transaction
--   que son ajout. Les fonctions ci-dessous comparent donc role::text (aucun cast vers 'head_coach'),
--   ce qui permet de tout exécuter d'un coup. Si l'éditeur SQL signale malgré tout
--   « unsafe use of new value », exécute d'abord la ligne ALTER TYPE seule, puis le reste.
-- =============================================================

-- ---------- 1. Nouveau rôle ----------
alter type user_role add value if not exists 'head_coach';

-- ---------- 2. Fiche coach ----------
alter table profiles add column if not exists phone       text;
alter table profiles add column if not exists active      boolean not null default true;
alter table profiles add column if not exists coach_pct   numeric(5,2) not null default 0;  -- ancien % coach (plus utilisé : l'application n'a plus de fonctions d'argent)
alter table profiles add column if not exists sales_pct   numeric(5,2) not null default 0;  -- ancien % commercial (plus utilisé)
alter table profiles add column if not exists specialties text[] not null default '{}';

do $$ begin
  alter table profiles add constraint profiles_coach_pct_range check (coach_pct between 0 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table profiles add constraint profiles_sales_pct_range check (sales_pct between 0 and 100);
exception when duplicate_object then null; end $$;

create index if not exists profiles_role_idx on profiles(role);
create index if not exists sessions_coach_idx on sessions(coach_id, starts_at);

-- ---------- 3. Fonctions d'aide ----------
-- Définition de démarrage, nécessaire aux scripts suivants (v5-planning, v5-bilan…).
-- La RÉFÉRENCE est supabase/v5-securite.sql, qui les redéfinit à l'identique (exécuté en dernier).
-- Un compte désactivé (active = false) perd ses droits de personnel.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'admin' and active from profiles where id = auth.uid()), false)
$$;

-- Admin ou head coach : voient tous les clients, affectent les séances, gèrent les dossiers de l'équipe
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('admin', 'head_coach') and active from profiles where id = auth.uid()), false)
$$;

-- Personnel : admin, head coach ou coach
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('admin', 'head_coach', 'coach') and active from profiles where id = auth.uid()), false)
$$;

-- Le profil `pid` est-il un membre ACTIF de l'équipe ? (utilisé par les déclencheurs d'intégrité)
create or replace function public.is_active_staff_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = pid and p.role::text in ('admin', 'head_coach', 'coach') and coalesce(p.active, true)
  )
$$;

-- Le membre du personnel connecté a une séance (affectée / acceptée / réalisée…) avec ce client.
-- Les séances refusées ou annulées ne donnent pas accès au dossier.
create or replace function public.coach_has_session_with(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from sessions s
    where s.client_id = cid and s.coach_id = auth.uid() and s.status::text not in ('refusee', 'annulee')
  )
$$;

-- VOIR un dossier client : un manager, le coach référent, un coach qui a une séance avec ce client,
-- ou l'adhérent lui-même (compte relié).
create or replace function public.can_see_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_manager()
    or exists (select 1 from clients c where c.id = cid and c.user_id = auth.uid())
    or (public.is_staff() and exists (select 1 from clients c where c.id = cid and c.coach_id = auth.uid()))
    or public.coach_has_session_with(cid)
$$;

-- GÉRER un dossier client (écrire) : le coach référent (actif) ou un manager.
create or replace function public.can_manage_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_manager() or (
    public.is_staff() and exists (select 1 from clients c where c.id = cid and c.coach_id = auth.uid())
  )
$$;

-- ---------- 4. Protection des profils ----------
-- Déclencheur profiles_protect_role (seul un admin change rôle / activation, dernier admin actif,
-- passation avant désactivation, dossier adhérent délié) : défini dans v5-securite.sql.

-- ---------- 5. Politiques (RLS) ----------
-- profiles : lecture soi-même ou personnel ; écriture soi-même ou admin (inchangé, is_staff mis à jour)
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select
  using (id = auth.uid() or public.is_staff());
drop policy if exists "profiles update self" on profiles;
create policy "profiles update self" on profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- Profils créés par l'admin sans passer par le déclencheur (rare : la création passe par Supabase Auth)
drop policy if exists "profiles admin insert" on profiles;
create policy "profiles admin insert" on profiles for insert with check (public.is_admin());

-- clients, séances, exercices de séance : politiques définies dans v5-securite.sql (exécuté en dernier).
-- Ancienne politique trop large retirée ici aussi (un coach pouvait écrire toute séance où il est coach) :
drop policy if exists "sessions write" on sessions;

-- tâches : le manager voit toutes les tâches de l'équipe
do $$ begin
  if to_regclass('public.tasks') is not null then
    drop policy if exists "tasks staff" on tasks;
    create policy "tasks staff" on tasks for all
      using (public.is_manager() or (public.is_staff() and (assigned_to = auth.uid() or created_by = auth.uid())))
      with check (public.is_staff());
  end if;
end $$;

-- Les autres politiques (mesures, bilans, messages, factures, programmes, santé connectée…) passent par
-- can_see_client / can_manage_client / is_staff : elles héritent automatiquement du head coach.
-- Les données financières sensibles (tarifs, packages, paramètres) restent réservées à is_admin().

-- ---------- 6. Vérification ----------
-- select id, full_name, role, active, coach_pct, sales_pct, specialties from profiles where role <> 'client';
