# Mon SMV · 3ᵉ RSMV

> Une application qui réunit jeunes, cadres et familles autour du
> **Service Militaire Volontaire** — caserne Beauregard, La Rochelle.

**Version 0.2 · beta fonctionnelle** : authentification réelle (PBKDF2),
pré-inscription par admin/modérateur, panel d'administration complet, gestion des
incorporations bimestrielles, invitations famille avec lien de parenté,
sauvegardes en anneau pour le fondateur.

---

## ⚡ Démarrer

### Option A · GitHub Codespaces (recommandé · zéro install)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/goilardkillian-boop/mon-smv)

1. Clique sur le badge ↑ (ou **Code › Codespaces › Create codespace on main**).
2. Attends ~30 s que le devcontainer démarre.
3. Le serveur HTTP démarre tout seul sur le port `8080` ; un Simple Browser
   s'ouvre.
4. Ouvre l'URL forwardée dans Chrome (icône 🌐 dans l'onglet Ports), puis
   active le mode mobile (`Ctrl+Shift+M`).

### Option B · En local

```bash
npm start                 # python3 -m http.server 8080
# ou
npx serve .
```

### Option C · Tests

```bash
npm run smoke             # 28 tests sur DB / auth / admin (Node JSDOM-less)
```

---

## 🔐 Comptes de démonstration

| Identifiant      | Mot de passe   | Rôle                    | Section |
|------------------|----------------|-------------------------|---------|
| `admin`          | `admin`        | Administrateur          | —       |
| `mod`            | `mod`          | Modérateur              | —       |
| `recrutement`    | `recrutement`  | Cellule recrutement     | —       |
| `fondateur`      | `fondateur`    | Fondateur (sauvegardes) | —       |
| `t.bertin`       | `cadre`        | Cadre encadrant         | S21     |
| `l.costa`        | `cadre`        | Cadre encadrant         | S22     |
| `l.morel`        | `jeune`        | Jeune volontaire        | S21     |
| `k.boucher`      | `jeune`        | Jeune volontaire        | S21     |
| `i.tessier`      | `jeune`        | Jeune volontaire        | S21     |
| `j.boutet`       | `jeune`        | Jeune volontaire        | S22     |
| `fam.morel`      | `famille`      | Famille de l.morel (mère) | —     |

> En production, ces comptes seraient supprimés. Tous les nouveaux comptes
> créés par un admin sont forcés à changer leur mot de passe à la 1ʳᵉ
> connexion.

---

## 🧱 Architecture

```
mon-smv/
├── index.html
├── manifest.webmanifest     # PWA
├── service-worker.js        # cache offline (stale-while-revalidate)
├── package.json
├── scripts/smoke.mjs        # tests DB/auth/admin (28 assertions)
├── .devcontainer/           # Codespaces : démarre auto sur :8080
├── .github/workflows/       # déploiement GitHub Pages
└── assets/
    ├── styles.css           # design system mobile + admin desktop
    ├── icons.js             # bibliothèque SVG line-icons (50+)
    ├── db.js                # DB localStorage + audit + backups
    ├── auth.js              # PBKDF2 100k it. + génération k.nom
    ├── seed.js              # seed initial (sections, comptes, ...)
    ├── screens-admin.js     # panel admin / mod / recrutement / fondateur
    ├── app.js               # router + écrans utilisateurs
    └── img/                 # logo SVG + blobs charte graphique
```

Stack volontairement minimale : **HTML + CSS + JS modules**, zéro build, zéro
dépendance runtime. Tout est servable depuis n'importe quel hébergeur statique.

---

## 🔑 Comment la sécurité fonctionne

1. **Pré-inscription par admin/mod** : depuis `/admin/utilisateurs/nouveau`,
   l'admin crée un compte. L'identifiant est généré automatiquement comme
   `première-lettre-prénom.nom` (ex. `k.goilard`). En cas de collision, on
   suffixe `.2`, `.3`, etc.
2. **Mot de passe initial** : 8 caractères aléatoires sans ambiguïté
   (pas de `0/O`, `1/I/l`). Affiché **une seule fois** dans une modale à
   l'admin pour transmission au volontaire, puis **non récupérable** (réinit
   possible à tout moment).
3. **Hachage** : PBKDF2-SHA256, 100 000 itérations, sel aléatoire 16 octets
   par utilisateur. Implémenté via Web Crypto (`crypto.subtle.deriveBits`).
4. **Forçage du changement au 1ᵉʳ login** : le flag `mustChangePassword` est
   levé jusqu'au premier `changePassword` réussi. Toute tentative de
   navigation est interceptée vers `#/auth/changer-mdp`.
5. **Session** : `sessionStorage` (par onglet). Pas de "remember me" en
   beta — à durcir avec un backend en v1.

### ⚠️ Caveats (pour passer en production)

Le stockage est **localStorage** côté navigateur — donc :
- 🟠 **Données par appareil**. Pas de synchro entre l'app du jeune et celle
  du cadre. À remplacer par une vraie API (PostgreSQL/Supabase/Firebase).
- 🟠 **Hashes côté client**. Le PBKDF2 est correct mais s'exécute dans le
  navigateur. En production, déléguer à Argon2 côté serveur.
- 🟠 **Emails non envoyés** : les destinataires configurés dans
  `/admin/parametres` sont stockés et affichés dans les toasts, mais aucun
  email réel n'est expédié. À brancher sur SendGrid/Mailjet en v1.
- 🟠 **Sauvegardes locales** : les 12 snapshots vivent dans `localStorage`
  — à pousser vers S3/Backblaze côté serveur pour une vraie politique de
  rétention.

---

## 🧭 Parcours utilisateurs

### 🟢 Visiteur (public)
- `#/` Onboarding
- `#/decouvrir` Découverte du dispositif
- `#/galerie` Galerie filtrable
- `#/visite` Visite virtuelle (URL configurable dans les paramètres)
- `#/candidature` Formulaire candidature → enregistré en DB, traité depuis l'admin
- `#/connexion` Login
- `#/famille/rejoindre` Activation d'un compte famille via code à 6 caractères

### 🔵 Jeune volontaire
- `#/accueil`
- `#/section/calendrier` · `/portfolio` · `/membres`
- `#/tchat` (messages persistés en DB)
- `#/code` (questions code de la route)
- `#/notes` + `#/notes/nouveau` (carnet de notes par module)
- `#/ressources` (PDF, vidéos, par module)
- `#/emploi` + `#/emploi/:id`
- `#/famille/inviter` ← **génère un code à 6 caractères + lien de parenté**
- `#/moi` (profil, changer mdp, déconnexion)

### 🟡 Cadre encadrant
Tous les écrans jeune **de sa section** plus :
- `#/pilote` (KPIs, alertes, présence)
- `#/pilote/evenement-nouveau` (formulaire planification + push)
- `#/pilote/moderation` (signalements + photos à valider)
- `#/pilote/suivi` (stats présence / code / stages / bien-être)

### 🟣 Famille (sur invitation)
- `#/famille/photos` (photos de la section, validées par le cadre)
- `#/famille/tchat` (canal privé avec le volontaire)
- `#/moi`

### 🛠 Admin / Modérateur — `#/admin`
- **Dashboard** : KPIs (volontaires, cadres, familles, candidatures à traiter), activité récente
- **Utilisateurs** : recherche, créer, modifier, désactiver, supprimer, **réinitialiser mot de passe** (modale qui affiche identifiant + mdp initial)
- **Candidatures** : pipeline du formulaire public — pré-inscrire en un clic (génère le compte volontaire automatiquement)
- **Familles** : invitations en attente, comptes famille connectés
- **Paramètres** : destinataires emails (candidature, signalement, fondateur), téléphone, URLs (site, visite virtuelle, réseaux sociaux), **textes éditoriaux** (titre onboarding, libellés, RGPD)
- **Audit log** : 200 dernières écritures avec auteur, action et entité

### 🎓 Recrutement — `#/recrutement`
- **Dashboard** + KPIs
- **Incorporations** (1 toutes les 2 mois : Jan, Mar, Mai, Jul, Sep, Nov) — ouvrir/fermer, modifier places, supprimer
- **Formations par incorporation** — CRUD complet (code, nom, durée, capacité)
- **Candidatures** (accès partagé avec admin)

### 🛡 Fondateur — `#/fondateur/sauvegardes`
- **12 sauvegardes** maximum (≈ 12 h d'historique)
- Sauvegarde **automatique toutes les heures** pendant que l'app est ouverte
- Sauvegarde **manuelle** depuis l'écran
- **Restauration** : crée d'abord un snapshot de l'état actuel avant de basculer (rollback possible)

---

## 🎨 Charte graphique

| Token         | Valeur     |
|---------------|------------|
| Bleu principal  | `#2D3E73` |
| Vert fluo       | `#6FFF53` |
| Vert            | `#3DA435` |
| Rouge alerte    | `#A72A1F` |
| Bleu clair      | `#8DA1D3` |
| Crème (fond clair) | `#F4F2EC` |

- **Titres** · `Oswald` 600/700 (équivalent libre à `Eurostile Condensed Heavy`)
- **Texte** · `Inter` (équivalent libre à `Marianne` — bascule documentée en commentaire dans `styles.css`)
- **Taches "blob" SVG** (aplat fluo + trame pointillés vert mid), exactement comme la charte

---

## 📱 PWA → App Store / Play Store

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npx cap init "Mon SMV" "fr.smv.monsmv" --web-dir=.
npx cap add ios && npx cap add android
npx cap copy && npx cap open ios       # Xcode
npx cap copy && npx cap open android   # Android Studio
```

Aucun changement de code web requis — le shell Capacitor charge `index.html` tel quel.

---

## 🛣 Roadmap v1

1. **Backend** (PostgreSQL + Node/Bun ou Supabase), API REST authentifiée
2. **Argon2** côté serveur pour le hash
3. **Push notifications** (FCM/APNs) et envoi réel d'emails (SendGrid)
4. **Synchro multi-device** + offline-first robuste (CRDT ou TanStack Query)
5. **WCAG AA** complet (focus visible, contraste, ARIA labels)
6. **i18n** pour ouvrir l'app aux autres centres SMV (1ᵉʳ, 2ᵉ RSMV…)
7. **Tests E2E** Playwright sur les 4 parcours utilisateurs
8. **Stockage médias** (upload signé S3 + EXIF stripping, antivirus ClamAV)

---

**Référent projet** · Killian, opérateur des métiers de l'image · cellule communication · 3ᵉ RSMV.
