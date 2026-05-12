/* ============================================================
   MON SMV · Application
   3ᵉ RSMV · La Rochelle, caserne Beauregard
   ============================================================
   Architecture
   - State (localStorage) : utilisateur courant, rôle, section, données
   - Router à hash : chaque écran est une fonction qui renvoie du HTML
   - Composants partagés : statusbar, topbar, bottom-nav, blobs, icons
   - Données : mock pédagogique pour démo (sections, planning, tchat, etc.)

   La logique métier réelle (auth, push, API) viendrait dans une v2 backée
   par un serveur. Ici, tout est local pour la démo et la maquette HF.
   ============================================================ */

import { ICONS } from './icons.js';
import { DATA } from './data.js';

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
const STORAGE_KEY = 'mon-smv:v1';

const defaultState = {
  centre: 'la-rochelle',                 // pilote unique pour le moment
  user: null,                            // null = visiteur
  // user = { firstName, lastName, role, section, avatarColor }
  toasts: [],
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch { return structuredClone(defaultState); }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function setUser(user) { state.user = user; save(); }
function logout() { state.user = null; save(); navigate('#/'); }

/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
const $app = document.getElementById('app');

function html(strings, ...values) {
  return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
}

function initials(first = '', last = '') {
  return (first[0] || '') + (last[0] || '');
}

function statusbar(theme = 'dark') {
  return `
    <div class="statusbar">
      <span>9:41</span>
      <span class="statusbar__right">
        ${ICONS.signal}${ICONS.wifi}${ICONS.battery}
      </span>
    </div>`;
}

function topbar({ back = false, title = '', right = '', center = '' } = {}) {
  const left = back
    ? `<button class="topbar__btn" data-action="back" aria-label="Retour">${ICONS.chevronLeft}</button>`
    : `<div class="topbar__spacer"></div>`;
  const r = right || `<div class="topbar__spacer"></div>`;
  return `
    <div class="topbar">
      ${left}
      <div class="topbar__center">${center || title}</div>
      ${r}
    </div>`;
}

function bottomNav(active) {
  const role = state.user?.role || 'visitor';
  let items = [];
  if (role === 'visitor') {
    items = [
      ['decouvrir', 'Accueil', ICONS.home],
      ['galerie',   'Galerie', ICONS.image],
      ['visite',    'Visite',  ICONS.map],
      ['contact',   'Contact', ICONS.send],
    ];
  } else if (role === 'jeune') {
    items = [
      ['accueil',          'Accueil', ICONS.home],
      ['section/calendrier','Section', ICONS.calendar],
      ['tchat',            'Tchat',   ICONS.chat],
      ['emploi',           'Emploi',  ICONS.briefcase],
      ['moi',              'Moi',     ICONS.user],
    ];
  } else if (role === 'cadre') {
    items = [
      ['pilote',                 'Pilote',  ICONS.home],
      ['section/calendrier',     'Section', ICONS.calendar],
      ['pilote/moderation',      'Modé.',   ICONS.shield],
      ['pilote/suivi',           'Suivi',   ICONS.chart],
      ['moi',                    'Moi',     ICONS.user],
    ];
  } else if (role === 'famille') {
    items = [
      ['famille/photos', 'Photos', ICONS.image],
      ['famille/tchat',  'Tchat',  ICONS.chat],
      ['moi',            'Moi',    ICONS.user],
    ];
  }
  return `
    <nav class="bottom-nav">
      ${items.map(([slug, label, icon]) => `
        <button class="bottom-nav__item ${active === slug ? 'bottom-nav__item--active' : ''}"
                data-link="#/${slug}">
          ${icon}
          <span>${label}</span>
        </button>`).join('')}
    </nav>`;
}

function blob({ kind = 'navy', label = '', svg = 'dots' } = {}) {
  const src = svg === 'fluo' ? './assets/img/blob-fluo.svg' : './assets/img/blob-dots.svg';
  return `
    <div class="blob blob--${kind}">
      <img class="blob__svg" src="${src}" alt="" />
      ${label ? `<span class="blob__label">${label}</span>` : ''}
    </div>`;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* ============================================================
   SCREENS
   ============================================================ */
const screens = {};

/* -------- 1. Onboarding -------- */
screens.onboarding = () => `
  <section class="screen screen--dark">
    ${statusbar('dark')}
    <div class="onboarding">
      <img class="onboarding__blob" src="./assets/img/blob-fluo.svg" alt="" aria-hidden="true" />
      <div class="onboarding__regiment">3<sup>E</sup> RSMV · LA ROCHELLE</div>
      <h1 class="onboarding__title">Une<br/>seconde<br/>chance,<br/><em>tracée.</em></h1>
      <p class="onboarding__sub">Tu as entre 18 et 25 ans. Tu cherches un cap. Le SMV te forme et t'accompagne vers l'emploi.</p>
      <div class="onboarding__actions">
        <button class="btn btn--fluo btn--block" data-link="#/centre">Je découvre →</button>
        <button class="btn btn--ghost btn--block" data-link="#/login">J'ai déjà un compte</button>
      </div>
      <div class="onboarding__foot">
        <span>le-smv.gouv.fr</span>
        <span>armé pour l'avenir</span>
      </div>
    </div>
  </section>`;

/* -------- 2. Choix du centre -------- */
screens.centre = () => `
  <section class="screen screen--dark">
    ${statusbar('dark')}
    ${topbar({ back: true, center: 'Choix du centre' })}
    <div class="center-picker">
      <div style="margin-bottom: 18px">
        <div class="eyebrow">// étape 1 sur 3</div>
        <h2 class="signup__title" style="margin-top: 8px">Choisis ton<br/><em>centre SMV.</em></h2>
        <p class="signup__sub" style="margin-top:10px">Pour le moment, seul le 3<sup>e</sup> RSMV de La Rochelle utilise l'application.</p>
      </div>
      <button class="center-card center-card--active" data-link="#/decouvrir">
        <div class="center-card__avatar">${ICONS.shieldFull}</div>
        <div>
          <div class="center-card__name">3<sup>e</sup> RSMV · La Rochelle</div>
          <div class="center-card__meta">Caserne Beauregard · Charente-Maritime</div>
        </div>
        ${ICONS.chevronRight}
      </button>
      <button class="center-card center-card--soon" disabled>
        <div class="center-card__avatar">${ICONS.shieldFull}</div>
        <div>
          <div class="center-card__name">2<sup>e</sup> RSMV · Brétigny</div>
          <div class="center-card__meta">Bientôt disponible</div>
        </div>
        ${ICONS.chevronRight}
      </button>
      <button class="center-card center-card--soon" disabled>
        <div class="center-card__avatar">${ICONS.shieldFull}</div>
        <div>
          <div class="center-card__name">1<sup>er</sup> RSMV · Montigny-lès-Metz</div>
          <div class="center-card__meta">Bientôt disponible</div>
        </div>
        ${ICONS.chevronRight}
      </button>
    </div>
  </section>`;

/* -------- 3. Découvrir le SMV (public) -------- */
screens.decouvrir = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Le 3ᵉ RSMV', right: `<button class="topbar__btn" aria-label="Recherche">${ICONS.search}</button>` })}

    <div class="screen__scroll">
      <div class="hero">
        <img class="hero__blob" src="./assets/img/blob-dots.svg" alt="" />
        <div class="hero__eyebrow">// Hero · formation militaire</div>
        <h1 class="hero__title">Armé pour<br/><em>l'avenir.</em></h1>
      </div>

      <div class="grid-2">
        <div class="stat">
          <div class="stat__num">6–8</div>
          <div class="stat__lbl">mois de formation</div>
        </div>
        <div class="stat">
          <div class="stat__num stat__num--fluo">80%</div>
          <div class="stat__lbl">vers l'emploi</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="stat">
          <div class="stat__num">6</div>
          <div class="stat__lbl">sections actives</div>
        </div>
        <div class="stat">
          <div class="stat__num" style="font-size:28px">GRATUIT</div>
          <div class="stat__lbl">encadré · logé · nourri</div>
        </div>
      </div>

      <div class="parcours">
        <div class="parcours__title">Le parcours</div>
        ${[
          ['01', 'Formation militaire', '1 mois · sport, vivre ensemble, savoir-être'],
          ['02', 'Remise à niveau', '3 mois · scolaire, permis, citoyenneté'],
          ['03', 'Spécialité métier', '2-3 mois · atelier mécanique, logistique, restauration'],
          ['04', 'Stage entreprise', '1 mois · immersion terrain'],
          ['05', 'Insertion emploi', 'Accompagnement vers le CDI ou la formation qualifiante'],
        ].map(([n, t, d]) => `
          <div class="parcours__item">
            <div class="parcours__num">${n}</div>
            <div>
              <div class="parcours__name">${t}</div>
              <div class="parcours__desc">${d}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="px-4" style="padding-bottom: 20px">
        <button class="btn btn--navy btn--block" data-link="#/contact">Contacter le recrutement →</button>
        <button class="btn btn--ghost-ink btn--block mt-4" data-link="#/signup">Créer mon compte volontaire</button>
      </div>
    </div>

    ${bottomNav('decouvrir')}
  </section>`;

/* -------- 4. Galerie (public) -------- */
screens.galerie = () => {
  const cat = state.galleryFilter || 'tout';
  const filters = ['Tout', 'Sport', 'Formation', 'Cérémonies', 'Stage'];
  const items = DATA.gallery.filter(i => cat === 'tout' || i.cat.toLowerCase() === cat);
  return `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Le SMV en images', right: `<button class="topbar__btn">${ICONS.filter}</button>` })}
    <div class="screen__scroll">
      <div class="chips" style="padding: 4px 16px 12px">
        ${filters.map(f => {
          const slug = f.toLowerCase();
          return `<button class="chip ${slug === cat ? 'chip--active' : ''}" data-gallery="${slug}">${f}</button>`;
        }).join('')}
      </div>
      <div class="gallery">
        ${items.map(i => blob({ kind: i.kind, label: i.label, svg: i.svg })).join('')}
      </div>
    </div>
    ${bottomNav('galerie')}
  </section>`;
};

/* -------- 5. Visite virtuelle (public) -------- */
screens.visite = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Visite virtuelle' })}
    <div class="screen__scroll">
      <div style="margin: 0 16px;">
        <div class="hero" style="margin: 8px 0 16px">
          <img class="hero__blob" src="./assets/img/blob-fluo.svg" alt="" />
          <div class="hero__eyebrow">// 360° · caserne Beauregard</div>
          <h1 class="hero__title" style="font-size: 34px; margin-top: 100px">Découvre<br/><em>nos lieux.</em></h1>
        </div>
      </div>

      <div class="section-title">Les espaces</div>
      <div style="padding: 0 16px 8px">
        ${[
          ['Quartier Beauregard',  'Entrée principale, drapeau, place d\'armes', 'navy'],
          ['Pavillons sections',   '6 sections, 22 volontaires par section',     'lightblue'],
          ['Atelier mécanique',    'Spécialité automobile · 12 postes',          'green'],
          ['Salle auto-école',     'Code de la route · simulateurs',             'navy'],
          ['Stade & gymnase',      'Sport quotidien · 6h30 réveil',              'lightblue'],
          ['Mess & cuisine',       'Restauration collective',                    'green'],
        ].map(([name, sub, kind]) => `
          <div class="card" style="display:grid; grid-template-columns: 92px 1fr 16px; gap: 12px; margin-bottom: 10px; padding: 10px;">
            <div style="width:92px; aspect-ratio: 1; border-radius: 14px; overflow:hidden; background: var(--${kind === 'green' ? 'green' : kind === 'lightblue' ? 'navy-400' : 'navy-700'});">
              ${blob({ kind, svg: 'dots' })}
            </div>
            <div style="align-self:center">
              <div style="font-family: var(--font-display); font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: .04em">${name}</div>
              <div style="font-size: 12px; color: var(--ink-500); margin-top: 2px">${sub}</div>
            </div>
            <div style="align-self:center; color: var(--ink-300)">${ICONS.chevronRight}</div>
          </div>`).join('')}
      </div>

      <div class="px-4" style="padding-bottom: 20px">
        <button class="btn btn--navy btn--block" data-toast="Visite 360° bientôt disponible">Lancer la visite 360°</button>
      </div>
    </div>
    ${bottomNav('visite')}
  </section>`;

/* -------- 6. Contact recrutement (public) -------- */
screens.contact = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Recrutement' })}
    <div class="screen__scroll">
      <div class="recruit-head">
        <h1 class="recruit-head__title">On reprend<br/>contact avec <em>toi.</em></h1>
        <p class="recruit-head__sub">La cellule recrutement te rappelle sous <em>48h ouvrées.</em></p>
      </div>
      <form class="form" data-form="contact">
        <div class="field">
          <label class="field__label">Prénom</label>
          <input class="field__input" name="firstName" placeholder="Léa" required />
        </div>
        <div class="field">
          <label class="field__label">Nom</label>
          <input class="field__input" name="lastName" placeholder="Morel" required />
        </div>
        <div class="field">
          <label class="field__label">Âge</label>
          <input class="field__input" type="number" name="age" min="16" max="40" placeholder="19" required />
        </div>
        <div class="field">
          <label class="field__label">Code postal</label>
          <input class="field__input" name="postalCode" placeholder="17000 · La Rochelle" required />
        </div>
        <div class="field">
          <label class="field__label">Tu cherches</label>
          <select class="field__select" name="goal" required>
            <option>Un métier, je ne sais pas lequel</option>
            <option>Le permis de conduire</option>
            <option>Une remise à niveau scolaire</option>
            <option>Une formation qualifiante</option>
            <option>Reprendre confiance avant l'emploi</option>
          </select>
        </div>
        <div class="field">
          <label class="field__label">Email</label>
          <input class="field__input" type="email" name="email" placeholder="lea.morel@email.fr" required />
        </div>
        <div class="field">
          <label class="field__label">Téléphone</label>
          <input class="field__input" type="tel" name="phone" placeholder="06 12 34 56 78" required />
        </div>
        <label class="checkbox mt-4">
          <input type="checkbox" required checked />
          <span>J'accepte que mes coordonnées soient transmises à la cellule recrutement du 3<sup>e</sup> RSMV. RGPD.</span>
        </label>
        <button class="btn btn--fluo btn--block mt-6" type="submit">Envoyer ma demande</button>
      </form>
    </div>
    ${bottomNav('contact')}
  </section>`;

/* -------- 7. Signup (multi-step) -------- */
screens.signup = () => {
  const step = state.signupStep || 1;
  const form = state.signupForm || {};
  const steps = `
    <div class="signup__step">
      <span class="${step >= 1 ? 'is-on' : ''}"></span>
      <span class="${step >= 2 ? 'is-on' : ''}"></span>
      <span class="${step >= 3 ? 'is-on' : ''}"></span>
    </div>`;

  let body = '';
  if (step === 1) {
    body = `
      <div class="eyebrow">// étape 1 · ton profil</div>
      <h2 class="signup__title">Qui es-<em>tu ?</em></h2>
      <p class="signup__sub">Choisis ton profil. Tu pourras le changer plus tard si nécessaire.</p>
      <div class="signup__cards" style="grid-template-columns:1fr">
        ${[
          ['jeune',   'Jeune volontaire', 'Tu intègres une section SMV'],
          ['cadre',   'Cadre encadrant',  'Tu encadres une section'],
          ['famille', 'Famille',          'Tu as été invité·e par un proche'],
        ].map(([role, name, desc]) => `
          <button class="signup__card ${form.role === role ? 'signup__card--active' : ''}" data-signup-role="${role}">
            <div class="signup__card__name">${name}</div>
            <div class="signup__card__desc">${desc}</div>
          </button>`).join('')}
      </div>
      <button class="btn btn--fluo btn--block" data-signup-next ${form.role ? '' : 'disabled'}>Continuer →</button>`;
  } else if (step === 2 && form.role === 'jeune') {
    body = `
      <div class="eyebrow">// étape 2 · ton affectation</div>
      <h2 class="signup__title">Ta compagnie,<br/><em>ta section.</em></h2>
      <p class="signup__sub">Renseigne ton affectation. Un cadre validera ton inscription.</p>
      <div class="signup__sub" style="font-family: var(--font-mono); font-size: 12px; color: var(--green-fluo); margin-top: -8px">// Compagnie</div>
      <div class="signup__cards">
        ${['1ʳᵉ compagnie', '2ᵉ compagnie'].map((c, i) => `
          <button class="signup__card ${form.compagnie === (i+1) ? 'signup__card--active' : ''}" data-signup-compagnie="${i+1}">
            <div class="signup__card__name">${c}</div>
            <div class="signup__card__desc">Sections S${i+1}1 · S${i+1}2 · S${i+1}3</div>
          </button>`).join('')}
      </div>
      ${form.compagnie ? `
        <div class="signup__sub" style="font-family: var(--font-mono); font-size: 12px; color: var(--green-fluo); margin-top: 4px">// Section</div>
        <div class="signup__cards" style="grid-template-columns: 1fr 1fr 1fr">
          ${[1,2,3].map(n => {
            const sec = `S${form.compagnie}${n}`;
            return `<button class="signup__card ${form.section === sec ? 'signup__card--active' : ''}" data-signup-section="${sec}" style="min-height: 80px; padding: 14px 10px">
              <div class="signup__card__name" style="font-size: 18px">${sec}</div>
            </button>`;
          }).join('')}
        </div>` : ''}
      <button class="btn btn--fluo btn--block" data-signup-next ${form.section ? '' : 'disabled'}>Continuer →</button>`;
  } else if (step === 2 && form.role === 'cadre') {
    body = `
      <div class="eyebrow">// étape 2 · ta section d'encadrement</div>
      <h2 class="signup__title">Quelle <em>section</em><br/>tu encadres ?</h2>
      <div class="signup__cards" style="grid-template-columns: 1fr 1fr 1fr">
        ${['S11','S12','S13','S21','S22','S23'].map(sec => `
          <button class="signup__card ${form.section === sec ? 'signup__card--active' : ''}" data-signup-section="${sec}" style="min-height: 80px; padding: 14px 10px">
            <div class="signup__card__name" style="font-size: 18px">${sec}</div>
          </button>`).join('')}
      </div>
      <button class="btn btn--fluo btn--block" data-signup-next ${form.section ? '' : 'disabled'}>Continuer →</button>`;
  } else if (step === 2 && form.role === 'famille') {
    body = `
      <div class="eyebrow">// étape 2 · ton invitation</div>
      <h2 class="signup__title">Code d'<em>invitation.</em></h2>
      <p class="signup__sub">Saisis le code reçu par le volontaire que tu accompagnes.</p>
      <div class="field">
        <label class="field__label" style="color: rgba(255,255,255,.7)">Code (6 caractères)</label>
        <input class="field__input" name="inviteCode" maxlength="6" placeholder="ABC123" style="text-transform: uppercase; letter-spacing: 4px; text-align:center; font-family: var(--font-mono); font-size: 22px" data-signup-input="inviteCode" />
      </div>
      <button class="btn btn--fluo btn--block" data-signup-next ${(form.inviteCode || '').length === 6 ? '' : 'disabled'}>Continuer →</button>`;
  } else if (step === 3) {
    body = `
      <div class="eyebrow">// étape 3 · tes informations</div>
      <h2 class="signup__title">On <em>finalise.</em></h2>
      <div class="field">
        <label class="field__label" style="color: rgba(255,255,255,.7)">Prénom</label>
        <input class="field__input" name="firstName" data-signup-input="firstName" value="${form.firstName || ''}" placeholder="Léa" />
      </div>
      <div class="field">
        <label class="field__label" style="color: rgba(255,255,255,.7)">Nom</label>
        <input class="field__input" name="lastName" data-signup-input="lastName" value="${form.lastName || ''}" placeholder="Morel" />
      </div>
      <div class="field">
        <label class="field__label" style="color: rgba(255,255,255,.7)">Email</label>
        <input class="field__input" type="email" data-signup-input="email" value="${form.email || ''}" placeholder="lea.morel@smv.gouv.fr" />
      </div>
      <button class="btn btn--fluo btn--block" data-signup-finish ${form.firstName && form.lastName ? '' : 'disabled'}>Créer mon compte →</button>`;
  }

  return `
    <section class="screen screen--dark">
      ${statusbar('dark')}
      ${topbar({ back: true, center: 'Inscription' })}
      <div class="signup">
        ${steps}
        ${body}
      </div>
    </section>`;
};

/* -------- 8. Login -------- */
screens.login = () => `
  <section class="screen screen--dark">
    ${statusbar('dark')}
    ${topbar({ back: true, center: 'Connexion' })}
    <div class="signup">
      <div class="eyebrow">// content de te revoir</div>
      <h2 class="signup__title">Te voilà<br/><em>de retour.</em></h2>
      <form data-form="login" style="display:flex; flex-direction: column; gap: 12px; flex:1">
        <div class="field" style="margin: 0">
          <label class="field__label" style="color: rgba(255,255,255,.7)">Email</label>
          <input class="field__input" name="email" type="email" placeholder="lea.morel@smv.gouv.fr" />
        </div>
        <div class="field" style="margin: 0">
          <label class="field__label" style="color: rgba(255,255,255,.7)">Mot de passe</label>
          <input class="field__input" name="password" type="password" placeholder="••••••••" />
        </div>
        <div style="margin-top:auto; display:flex; flex-direction: column; gap: 10px">
          <button class="btn btn--fluo btn--block" type="submit">Se connecter</button>
          <p style="text-align:center; color: rgba(255,255,255,.55); font-size: 13px">Pas encore inscrit ? <a href="#/signup" style="color: var(--green-fluo)">Créer un compte</a></p>
          <p style="text-align:center; color: rgba(255,255,255,.45); font-size: 12px">Démo · choisis un profil rapide ↓</p>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px">
            <button type="button" class="btn btn--ghost btn--sm" data-demo="jeune">Jeune</button>
            <button type="button" class="btn btn--ghost btn--sm" data-demo="cadre">Cadre</button>
            <button type="button" class="btn btn--ghost btn--sm" data-demo="famille">Famille</button>
          </div>
        </div>
      </form>
    </div>
  </section>`;

/* -------- 9. Accueil jeune -------- */
screens.accueil = () => {
  const u = state.user;
  const today = DATA.schedule.S21; // démo : ta section S21
  const dateLabel = 'Mardi 12 mai';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      <div class="greeting">
        <div class="greeting__avatar">${initials(u.firstName, u.lastName)}</div>
        <div class="greeting__date">${dateLabel}</div>
        <h1 class="greeting__name">Bonjour,<br/><em>${u.firstName}.</em></h1>
        <div class="now">
          <span class="now__chip">${u.section}</span>
          <div class="now__lbl">Maintenant · 08:30</div>
          <div class="now__title">Auto-école · Module 3</div>
          <div class="now__sub">Salle 2 · Sergent Bertin</div>
        </div>
      </div>

      <div class="today">
        <div class="today__head">Aujourd'hui</div>
        ${today.slice(0, 4).map(e => `
          <div class="today__row">
            <div class="today__time">${e.time}</div>
            <div>
              <div class="today__title">${e.title}</div>
              <div class="today__sub">${e.sub}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="section-title">Accès rapide</div>
      <div class="tiles">
        <button class="tile" data-link="#/code">
          <div class="tile__icon">${ICONS.car}</div>
          <div>
            <div class="tile__name">Code</div>
            <div class="tile__count">47 fiches</div>
          </div>
        </button>
        <button class="tile" data-link="#/emploi">
          <div class="tile__icon">${ICONS.briefcase}</div>
          <div>
            <div class="tile__name">Offres</div>
            <div class="tile__count">12 nouvelles</div>
          </div>
        </button>
        <button class="tile" data-link="#/notes">
          <div class="tile__icon">${ICONS.notebook}</div>
          <div>
            <div class="tile__name">Mes notes</div>
            <div class="tile__count">3 brouillons</div>
          </div>
        </button>
        <button class="tile" data-link="#/ressources">
          <div class="tile__icon">${ICONS.folder}</div>
          <div>
            <div class="tile__name">Ressources</div>
            <div class="tile__count">Module 3</div>
          </div>
        </button>
      </div>

      <div class="section-title">Actualités du régiment</div>
      <div style="padding: 0 16px 24px">
        ${DATA.news.slice(0,3).map(n => `
          <div class="card" style="margin-bottom: 10px; display:grid; grid-template-columns: 78px 1fr; gap: 12px; padding: 10px">
            <div style="width:78px; aspect-ratio:1; border-radius:12px; overflow:hidden">${blob({ kind: n.kind, svg: 'dots' })}</div>
            <div style="align-self:center">
              <div style="font-family: var(--font-mono); font-size: 10px; color: var(--green); letter-spacing: .08em; text-transform: uppercase">${n.date}</div>
              <div style="font-family: var(--font-display); font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: .03em; margin-top: 2px">${n.title}</div>
              <div style="font-size: 12px; color: var(--ink-500); margin-top: 2px">${n.excerpt}</div>
            </div>
          </div>`).join('')}
      </div>

      ${bottomNav('accueil')}
    </section>`;
};

/* -------- 10. Section · Calendrier -------- */
screens['section/calendrier'] = () => {
  const sec = state.user?.section || 'S21';
  const schedule = DATA.schedule[sec] || DATA.schedule.S21;
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Section ${sec}`, right: `<button class="topbar__btn">${ICONS.filter}</button>` })}
      <div class="segmented" style="margin: 0 16px 8px; width: calc(100% - 32px)">
        <button class="segmented__item segmented__item--active" data-link="#/section/calendrier">Calendrier</button>
        <button class="segmented__item" data-link="#/section/portfolio">Portfolio</button>
        <button class="segmented__item" data-link="#/section/membres">Membres</button>
      </div>
      <div class="weekstrip">
        ${['L','M','M','J','V','S','D'].map((d, i) => {
          const n = 12 + i;
          const active = n === 13;
          return `<div class="weekstrip__cell ${active ? 'weekstrip__cell--active' : ''}">
            <div class="weekstrip__d">${d}</div>
            <div class="weekstrip__n">${n}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="schedule">
        ${schedule.map(e => `
          <div class="schedule__row">
            <div class="schedule__time">${e.time}</div>
            <div>
              <div class="schedule__title">${e.title}</div>
              <div class="schedule__sub">${e.sub}</div>
              ${e.status ? `<div class="schedule__status">${e.status}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${bottomNav('section/calendrier')}
    </section>`;
};

/* -------- 10b. Section · Portfolio -------- */
screens['section/portfolio'] = () => {
  const sec = state.user?.section || 'S21';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Portfolio ${sec}`, right: `<button class="topbar__btn">${ICONS.upload}</button>` })}
      <div class="segmented" style="margin: 0 16px 8px; width: calc(100% - 32px)">
        <button class="segmented__item" data-link="#/section/calendrier">Calendrier</button>
        <button class="segmented__item segmented__item--active" data-link="#/section/portfolio">Portfolio</button>
        <button class="segmented__item" data-link="#/section/membres">Membres</button>
      </div>
      <div class="portfolio">
        <div class="portfolio__notice">
          ${ICONS.shield}
          <div>Photos validées par le cadre. Tu peux retirer ton image à tout moment.</div>
        </div>
        ${DATA.portfolio.map((p, i) => `
          <div style="position:relative">
            ${blob({ kind: p.kind, label: p.label, svg: p.svg })}
            ${p.badge ? `<div class="portfolio__badge">${p.badge}</div>` : ''}
          </div>`).join('')}
      </div>
      ${bottomNav('section/calendrier')}
    </section>`;
};

/* -------- 10c. Section · Membres -------- */
screens['section/membres'] = () => {
  const sec = state.user?.section || 'S21';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Membres ${sec}` })}
      <div class="segmented" style="margin: 0 16px 8px; width: calc(100% - 32px)">
        <button class="segmented__item" data-link="#/section/calendrier">Calendrier</button>
        <button class="segmented__item" data-link="#/section/portfolio">Portfolio</button>
        <button class="segmented__item segmented__item--active" data-link="#/section/membres">Membres</button>
      </div>
      <div class="section-title">Cadres</div>
      <div style="padding: 0 16px">
        ${DATA.members.filter(m => m.role === 'cadre').map(m => memberRow(m)).join('')}
      </div>
      <div class="section-title">Volontaires · ${DATA.members.filter(m => m.role === 'jeune').length}</div>
      <div style="padding: 0 16px 24px">
        ${DATA.members.filter(m => m.role === 'jeune').map(m => memberRow(m)).join('')}
      </div>
      ${bottomNav('section/calendrier')}
    </section>`;
};
function memberRow(m) {
  return `
    <div style="display:grid; grid-template-columns: 36px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--bg-stroke);">
      <div class="msg__avatar ${m.color === 'orange' ? 'msg__avatar--orange' : m.color === 'green' ? 'msg__avatar--green' : ''}" style="width: 36px; height: 36px; font-size: 13px;">${m.initials}</div>
      <div>
        <div style="font-family: var(--font-display); font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: .04em">${m.name}</div>
        <div style="font-size: 11px; color: var(--ink-500)">${m.title}</div>
      </div>
      ${m.online ? `<span style="width:8px; height:8px; border-radius:999px; background: var(--green-fluo);"></span>` : ''}
    </div>`;
}

/* -------- 11. Tchat -------- */
screens.tchat = () => {
  const sec = state.user?.section || 'S21';
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: `Tchat · ${sec}`, right: `<span style="color: var(--green); font-family: var(--font-mono); font-size: 12px; align-self: center">● 23</span>` })}
      <div class="chat">
        <div class="chat__mod">${ICONS.shield} Modéré par Sgt Bertin · règles de la charte</div>
        ${DATA.chat.map(m => {
          if (m.pinned) return `<div class="chat__pin">${ICONS.pin} ${m.text}</div>`;
          if (m.mine) return `
            <div class="msg msg--mine">
              <div>
                <div class="msg__bubble">${m.text}</div>
                <div class="msg__meta">${m.time}</div>
              </div>
            </div>`;
          return `
            <div class="msg">
              <div class="msg__avatar ${m.color === 'orange' ? 'msg__avatar--orange' : m.color === 'green' ? 'msg__avatar--green' : ''}">${m.initials}</div>
              <div>
                <div class="msg__name">${m.name}${m.cadre ? `<span class="msg__name-tag">CADRE</span>` : ''}</div>
                <div class="msg__bubble">${m.text}</div>
                <div class="msg__meta">${m.time}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="composer">
        <button class="composer__btn" aria-label="Joindre">${ICONS.paperclip}</button>
        <input class="composer__input" placeholder="Message · ${sec}" />
        <button class="composer__send" aria-label="Envoyer" data-toast="Message envoyé (démo)">${ICONS.send}</button>
      </div>
    </section>`;
};

/* -------- 12. Code de la route -------- */
screens.code = () => {
  const q = DATA.codeQuestion;
  const selected = state.codeSelected || 'B';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Code de la route · 47/120` })}
      <div class="code-progress"><div class="code-progress__bar" style="width: 39%"></div></div>
      <div class="code-q">
        <div class="code-q__num">Question 47 · ${q.theme}</div>
        <div class="code-q__text">${q.text}</div>
        <div class="code-q__media">
          ${blob({ kind: 'navy', svg: 'dots' })}
          <div class="code-q__caption">// Schéma intersection 4 voies</div>
        </div>
        ${q.options.map(o => `
          <button class="code-opt ${selected === o.letter ? 'code-opt--selected' : ''}" data-code-opt="${o.letter}">
            <div class="code-opt__letter">${o.letter}</div>
            <div>${o.text}</div>
          </button>`).join('')}
        <button class="btn btn--navy btn--block mt-4" data-toast="Bonne réponse · +1 point">Valider ma réponse</button>
        <div class="text-center mt-4 muted" style="font-size: 12px; padding-bottom: 24px">
          Score moyen section : 78%
        </div>
      </div>
      ${bottomNav('section/calendrier')}
    </section>`;
};

/* -------- 13. Notes (carnet) -------- */
screens.notes = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Mes notes', right: `<button class="topbar__btn" data-link="#/notes/nouveau">${ICONS.plus}</button>` })}
    <div class="notes">
      ${DATA.notes.map(n => `
        <div class="note-card">
          <div class="note-card__title">${n.title}</div>
          <div class="note-card__excerpt">${n.excerpt}</div>
          <div class="note-card__meta">${n.module} · ${n.date}</div>
        </div>`).join('')}
    </div>
    ${bottomNav('accueil')}
  </section>`;

screens['notes/nouveau'] = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Nouvelle note', right: `<button class="topbar__btn" data-toast="Note enregistrée">${ICONS.check}</button>` })}
    <div class="form" style="padding-top: 8px">
      <div class="field">
        <label class="field__label">Titre</label>
        <input class="field__input" placeholder="Cours du 12 mai" />
      </div>
      <div class="field">
        <label class="field__label">Module / cours</label>
        <select class="field__select">
          <option>Module 3 · Auto-école</option>
          <option>Module 1 · Citoyenneté</option>
          <option>Module 2 · Remise à niveau</option>
          <option>Atelier mécanique</option>
          <option>Sport</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label">Contenu</label>
        <textarea class="field__textarea" placeholder="Tape tes notes ici…" style="min-height: 240px"></textarea>
      </div>
      <button class="btn btn--fluo btn--block">Enregistrer</button>
    </div>
  </section>`;

/* -------- 14. Ressources pédagogiques -------- */
screens.ressources = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Ressources' })}
    <div class="chips" style="padding: 4px 16px 8px">
      <button class="chip chip--active">Tout</button>
      <button class="chip">Module 3</button>
      <button class="chip">Code</button>
      <button class="chip">Mécanique</button>
      <button class="chip">Sport</button>
    </div>
    <div class="res-list">
      ${DATA.resources.map(r => `
        <button class="res-item" data-toast="Ouverture · ${r.title}">
          <div class="res-item__icon">${ICONS[r.icon] || ICONS.folder}</div>
          <div>
            <div style="font-family: var(--font-display); font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: .04em">${r.title}</div>
            <div style="font-size: 11px; color: var(--ink-500); margin-top: 2px">${r.meta}</div>
          </div>
          ${ICONS.chevronRight}
        </button>`).join('')}
    </div>
    ${bottomNav('accueil')}
  </section>`;

/* -------- 15. Emploi / offres -------- */
screens.emploi = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Offres d\'emploi' })}
    <div class="chips" style="padding: 4px 16px 8px">
      <button class="chip chip--active">Toutes</button>
      <button class="chip">Mécanique</button>
      <button class="chip">Logistique</button>
      <button class="chip">Restauration</button>
      <button class="chip">17 · La Rochelle</button>
      <button class="chip">Alternance</button>
    </div>
    <div class="screen__scroll" style="padding-top: 8px">
      ${DATA.jobs.map(j => `
        <div class="offer" data-link="#/emploi/${j.id}">
          <div class="offer__row">
            <span class="offer__tag">${j.type}</span>
            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--ink-500)">${j.posted}</span>
          </div>
          <div class="offer__title">${j.title}</div>
          <div class="offer__meta">${j.company} · ${j.city}</div>
          <div class="offer__pills">
            ${j.tags.map(t => `<span class="offer__pill">${t}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    ${bottomNav('emploi')}
  </section>`;

/* -------- 16. Profil (Moi) -------- */
screens.moi = () => {
  const u = state.user;
  const items = [
    [ICONS.user,     'Informations',    '#/moi/infos'],
    [ICONS.shield,   'Sécurité',        '#/moi/securite'],
    [ICONS.bell,     'Notifications',   '#/moi/notifications'],
    [ICONS.users,    'Inviter ma famille', '#/moi/inviter'],
    [ICONS.book,     'Charte & RGPD',   '#/moi/charte'],
    [ICONS.help,     'Aide & contact',  '#/moi/aide'],
  ];
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ center: 'Moi' })}
      <div class="profile-hero">
        <div class="profile-hero__avatar">${initials(u.firstName, u.lastName)}</div>
        <div class="profile-hero__name">${u.firstName} ${u.lastName}</div>
        <div class="profile-hero__role">${u.role === 'jeune' ? `Volontaire · ${u.section}` : u.role === 'cadre' ? `Sergent · ${u.section}` : u.role === 'famille' ? 'Famille · invitation' : 'Visiteur'}</div>
      </div>
      <div class="profile-list">
        ${items.map(([icon, label, link]) => `
          <button class="profile-item" data-toast="Réglages bientôt disponibles">
            <div class="profile-item__icon">${icon}</div>
            <div class="profile-item__name">${label}</div>
            <div style="color: var(--ink-300)">${ICONS.chevronRight}</div>
          </button>`).join('')}
      </div>
      <div class="section-title">Démo · changer de profil</div>
      <div class="px-4" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
        <button class="btn btn--ghost-ink btn--sm" data-demo="visitor">Visiteur</button>
        <button class="btn btn--ghost-ink btn--sm" data-demo="jeune">Jeune</button>
        <button class="btn btn--ghost-ink btn--sm" data-demo="cadre">Cadre</button>
        <button class="btn btn--ghost-ink btn--sm" data-demo="famille">Famille</button>
      </div>
      <div class="px-4" style="padding-top: 12px; padding-bottom: 24px">
        <button class="btn btn--ghost-ink btn--block" data-action="logout">Se déconnecter</button>
      </div>
      ${bottomNav('moi')}
    </section>`;
};

/* -------- 17. Pilote (cadre) -------- */
screens.pilote = () => {
  const sec = state.user?.section || 'S21';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      <div class="pilot-hero">
        <img src="./assets/img/blob-dots.svg" alt="" style="position:absolute; right:-30px; top:-30px; width:200px; opacity:.7"/>
        <div class="pilot-hero__role">Sergent · Pilotage ${sec}</div>
        <div class="pilot-hero__name">Bertin, T.</div>
        <div class="pilot-hero__stats">
          <div>
            <div class="pilot-hero__num">22</div>
            <div class="pilot-hero__lbl">volontaires</div>
          </div>
          <div>
            <div class="pilot-hero__num" style="color: #FF6B6B">3</div>
            <div class="pilot-hero__lbl">signalements</div>
          </div>
          <div>
            <div class="pilot-hero__num">12</div>
            <div class="pilot-hero__lbl">évén. semaine</div>
          </div>
        </div>
      </div>

      <div class="alert-list">
        <div class="alert-list__head">
          <span>À traiter</span>
          <span class="alert-list__count">3</span>
        </div>
        <button class="alert-item" data-link="#/pilote/moderation">
          <div class="alert-item__icon">${ICONS.shield}</div>
          <div>
            <div class="alert-item__title">Message signalé · Tchat ${sec}</div>
            <div class="alert-item__sub">Inès T. · « … » — 2 vues</div>
          </div>
          ${ICONS.chevronRight}
        </button>
        <button class="alert-item" data-link="#/pilote/moderation">
          <div class="alert-item__icon alert-item__icon--photo">${ICONS.image}</div>
          <div>
            <div class="alert-item__title">12 photos à valider</div>
            <div class="alert-item__sub">Soumises par Karim · marche Coubre</div>
          </div>
          ${ICONS.chevronRight}
        </button>
        <button class="alert-item" data-link="#/pilote/evenement-nouveau">
          <div class="alert-item__icon alert-item__icon--cal">${ICONS.calendar}</div>
          <div>
            <div class="alert-item__title">Visite entreprise · 13/05</div>
            <div class="alert-item__sub">Confirmer l'horaire avec Carrefour</div>
          </div>
          ${ICONS.chevronRight}
        </button>
      </div>

      <div class="section-title">Section ${sec} · aujourd'hui</div>
      <div class="attendance">
        <div class="attendance__head">
          <div class="attendance__h">Présents</div>
          <div class="attendance__num">21/22</div>
        </div>
        <div class="attendance__bar"><div class="attendance__fill" style="width: 95%"></div></div>
        <div class="attendance__note">
          <span>1 absence non justifiée</span>
          <a href="#" style="color: var(--green); font-family: var(--font-display); font-size: 12px; letter-spacing: .06em; text-transform: uppercase">Voir</a>
        </div>
      </div>

      <div class="px-4" style="padding-bottom: 20px">
        <button class="btn btn--fluo btn--block" data-link="#/pilote/evenement-nouveau">+ Nouvel événement</button>
      </div>
      ${bottomNav('pilote')}
    </section>`;
};

/* -------- 18. Nouvel événement (cadre) -------- */
screens['pilote/evenement-nouveau'] = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Nouvel événement', right: `<button class="btn btn--fluo btn--sm" data-toast="Événement publié">Publier</button>` })}
    <div class="form">
      <div class="field">
        <label class="field__label">Titre</label>
        <input class="field__input" value="Visite Carrefour Logistique" />
      </div>
      <div class="field">
        <label class="field__label">Type</label>
        <select class="field__select"><option>Sortie pédagogique · Insertion</option><option>Sport collectif</option><option>Cérémonie</option><option>Cours</option></select>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px">
        <div class="field">
          <label class="field__label">Date</label>
          <input class="field__input" value="Mar. 13 mai" />
        </div>
        <div class="field">
          <label class="field__label">Heure</label>
          <input class="field__input" value="14:00 – 17:00" />
        </div>
      </div>
      <div class="field">
        <label class="field__label">Lieu</label>
        <input class="field__input" value="Aytré · zone Atlantique" />
      </div>
      <div class="field">
        <label class="field__label">Sections concernées</label>
        <input class="field__input" value="S21 · S22" />
      </div>
      <div class="field">
        <label class="field__label">Description</label>
        <textarea class="field__textarea">Visite plateforme logistique. Tenue de service. Calots. Transport assuré.</textarea>
      </div>

      <div class="section-title" style="padding: 8px 0 4px">Notification</div>
      <label class="card" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 14px;">
        <span>Push aux volontaires</span>
        <input type="checkbox" checked style="width: 36px; height: 22px; accent-color: var(--green);" />
      </label>
      <label class="card" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 14px;">
        <span>Visible côté famille (vue simplifiée)</span>
        <input type="checkbox" checked style="width: 36px; height: 22px; accent-color: var(--green);" />
      </label>
      <label class="card" style="display:flex; justify-content: space-between; align-items: center; padding: 14px;">
        <span>Confirmer la présence demandée</span>
        <input type="checkbox" style="width: 36px; height: 22px; accent-color: var(--green);" />
      </label>
    </div>
  </section>`;

/* -------- 19. Modération (cadre) -------- */
screens['pilote/moderation'] = () => `
  <section class="screen screen--white">
    ${statusbar()}
    ${topbar({ back: true, center: `Modération · ${state.user?.section || 'S21'}` })}

    <div class="mod-card">
      <div class="mod-card__head">
        <span class="mod-card__pill">● Signalé · 2 vues</span>
        <span class="mod-card__time">Il y a 12 min</span>
      </div>
      <div class="mod-card__name">Inès T. · Tchat S21</div>
      <div class="mod-card__text">« [Message masqué — propos déplacés signalés par 2 volontaires] »</div>
      <div class="mod-card__reason">Motif : propos inappropriés</div>
      <div class="mod-actions">
        <button class="btn btn--dark" data-toast="Message masqué maintenu">Maintenir masqué</button>
        <button class="btn btn--ghost-ink" data-toast="Message réaffiché">Réafficher</button>
        <button class="btn btn--ghost-ink" data-toast="Avertissement envoyé">Avertir l'auteur</button>
        <button class="btn btn--dark" data-toast="Cas escaladé à l'admin">Escalader</button>
      </div>
    </div>

    <div class="mod-photos">
      <div class="mod-photos__head">Photos à valider · 12</div>
      <div class="gallery" style="padding: 0">
        ${DATA.modPhotos.map(p => `
          <div class="photo-validate">
            ${blob({ kind: p.kind, label: p.label, svg: p.svg })}
            <div class="photo-validate__actions">
              <button class="photo-validate__btn" data-toast="Photo validée">${ICONS.check}</button>
              <button class="photo-validate__btn photo-validate__btn--reject" data-toast="Photo refusée">${ICONS.close}</button>
              <span class="photo-validate__counter">${p.idx}/12</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
    ${bottomNav('pilote/moderation')}
  </section>`;

/* -------- 20. Suivi & stats (cadre) -------- */
screens['pilote/suivi'] = () => {
  const tab = state.statsTab || 'presence';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Suivi ${state.user?.section || 'S21'}`, right: `<button class="topbar__btn">${ICONS.download}</button>` })}
      <div class="tabs">
        ${[['presence','Présence'],['code','Code'],['stages','Stages'],['bien-etre','Bien-être']].map(([k,l]) => `
          <button class="tabs__tab ${tab === k ? 'tabs__tab--active' : ''}" data-stats-tab="${k}">${l}</button>`).join('')}
      </div>
      <div class="chart">
        <div class="chart__head">Taux de présence · 30J</div>
        <div class="chart__bars">
          ${[80,90,85,75,95,88,92,70,98,90,95,92].map((h, i) => `
            <div class="chart__bar ${i % 2 === 0 ? '' : 'chart__bar--alt'}" style="height: ${h}%"></div>`).join('')}
        </div>
        <div class="chart__axis"><span>12 avr</span><span>27 avr</span><span>12 mai</span></div>
      </div>
      <div class="leaderboard">
        <div class="leaderboard__h">Top volontaires · Code</div>
        ${[
          ['KB', 'Karim B.', 92, 'green'],
          ['LM', 'Léa M.',   47, 'orange'],
          ['IT', 'Inès T.',  34, 'orange'],
          ['JB', 'Julien B.',28, 'navy'],
        ].map(([init, name, pts, color]) => `
          <div class="leaderboard__row">
            <div class="leaderboard__avatar leaderboard__avatar--${color}">${init}</div>
            <div>
              <div class="leaderboard__name">${name}</div>
              <div class="leaderboard__bar"><div class="leaderboard__fill" style="width: ${(pts/120)*100}%"></div></div>
            </div>
            <div class="leaderboard__pts">${pts}/120</div>
          </div>`).join('')}
      </div>
      ${bottomNav('pilote/suivi')}
    </section>`;
};

/* -------- 21. Famille · Photos -------- */
screens['famille/photos'] = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ center: 'Photos · Léa', right: `<button class="topbar__btn">${ICONS.heart}</button>` })}
    <div class="screen__scroll">
      <div class="portfolio">
        <div class="portfolio__notice">
          ${ICONS.shield}
          <div>Photos partagées par Léa et validées par son cadre.</div>
        </div>
        ${DATA.portfolio.map(p => `
          <div style="position:relative">
            ${blob({ kind: p.kind, label: p.label, svg: p.svg })}
            ${p.badge ? `<div class="portfolio__badge">${p.badge}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>
    ${bottomNav('famille/photos')}
  </section>`;

/* -------- 22. Famille · Tchat -------- */
screens['famille/tchat'] = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: 'Léa · ma fille' })}
    <div class="chat">
      <div class="chat__mod">${ICONS.shield} Canal privé · uniquement toi et Léa</div>
      <div class="msg">
        <div class="msg__avatar msg__avatar--green">LM</div>
        <div>
          <div class="msg__name">Léa</div>
          <div class="msg__bubble">Salut maman, on a fait sport ce matin au stade, c'était dur 😅</div>
          <div class="msg__meta">08:42</div>
        </div>
      </div>
      <div class="msg msg--mine">
        <div>
          <div class="msg__bubble">Courage ma puce, t'es géniale 💪</div>
          <div class="msg__meta">08:50</div>
        </div>
      </div>
      <div class="msg">
        <div class="msg__avatar msg__avatar--green">LM</div>
        <div>
          <div class="msg__name">Léa</div>
          <div class="msg__bubble">Cet aprem j'ai code, je te raconte ce soir ❤️</div>
          <div class="msg__meta">09:01</div>
        </div>
      </div>
    </div>
    <div class="composer">
      <button class="composer__btn">${ICONS.paperclip}</button>
      <input class="composer__input" placeholder="Message à Léa" />
      <button class="composer__send" data-toast="Message envoyé (démo)">${ICONS.send}</button>
    </div>
  </section>`;

/* -------- 404 -------- */
screens.notfound = () => `
  <section class="screen screen--cream">
    ${statusbar()}
    ${topbar({ back: true, center: '404' })}
    <div class="empty">
      <div class="empty__icon">${ICONS.compass}</div>
      <h3 class="h3">Page introuvable</h3>
      <p class="muted">Ce parcours n'existe pas encore dans la maquette.</p>
      <button class="btn btn--navy" data-link="#/">Retour à l'accueil</button>
    </div>
  </section>`;

/* ============================================================
   Router
   ============================================================ */
function getRoute() {
  const h = location.hash.replace(/^#\//, '');
  return h || '';
}

function navigate(hash) {
  if (location.hash === hash) { render(); return; }
  location.hash = hash;
}

function resolveScreen() {
  const route = getRoute();
  if (!route) return screens.onboarding();
  if (screens[route]) return screens[route]();
  // sub-routes : emploi/:id
  if (route.startsWith('emploi/')) {
    const id = route.split('/')[1];
    const job = DATA.jobs.find(j => j.id === id);
    if (job) return offerDetail(job);
  }
  return screens.notfound();
}

function offerDetail(j) {
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Offre', right: `<button class="topbar__btn">${ICONS.heart}</button>` })}
      <div class="screen__scroll">
        <div class="px-4">
          <span class="offer__tag">${j.type}</span>
          <h1 class="h2" style="margin-top: 12px">${j.title}</h1>
          <p class="muted" style="margin-top: 6px">${j.company} · ${j.city}</p>
          <div class="offer__pills">${j.tags.map(t => `<span class="offer__pill">${t}</span>`).join('')}</div>
        </div>
        <div class="section-title">Profil recherché</div>
        <div class="px-4">
          <p>${j.description || 'Tu sors de formation SMV, tu as ton permis B et l\'envie d\'apprendre un métier de terrain. Cette offre est faite pour toi.'}</p>
        </div>
        <div class="section-title">Conditions</div>
        <div class="px-4" style="padding-bottom: 24px">
          <p>${j.conditions || 'Contrat ' + j.type + ', démarrage à l\'issue de ta formation SMV. Mutuelle, primes terrain.'}</p>
          <button class="btn btn--fluo btn--block mt-6" data-toast="Candidature transmise via le SMV">Postuler via le SMV</button>
        </div>
      </div>
      ${bottomNav('emploi')}
    </section>`;
}

/* ============================================================
   Render & events
   ============================================================ */
function render() {
  const route = getRoute();
  $app.innerHTML = resolveScreen();
  document.body.scrollTop = 0;
  $app.scrollTop = 0;
}

window.addEventListener('hashchange', render);

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link) {
    e.preventDefault();
    navigate(link.getAttribute('data-link'));
    return;
  }
  const back = e.target.closest('[data-action="back"]');
  if (back) { history.length > 1 ? history.back() : navigate('#/'); return; }
  const logoutBtn = e.target.closest('[data-action="logout"]');
  if (logoutBtn) { logout(); return; }
  const toastBtn = e.target.closest('[data-toast]');
  if (toastBtn) { toast(toastBtn.getAttribute('data-toast')); return; }

  // Gallery filter
  const gal = e.target.closest('[data-gallery]');
  if (gal) { state.galleryFilter = gal.getAttribute('data-gallery'); render(); return; }

  // Code option
  const opt = e.target.closest('[data-code-opt]');
  if (opt) { state.codeSelected = opt.getAttribute('data-code-opt'); render(); return; }

  // Stats tab
  const tab = e.target.closest('[data-stats-tab]');
  if (tab) { state.statsTab = tab.getAttribute('data-stats-tab'); render(); return; }

  // Demo role switch
  const demo = e.target.closest('[data-demo]');
  if (demo) {
    const role = demo.getAttribute('data-demo');
    if (role === 'visitor') { state.user = null; save(); navigate('#/decouvrir'); return; }
    setUser({
      firstName: role === 'cadre' ? 'Thomas' : role === 'famille' ? 'Sophie' : 'Léa',
      lastName:  role === 'cadre' ? 'Bertin' : role === 'famille' ? 'Morel' : 'Morel',
      role,
      section: role === 'famille' ? 'S21' : 'S21',
    });
    navigate(role === 'cadre' ? '#/pilote' : role === 'famille' ? '#/famille/photos' : '#/accueil');
    return;
  }

  // Signup flow
  const signupRole = e.target.closest('[data-signup-role]');
  if (signupRole) {
    state.signupForm = { ...(state.signupForm || {}), role: signupRole.getAttribute('data-signup-role') };
    render(); return;
  }
  const signupComp = e.target.closest('[data-signup-compagnie]');
  if (signupComp) {
    state.signupForm = { ...(state.signupForm || {}), compagnie: parseInt(signupComp.getAttribute('data-signup-compagnie'), 10), section: null };
    render(); return;
  }
  const signupSec = e.target.closest('[data-signup-section]');
  if (signupSec) {
    state.signupForm = { ...(state.signupForm || {}), section: signupSec.getAttribute('data-signup-section') };
    render(); return;
  }
  if (e.target.closest('[data-signup-next]')) {
    if (e.target.closest('[data-signup-next]').hasAttribute('disabled')) return;
    state.signupStep = (state.signupStep || 1) + 1;
    render(); return;
  }
  if (e.target.closest('[data-signup-finish]')) {
    if (e.target.closest('[data-signup-finish]').hasAttribute('disabled')) return;
    const f = state.signupForm || {};
    setUser({
      firstName: f.firstName || 'Léa',
      lastName: f.lastName || 'Morel',
      role: f.role || 'jeune',
      section: f.section || 'S21',
      email: f.email,
    });
    state.signupStep = 1; state.signupForm = {}; save();
    navigate(f.role === 'cadre' ? '#/pilote' : f.role === 'famille' ? '#/famille/photos' : '#/accueil');
    toast('Bienvenue ' + (f.firstName || ''));
    return;
  }
});

// Live input bindings for signup
document.addEventListener('input', (e) => {
  const inp = e.target.closest('[data-signup-input]');
  if (inp) {
    const key = inp.getAttribute('data-signup-input');
    state.signupForm = { ...(state.signupForm || {}), [key]: inp.value };
    // ne ré-render que pour le bouton activable — minimal flash
    const next = document.querySelector('[data-signup-next], [data-signup-finish]');
    if (next) {
      const f = state.signupForm;
      const enabled =
        (state.signupStep === 2 && f.role === 'famille' && (f.inviteCode || '').length === 6) ||
        (state.signupStep === 3 && f.firstName && f.lastName);
      enabled ? next.removeAttribute('disabled') : next.setAttribute('disabled','');
    }
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const kind = form.getAttribute('data-form');
  if (kind === 'contact') {
    toast('Demande envoyée à la cellule recrutement.');
    setTimeout(() => navigate('#/decouvrir'), 800);
  }
  if (kind === 'login') {
    // démo : crée un jeune par défaut
    setUser({ firstName: 'Léa', lastName: 'Morel', role: 'jeune', section: 'S21' });
    navigate('#/accueil');
  }
});

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  if (!location.hash) navigate('#/');
  else render();
  // service worker (PWA)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}
boot();
