-- =============================================================
-- Moov'Up Coach · V5 · Contrôle à distance (Moov'Up Lady)
-- La direction ne peut pas entrer dans l'espace 100 % femmes : le contrôle des coachs
-- se fait par trois preuves que la coach ne peut pas fabriquer seule :
--   1. le POINTAGE (arrivée / départ) avec le code QR qui change toutes les 30 s
--      sur l'écran de l'accueil (borne) ;
--   2. la CONFIRMATION de chaque séance réalisée par la cliente ;
--   3. l'AVIS de la cliente (note + commentaire), visible par la direction seulement.
--
-- ORDRE D'EXÉCUTION :
--   schema → v5-roles → v5-planning → v5-planning-2 → v5-bilan → health-data → reclamations
--   → v5-securite → v5-controle (CE FICHIER, en tout dernier)
-- Script idempotent : peut être relancé sans risque.
-- Variable serveur à ajouter : POINTAGE_SECRET (texte aléatoire, au moins 32 caractères).
-- =============================================================

-- ---------- 1. Espace de chaque membre de l'équipe ----------
alter table profiles add column if not exists espace text not null default 'mixte';
do $$ begin
  alter table profiles add constraint profiles_espace_check check (espace in ('mixte', 'lady'));
exception when duplicate_object then null; end $$;

-- Seul l'admin change l'espace d'un coach (une coach ne peut pas sortir seule du contrôle Lady)
create or replace function public.guard_profile_espace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.espace is distinct from old.espace and auth.uid() is not null and not public.is_admin() then
    raise exception 'Seul l''administrateur change l''espace (Mixte / Lady) d''un coach'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_espace on profiles;
create trigger profiles_guard_espace before update of espace on profiles
  for each row execute function public.guard_profile_espace();

-- ---------- 2. Moov'Up Lady : jamais d'adhérent homme chez une coach Lady ----------
create or replace function public.coach_is_lady(p_coach uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = p_coach and p.espace = 'lady');
$$;

create or replace function public.guard_lady_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sex = 'H' and public.coach_is_lady(new.coach_id) then
    raise exception 'Moov''Up Lady est un espace 100 %% femmes : un adhérent homme ne peut pas être suivi par une coach Lady'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists clients_guard_lady on clients;
create trigger clients_guard_lady before insert or update of coach_id, sex on clients
  for each row execute function public.guard_lady_client();

create or replace function public.guard_lady_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.coach_is_lady(new.coach_id)
     and exists (select 1 from clients c where c.id = new.client_id and c.sex = 'H') then
    raise exception 'Moov''Up Lady est un espace 100 %% femmes : séance impossible avec un adhérent homme'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists sessions_guard_lady on sessions;
create trigger sessions_guard_lady before insert or update of coach_id, client_id on sessions
  for each row execute function public.guard_lady_session();

-- ---------- 3. Pointage des coachs ----------
-- Écrit UNIQUEMENT par le serveur (clé service) après vérification du code de la borne :
-- aucune politique d'insertion pour les comptes, un coach ne peut donc pas pointer « à distance ».
create table if not exists coach_pointages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  espace      text not null default 'mixte' check (espace in ('mixte', 'lady')),
  kind        text not null check (kind in ('arrivee', 'depart')),
  at          timestamptz not null default now(),
  method      text not null default 'code' check (method in ('qr', 'code')),
  created_at  timestamptz not null default now()
);
create index if not exists coach_pointages_idx on coach_pointages(coach_id, at desc);
create index if not exists coach_pointages_day_idx on coach_pointages(espace, at);

alter table coach_pointages enable row level security;
drop policy if exists "pointages read" on coach_pointages;
create policy "pointages read" on coach_pointages for select
  using (public.is_manager() or (public.is_staff() and coach_id = auth.uid()));
drop policy if exists "pointages delete" on coach_pointages;
create policy "pointages delete" on coach_pointages for delete using (public.is_admin());

-- ---------- 4. Confirmation et avis des clientes ----------
-- La cliente confirme que la séance a eu lieu (ou non) et peut laisser une note.
-- Lu par la direction et par la cliente elle-même ; JAMAIS par les coachs.
create table if not exists session_feedback (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null unique references sessions(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  coach_id    uuid not null references profiles(id) on delete cascade,
  happened    boolean not null,
  rating      smallint check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now()
);
create index if not exists session_feedback_coach_idx on session_feedback(coach_id, created_at desc);

alter table session_feedback enable row level security;
drop policy if exists "feedback read" on session_feedback;
create policy "feedback read" on session_feedback for select
  using (
    public.is_manager()
    or exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid())
  );
drop policy if exists "feedback client insert" on session_feedback;
create policy "feedback client insert" on session_feedback for insert
  with check (
    exists (
      select 1 from sessions s join clients c on c.id = s.client_id
      where s.id = session_id
        and s.client_id = session_feedback.client_id
        and s.coach_id = session_feedback.coach_id
        and s.status::text = 'realisee'
        and c.user_id = auth.uid()
    )
  );
drop policy if exists "feedback delete" on session_feedback;
create policy "feedback delete" on session_feedback for delete using (public.is_admin());

-- ---------- Vérification ----------
-- select tgname from pg_trigger where tgname in ('profiles_guard_espace','clients_guard_lady','sessions_guard_lady');
-- select policyname, cmd from pg_policies where tablename in ('coach_pointages','session_feedback') order by 1;
