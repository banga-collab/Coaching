-- =====================================================================
-- Moov'Up Coach — V5 planning (2) : prix INDICATIF des séances, index du planning
-- Idempotent. Ordre d'exécution :
--   schema → v5-roles → v5-planning → v5-planning-2 → v5-bilan → health-data → reclamations → v5-securite
-- Ce fichier ne crée AUCUNE politique RLS et ne redéfinit aucune fonction d'aide
-- (is_staff, is_manager, can_see_client… sont dans v5-securite.sql).
-- =====================================================================

-- 1. Prix indicatif par défaut d'un type de séance (DH). Information seulement : aucun paiement.
alter table if exists session_types add column if not exists price_mad numeric(10,2);
do $$ begin
  alter table session_types add constraint session_types_price_positive check (price_mad is null or price_mad >= 0);
exception when duplicate_object or undefined_table then null; end $$;

-- 2. Prix indicatif d'une séance (pré-rempli depuis le type, modifiable). Information seulement.
alter table if exists sessions add column if not exists price_mad numeric(10,2);
do $$ begin
  alter table sessions add constraint sessions_price_positive check (price_mad is null or price_mad >= 0);
exception when duplicate_object or undefined_table then null; end $$;

-- Valeurs par défaut des types existants (seulement si aucun prix n'est encore saisi)
update session_types set price_mad = case
    when name ilike '%duo%' then 400
    when name ilike '%bilan%' or name ilike '%évaluation%' or name ilike '%evaluation%' or name ilike '%découverte%' then 200
    when name ilike '%préparation%' then 350
    when name ilike '%mobilit%' or name ilike '%renforcement%' or name ilike '%pilates%' or name ilike '%cardio%' or name ilike '%circuit%' then 250
    when name ilike '%stretching%' then 150
    else 300
  end
where price_mad is null;

-- 3. Index utilisés par le contrôle des créneaux
--    (horaires proposés « réservés », cours collectifs d'un coach, demandes en ligne en attente)
create index if not exists sessions_proposed_idx on sessions (coach_id, proposed_at) where status = 'reportee';
create index if not exists sessions_coach_start_idx on sessions (coach_id, starts_at);
create index if not exists group_classes_coach_idx on group_classes (coach_id, starts_at) where cancelled = false;
create index if not exists booking_requests_pending_idx on booking_requests (wanted_at) where status = 'nouvelle';
