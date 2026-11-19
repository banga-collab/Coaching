-- =============================================================
-- V5 : Bilan sportif & médical d'entrée (table sport_assessments)
--
-- ORDRE D'EXÉCUTION :
--   schema.sql → v5-roles.sql → v5-planning.sql → v5-planning-2.sql → v5-bilan.sql (CE FICHIER)
--   → health-data.sql → reclamations.sql → v5-securite.sql (toujours en dernier)
-- Dépend de is_staff(), is_manager(), can_see_client(), can_manage_client() (v5-roles.sql ;
-- référence : v5-securite.sql). Script idempotent (peut être relancé).
-- Colonnes explicites pour les signaux clés (filtres, tableaux de bord)
-- + réponses complètes dans `answers` (jsonb, format BilanAnswers de src/lib/types-bilan.ts).
-- Accès :
--   lecture        : tout le personnel (données médicales visibles par toute l'équipe) ; l'adhérent, les siens ;
--   création       : coach référent, manager, ou coach ayant une séance avec le client (can_see_client) ;
--                    l'adhérent peut déposer le sien (statut « a_valider ») ;
--   modification   : coach référent, auteur du bilan ou manager (admin / head coach) ;
--   suppression    : managers uniquement.
-- =============================================================

create table if not exists public.sport_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  done_on date not null default current_date,
  status text not null default 'valide' check (status in ('valide', 'a_valider')),
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  risk_level text not null default 'vert' check (risk_level in ('vert', 'orange', 'rouge')),
  risk_flags text[] not null default '{}',
  parq_positive boolean not null default false,
  surgery boolean not null default false,
  surgery_recent boolean not null default false,
  diabetes text not null default 'non' check (diabetes in ('non', 'type1', 'type2', 'prediabete')),
  smoker text not null default 'non' check (smoker in ('non', 'ancien', 'occasionnel', 'regulier')),
  alcohol text not null default 'non' check (alcohol in ('non', 'occasionnel', 'regulier')),
  hypertension boolean not null default false,
  cardiac boolean not null default false,
  pregnant boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Colonnes ajoutées après coup (si une première version de la table existe déjà)
alter table public.sport_assessments add column if not exists surgery_recent boolean not null default false;
alter table public.sport_assessments add column if not exists pregnant boolean not null default false;
alter table public.sport_assessments add column if not exists updated_at timestamptz not null default now();

create index if not exists sport_assessments_client on public.sport_assessments (client_id, done_on desc);
create index if not exists sport_assessments_risk on public.sport_assessments (risk_level);
create index if not exists sport_assessments_pending on public.sport_assessments (status) where status = 'a_valider';

-- Ancien doublon conservé pour compatibilité : appelle la fonction canonique is_staff().
create or replace function public.bilan_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
$$;

-- L'adhérent connecté est-il le titulaire de ce dossier client ?
create or replace function public.bilan_is_own_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients c where c.id = cid and c.user_id = auth.uid())
$$;

alter table public.sport_assessments enable row level security;

drop policy if exists "sport_assessments read" on public.sport_assessments;
create policy "sport_assessments read" on public.sport_assessments for select
  using (public.is_staff() or public.bilan_is_own_client(client_id));

drop policy if exists "sport_assessments staff insert" on public.sport_assessments;
create policy "sport_assessments staff insert" on public.sport_assessments for insert
  with check (public.is_staff() and public.can_see_client(client_id) and created_by = auth.uid());

-- L'adhérent dépose son propre questionnaire, forcément « à valider »
drop policy if exists "sport_assessments member insert" on public.sport_assessments;
create policy "sport_assessments member insert" on public.sport_assessments for insert
  with check (
    public.bilan_is_own_client(client_id)
    and status = 'a_valider'
    and created_by = auth.uid()
    and validated_by is null
  );

-- Modification / validation : coach référent, auteur du bilan ou manager
drop policy if exists "sport_assessments staff update" on public.sport_assessments;
create policy "sport_assessments staff update" on public.sport_assessments for update
  using (public.is_staff() and (public.can_manage_client(client_id) or created_by = auth.uid()))
  with check (public.is_staff() and (public.can_manage_client(client_id) or created_by = auth.uid()));

-- Suppression : managers (admin / head coach) uniquement
drop policy if exists "sport_assessments staff delete" on public.sport_assessments;
create policy "sport_assessments staff delete" on public.sport_assessments for delete
  using (public.is_manager());

-- Les noms des auteurs (historique) viennent de profiles, déjà lisibles par le personnel.
