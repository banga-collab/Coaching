# Moov'Up Coach

CRM de coaching du Complexe Moov'Up Sports (Agadir) : clients, séances, progression, bilans de santé, programmes, facturation, messagerie, espace adhérent, réservation en ligne et assistant IA.

## Modules

| Phase | Modules |
|---|---|
| **1 · CRM essentiel** | Tableau de bord · Base clients · Fiches clients · Évaluations personnalisables · Séances · Objectifs & progression · Espace adhérent · Documents & rapports · Comptes et permissions |
| **2 · Gestion** | Programmes · Tâches & check-ins · Messages & notifications · Factures, formules & paiements · Équipe · Analytique · Exports CSV |
| **3 · Plateforme** | Assistant IA (Claude) · WhatsApp · Automatisations · Réservation en ligne · Marque blanche · Intégrations (agenda, import CSV, webhook) · Application installable (PWA) |
| **4 · Fidélisation** | Nutrition (plats marocains, macros, journal, courses) · Photos avant/après · Abonnements & accès QR · Paiement en ligne (CMI / Stripe) · Rappels WhatsApp automatiques · Défis & badges · Cours collectifs · Vidéothèque · Suivi de séance en direct · Parrainage |

## Voir la démo (sans base de données)

```bash
npm run dev:demo
```

Ouvre http://localhost:3000 : des clients, séances, factures, messages… fictifs sont chargés. Connecte-toi avec un compte de démonstration (affichés sur la page de connexion) : admin@moovup.ma / moovup2026, sara@moovup.ma / coach2026 ou karim@example.com / adherent2026. Les modifications ne sont pas sauvegardées.

## Mise en route (une seule fois)

1. Crée un projet sur [supabase.com](https://supabase.com) (région Europe).
2. **SQL Editor → New query** : colle tout le fichier `supabase/schema.sql`, puis clique sur **Run**.
3. **Authentication → URL Configuration** : mets `http://localhost:3000` dans *Site URL* (puis l'adresse finale quand l'app sera en ligne).
4. Copie `.env.local.example` en `.env.local` et remplis les valeurs (voir ci-dessous).
5. Lance l'application :

```bash
npm run dev
```

6. Ouvre http://localhost:3000, clique sur **Créer un compte** : le **premier compte devient administrateur**.

### Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | Clé publique `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | non | Flux agenda (ICS) et automatisations quotidiennes. **Secrète** : uniquement côté serveur. |
| `ANTHROPIC_API_KEY` | non | Active l'assistant IA (sinon analyse automatique sans IA) |
| `CRON_SECRET` | non | Protège la route `/api/cron` des automatisations |

## Rôles

- **Admin** : voit tout, gère l'équipe, les paramètres (marque blanche), les intégrations et les formules.
- **Coach** : un coach crée son compte, l'admin lui donne le rôle « Coach ». Il voit uniquement ses clients.
- **Adhérent** : le coach saisit l'e-mail du client dans sa fiche ; le client crée son compte avec cet e-mail et retrouve sa progression, son programme, ses documents, ses factures, la messagerie et son check-in hebdomadaire.

La sécurité est assurée par la base (Row Level Security) : chacun ne voit que ce qu'il a le droit de voir.

## Mise en ligne

Déploie sur [Vercel](https://vercel.com) en ajoutant les variables d'environnement, puis mets l'adresse Vercel dans *Site URL* sur Supabase. Les automatisations tournent chaque jour grâce à `vercel.json`.
