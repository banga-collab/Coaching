-- Réclamations envoyées via le QR code de la salle (page publique /signaler)
-- À exécuter une fois dans Supabase › SQL Editor. L'envoi public passe par SUPABASE_SERVICE_ROLE_KEY côté serveur.
create table if not exists public.reclamations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('panne', 'proprete', 'securite', 'service', 'autre')),
  location text,
  description text not null,
  contact_name text,
  contact_phone text,
  photo text, -- image compressée (data URL JPEG, < 700 Ko)
  status text not null default 'nouvelle' check (status in ('nouvelle', 'en_cours', 'resolue')),
  task_id uuid references public.tasks(id) on delete set null,
  resolved_at timestamptz
);
create index if not exists reclamations_created_idx on public.reclamations (created_at desc);

alter table public.reclamations enable row level security;

-- L'équipe (admin, coach) lit et met à jour ; personne d'autre.
drop policy if exists "reclamations staff" on public.reclamations;
create policy "reclamations staff" on public.reclamations for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')));

-- Secours si la clé service n'est pas configurée : les visiteurs peuvent seulement créer une réclamation.
drop policy if exists "reclamations public insert" on public.reclamations;
create policy "reclamations public insert" on public.reclamations for insert to anon with check (status = 'nouvelle');
