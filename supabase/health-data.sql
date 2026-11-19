-- =============================================================
-- Santé connectée : données des montres (Apple Santé, Health Connect, Samsung Health)
-- et saisies manuelles. Une ligne = une valeur par jour, par métrique et par source.
--
-- ORDRE D'EXÉCUTION :
--   schema.sql → v5-roles.sql → v5-planning.sql → v5-planning-2.sql → v5-bilan.sql
--   → health-data.sql (CE FICHIER) → reclamations.sql → v5-securite.sql (toujours en dernier)
-- Utilise can_see_client (référence : v5-securite.sql).
-- =============================================================

create table if not exists public.health_samples (
  id uuid primary key,                -- identifiant stable calculé par l'application (client|jour|métrique|source)
  client_id uuid not null references public.clients(id) on delete cascade,
  day date not null,                  -- jour local ; sommeil = jour du réveil
  metric text not null check (metric in ('sleep','steps','hr_resting','hr_avg','active_kcal','vo2max','weight')),
  value numeric not null,             -- sleep en minutes, steps en pas, hr en bpm, kcal, mL/kg/min, kg
  unit text not null,
  source text not null check (source in ('apple_health','health_connect','samsung_health','manuel')),
  details jsonb,                      -- phases de sommeil {deep, light, rem, awake, in_bed, bed, wake}, FC {min, max}
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, day, metric, source)
);

create index if not exists health_samples_client_day on public.health_samples (client_id, metric, day desc);
create index if not exists health_samples_client_created on public.health_samples (client_id, created_at desc);

alter table public.health_samples enable row level security;

-- Lecture et écriture : le coach du client, un admin, ou l'adhérent lui-même
drop policy if exists "health_samples read" on public.health_samples;
create policy "health_samples read" on public.health_samples for select using (public.can_see_client(client_id));
drop policy if exists "health_samples write" on public.health_samples;
create policy "health_samples write" on public.health_samples for all
  using (public.can_see_client(client_id))
  with check (public.can_see_client(client_id));

-- =============================================================
-- Jetons personnels pour l'application mobile (POST /api/health/sync)
-- Seule l'empreinte SHA-256 du jeton est stockée. L'API lit cette table avec la clé service-role.
-- =============================================================
create table if not exists public.health_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists health_tokens_client on public.health_tokens (client_id);

alter table public.health_tokens enable row level security;

drop policy if exists "health_tokens read" on public.health_tokens;
create policy "health_tokens read" on public.health_tokens for select using (public.can_see_client(client_id));
drop policy if exists "health_tokens insert" on public.health_tokens;
create policy "health_tokens insert" on public.health_tokens for insert
  with check (public.can_see_client(client_id) and created_by = auth.uid());
drop policy if exists "health_tokens delete" on public.health_tokens;
create policy "health_tokens delete" on public.health_tokens for delete using (public.can_see_client(client_id));
