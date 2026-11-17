-- =============================================================
-- Moov'Up Coach — schéma de base de données (Supabase / Postgres)
-- À exécuter une fois dans Supabase > SQL Editor > New query.
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- Types ----------
do $$ begin
  create type user_role as enum ('admin', 'coach', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('actif', 'pause', 'termine');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('planifiee', 'realisee', 'absent', 'annulee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type check_kind as enum ('initial', 'mensuel', 'hebdo');
exception when duplicate_object then null; end $$;

-- ---------- Profils (1 par compte) ----------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        user_role not null default 'client',
  created_at  timestamptz not null default now()
);

-- ---------- Clients ----------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete restrict,
  user_id     uuid unique references profiles(id) on delete set null, -- compte du client (portail)
  full_name   text not null,
  email       text,
  phone       text,
  birth_date  date,
  sex         text check (sex in ('H', 'F')),
  height_cm   numeric(5,1),
  goal        text,
  frequency   text,
  status      client_status not null default 'actif',
  start_date  date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists clients_coach_idx on clients(coach_id);
create index if not exists clients_email_idx on clients(lower(email));

-- ---------- Séances ----------
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  coach_id    uuid not null references profiles(id) on delete restrict,
  starts_at   timestamptz not null,
  duration_min int not null default 60,
  type        text not null,
  status      session_status not null default 'planifiee',
  rpe         int check (rpe between 1 and 10),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_client_idx on sessions(client_id, starts_at desc);
create index if not exists sessions_coach_idx on sessions(coach_id, starts_at);

create table if not exists session_exercises (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  position    int not null default 0,
  name        text not null,
  sets        int,
  reps        text,
  load_kg     numeric(6,2),
  rpe         int check (rpe between 1 and 10)
);
create index if not exists session_ex_idx on session_exercises(session_id, position);

-- ---------- Mesures & performances ----------
create table if not exists measurements (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  measured_on  date not null default current_date,
  weight_kg    numeric(5,1),
  body_fat     numeric(4,1),
  muscle_kg    numeric(5,1),
  waist_cm     numeric(5,1),
  hips_cm      numeric(5,1),
  chest_cm     numeric(5,1),
  arm_cm       numeric(4,1),
  thigh_cm     numeric(4,1),
  squat_kg     numeric(6,2),
  bench_kg     numeric(6,2),
  deadlift_kg  numeric(6,2),
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists measurements_idx on measurements(client_id, measured_on);

-- ---------- Bilans de santé ----------
create table if not exists health_checks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  created_by   uuid references profiles(id) on delete set null default auth.uid(),
  kind         check_kind not null default 'mensuel',
  checked_on   date not null default current_date,
  systolic     int,
  diastolic    int,
  resting_hr   int,
  sleep        int check (sleep between 1 and 10),
  energy       int check (energy between 1 and 10),
  stress       int check (stress between 1 and 10),
  motivation   int check (motivation between 1 and 10),
  nutrition    int check (nutrition between 1 and 10),
  recovery     int check (recovery between 1 and 10),
  pain_zones   text[] not null default '{}',
  conditions   text,
  medications  text,
  injuries     text,
  parq_positive boolean,
  notes        text,
  consent      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists health_idx on health_checks(client_id, checked_on);

-- =============================================================
-- Fonctions d'aide (SECURITY DEFINER pour éviter la récursion RLS)
-- =============================================================
create or replace function public.my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','coach') from profiles where id = auth.uid()), false)
$$;

-- Le coach du client, un admin, ou le client lui-même
create or replace function public.can_see_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from clients c
    where c.id = cid and (c.coach_id = auth.uid() or c.user_id = auth.uid())
  )
$$;

-- Le coach du client ou un admin
create or replace function public.can_manage_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from clients c where c.id = cid and c.coach_id = auth.uid() and public.is_staff()
  )
$$;

-- =============================================================
-- Création automatique du profil + liaison du compte client
-- Le premier compte créé devient admin. Les autres sont "client" ;
-- l'admin promeut les coachs depuis la page Équipe.
-- =============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from profiles) into first_user;
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    case when first_user then 'admin'::user_role else 'client'::user_role end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lie le compte au dossier client seulement quand l'e-mail est confirmé
create or replace function public.link_client_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    update clients set user_id = new.id
    where user_id is null and lower(email) = lower(new.email)
      and not exists (select 1 from profiles p where p.id = new.id and p.role <> 'client');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_client_account();

-- Quand un coach ajoute un client dont le compte existe déjà, on lie tout de suite
create or replace function public.link_existing_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    select u.id into new.user_id
    from auth.users u join profiles p on p.id = u.id
    where lower(u.email) = lower(new.email)
      and u.email_confirmed_at is not null and p.role = 'client'
      and not exists (select 1 from clients c where c.user_id = u.id)
    limit 1;
  end if;
  return new;
end $$;

drop trigger if exists clients_link_account on clients;
create trigger clients_link_account
  before insert on clients
  for each row execute function public.link_existing_account();

-- Empêche un utilisateur de changer lui-même son rôle
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Seul un admin peut changer un rôle';
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role
  before update on profiles
  for each row execute function public.protect_role();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table profiles          enable row level security;
alter table clients           enable row level security;
alter table sessions          enable row level security;
alter table session_exercises enable row level security;
alter table measurements      enable row level security;
alter table health_checks     enable row level security;

-- profiles
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select
  using (id = auth.uid() or public.is_staff());
drop policy if exists "profiles update self" on profiles;
create policy "profiles update self" on profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- clients
drop policy if exists "clients read" on clients;
create policy "clients read" on clients for select
  using (public.is_admin() or coach_id = auth.uid() or user_id = auth.uid());
drop policy if exists "clients insert" on clients;
create policy "clients insert" on clients for insert
  with check (public.is_staff() and (coach_id = auth.uid() or public.is_admin()));
drop policy if exists "clients update" on clients;
create policy "clients update" on clients for update
  using (public.is_admin() or (public.is_staff() and coach_id = auth.uid()))
  with check (public.is_admin() or (public.is_staff() and coach_id = auth.uid()));
drop policy if exists "clients delete" on clients;
create policy "clients delete" on clients for delete
  using (public.is_admin() or (public.is_staff() and coach_id = auth.uid()));

-- sessions
drop policy if exists "sessions read" on sessions;
create policy "sessions read" on sessions for select using (public.can_see_client(client_id));
drop policy if exists "sessions write" on sessions;
create policy "sessions write" on sessions for all
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

-- session_exercises
drop policy if exists "exercises read" on session_exercises;
create policy "exercises read" on session_exercises for select
  using (exists (select 1 from sessions s where s.id = session_id and public.can_see_client(s.client_id)));
drop policy if exists "exercises write" on session_exercises;
create policy "exercises write" on session_exercises for all
  using (exists (select 1 from sessions s where s.id = session_id and public.can_manage_client(s.client_id)))
  with check (exists (select 1 from sessions s where s.id = session_id and public.can_manage_client(s.client_id)));

-- measurements
drop policy if exists "measurements read" on measurements;
create policy "measurements read" on measurements for select using (public.can_see_client(client_id));
drop policy if exists "measurements write" on measurements;
create policy "measurements write" on measurements for all
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

-- health_checks : le coach gère tout ; le client peut ajouter ses check-ins hebdo
drop policy if exists "health read" on health_checks;
create policy "health read" on health_checks for select using (public.can_see_client(client_id));
drop policy if exists "health staff write" on health_checks;
create policy "health staff write" on health_checks for all
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));
drop policy if exists "health client checkin" on health_checks;
create policy "health client checkin" on health_checks for insert
  with check (
    kind = 'hebdo'
    and created_by = auth.uid()
    and exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid())
  );

-- =============================================================
-- PHASES 1 à 3 : modules complémentaires
-- =============================================================

-- ---------- Paramètres (marque blanche, contact, réservation) ----------
create table if not exists settings (
  id              int primary key default 1 check (id = 1),
  brand_name      text not null default 'Complexe Moov''Up Sports',
  app_name        text not null default 'Moov''Up Coach',
  primary_color   text not null default '#1a6d8e',
  accent_color    text not null default '#e8782a',
  logo_url        text,
  phone           text,
  whatsapp        text,
  email           text,
  address         text default 'Agadir, Maroc',
  ice             text,
  invoice_footer  text,
  booking_enabled boolean not null default true,
  booking_types   text[] not null default '{"Séance découverte","Bilan initial","Coaching individuel"}',
  booking_hours   jsonb not null default '{"start":"08:00","end":"20:00","days":[1,2,3,4,5,6],"slot":60}',
  calendar_token  text not null default encode(gen_random_bytes(12), 'hex'),
  webhook_url     text,
  updated_at      timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

-- ---------- Évaluations personnalisées ----------
create table if not exists assessment_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text,
  fields      jsonb not null default '[]',
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists assessments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  template_id   uuid references assessment_templates(id) on delete set null,
  template_name text not null,
  fields        jsonb not null default '[]',
  answers       jsonb not null default '{}',
  score         numeric,
  notes         text,
  done_on       date not null default current_date,
  created_by    uuid references profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists assessments_idx on assessments(client_id, done_on);

-- ---------- Objectifs ----------
create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  title         text not null,
  metric        text not null default 'custom',
  unit          text,
  start_value   numeric,
  target_value  numeric,
  current_value numeric,
  due_date      date,
  status        text not null default 'en_cours' check (status in ('en_cours','atteint','abandonne')),
  created_at    timestamptz not null default now()
);
create index if not exists goals_idx on goals(client_id);

-- ---------- Documents ----------
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  name         text not null,
  category     text not null default 'Autre',
  storage_path text,
  size_bytes   bigint,
  mime         text,
  shared       boolean not null default true,
  created_by   uuid references profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists documents_idx on documents(client_id);

-- ---------- Programmes ----------
create table if not exists programs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  goal        text,
  level       text default 'Intermédiaire',
  weeks       int not null default 4,
  days        jsonb not null default '[]',
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists client_programs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  start_date  date not null default current_date,
  status      text not null default 'actif' check (status in ('actif','termine','pause')),
  created_at  timestamptz not null default now()
);
create index if not exists client_programs_idx on client_programs(client_id);

-- ---------- Tâches ----------
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text,
  client_id   uuid references clients(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null default auth.uid(),
  due_date    date,
  priority    text not null default 'normale' check (priority in ('basse','normale','haute')),
  done        boolean not null default false,
  done_at     timestamptz,
  source      text not null default 'manuel',
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists tasks_idx on tasks(assigned_to, done, due_date);

-- ---------- Messages ----------
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  sender_id   uuid references profiles(id) on delete set null default auth.uid(),
  from_client boolean not null default false,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists messages_idx on messages(client_id, created_at);

-- ---------- Notifications ----------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text,
  link        text,
  kind        text not null default 'info',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_idx on notifications(user_id, read, created_at desc);

-- ---------- Formules, factures et paiements ----------
create table if not exists packages (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  price_mad      numeric(10,2) not null,
  sessions_count int,
  duration_days  int,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  number      text not null unique,
  client_id   uuid not null references clients(id) on delete restrict,
  package_id  uuid references packages(id) on delete set null,
  lines       jsonb not null default '[]',
  amount_mad  numeric(10,2) not null,
  issued_on   date not null default current_date,
  due_on      date,
  status      text not null default 'envoyee' check (status in ('brouillon','envoyee','payee','annulee')),
  paid_on     date,
  method      text,
  notes       text,
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists invoices_idx on invoices(client_id, issued_on desc);

-- ---------- Réservations en ligne ----------
create table if not exists booking_requests (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text not null,
  email       text,
  type        text not null,
  wanted_at   timestamptz not null,
  message     text,
  status      text not null default 'nouvelle' check (status in ('nouvelle','confirmee','refusee')),
  session_id  uuid references sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- Automatisations ----------
create table if not exists automations (
  id          text primary key,
  enabled     boolean not null default true,
  params      jsonb not null default '{}',
  last_run    timestamptz,
  last_count  int
);
insert into automations (id, params) values
  ('checkin_reminder', '{"days":7}'),
  ('health_check_due', '{"days":30}'),
  ('absence_followup', '{"count":2}'),
  ('invoice_overdue',  '{"days":0}'),
  ('goal_reached',     '{}'),
  ('inactive_client',  '{"days":14}')
on conflict do nothing;

-- ---------- RLS des nouveaux modules ----------
alter table settings              enable row level security;
alter table assessment_templates  enable row level security;
alter table assessments           enable row level security;
alter table goals                 enable row level security;
alter table documents             enable row level security;
alter table programs              enable row level security;
alter table client_programs       enable row level security;
alter table tasks                 enable row level security;
alter table messages              enable row level security;
alter table notifications         enable row level security;
alter table packages              enable row level security;
alter table invoices              enable row level security;
alter table booking_requests      enable row level security;
alter table automations           enable row level security;

drop policy if exists "settings read" on settings;
create policy "settings read" on settings for select using (true);
drop policy if exists "settings admin" on settings;
create policy "settings admin" on settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "templates read" on assessment_templates;
create policy "templates read" on assessment_templates for select using (public.is_staff());
drop policy if exists "templates write" on assessment_templates;
create policy "templates write" on assessment_templates for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "assessments read" on assessments;
create policy "assessments read" on assessments for select using (public.can_see_client(client_id));
drop policy if exists "assessments write" on assessments;
create policy "assessments write" on assessments for all using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

drop policy if exists "goals read" on goals;
create policy "goals read" on goals for select using (public.can_see_client(client_id));
drop policy if exists "goals write" on goals;
create policy "goals write" on goals for all using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

drop policy if exists "documents read" on documents;
create policy "documents read" on documents for select
  using (public.can_manage_client(client_id) or (shared and public.can_see_client(client_id)));
drop policy if exists "documents write" on documents;
create policy "documents write" on documents for all using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

drop policy if exists "programs read" on programs;
create policy "programs read" on programs for select
  using (public.is_staff() or exists (select 1 from client_programs cp join clients c on c.id = cp.client_id where cp.program_id = programs.id and c.user_id = auth.uid()));
drop policy if exists "programs write" on programs;
create policy "programs write" on programs for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "client_programs read" on client_programs;
create policy "client_programs read" on client_programs for select using (public.can_see_client(client_id));
drop policy if exists "client_programs write" on client_programs;
create policy "client_programs write" on client_programs for all using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

drop policy if exists "tasks staff" on tasks;
create policy "tasks staff" on tasks for all
  using (public.is_admin() or (public.is_staff() and (assigned_to = auth.uid() or created_by = auth.uid())))
  with check (public.is_staff());

drop policy if exists "messages read" on messages;
create policy "messages read" on messages for select using (public.can_see_client(client_id));
drop policy if exists "messages staff write" on messages;
create policy "messages staff write" on messages for all using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));
drop policy if exists "messages client insert" on messages;
create policy "messages client insert" on messages for insert
  with check (from_client and sender_id = auth.uid() and exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));
drop policy if exists "messages client read mark" on messages;
create policy "messages client read mark" on messages for update
  using (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()))
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));

drop policy if exists "notifications own" on notifications;
create policy "notifications own" on notifications for select using (user_id = auth.uid());
drop policy if exists "notifications update own" on notifications;
create policy "notifications update own" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications insert staff" on notifications;
create policy "notifications insert staff" on notifications for insert with check (
  user_id = auth.uid() or public.is_staff()
  or exists (select 1 from clients c where c.user_id = auth.uid() and c.coach_id = notifications.user_id)
);

drop policy if exists "packages read" on packages;
create policy "packages read" on packages for select using (auth.uid() is not null);
drop policy if exists "packages write" on packages;
create policy "packages write" on packages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "invoices read" on invoices;
create policy "invoices read" on invoices for select using (public.can_see_client(client_id));
drop policy if exists "invoices write" on invoices;
create policy "invoices write" on invoices for all using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

drop policy if exists "booking insert" on booking_requests;
create policy "booking insert" on booking_requests for insert with check (status = 'nouvelle' and session_id is null);
drop policy if exists "booking staff" on booking_requests;
create policy "booking staff" on booking_requests for select using (public.is_staff());
drop policy if exists "booking staff update" on booking_requests;
create policy "booking staff update" on booking_requests for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "automations read" on automations;
create policy "automations read" on automations for select using (public.is_staff());
drop policy if exists "automations write" on automations;
create policy "automations write" on automations for update using (public.is_staff()) with check (public.is_staff());

-- Le calendrier ICS et la page de réservation publique lisent via des fonctions dédiées
create or replace function public.public_settings() returns table (brand_name text, app_name text, primary_color text, accent_color text, logo_url text, phone text, whatsapp text, address text, booking_enabled boolean, booking_types text[], booking_hours jsonb)
language sql stable security definer set search_path = public as $$
  select brand_name, app_name, primary_color, accent_color, logo_url, phone, whatsapp, address, booking_enabled, booking_types, booking_hours from settings where id = 1
$$;

-- Stockage des documents (bucket privé)
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
drop policy if exists "documents storage staff" on storage.objects;
create policy "documents storage staff" on storage.objects for all
  using (bucket_id = 'documents' and public.is_staff())
  with check (bucket_id = 'documents' and public.is_staff());
drop policy if exists "documents storage client" on storage.objects;
create policy "documents storage client" on storage.objects for select
  using (bucket_id = 'documents' and exists (
    select 1 from documents d join clients c on c.id = d.client_id
    where d.storage_path = storage.objects.name and d.shared and c.user_id = auth.uid()));

-- =============================================================
-- MODULES V3 : nutrition, photos, abonnements & accès, paiement en ligne,
-- WhatsApp, défis, cours collectifs, vidéothèque, suivi de séance, parrainage
-- =============================================================

-- Codes personnels des adhérents (QR d'accès + parrainage)
alter table clients add column if not exists access_code text unique default upper(encode(gen_random_bytes(5), 'hex'));
alter table clients add column if not exists referral_code text unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

alter table settings add column if not exists payment_provider text not null default 'stripe';   -- stripe | cmi | aucun
alter table settings add column if not exists referral_reward_mad numeric(10,2) not null default 200;
alter table settings add column if not exists referral_discount_pct int not null default 10;
alter table settings add column if not exists whatsapp_enabled boolean not null default false;

-- ---------- Nutrition ----------
create table if not exists foods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null default 'Autre',
  portion    text,                 -- ex. "1 bol (250 g)"
  grams      numeric not null default 100,  -- poids de la portion
  kcal       numeric not null,     -- pour la portion
  protein    numeric not null default 0,
  carbs      numeric not null default 0,
  fat        numeric not null default 0,
  moroccan   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists meal_plans (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,  -- null = modèle
  name        text not null,
  goal        text,
  target_kcal int,
  protein_g   int,
  carbs_g     int,
  fat_g       int,
  meals       jsonb not null default '[]', -- [{name,time,items:[{food_id?,name,qty,unit?,kcal,protein,carbs,fat}]}]
  notes       text,
  active      boolean not null default true,
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists meal_plans_idx on meal_plans(client_id);

create table if not exists food_logs (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  logged_on date not null default current_date,
  meal      text not null default 'Déjeuner',  -- Petit-déjeuner | Déjeuner | Goûter | Dîner | Collation
  food_name text not null,
  qty       numeric not null default 1,
  kcal      numeric not null default 0,
  protein   numeric not null default 0,
  carbs     numeric not null default 0,
  fat       numeric not null default 0,
  water_ml  int,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_idx on food_logs(client_id, logged_on);

-- ---------- Photos avant / après ----------
create table if not exists progress_photos (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  taken_on     date not null default current_date,
  pose         text not null default 'face' check (pose in ('face','profil','dos')),
  storage_path text,
  url          text,                          -- URL publique/externe (démo)
  weight_kg    numeric(5,1),
  notes        text,
  shared_publicly boolean not null default false,  -- accord pour la communication de la salle
  created_by   uuid references profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists progress_photos_idx on progress_photos(client_id, taken_on);

-- ---------- Abonnements & accès salle ----------
create table if not exists memberships (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  package_id     uuid references packages(id) on delete set null,
  name           text not null,
  start_date     date not null default current_date,
  end_date       date not null,
  sessions_total int,
  sessions_used  int not null default 0,
  price_mad      numeric(10,2),
  status         text not null default 'actif' check (status in ('actif','suspendu','annule')),
  auto_renew     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists memberships_idx on memberships(client_id, end_date);

create table if not exists gym_checkins (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  checked_at  timestamptz not null default now(),
  method      text not null default 'qr' check (method in ('qr','manuel','code')),
  created_by  uuid references profiles(id) on delete set null default auth.uid()
);
create index if not exists gym_checkins_idx on gym_checkins(client_id, checked_at desc);

-- ---------- Paiement en ligne ----------
create table if not exists online_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  provider     text not null check (provider in ('stripe','cmi','demo')),
  provider_ref text,
  amount_mad   numeric(10,2) not null,
  status       text not null default 'en_attente' check (status in ('en_attente','reussi','echoue')),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);

-- ---------- WhatsApp ----------
create table if not exists whatsapp_messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  to_phone   text not null,
  template   text not null,             -- session_reminder | invoice_overdue | checkin_missing | membership_expiring | manuel
  body       text not null,
  status     text not null default 'en_attente' check (status in ('en_attente','envoye','simule','echec')),
  error      text,
  provider_id text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists whatsapp_idx on whatsapp_messages(created_at desc);

insert into automations (id, params, enabled) values
  ('wa_session_reminder', '{"hours":24}', false),
  ('wa_invoice_overdue', '{"days":3}', false),
  ('wa_checkin_missing', '{"days":7}', false),
  ('membership_expiring', '{"days":7}', true)
on conflict do nothing;

-- ---------- Défis & badges ----------
create table if not exists challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  metric      text not null default 'presences',  -- presences | squat_kg | pas | custom
  unit        text,
  goal_value  numeric,
  start_date  date not null,
  end_date    date not null,
  reward      text,
  cover       text,                                -- couleur/emoji
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists challenge_entries (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  value        numeric not null default 0,
  updated_at   timestamptz not null default now(),
  unique (challenge_id, client_id)
);

create table if not exists badges (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  code      text not null,
  label     text not null,
  earned_on date not null default current_date,
  unique (client_id, code)
);

-- ---------- Cours collectifs ----------
create table if not exists group_classes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'HIIT',   -- CrossFit | HIIT | Yoga | Pilates | Cardio | Renforcement
  coach_id     uuid references profiles(id) on delete set null,
  starts_at    timestamptz not null,
  duration_min int not null default 60,
  capacity     int not null default 12,
  room         text,
  level        text default 'Tous niveaux',
  description  text,
  cancelled    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists group_classes_idx on group_classes(starts_at);

create table if not exists class_bookings (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references group_classes(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  status     text not null default 'inscrit' check (status in ('inscrit','attente','annule','present','absent')),
  created_at timestamptz not null default now(),
  unique (class_id, client_id)
);

-- ---------- Vidéothèque d'exercices ----------
create table if not exists exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  category     text not null default 'Musculation',
  muscles      text[] not null default '{}',
  equipment    text,
  level        text default 'Tous niveaux',
  video_url    text,          -- YouTube, Vimeo ou fichier mp4
  instructions text,
  tips         text,
  created_at   timestamptz not null default now()
);

-- ---------- Suivi pendant la séance ----------
create table if not exists workout_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  program_id  uuid references programs(id) on delete set null,
  day_title   text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  entries     jsonb not null default '[]',  -- [{exercise, sets:[{reps, load, done}]}]
  rpe         int check (rpe between 1 and 10),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists workout_logs_idx on workout_logs(client_id, started_at desc);

-- ---------- Parrainage ----------
create table if not exists referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_client_id uuid not null references clients(id) on delete cascade,
  referred_name      text not null,
  referred_phone     text,
  referred_client_id uuid references clients(id) on delete set null,
  status             text not null default 'en_attente' check (status in ('en_attente','inscrit','recompense')),
  reward_mad         numeric(10,2),
  created_at         timestamptz not null default now()
);

-- ---------- RLS V3 ----------
alter table foods             enable row level security;
alter table meal_plans        enable row level security;
alter table food_logs         enable row level security;
alter table progress_photos   enable row level security;
alter table memberships       enable row level security;
alter table gym_checkins      enable row level security;
alter table online_payments   enable row level security;
alter table whatsapp_messages enable row level security;
alter table challenges        enable row level security;
alter table challenge_entries enable row level security;
alter table badges            enable row level security;
alter table group_classes     enable row level security;
alter table class_bookings    enable row level security;
alter table exercises         enable row level security;
alter table workout_logs      enable row level security;
alter table referrals         enable row level security;

-- Bibliothèques lisibles par tous les comptes connectés, gérées par le staff
drop policy if exists "foods read" on foods;
create policy "foods read" on foods for select using (auth.uid() is not null);
drop policy if exists "foods write" on foods;
create policy "foods write" on foods for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "exercises read" on exercises;
create policy "exercises read" on exercises for select using (auth.uid() is not null);
drop policy if exists "exercises write" on exercises;
create policy "exercises write" on exercises for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "classes read" on group_classes;
create policy "classes read" on group_classes for select using (auth.uid() is not null);
drop policy if exists "classes write" on group_classes;
create policy "classes write" on group_classes for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "challenges read" on challenges;
create policy "challenges read" on challenges for select using (auth.uid() is not null);
drop policy if exists "challenges write" on challenges;
create policy "challenges write" on challenges for all using (public.is_staff()) with check (public.is_staff());

-- Classement : tous les adhérents voient les scores (prénom affiché côté app)
drop policy if exists "entries read" on challenge_entries;
create policy "entries read" on challenge_entries for select using (auth.uid() is not null);
drop policy if exists "entries staff" on challenge_entries;
create policy "entries staff" on challenge_entries for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "entries self" on challenge_entries;
create policy "entries self" on challenge_entries for all
  using (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()))
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));

-- Données propres à un client : lecture coach/admin/client, écriture coach/admin
do $$
declare t text;
begin
  foreach t in array array['meal_plans','progress_photos','memberships','gym_checkins','online_payments','badges','workout_logs','food_logs','class_bookings'] loop
    execute format('drop policy if exists "%1$s read" on %1$s', t);
    execute format('create policy "%1$s read" on %1$s for select using (client_id is null or public.can_see_client(client_id))', t);
    execute format('drop policy if exists "%1$s staff" on %1$s', t);
    execute format('create policy "%1$s staff" on %1$s for all using (client_id is null and public.is_staff() or public.can_manage_client(client_id)) with check (client_id is null and public.is_staff() or public.can_manage_client(client_id))', t);
  end loop;
end $$;

-- Ce que l'adhérent peut écrire lui-même
do $$
declare t text;
begin
  foreach t in array array['food_logs','workout_logs','progress_photos','class_bookings','referrals'] loop
    execute format('drop policy if exists "%1$s self" on %1$s', t);
  end loop;
end $$;
create policy "food_logs self" on food_logs for all
  using (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()))
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));
create policy "workout_logs self" on workout_logs for all
  using (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()))
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));
create policy "progress_photos self" on progress_photos for insert
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));
create policy "class_bookings self" on class_bookings for all
  using (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()))
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));
create policy "referrals self" on referrals for insert
  with check (status = 'en_attente' and exists (select 1 from clients c where c.id = referrer_client_id and c.user_id = auth.uid()));
drop policy if exists "referrals read" on referrals;
create policy "referrals read" on referrals for select using (public.can_see_client(referrer_client_id));
drop policy if exists "referrals staff" on referrals;
create policy "referrals staff" on referrals for all using (public.is_staff()) with check (public.is_staff());

-- WhatsApp : staff uniquement
drop policy if exists "whatsapp staff" on whatsapp_messages;
create policy "whatsapp staff" on whatsapp_messages for all using (public.is_staff()) with check (public.is_staff());

-- Photos dans le stockage (bucket privé)
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;
drop policy if exists "photos storage staff" on storage.objects;
create policy "photos storage staff" on storage.objects for all
  using (bucket_id = 'photos' and public.is_staff()) with check (bucket_id = 'photos' and public.is_staff());
drop policy if exists "photos storage client" on storage.objects;
create policy "photos storage client" on storage.objects for all
  using (bucket_id = 'photos' and exists (select 1 from clients c where c.user_id = auth.uid() and storage.objects.name like c.id::text || '/%'))
  with check (bucket_id = 'photos' and exists (select 1 from clients c where c.user_id = auth.uid() and storage.objects.name like c.id::text || '/%'));

-- ---------- Ajustements V3 (accès en production) ----------
-- Les adhérents voient le taux de remplissage des cours (pas de données personnelles dans cette table)
drop policy if exists "class_bookings read all" on class_bookings;
create policy "class_bookings read all" on class_bookings for select using (auth.uid() is not null);

-- Les badges gagnés sont enregistrés depuis l'espace adhérent
drop policy if exists "badges self" on badges;
create policy "badges self" on badges for insert
  with check (exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));

-- Prénom + initiale des participants (classements) sans exposer les fiches clients
create or replace function public.member_short_names(ids uuid[]) returns table (id uuid, short_name text)
language sql stable security definer set search_path = public as $$
  select c.id, split_part(c.full_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(c.full_name, ' ', 2), ''), 1) || '.', '')
  from clients c where c.id = any(ids) and auth.uid() is not null
$$;

alter table challenges add column if not exists announced_at timestamptz;

-- Les adhérents peuvent supprimer les photos qu'ils ont eux-mêmes ajoutées
drop policy if exists "progress_photos self delete" on progress_photos;
create policy "progress_photos self delete" on progress_photos for delete
  using (created_by = auth.uid() and exists (select 1 from clients c where c.id = client_id and c.user_id = auth.uid()));
