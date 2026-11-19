-- =============================================================
-- Moov'Up Coach — V5 : sécurité (rôles, liens profil ↔ données, règles de la base)
--
-- ORDRE D'EXÉCUTION (éditeur SQL Supabase) :
--   schema.sql → v5-roles.sql → v5-planning.sql → v5-planning-2.sql → v5-bilan.sql
--   → health-data.sql → reclamations.sql → v5-securite.sql (CE FICHIER, TOUJOURS EN DERNIER)
--
-- ⚠ Si schema.sql (ou un autre script) est relancé, relancer ensuite v5-roles.sql puis CE fichier :
--   schema.sql redéfinit des fonctions et politiques avec d'anciennes règles (sans head coach ni
--   comptes désactivés).
--
-- Idempotent : peut être relancé sans risque. Les comparaisons de rôle / statut se font en texte
-- (role::text), ce qui fonctionne même juste après l'ajout d'une valeur d'enum.
--
-- Contenu :
--   1. Fonctions d'aide CANONIQUES (une seule définition de référence, utilisée partout)
--   2. Protection des profils (rôle, activation, dernier admin, passation, dossier adhérent)
--   3. Intégrité des liens : clients.coach_id / clients.user_id / sessions.coach_id
--   4. Clés étrangères : historique conservé, auteurs alignés sur profiles(id)
--   5. Politiques RLS des clients, séances et exercices de séance
--   6. Réclamations : celles des coachs (privées : auteur + managers) et celles de la salle (QR code)
-- =============================================================

-- ---------- 1. Fonctions d'aide canoniques ----------
-- Toutes exigent un compte actif (profiles.active = true) pour les droits du personnel.

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

-- Anciens doublons conservés pour compatibilité : ils appellent désormais les fonctions canoniques.
create or replace function public.bilan_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
$$;

-- ---------- 2. Protection des profils ----------
-- • Seul un admin change : rôle, activation, pourcentages (colonnes conservées), e-mail.
-- • Il reste toujours au moins un admin actif.
-- • Passation : un membre de l'équipe ne peut être désactivé ou repassé adhérent tant qu'il suit
--   des clients actifs ou des séances à venir (l'Espace admin les transfère d'abord).
-- • Un adhérent promu dans l'équipe ne doit plus être relié à un dossier client.
-- auth.uid() nul = clé service-role ou éditeur SQL : opérations d'administration autorisées.
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  was_staff boolean;
  is_staff_now boolean;
begin
  was_staff := old.role::text in ('admin', 'head_coach', 'coach');
  is_staff_now := new.role::text in ('admin', 'head_coach', 'coach');
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Seul un admin peut changer un rôle' using errcode = 'insufficient_privilege';
    end if;
    if new.active is distinct from old.active
       or new.coach_pct is distinct from old.coach_pct
       or new.sales_pct is distinct from old.sales_pct then
      raise exception 'Seul un admin peut modifier l''activation d''un compte' using errcode = 'insufficient_privilege';
    end if;
    if new.email is distinct from old.email then
      new.email := old.email;
    end if;
  end if;

  if old.role::text = 'admin' and coalesce(old.active, true)
     and (new.role::text <> 'admin' or not coalesce(new.active, true))
     and not exists (
       select 1 from profiles p
       where p.id <> old.id and p.role::text = 'admin' and coalesce(p.active, true)
     ) then
    raise exception 'Il doit rester au moins un administrateur actif';
  end if;

  if was_staff and coalesce(old.active, true) and (not is_staff_now or not coalesce(new.active, true)) then
    if exists (select 1 from clients c where c.coach_id = old.id and c.status::text <> 'termine') then
      raise exception 'Ce coach suit encore des clients actifs : transfère-les à un autre coach avant de le désactiver ou de le retirer de l''équipe';
    end if;
    if exists (
      select 1 from sessions s
      where s.coach_id = old.id and s.status::text in ('planifiee', 'acceptee', 'reportee') and s.starts_at >= now()
    ) then
      raise exception 'Ce coach a encore des séances à venir : transfère-les à un autre coach avant de le désactiver ou de le retirer de l''équipe';
    end if;
  end if;

  if not was_staff and is_staff_now and exists (select 1 from clients c where c.user_id = old.id) then
    raise exception 'Ce compte est relié à un dossier client : délie-le avant de passer le compte dans l''équipe';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role
  before update on profiles
  for each row execute function public.protect_role();

-- ---------- 3. Intégrité des liens ----------
-- clients.coach_id : toujours un membre ACTIF de l'équipe (vérifié à la création et à chaque changement ;
--   les clients archivés d'un ancien coach gardent leur historique).
-- Seuls les managers changent coach_id ou user_id (relier / délier le compte adhérent).
-- user_id ne peut pointer que vers un compte adhérent (role = client).
-- Nom choisi pour s'exécuter AVANT clients_link_account (ordre alphabétique des déclencheurs BEFORE) :
-- la liaison automatique par e-mail (schema.sql) reste donc possible à la création.
create or replace function public.guard_client_links() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  privileged boolean;
begin
  uid := auth.uid();
  privileged := uid is null or public.is_manager();
  if tg_op = 'INSERT' or new.coach_id is distinct from old.coach_id then
    if not public.is_active_staff_profile(new.coach_id) then
      raise exception 'Le coach référent doit être un membre actif de l''équipe (admin, head coach ou coach)'
        using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and not privileged then
      raise exception 'Seuls l''admin et le head coach peuvent changer le coach référent d''un client'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if (tg_op = 'INSERT' and new.user_id is not null)
     or (tg_op = 'UPDATE' and new.user_id is distinct from old.user_id) then
    if new.user_id is not null
       and not exists (select 1 from profiles p where p.id = new.user_id and p.role::text = 'client') then
      raise exception 'Un dossier client ne peut être relié qu''à un compte adhérent' using errcode = 'check_violation';
    end if;
    -- Exception : liaison automatique du compte qui vient de confirmer son e-mail (link_client_account)
    if not privileged and not (tg_op = 'UPDATE' and old.user_id is null and new.user_id = uid) then
      raise exception 'Seuls l''admin et le head coach peuvent relier ou délier le compte d''un client'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists clients_guard_links on clients;
create trigger clients_guard_links
  before insert or update of coach_id, user_id on clients
  for each row execute function public.guard_client_links();

-- sessions.coach_id : toujours un membre ACTIF de l'équipe (création ou réaffectation).
create or replace function public.guard_session_coach() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.coach_id is distinct from old.coach_id)
     and not public.is_active_staff_profile(new.coach_id) then
    raise exception 'La séance doit être affectée à un membre actif de l''équipe' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists sessions_guard_coach on sessions;
create trigger sessions_guard_coach
  before insert or update of coach_id on sessions
  for each row execute function public.guard_session_coach();

-- ---------- 4. Clés étrangères ----------
-- • sessions.client_id : ON DELETE RESTRICT (l'application archive les clients ; supprimer un client
--   ne doit pas effacer silencieusement son historique de séances).
-- • Auteurs (created_by / validated_by) des bilans sportifs et de la santé connectée : alignés sur
--   profiles(id) ON DELETE SET NULL, comme le reste du schéma (au lieu de auth.users).
do $$
declare
  specs text[] := array[
    ['sessions',          'client_id',    'clients',  'restrict'],
    ['sport_assessments', 'created_by',   'profiles', 'set null'],
    ['sport_assessments', 'validated_by', 'profiles', 'set null'],
    ['health_samples',    'created_by',   'profiles', 'set null'],
    ['health_tokens',     'created_by',   'profiles', 'set null']
  ];
  spec text[];
  tbl regclass;
  att smallint;
  r record;
begin
  foreach spec slice 1 in array specs loop
    tbl := to_regclass('public.' || spec[1]);
    if tbl is null then continue; end if;
    select a.attnum into att from pg_attribute a where a.attrelid = tbl and a.attname = spec[2] and not a.attisdropped;
    if att is null then continue; end if;
    -- Références orphelines (compte Auth sans profil) : remises à null avant la nouvelle contrainte
    if spec[3] = 'profiles' then
      execute format(
        'update public.%I t set %I = null where t.%I is not null and not exists (select 1 from public.profiles p where p.id = t.%I)',
        spec[1], spec[2], spec[2], spec[2]);
    end if;
    for r in
      select c.conname from pg_constraint c
      where c.conrelid = tbl and c.contype = 'f' and c.conkey = array[att]
    loop
      execute format('alter table public.%I drop constraint %I', spec[1], r.conname);
    end loop;
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete %s',
      spec[1], spec[1] || '_' || spec[2] || '_fkey', spec[2], spec[3], spec[4]);
  end loop;
end $$;

-- ---------- 5. Politiques RLS ----------
-- Clients
drop policy if exists "clients read" on clients;
drop policy if exists "clients read planning" on clients;   -- ancien doublon (v5-planning), couvert par can_see_client
create policy "clients read" on clients for select using (public.can_see_client(id));

drop policy if exists "clients insert" on clients;
create policy "clients insert" on clients for insert
  with check (public.is_staff() and (coach_id = auth.uid() or public.is_manager()));

-- Le coach référent modifie le dossier sans pouvoir le confier à un autre (with check) ;
-- coach_id / user_id : managers uniquement (déclencheur clients_guard_links).
drop policy if exists "clients update" on clients;
create policy "clients update" on clients for update
  using (public.can_manage_client(id))
  with check (public.is_manager() or (public.is_staff() and coach_id = auth.uid()));

-- Pas de suppression depuis l'application (archivage = statut « termine »). Admin uniquement,
-- et refusée tant que le client a des séances (ON DELETE RESTRICT).
drop policy if exists "clients delete" on clients;
create policy "clients delete" on clients for delete using (public.is_admin());

-- Séances
drop policy if exists "sessions read" on sessions;
drop policy if exists "sessions write" on sessions;        -- schema.sql / v5-roles (FOR ALL trop large)
drop policy if exists "sessions manager" on sessions;
drop policy if exists "sessions own coach" on sessions;    -- v5-planning (FOR ALL : un coach pouvait créer une séance pour n'importe quel client)
drop policy if exists "sessions coach insert" on sessions;
drop policy if exists "sessions coach update" on sessions;

create policy "sessions read" on sessions for select
  using (public.can_see_client(client_id) or (public.is_staff() and coach_id = auth.uid()));

-- Managers : tout (créer, affecter à n'importe quel coach, réaffecter, supprimer)
create policy "sessions manager" on sessions for all
  using (public.is_manager())
  with check (public.is_manager());

-- Coach : crée une séance pour lui-même et seulement pour un client qu'il gère
create policy "sessions coach insert" on sessions for insert
  with check (public.is_staff() and coach_id = auth.uid() and public.can_manage_client(client_id));

-- Coach : met à jour uniquement ses propres séances, sans pouvoir les confier à un autre coach.
-- (Pas de suppression pour un coach : il annule la séance.)
create policy "sessions coach update" on sessions for update
  using (public.is_staff() and coach_id = auth.uid())
  with check (public.is_staff() and coach_id = auth.uid());

-- Exercices des séances : lecture comme la séance ; écriture par le coach de la séance ou un manager
drop policy if exists "exercises read" on session_exercises;
drop policy if exists "exercises write" on session_exercises;
drop policy if exists "exercises planning" on session_exercises;
create policy "exercises read" on session_exercises for select
  using (exists (
    select 1 from sessions s where s.id = session_id
      and (public.can_see_client(s.client_id) or (public.is_staff() and s.coach_id = auth.uid()))
  ));
create policy "exercises write" on session_exercises for all
  using (exists (
    select 1 from sessions s where s.id = session_id
      and (public.is_manager() or (public.is_staff() and s.coach_id = auth.uid()))
  ))
  with check (exists (
    select 1 from sessions s where s.id = session_id
      and (public.is_manager() or (public.is_staff() and s.coach_id = auth.uid()))
  ));

-- Bilans sportifs : politiques dans v5-bilan.sql (lecture : tout le personnel ; modification : coach
-- référent, auteur ou manager ; suppression : managers). Elles utilisent les fonctions ci-dessus.

-- ---------- 6. Réclamations (salle + coachs) ----------
-- source = 'adherent' : signalement public via le QR code (page /signaler) ;
-- source = 'coach'    : réclamation d'un coach à la direction, visible par son auteur et les managers.
alter table public.reclamations add column if not exists source text not null default 'adherent';
alter table public.reclamations add column if not exists author_id uuid references public.profiles(id) on delete set null;
alter table public.reclamations add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.reclamations add column if not exists urgent boolean not null default false;
alter table public.reclamations add column if not exists response text;
alter table public.reclamations add column if not exists responded_by uuid references public.profiles(id) on delete set null;
alter table public.reclamations add column if not exists responded_at timestamptz;

alter table public.reclamations drop constraint if exists reclamations_source_check;
alter table public.reclamations add constraint reclamations_source_check check (source in ('adherent', 'coach'));
alter table public.reclamations drop constraint if exists reclamations_category_check;
alter table public.reclamations add constraint reclamations_category_check check (category in (
  'panne', 'proprete', 'securite', 'service', 'autre',                 -- salle (QR code)
  'client', 'planning', 'materiel', 'equipe', 'administratif'          -- coachs
));
create index if not exists reclamations_source_idx on public.reclamations (source, status);

-- Remplace l'ancienne politique (admin + coach, sans head coach ni comptes désactivés)
drop policy if exists "reclamations staff" on public.reclamations;
drop policy if exists "reclamations read" on public.reclamations;
drop policy if exists "reclamations coach insert" on public.reclamations;
drop policy if exists "reclamations update" on public.reclamations;
drop policy if exists "reclamations delete" on public.reclamations;

-- Lecture : managers tout ; coachs les signalements de la salle + leurs propres réclamations
create policy "reclamations read" on public.reclamations for select
  using (public.is_manager() or (public.is_staff() and (source = 'adherent' or author_id = auth.uid())));

-- Création depuis l'application : un membre de l'équipe, en son nom, en statut « nouvelle »
create policy "reclamations coach insert" on public.reclamations for insert
  with check (public.is_staff() and source = 'coach' and author_id = auth.uid() and status = 'nouvelle' and response is null);

-- Traitement : la salle par toute l'équipe ; les réclamations de coach par les managers seulement
create policy "reclamations update" on public.reclamations for update
  using (public.is_manager() or (public.is_staff() and source = 'adherent'))
  with check (public.is_manager() or (public.is_staff() and source = 'adherent'));

create policy "reclamations delete" on public.reclamations for delete using (public.is_admin());

-- « reclamations public insert » (visiteurs, reclamations.sql) reste en place : il ne crée que des
-- signalements 'adherent' (valeur par défaut). On le resserre pour l'empêcher de se faire passer pour un coach.
drop policy if exists "reclamations public insert" on public.reclamations;
create policy "reclamations public insert" on public.reclamations for insert to anon
  with check (status = 'nouvelle' and source = 'adherent' and author_id is null and response is null);

-- ---------- Vérifications ----------
-- select proname from pg_proc where proname in ('is_admin','is_manager','is_staff','can_see_client','can_manage_client');
-- select tgname from pg_trigger where tgname in ('profiles_protect_role','clients_guard_links','sessions_guard_coach');
-- select policyname, cmd from pg_policies where tablename in ('clients','sessions','session_exercises','reclamations') order by 1;
