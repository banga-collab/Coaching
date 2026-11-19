-- =============================================================
-- Moov'Up Coach · V5 · Planning de l'équipe
-- Disponibilités des coachs, congés, cycle des séances
-- (affectation → acceptation / refus / report → démarrée → terminée).
--
-- ORDRE D'EXÉCUTION :
--   schema.sql → v5-roles.sql → v5-planning.sql (CE FICHIER) → v5-planning-2.sql → v5-bilan.sql
--   → health-data.sql → reclamations.sql → v5-securite.sql (toujours en dernier)
-- Dépend des fonctions is_staff() / is_manager() de v5-roles.sql (référence : v5-securite.sql).
--
-- Script idempotent : peut être relancé sans risque.
--
-- ⚠ ALTER TYPE ... ADD VALUE : si votre éditeur SQL exécute tout dans une
--   seule transaction et signale « unsafe use of new value », exécutez d'abord
--   la section 1 seule, puis le reste du script.
-- =============================================================

-- ---------- 1. Nouveaux statuts de séance et rôle head coach ----------
alter type session_status add value if not exists 'acceptee';
alter type session_status add value if not exists 'refusee';
alter type session_status add value if not exists 'reportee';
alter type session_status add value if not exists 'en_cours';
alter type user_role add value if not exists 'head_coach';

-- ---------- 2. Nouvelles colonnes des séances ----------
alter table sessions add column if not exists assigned_by   uuid references profiles(id) on delete set null;
alter table sessions add column if not exists responded_at  timestamptz;
alter table sessions add column if not exists response_note text;
alter table sessions add column if not exists proposed_at   timestamptz;
alter table sessions add column if not exists started_at    timestamptz;
alter table sessions add column if not exists ended_at      timestamptz;
create index if not exists sessions_status_idx on sessions(status, starts_at);
create index if not exists sessions_assigned_idx on sessions(assigned_by);

-- ---------- 3. Disponibilités hebdomadaires ----------
create table if not exists coach_availability (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),   -- 1 = lundi … 7 = dimanche
  start_time  text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),  -- 'HH:MM' (Agadir)
  end_time    text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists coach_availability_idx on coach_availability(coach_id, weekday);

-- ---------- 4. Congés ----------
create table if not exists coach_time_off (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists coach_time_off_idx on coach_time_off(coach_id, starts_on, ends_on);

-- ---------- 5. Fonctions d'aide ----------
-- is_staff(), is_manager(), can_see_client(), can_manage_client(), coach_has_session_with() :
-- définitions uniques dans v5-roles.sql / v5-securite.sql (les anciens doublons d'ici ignoraient
-- les comptes désactivés et ont été retirés).

-- ---------- 6. RLS ----------
alter table coach_availability enable row level security;
alter table coach_time_off     enable row level security;

-- Disponibilités : tout le personnel lit ; chaque coach gère les siennes ; les managers gèrent tout
drop policy if exists "availability read" on coach_availability;
create policy "availability read" on coach_availability for select using (public.is_staff());
drop policy if exists "availability write" on coach_availability;
create policy "availability write" on coach_availability for all
  using (public.is_manager() or (public.is_staff() and coach_id = auth.uid()))
  with check (public.is_manager() or (public.is_staff() and coach_id = auth.uid()));

drop policy if exists "time off read" on coach_time_off;
create policy "time off read" on coach_time_off for select using (public.is_staff());
drop policy if exists "time off write" on coach_time_off;
create policy "time off write" on coach_time_off for all
  using (public.is_manager() or (public.is_staff() and coach_id = auth.uid()))
  with check (public.is_manager() or (public.is_staff() and coach_id = auth.uid()));

-- Séances, exercices de séance et lecture des clients : politiques définies dans v5-securite.sql
-- (managers : tout ; coach : création seulement pour ses clients, mise à jour de ses propres séances).
-- Anciennes politiques retirées : « sessions own coach » (FOR ALL) laissait un coach créer une séance
-- pour n'importe quel client et obtenir ainsi l'accès à son dossier.
drop policy if exists "sessions own coach" on sessions;
drop policy if exists "exercises planning" on session_exercises;
drop policy if exists "clients read planning" on clients;

-- Profils : le personnel voit déjà tous les profils (« profiles read » utilise is_staff)

-- =============================================================
-- Types de séance (liste gérée : Séances → Types de séance)
-- =============================================================
create table if not exists session_types (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  duration_min int,
  color        text,
  active       boolean not null default true,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create unique index if not exists session_types_name_idx on session_types (lower(name));
alter table session_types enable row level security;
drop policy if exists "session_types read" on session_types;
create policy "session_types read" on session_types for select using (public.is_staff());
-- Tout le personnel peut ajouter un type depuis un formulaire ; seuls admin / head coach modifient ou suppriment
drop policy if exists "session_types insert" on session_types;
create policy "session_types insert" on session_types for insert with check (public.is_staff());
drop policy if exists "session_types manage" on session_types;
create policy "session_types manage" on session_types for update using (public.is_manager()) with check (public.is_manager());
drop policy if exists "session_types delete" on session_types;
create policy "session_types delete" on session_types for delete using (public.is_manager());
