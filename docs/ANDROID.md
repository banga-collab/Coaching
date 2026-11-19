# Moov'Up Coach sur Android (Google Play)

L'application web Moov'Up Coach est déjà **installable** (PWA). Pour la mettre sur le **Google Play Store**, on l'emballe dans une petite application Android appelée **TWA** (*Trusted Web Activity*) : c'est Chrome qui affiche le site en plein écran, sans barre d'adresse. Avantages : gratuit, aucune deuxième application à maintenir, chaque mise à jour du site est immédiatement dans l'application.

Ce qui est déjà prêt dans le projet :

| Élément | Fichier | État |
|---|---|---|
| Manifeste (nom, couleurs Moov'Up, icônes 192/512 normales et « maskable », raccourcis, catégories) | `src/app/manifest.ts` | prêt |
| Captures d'écran pour le Play Store | `public/screenshots/` | à ajouter (voir étape 6) |
| Fichier de liaison site ↔ application | `public/.well-known/assetlinks.json` | modèle : empreinte à remplir (étape 5) |
| API pour que l'application envoie les données des montres | `POST /api/health/sync` | prête (voir dernière partie) |

Nom de paquet proposé : **`ma.moovup.coach`** (identifiant unique sur Google Play, définitif après la 1re publication).

---

## 1. Avant de commencer

1. Le site doit être **en ligne en HTTPS** sur son domaine définitif (ex. `https://coach.moovup.ma`).
2. Ouvrir `https://coach.moovup.ma/manifest.webmanifest` : le texte du manifeste doit s'afficher.
3. Ouvrir `https://coach.moovup.ma/.well-known/assetlinks.json` **dans une fenêtre de navigation privée** (sans être connecté) : le fichier doit s'afficher, et **pas** la page de connexion. Si la page de connexion apparaît, il faut ajouter `/.well-known` à la liste des chemins publics de `src/lib/supabase/middleware.ts` (et `/api/health/sync` pour l'application mobile).

## 2. Générer l'application gratuitement avec PWABuilder (le plus simple)

1. Aller sur **https://www.pwabuilder.com** (gratuit, aucun compte nécessaire).
2. Coller l'adresse du site (`https://coach.moovup.ma`) et cliquer sur **Start**.
3. PWABuilder affiche une note du manifeste : les éléments en rouge sont à corriger, les avertissements jaunes sont facultatifs.
4. Cliquer sur **Package for stores** → **Android** → **Generate Package**.
5. Dans les options :
   - **Package ID** : `ma.moovup.coach`
   - **App name** : `Moov'Up Coach` — **Short name** : `Moov'Up Coach`
   - **Version** : `1.0.0` et **Version code** : `1` (à augmenter de 1 à chaque nouvelle publication)
   - **Signing key** : laisser **« Create new »** et remplir nom, organisation (Moov'Up), pays (MA).
6. Télécharger le fichier ZIP. Il contient :
   - `*.aab` : le fichier à envoyer sur Google Play ;
   - `*.apk` : le fichier à installer directement sur un téléphone pour tester ;
   - `signing.keystore` + `signing-key-info.txt` : **la clé de signature et son mot de passe. À conserver précieusement (2 copies : clé USB + coffre-fort de mots de passe). Sans elle, impossible de publier une mise à jour.**
   - `assetlinks.json` : contient l'empreinte de cette clé.

> Alternative en ligne de commande : **Bubblewrap** (`npm i -g @bubblewrap/cli`, puis `bubblewrap init --manifest https://coach.moovup.ma/manifest.webmanifest` et `bubblewrap build`). Même résultat, demande Java et le SDK Android (installés automatiquement par l'outil).

## 3. Tester l'APK sur un téléphone Android

1. Envoyer le fichier `.apk` sur le téléphone (câble USB, Google Drive ou WhatsApp vers soi-même).
2. L'ouvrir sur le téléphone ; Android demande d'**autoriser l'installation d'applications inconnues** pour l'app utilisée (Fichiers, Drive…) : accepter pour ce test.
3. Ouvrir **Moov'Up Coach** depuis l'écran d'accueil.
   - Si une **barre d'adresse** apparaît en haut : la liaison site ↔ application n'est pas encore validée (étape 5). L'application fonctionne quand même.
   - Vérifier : connexion, menu, prise de photo, scan QR, rotation, bouton retour.
4. Chrome doit être installé et à jour sur le téléphone (c'est le cas sur presque tous les Android).

## 4. Publier sur Google Play

1. **Créer le compte développeur** (à faire par le propriétaire, au nom de Moov'Up) : https://play.google.com/console → frais uniques de **25 $**, pièce d'identité, et pour un compte « Organisation » le numéro D-U-N-S de l'entreprise (gratuit, à demander à l'avance car cela prend quelques jours).
2. **Créer une application** : nom « Moov'Up Coach », langue par défaut Français, type *Application*, *Gratuite*.
3. Remplir la **fiche du Play Store** : description courte (80 caractères) et longue, icône 512×512 (`public/icons/icon-512.png`), image de présentation 1024×500, au moins **2 captures d'écran** de téléphone.
4. Remplir les questionnaires obligatoires : classification du contenu, public cible (adultes), **sécurité des données** (données collectées : nom, e-mail, téléphone, **données de santé et de forme** si la santé connectée est utilisée ; chiffrées en transit ; l'utilisateur peut demander leur suppression), et l'adresse de la **politique de confidentialité** (page à publier sur le site).
5. **Production → Créer une version** → envoyer le fichier `.aab`. Accepter « Signature d'application par Google Play » (recommandé).
6. Nouveau compte personnel : Google impose d'abord un **test fermé avec au moins 12 testeurs pendant 14 jours** avant la production. Ajouter l'équipe et quelques adhérents par e-mail.
7. Envoyer en examen (quelques heures à quelques jours).

## 5. Mettre à jour l'empreinte dans `assetlinks.json` (supprime la barre d'adresse)

Google Play **re-signe** l'application avec sa propre clé : il faut donc mettre **son** empreinte.

1. Play Console → l'application → **Tester et publier → Configuration → Intégrité de l'application → Signature d'application**.
2. Copier l'**empreinte du certificat SHA-256** de la « clé de signature d'application » (format `AB:12:CD:…`).
3. Dans `public/.well-known/assetlinks.json`, remplacer la première ligne `A_REMPLACER…` par cette empreinte. Remplacer la seconde par l'empreinte de `signing-key-info.txt` de PWABuilder (pour que l'APK de test fonctionne aussi), ou supprimer cette seconde ligne.
4. Mettre le site en ligne, puis vérifier avec l'outil de Google : https://developers.google.com/digital-asset-links/tools/generator (domaine + `ma.moovup.coach` + empreinte → « Test statement »).
5. Désinstaller / réinstaller l'application : la barre d'adresse disparaît.

## 6. Captures d'écran et mises à jour

- Captures : faire des captures de l'application sur un téléphone (portrait) et les enregistrer dans `public/screenshots/` sous les noms `mobile-1.png`, `mobile-2.png`… (1080×1920 idéalement) ; pour une tablette ou un ordinateur : `large-1.png`… (1920×1080). Elles s'ajoutent automatiquement au manifeste.
- **Mises à jour du contenu** : rien à faire, l'application affiche toujours la dernière version du site.
- **Nouvelle version de l'application** (changement d'icône, de nom, de couleurs) : régénérer avec PWABuilder **en réutilisant la même clé** (`signing.keystore`, option « Use mine »), augmenter le *Version code*, envoyer le nouvel `.aab`.

---

## 7. Plus tard : lire les montres Samsung / Wear OS avec Health Connect

Un site web ne peut pas lire les montres. Aujourd'hui, l'adhérent importe le fichier d'export (Apple Santé, Samsung Health) dans **Ma santé connectée** (`/moi/sante`). Pour une synchronisation **automatique**, il faudra une petite partie **native** dans l'application Android :

1. **Health Connect** (intégré à Android 14+, application à installer sur Android 9–13) centralise les données de Samsung Health, des montres Wear OS, Fitbit, Garmin, Withings…
2. L'application Android (TWA + un module natif en Kotlin, ou une application Capacitor) demande les autorisations de lecture : `READ_STEPS`, `READ_SLEEP`, `READ_HEART_RATE`, `READ_RESTING_HEART_RATE`, `READ_ACTIVE_CALORIES_BURNED`, `READ_VO2_MAX`, `READ_WEIGHT`. Google Play exige une **déclaration** pour ces autorisations (formulaire « Health Connect » dans la Play Console) et une politique de confidentialité qui les mentionne.
3. Une fois par jour (WorkManager), l'application lit les 7 derniers jours, calcule **une valeur par jour** et l'envoie à l'API :

```
POST https://coach.moovup.ma/api/health/sync
Authorization: Bearer mvh_xxxxxxxx   ← code créé par l'adhérent dans /moi/sante › Application mobile
Content-Type: application/json

{
  "source": "health_connect",
  "samples": [
    { "date": "2026-11-17", "type": "steps", "value": 8421 },
    { "date": "2026-11-17", "type": "sleep", "value": 432,
      "details": { "deep": 80, "light": 230, "rem": 95, "awake": 27, "bed": "23:12", "wake": "06:51" } },
    { "date": "2026-11-17", "type": "hr_resting", "value": 61 },
    { "date": "2026-11-17", "type": "hr_avg", "value": 78 },
    { "date": "2026-11-17", "type": "active_kcal", "value": 512 },
    { "date": "2026-11-17", "type": "vo2max", "value": 41.2 },
    { "date": "2026-11-17", "type": "weight", "value": 82.4 }
  ]
}
```

   - `sleep` en minutes (jour = jour du réveil), `steps` en pas, `hr_*` en bpm, `weight` en kg ; 2000 valeurs max par envoi.
   - Renvoyer le même jour **remplace** la valeur (aucun doublon) : on peut renvoyer les 7 derniers jours à chaque fois.
   - `GET` sur la même adresse avec le même en-tête permet de **tester le code** (réponse `{ "ok": true }`).
   - Réponses : `200` `{ ok, received, saved, rejected }` ; `401` code invalide ou révoqué ; `413` envoi trop gros.
4. Côté serveur : exécuter `supabase/health-data.sql` dans Supabase (SQL Editor) et définir la variable `SUPABASE_SERVICE_ROLE_KEY` (l'API n'a pas de session utilisateur).
5. iPhone / Apple Watch : même API, avec une application iOS qui lit **HealthKit** (`"source": "apple_health"`). Sans application iOS, l'import du fichier `export.zip` reste disponible.
