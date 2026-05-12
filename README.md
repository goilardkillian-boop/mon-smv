# Mon SMV · 3ᵉ RSMV

> Une application qui réunit jeunes, cadres et familles autour du
> **Service Militaire Volontaire** — caserne Beauregard, La Rochelle.

Maquette haute-fidélité interactive de l'application **Mon SMV**, conçue à partir
du brief créatif du 3ᵉ RSMV (mai 2026). PWA installable, mobile-first, 100%
responsive web — pensée pour être ensuite emballée vers l'App Store et le Play
Store via Capacitor.

---

## ⚡ Démarrer en local

Aucune build, aucune dépendance.

```bash
# n'importe quel serveur statique
python3 -m http.server 8080
# ou
npx serve .
```

Puis ouvre **http://localhost:8080** (utilise le DevTools mobile pour la meilleure
expérience).

> Le service-worker se charge automatiquement au 2ᵉ chargement → l'app est
> installable comme PWA depuis Chrome / Safari iOS / Edge.

---

## 🗺 Architecture

```
mon-smv/
├── index.html               # shell mobile
├── manifest.webmanifest     # PWA
├── service-worker.js        # cache offline (stale-while-revalidate)
├── assets/
│   ├── styles.css           # design system + écrans
│   ├── app.js               # routeur hash + tous les écrans
│   ├── icons.js             # bibliothèque SVG line-icons
│   ├── data.js              # données pédagogiques (mock)
│   └── img/
│       ├── logo.svg         # logo régiment SMV
│       ├── blob-fluo.svg    # tache verte fluo (charte)
│       └── blob-dots.svg    # tache trame pointillés
└── README.md
```

Pas de framework. Stack volontairement minimale : **HTML + CSS + JS modules** —
sert directement depuis n'importe quel hébergeur statique (GitHub Pages, Netlify,
Vercel, S3, etc.). Idéal pour itérer vite avec la cellule communication.

---

## 🎨 Charte graphique respectée

Source : *Charte graphique du 3ᵉ RSMV*.

| Token        | Valeur     | Usage                                  |
|--------------|------------|----------------------------------------|
| `--navy-600` | `#2D3E73`  | Bleu principal (texte, fond foncé)     |
| `--navy-900` | `#0B1638`  | Fond hero/onboarding                   |
| `--green-fluo`| `#6FFF53` | Accent · CTA · highlight               |
| `--green`    | `#3DA435`  | Texte vert, validation                 |
| `--navy-400` | `#8DA1D3`  | Bleu clair (silhouettes, charte)       |
| `--red`      | `#A72A1F`  | Alerte, modération                     |
| `--bg-cream` | `#F4F2EC`  | Fond clair (charte papier)             |

Typographies :

- **Titres** · `Oswald` 600/700 (équivalent libre à l'`Eurostile Condensed Heavy`)
- **Texte courant** · `Inter` (équivalent libre à `Marianne`)
- Pour passer à `Marianne` officielle : remplacer dans `styles.css`
  → `--font-body: 'Marianne', system-ui, …` et inclure
  `https://www.systeme-de-design.gouv.fr/uploads/Marianne.css`.

Les **taches** (blobs) sont en SVG et reprennent la déclinaison aplat vert fluo
+ trame pointillés vert mid imposée par la charte (toujours la trame plus foncée
que l'aplat).

---

## 🧭 Parcours utilisateurs

L'app distingue **4 publics** + **2 rôles transverses** (modérateur, admin).

### 🟢 Visiteur (grand public, futur volontaire)
1. **Onboarding** — `#/`
2. **Choix du centre** — `#/centre` (pilote = La Rochelle)
3. **Découverte du dispositif** — `#/decouvrir`
4. **Galerie** — `#/galerie` (filtres : sport, formation, cérémonies, stage)
5. **Visite virtuelle** — `#/visite`
6. **Contact recrutement** — `#/contact` (formulaire RGPD, rappel sous 48h)

### 🔵 Jeune volontaire
1. **Accueil** — `#/accueil` (cours du moment, accès rapide, actu)
2. **Section** — `#/section/calendrier` · `#/section/portfolio` · `#/section/membres`
3. **Tchat de section** — `#/tchat` (modéré, mention `CADRE`, épinglage)
4. **Code de la route** — `#/code` (questions, score, leaderboard)
5. **Mes notes** — `#/notes` + `#/notes/nouveau` (carnet par module)
6. **Ressources** — `#/ressources` (PDF, vidéos, par module)
7. **Offres d'emploi** — `#/emploi` + détail `#/emploi/:id`
8. **Mon profil** — `#/moi` (infos, RGPD, inviter ma famille)

### 🟡 Cadre encadrant
Accès à tout ce qu'un jeune de **sa section** voit, **plus** :
1. **Pilotage de section** — `#/pilote` (volontaires, signalements, événements)
2. **Nouvel événement** — `#/pilote/evenement-nouveau` (push, visible famille)
3. **Modération** — `#/pilote/moderation` (messages signalés, photos à valider)
4. **Suivi & stats** — `#/pilote/suivi` (présence, code, stages, bien-être)

### 🟣 Famille (sur invitation uniquement)
1. **Photos** de la section où est leur proche — `#/famille/photos`
2. **Tchat 1:1** avec leur enfant — `#/famille/tchat`

### 🔀 Démo
Depuis l'écran `#/moi`, des boutons permettent de basculer entre les profils
**Visiteur / Jeune / Cadre / Famille** pour explorer toute l'app sans backend.

---

## 📱 PWA & installation

- `manifest.webmanifest` correctement configuré (start_url, scope, theme).
- `service-worker.js` en stale-while-revalidate → app **offline-first**.
- Sur iOS, ajouter à l'écran d'accueil → l'app s'ouvre en plein écran.

### Vers les stores (Capacitor)
Pour publier sur App Store / Play Store :

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npx cap init "Mon SMV" "fr.smv.monsmv" --web-dir=.
npx cap add ios && npx cap add android
npx cap copy && npx cap open ios   # Xcode
npx cap copy && npx cap open android   # Android Studio
```

Aucun changement au code web nécessaire — le shell Capacitor charge `index.html`
tel quel et les screens deviennent natifs (status bar, safe area, push, etc.).

---

## 🧪 Tests manuels (golden path)

- [ ] `#/` → onboarding s'affiche, "Je découvre" emmène vers `#/centre`
- [ ] `#/centre` → choix La Rochelle → `#/decouvrir`
- [ ] `#/decouvrir` → stats, parcours, CTA contact + CTA inscription
- [ ] `#/galerie` → filtres fonctionnels (Tout, Sport, Formation…)
- [ ] `#/contact` → formulaire submit → toast + retour
- [ ] `#/login` → bouton démo "Jeune" → `#/accueil` (Léa, S21)
- [ ] `#/accueil` → tiles cliquables (code, offres, notes, ressources)
- [ ] `#/section/calendrier` → tabs Calendrier / Portfolio / Membres
- [ ] `#/tchat` → composer affiche un toast
- [ ] `#/code` → options sélectionnables, validation
- [ ] `#/moi` → switch démo Cadre → `#/pilote`
- [ ] `#/pilote/moderation` → boutons modération → toasts
- [ ] `#/pilote/suivi` → tabs Présence / Code / Stages / Bien-être
- [ ] `#/moi` → switch démo Famille → `#/famille/photos`
- [ ] PWA installable (Chrome DevTools › Application › Manifest)
- [ ] Offline (Chrome DevTools › Network › Offline → reload)

---

## 🛣 Prochaines étapes (post-maquette)

1. **Backend** : authentification (Keycloak ou Auth gouv.fr), base sectionnée par
   compagnie/section, modération côté serveur, push (FCM/APNs).
2. **Médias** : remplacer les blobs SVG par des photos validées par le cadre +
   pipeline d'upload signé / EXIF stripping côté serveur.
3. **Marianne** : embarquer la police officielle gouvernementale.
4. **Tests E2E** : Playwright sur les 4 parcours utilisateurs.
5. **Accessibilité** : audit WCAG AA, labels ARIA sur la nav, focus visible.
6. **i18n** : préparer la chaîne pour ouvrir l'app aux autres centres SMV.

---

**Référent projet** · Killian, opérateur des métiers de l'image · cellule
communication · 3ᵉ RSMV.
