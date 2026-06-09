/* ============================================================
   Mon SMV · Application beta
   - DB locale + auth PBKDF2 + sauvegardes 12 slots
   - Pré-inscription par admin/mod (k.nom + mdp initial)
   - Force changement de mdp au 1ᵉʳ login
   - Public : candidature, login, famille/rejoindre
   - Jeune / Cadre / Famille / Admin / Mod / Recrutement / Fondateur
   ============================================================ */

import { ICONS } from './icons.js';
import {
  db, onChange, getLogoUrl, logAction,
  getBackups, backupNow, restoreBackup, deleteBackup,
} from './db.js';
import {
  initAuth, onAuthChange,
  login as authLogin, logout as authLogout, changePassword,
  resetPasswordByAdmin, currentUser, ROLES_LABELS, RELATIONSHIPS,
  canAccessAdmin, canAccessBackups, canAccessRecrutement, slug, genInviteCode,
  createUser,
} from './auth.js';
import { seedIfEmpty } from './seed.js';
import { supabase } from './supabase-client.js';
import * as Admin from './screens-admin.js';
import * as Social from './social.js';

/* ----------------------------------------------------------
   UI state éphémère (filtres, brouillons)
   ---------------------------------------------------------- */
const ui = {
  galleryFilter: 'tout',
  codeSelected: 'B',
  statsTab: 'presence',
  signupStep: 1,
  signupForm: {},
  loginError: null,
  banner: null,
  usersQuery: '',
};

const $app = document.getElementById('app');

/* ----------------------------------------------------------
   Helpers UI
   ---------------------------------------------------------- */
function html(strings, ...values) { return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), ''); }
function escapeHtml(s) { return (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function initials(f = '', l = '') { return ((f[0] || '') + (l[0] || '')).toUpperCase(); }

function statusbar() {
  return `
    <div class="statusbar">
      <span>9:41</span>
      <span class="statusbar__right">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</span>
    </div>`;
}
function topbar({ back = false, title = '', right = '', center = '' } = {}) {
  const left = back
    ? `<button class="topbar__btn" data-action="back" aria-label="Retour">${ICONS.chevronLeft}</button>`
    : `<div class="topbar__spacer"></div>`;
  const r = right || `<div class="topbar__spacer"></div>`;
  return `<div class="topbar">${left}<div class="topbar__center">${center || title}</div>${r}</div>`;
}

function blob({ kind = 'navy', label = '', svg = 'dots' } = {}) {
  const src = svg === 'fluo' ? './assets/img/blob-fluo.svg' : './assets/img/blob-dots.svg';
  return `<div class="blob blob--${kind}"><img class="blob__svg" src="${src}" alt="" />${label ? `<span class="blob__label">${label}</span>` : ''}</div>`;
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// Erreurs non gérées (promesses rejetées dans des handlers) → toast visible
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || e.reason || 'Erreur inconnue';
  console.error('Unhandled rejection:', e.reason);
  toast('⚠️ ' + msg, 'error');
});
window.addEventListener('error', (e) => {
  if (e.error) {
    console.error('Window error:', e.error);
    toast('⚠️ ' + (e.error.message || e.message), 'error');
  }
});

function bottomNav(role, active) {
  let items = [];
  if (role === 'visitor') items = [
    ['decouvrir',  'Accueil', ICONS.home],
    ['galerie',    'Galerie', ICONS.image],
    ['visite',     'Visite',  ICONS.map],
    ['candidature','Contact', ICONS.send],
  ];
  else if (role === 'jeune') items = [
    ['accueil',              'Accueil', ICONS.home],
    ['section/calendrier',   'Section', ICONS.calendar],
    ['tchat',                'Tchat',   ICONS.chat],
    ['emploi',               'Emploi',  ICONS.briefcase],
    ['moi',                  'Moi',     ICONS.user],
  ];
  else if (role === 'cadre') items = [
    ['pilote',                'Pilote',  ICONS.home],
    ['section/calendrier',    'Section', ICONS.calendar],
    ['pilote/moderation',     'Modé.',   ICONS.shield],
    ['pilote/suivi',          'Suivi',   ICONS.chart],
    ['moi',                   'Moi',     ICONS.user],
  ];
  else if (role === 'famille') items = [
    ['famille/photos', 'Photos', ICONS.image],
    ['famille/tchat',  'Tchat',  ICONS.chat],
    ['moi',            'Moi',    ICONS.user],
  ];
  if (items.length === 0) return '';
  return `
    <nav class="bottom-nav">
      ${items.map(([slug, label, icon]) => `
        <button class="bottom-nav__item ${active === slug ? 'bottom-nav__item--active' : ''}" data-link="#/${slug}">
          ${icon}<span>${label}</span>
        </button>`).join('')}
    </nav>`;
}

/* Sidebar admin (utilisée sur desktop pour les rôles admin/mod/recru/fondateur).
   Sur mobile, l'admin-header__nav (scrollable horizontalement) fait le job. */
function adminSidebar(active, user) {
  // Source unique de vérité : adminNavItems exporté depuis screens-admin
  const items = Admin.adminNavItems(user);
  return `
    <nav class="bottom-nav">
      ${items.map(([slug, label, icon]) => `
        <button class="bottom-nav__item ${active === slug ? 'bottom-nav__item--active' : ''}" data-link="#/${slug}">
          ${icon}<span>${label}</span>
        </button>`).join('')}
      <button class="bottom-nav__item" data-action="logout" style="margin-top: auto; color: var(--red)">
        ${ICONS.logout}<span>Déconnexion</span>
      </button>
    </nav>`;
}

/* ============================================================
   SCREENS · Public
   ============================================================ */
function screenOnboarding() {
  const s = db.getSettings();
  return `
    <section class="screen screen--dark">
      ${statusbar()}
      <div class="onboarding">
        <img class="onboarding__blob" src="./assets/img/blob-fluo.svg" alt="" aria-hidden="true" />
        <div class="onboarding__regiment">3<sup>E</sup> RSMV · LA ROCHELLE</div>
        <h1 class="onboarding__title">${escapeHtml(s.onboardingTitle).replace('tracée.', '<em>tracée.</em>').replace('seconde chance,', 'seconde<br/>chance,')}</h1>
        <p class="onboarding__sub">${escapeHtml(s.onboardingSub)}</p>
        <div class="onboarding__actions">
          <button class="btn btn--fluo btn--block" data-link="#/decouvrir">Je découvre →</button>
          <button class="btn btn--ghost btn--block" data-link="#/connexion">J'ai un compte</button>
        </div>
        <div class="onboarding__foot">
          <span>${escapeHtml((s.websiteUrl || 'le-smv.gouv.fr').replace(/https?:\/\//, ''))}</span>
          <span>armé pour l'avenir</span>
        </div>
      </div>
    </section>`;
}

function screenDecouvrir() {
  const s = db.getSettings();
  const jeunes = db.count('users', (u) => u.role === 'jeune');
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Le 3ᵉ RSMV' })}
      <div class="screen__scroll">
        <div class="hero">
          <img class="hero__blob" src="./assets/img/blob-dots.svg" alt="" />
          <div class="hero__eyebrow">// Hero · formation militaire</div>
          <h1 class="hero__title">Armé pour<br/><em>l'avenir.</em></h1>
        </div>
        <div class="grid-2">
          <div class="stat"><div class="stat__num">6–8</div><div class="stat__lbl">mois de formation</div></div>
          <div class="stat"><div class="stat__num stat__num--fluo">80%</div><div class="stat__lbl">vers l'emploi</div></div>
        </div>
        <div class="grid-2">
          <div class="stat"><div class="stat__num">${db.count('sections')}</div><div class="stat__lbl">sections actives</div></div>
          <div class="stat"><div class="stat__num" style="font-size:28px">GRATUIT</div><div class="stat__lbl">encadré · logé · nourri</div></div>
        </div>
        <div class="parcours">
          <div class="parcours__title">Le parcours</div>
          ${[
            ['01', 'Formation militaire', '1 mois · sport, vivre ensemble, savoir-être'],
            ['02', 'Remise à niveau', '3 mois · scolaire, permis, citoyenneté'],
            ['03', 'Spécialité métier', '2-3 mois · atelier, logistique, restauration'],
            ['04', 'Stage entreprise', '1 mois · immersion terrain'],
            ['05', 'Insertion emploi', 'CDI, alternance, formation qualifiante'],
          ].map(([n, t, d]) => `
            <div class="parcours__item">
              <div class="parcours__num">${n}</div>
              <div><div class="parcours__name">${t}</div><div class="parcours__desc">${d}</div></div>
            </div>`).join('')}
        </div>

        ${nextIncorporationCard()}

        ${latestArticlesCard(3)}

        <div class="px-4" style="padding-bottom: 20px">
          <button class="btn btn--navy btn--block" data-link="#/candidature">${s.candidatureButtonLabel || 'Envoyer ma demande'}</button>
          <button class="btn btn--ghost-ink btn--block mt-4" data-link="#/connexion">J'ai déjà un compte</button>
        </div>
      </div>
      ${bottomNav('visitor', 'decouvrir')}
    </section>`;
}

/* Composants partagés (utilisés sur découvrir + accueil) */
function nextIncorporationCard() {
  const incos = db.filter('incorporations', (i) => i.open).sort((a, b) => `${a.year}-${String(a.month).padStart(2,'0')}`.localeCompare(`${b.year}-${String(b.month).padStart(2,'0')}`));
  const next = incos[0];
  if (!next) return '';
  const formations = db.filter('formations', (f) => f.incorporationId === next.id);
  return `
    <div class="section-title section-title--green">Prochaine incorporation</div>
    <div class="px-4" style="padding-bottom: 8px">
      <div class="card" style="padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
          <div>
            <div style="font-family: var(--font-display); font-weight: 700; font-size: 22px; text-transform: uppercase; letter-spacing: .02em">${escapeHtml(next.label)}</div>
            <div class="muted" style="font-size: 12px; margin-top: 2px">Formations proposées</div>
          </div>
          <span class="tag tag--green">ouverte</span>
        </div>
        ${formations.length > 0 ? `
          <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
            ${formations.map((f) => `
              <div style="display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; background: var(--bg-cream); border-radius: 10px;">
                <div>
                  <div style="font-family: var(--font-display); font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: .04em">${escapeHtml(f.name)}</div>
                  <div style="font-size: 11px; color: var(--ink-500); margin-top: 2px">Code <code>${escapeHtml(f.code)}</code>${f.duration ? ' · ' + escapeHtml(f.duration) : ''}</div>
                </div>
              </div>`).join('')}
          </div>` : '<p class="muted" style="margin: 10px 0 0; font-size: 12px">Formations à venir.</p>'}
      </div>
    </div>`;
}

function latestArticlesCard(limit = 3) {
  const articles = db.filter('news', (n) => n.published !== false).slice(0, limit);
  if (articles.length === 0) return '';
  return `
    <div class="section-title">Dernières actualités</div>
    <div style="padding: 0 16px 8px;">
      ${articles.map((n) => `
        <div class="card" style="margin-bottom: 10px; display:grid; grid-template-columns: 78px 1fr; gap: 12px; padding: 10px">
          <div style="width:78px; aspect-ratio:1; border-radius:12px; overflow:hidden">${blob({ kind: n.kind || 'navy', svg: 'dots' })}</div>
          <div style="align-self:center">
            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--green); letter-spacing: .08em; text-transform: uppercase">${escapeHtml(n.date || '')}</div>
            <div style="font-family: var(--font-display); font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: .03em; margin-top: 2px">${escapeHtml(n.title)}</div>
            <div style="font-size: 12px; color: var(--ink-500); margin-top: 2px">${escapeHtml(n.excerpt || '')}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function instagramEmbedCard() {
  const s = db.getSettings();
  const embed = (s.instagramEmbed || '').trim();
  const handle = (s.instagramHandle || '').trim();
  if (!embed && !handle) return '';
  if (embed && /<iframe/i.test(embed)) {
    return `<div class="section-title">Instagram du régiment</div>
      <div class="px-4" style="padding-bottom: 12px;">
        <div class="card" style="padding: 0; overflow: hidden;">${embed}</div>
      </div>`;
  }
  if (handle) {
    const url = `https://instagram.com/${handle.replace(/^@/, '')}`;
    return `<div class="section-title">Instagram du régiment</div>
      <div class="px-4" style="padding-bottom: 12px;">
        <a class="card" href="${url}" target="_blank" rel="noopener" style="display: flex; align-items: center; gap: 12px; padding: 14px; text-decoration: none;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5); display: grid; place-items: center;">
            <svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="white"/></svg>
          </div>
          <div>
            <div style="font-family: var(--font-display); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; font-size: 13px;">Suis-nous sur Instagram</div>
            <div style="font-size: 12px; color: var(--ink-500); margin-top: 2px;">@${escapeHtml(handle.replace(/^@/, ''))}</div>
          </div>
        </a>
      </div>`;
  }
  return '';
}

function screenGalerie() {
  const filters = ['Tout', 'Sport', 'Formation', 'Cérémonies', 'Stage'];
  const items = [
    { kind: 'navy',      label: '// Sport · matin',     cat: 'sport',      svg: 'dots' },
    { kind: 'green',     label: '// Auto-école',        cat: 'formation',  svg: 'fluo' },
    { kind: 'navy',      label: '// Cérémonie calot',   cat: 'cérémonies', svg: 'dots' },
    { kind: 'green',     label: '// Atelier mécanique', cat: 'formation',  svg: 'fluo' },
    { kind: 'lightblue', label: '// Section S21',       cat: 'sport',      svg: 'dots' },
    { kind: 'navy',      label: '// Stage entreprise',  cat: 'stage',      svg: 'dots' },
    { kind: 'green',     label: '// Marche · Coubre',   cat: 'sport',      svg: 'fluo' },
    { kind: 'navy',      label: '// Cérémonie CAPI',    cat: 'cérémonies', svg: 'dots' },
  ];
  const cat = ui.galleryFilter;
  const filtered = items.filter((i) => cat === 'tout' || i.cat.toLowerCase() === cat);
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Le SMV en images' })}
      <div class="screen__scroll">
        <div class="chips" style="padding: 4px 16px 12px">
          ${filters.map((f) => `<button class="chip ${f.toLowerCase() === cat ? 'chip--active' : ''}" data-gallery="${f.toLowerCase()}">${f}</button>`).join('')}
        </div>
        <div class="gallery">${filtered.map((i) => blob({ kind: i.kind, label: i.label, svg: i.svg })).join('')}</div>
      </div>
      ${bottomNav('visitor', 'galerie')}
    </section>`;
}

function screenVisite() {
  const s = db.getSettings();
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Visite virtuelle' })}
      <div class="screen__scroll">
        <div class="hero" style="margin: 8px 16px 16px">
          <img class="hero__blob" src="./assets/img/blob-fluo.svg" alt="" />
          <div class="hero__eyebrow">// 360° · caserne Beauregard</div>
          <h1 class="hero__title" style="font-size: 34px; margin-top: 100px">Découvre<br/><em>nos lieux.</em></h1>
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
              <div style="width:92px; aspect-ratio: 1; border-radius: 14px; overflow:hidden;">${blob({ kind, svg: 'dots' })}</div>
              <div style="align-self:center">
                <div style="font-family: var(--font-display); font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: .04em">${name}</div>
                <div style="font-size: 12px; color: var(--ink-500); margin-top: 2px">${sub}</div>
              </div>
              <div style="align-self:center; color: var(--ink-300)">${ICONS.chevronRight}</div>
            </div>`).join('')}
        </div>
        <div class="px-4" style="padding-bottom: 20px">
          ${s.visiteUrl
            ? `<a class="btn btn--navy btn--block" href="${escapeHtml(s.visiteUrl)}" target="_blank" rel="noopener">Lancer la visite 360° ↗</a>`
            : `<button class="btn btn--navy btn--block" data-toast="Visite 360° bientôt disponible">Lancer la visite 360°</button>`}
        </div>
      </div>
      ${bottomNav('visitor', 'visite')}
    </section>`;
}

function screenCandidature() {
  const s = db.getSettings();
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Recrutement' })}
      <div class="screen__scroll">
        <div class="recruit-head">
          <h1 class="recruit-head__title">On reprend<br/>contact avec <em>toi.</em></h1>
          <p class="recruit-head__sub">${escapeHtml(s.candidatureMessage)}</p>
        </div>
        <form class="form" data-form="candidature">
          <div class="field"><label class="field__label">Prénom</label><input class="field__input" name="firstName" required /></div>
          <div class="field"><label class="field__label">Nom</label><input class="field__input" name="lastName" required /></div>
          <div class="field"><label class="field__label">Âge</label><input class="field__input" type="number" name="age" min="16" max="40" required /></div>
          <div class="field"><label class="field__label">Code postal</label><input class="field__input" name="postalCode" required /></div>
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
          <div class="field"><label class="field__label">Email</label><input class="field__input" type="email" name="email" required /></div>
          <div class="field"><label class="field__label">Téléphone</label><input class="field__input" type="tel" name="phone" required /></div>
          <label class="checkbox mt-4">
            <input type="checkbox" name="rgpd" required checked />
            <span>${escapeHtml(s.rgpdMention)}</span>
          </label>
          <button class="btn btn--fluo btn--block mt-6" type="submit">${escapeHtml(s.candidatureButtonLabel)}</button>
        </form>
      </div>
      ${bottomNav('visitor', 'candidature')}
    </section>`;
}

/* ============================================================
   SCREENS · Auth
   ============================================================ */
function screenConnexion() {
  return `
    <section class="screen screen--dark">
      ${statusbar()}
      ${topbar({ back: true })}
      <div class="auth-wrap">
        <div class="auth-wrap__brand">
          <img src="${getLogoUrl()}" alt="" />
          <div><small>3ᵉ RSMV · La Rochelle</small><strong>${escapeHtml(db.getSettings().applicationName || 'Mon SMV')}</strong></div>
        </div>
        <div class="eyebrow">// connexion</div>
        <h2 class="auth-wrap__title">Te voilà<br/><em>de retour.</em></h2>

        ${ui.loginError ? `<div class="banner banner--error">${ICONS.alert}<div>${escapeHtml(ui.loginError)}</div></div>` : ''}

        <form data-form="login" style="display:flex; flex-direction: column; gap: 12px;">
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Identifiant</label>
            <input class="field__input" name="username" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ex. admin · l.morel · t.bertin" required />
            <div class="field__hint" style="color: rgba(255,255,255,.5); font-size: 11px; margin-top: 4px">Identifiant simple (sans @). Tu peux aussi utiliser ton email.</div>
          </div>
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Mot de passe</label>
            <input class="field__input" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="btn btn--fluo btn--block mt-4" type="submit">${ICONS.key}<span>Se connecter</span></button>
        </form>

        <div class="demo-creds">
          <strong>Comptes de démo</strong><br/>
          • admin <strong>admin</strong> / <strong>admin123</strong><br/>
          • modérateur <strong>mod</strong> / <strong>mod1234</strong><br/>
          • recrutement <strong>recrutement</strong> / <strong>recrutement</strong><br/>
          • fondateur <strong>fondateur</strong> / <strong>fondateur</strong><br/>
          • cadre <strong>t.bertin</strong> / <strong>cadre1</strong><br/>
          • jeune <strong>l.morel</strong> / <strong>jeune1</strong>
        </div>
      </div>
    </section>`;
}

function screenChangePassword(forced = true) {
  const u = currentUser();
  return `
    <section class="screen screen--dark">
      ${statusbar()}
      ${topbar({ center: forced ? 'Premier accès' : 'Mot de passe' })}
      <div class="auth-wrap">
        <div class="eyebrow">// sécurité</div>
        <h2 class="auth-wrap__title">${forced ? 'Choisis ton<br/><em>nouveau mdp.</em>' : 'Mot de <em>passe.</em>'}</h2>
        <p class="muted" style="color: rgba(255,255,255,.7); margin-bottom: 20px">
          ${forced ? `Bienvenue ${u.firstName}. Pour ta sécurité, change le mot de passe initial fourni par l'administrateur. Minimum 8 caractères.` : 'Modifie ton mot de passe.'}
        </p>

        ${ui.banner ? `<div class="banner banner--${ui.banner.kind}">${ICONS.alert}<div>${escapeHtml(ui.banner.msg)}</div></div>` : ''}

        <form data-form="change-password" style="display:flex; flex-direction: column; gap: 12px;">
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Nouveau mot de passe</label>
            <input class="field__input" name="password" type="password" minlength="8" required />
          </div>
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Confirmer</label>
            <input class="field__input" name="password2" type="password" minlength="8" required />
          </div>
          <button class="btn btn--fluo btn--block mt-4" type="submit">Mettre à jour</button>
        </form>
      </div>
    </section>`;
}

/* ============================================================
   SCREENS · Jeune
   ============================================================ */
function screenAccueil() {
  const u = currentUser();
  const today = '2026-05-12';
  const events = db.filter('events', (e) => e.sec === u.section && e.day === today)
                   .sort((a, b) => a.time.localeCompare(b.time));
  const dateLabel = new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `
    <section class="screen screen--white">
      ${statusbar()}
      <div class="greeting">
        <div class="greeting__avatar">${initials(u.firstName, u.lastName)}</div>
        <div class="greeting__date">${dateLabel}</div>
        <h1 class="greeting__name">Bonjour,<br/><em>${escapeHtml(u.firstName)}.</em></h1>
        <div class="now">
          <span class="now__chip">${u.section || ''}</span>
          <div class="now__lbl">${events[1] ? `Maintenant · ${events[1].time}` : 'Aujourd\'hui'}</div>
          <div class="now__title">${events[1]?.title || 'Quartier libre'}</div>
          <div class="now__sub">${events[1]?.sub || ''}</div>
        </div>
      </div>

      <div class="today">
        <div class="today__head">Aujourd'hui</div>
        ${events.length === 0 ? `<p class="muted" style="padding: 16px 0">Aucun événement planifié.</p>` : events.slice(0, 4).map((e) => `
          <div class="today__row">
            <div class="today__time">${e.time}</div>
            <div><div class="today__title">${escapeHtml(e.title)}</div><div class="today__sub">${escapeHtml(e.sub)}</div></div>
          </div>`).join('')}
      </div>

      <div class="section-title">Accès rapide</div>
      <div class="tiles">
        <button class="tile" data-link="#/code"><div class="tile__icon">${ICONS.car}</div><div><div class="tile__name">Code</div><div class="tile__count">120 fiches</div></div></button>
        <button class="tile" data-link="#/emploi"><div class="tile__icon">${ICONS.briefcase}</div><div><div class="tile__name">Offres</div><div class="tile__count">${db.count('jobs', (j) => j.published !== false)} actives</div></div></button>
        <button class="tile" data-link="#/notes"><div class="tile__icon">${ICONS.notebook}</div><div><div class="tile__name">Mes notes</div><div class="tile__count">${db.count('notes', (n) => n.userId === u.id)} brouillons</div></div></button>
        <button class="tile" data-link="#/ressources"><div class="tile__icon">${ICONS.folder}</div><div><div class="tile__name">Ressources</div><div class="tile__count">Module 3</div></div></button>
      </div>

      ${nextIncorporationCard()}

      ${latestArticlesCard(3)}

      ${instagramEmbedCard()}

      <div style="padding: 0 16px 24px"></div>
      ${bottomNav('jeune', 'accueil')}
    </section>`;
}

function screenSection(sub = 'calendrier') {
  const u = currentUser();
  const sec = u.section || 'S21';
  const role = u.role;
  const segs = `
    <div class="segmented" style="margin: 0 16px 8px; width: calc(100% - 32px)">
      <button class="segmented__item ${sub === 'calendrier' ? 'segmented__item--active' : ''}" data-link="#/section/calendrier">Calendrier</button>
      <button class="segmented__item ${sub === 'portfolio' ? 'segmented__item--active' : ''}" data-link="#/section/portfolio">Portfolio</button>
      <button class="segmented__item ${sub === 'membres' ? 'segmented__item--active' : ''}" data-link="#/section/membres">Membres</button>
    </div>`;

  let body = '';
  if (sub === 'calendrier') {
    const events = db.filter('events', (e) => e.sec === sec).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
    body = `
      <div class="weekstrip">
        ${['L','M','M','J','V','S','D'].map((d, i) => {
          const n = 12 + i;
          return `<div class="weekstrip__cell ${n === 13 ? 'weekstrip__cell--active' : ''}"><div class="weekstrip__d">${d}</div><div class="weekstrip__n">${n}</div></div>`;
        }).join('')}
      </div>
      <div class="schedule">
        ${events.length === 0 ? `<p class="muted" style="padding: 16px">Aucun événement planifié.</p>` : events.map((e) => `
          <div class="schedule__row">
            <div class="schedule__time">${e.time}</div>
            <div>
              <div class="schedule__title">${escapeHtml(e.title)}</div>
              <div class="schedule__sub">${escapeHtml(e.sub)}</div>
            </div>
          </div>`).join('')}
      </div>`;
  } else if (sub === 'portfolio') {
    const photos = [
      { kind: 'navy',      label: '// Cérémonie calot', svg: 'dots',  badge: '🏅 12/04' },
      { kind: 'green',     label: '// Marche · Coubre', svg: 'fluo' },
      { kind: 'navy',      label: '// Atelier garage',  svg: 'dots' },
      { kind: 'lightblue', label: '// Visite La Pallice', svg: 'dots' },
      { kind: 'green',     label: '// Sport collectif', svg: 'fluo' },
      { kind: 'navy',      label: '// Cérémonie CAPI',  svg: 'dots' },
    ];
    body = `
      <div class="portfolio">
        <div class="portfolio__notice">
          ${ICONS.shield}<div>Photos validées par le cadre. Tu peux retirer ton image à tout moment.</div>
        </div>
        ${photos.map((p) => `<div style="position:relative">${blob({ kind: p.kind, label: p.label, svg: p.svg })}${p.badge ? `<div class="portfolio__badge">${p.badge}</div>` : ''}</div>`).join('')}
      </div>`;
  } else {
    const cadres = db.filter('users', (u2) => u2.section === sec && u2.role === 'cadre');
    const jeunes = db.filter('users', (u2) => u2.section === sec && u2.role === 'jeune');
    body = `
      <div class="section-title">Cadres</div>
      <div style="padding: 0 16px">
        ${cadres.length === 0 ? `<p class="muted" style="padding: 8px 0">Aucun cadre rattaché.</p>` : cadres.map(memberRow).join('')}
      </div>
      <div class="section-title">Volontaires · ${jeunes.length}</div>
      <div style="padding: 0 16px 24px">
        ${jeunes.length === 0 ? `<p class="muted" style="padding: 8px 0">Aucun volontaire affecté.</p>` : jeunes.map(memberRow).join('')}
      </div>`;
  }

  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Section ${sec}` })}
      ${segs}${body}
      ${bottomNav(role, 'section/calendrier')}
    </section>`;
}
function memberRow(m) {
  return `
    <div style="display:grid; grid-template-columns: 36px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--bg-stroke);">
      <div class="msg__avatar" style="width: 36px; height: 36px; font-size: 13px;">${initials(m.firstName, m.lastName)}</div>
      <div>
        <div style="font-family: var(--font-display); font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: .04em">${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</div>
        <div style="font-size: 11px; color: var(--ink-500)">${m.role === 'cadre' ? 'Cadre' : 'Volontaire'}${m.username ? ' · @' + m.username : ''}</div>
      </div>
    </div>`;
}

function screenTchat() {
  const u = currentUser();
  const sec = u.section || 'S21';
  const messages = db.filter('messages', (m) => m.channel === sec).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: `Tchat · ${sec}` })}
      <div class="chat">
        <div class="chat__mod">${ICONS.shield} Modéré · règles de la charte</div>
        ${messages.length === 0 ? `<p class="muted" style="padding: 16px 0; text-align:center">Aucun message. Lance la conversation 👇</p>` : messages.map((m) => {
          const a = db.byId('users', m.userId);
          const mine = a?.id === u.id;
          const time = (m.at || '').slice(11, 16);
          if (mine) return `<div class="msg msg--mine"><div><div class="msg__bubble">${escapeHtml(m.text)}</div><div class="msg__meta">${time}</div></div></div>`;
          return `
            <div class="msg">
              <div class="msg__avatar">${initials(a?.firstName, a?.lastName)}</div>
              <div>
                <div class="msg__name">${escapeHtml(a?.firstName || '')} ${escapeHtml((a?.lastName || '')[0] || '')}.${a?.role === 'cadre' ? '<span class="msg__name-tag">CADRE</span>' : ''}</div>
                <div class="msg__bubble">${escapeHtml(m.text)}</div>
                <div class="msg__meta">${time}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <form class="composer" data-form="message" data-channel="${sec}">
        <button class="composer__btn" type="button" aria-label="Joindre">${ICONS.paperclip}</button>
        <input class="composer__input" name="text" placeholder="Message · ${sec}" required />
        <button class="composer__send" type="submit" aria-label="Envoyer">${ICONS.send}</button>
      </form>
    </section>`;
}

function screenCode() {
  const q = {
    theme: 'Priorités',
    text: 'Dans cette intersection, dans quel ordre passent les véhicules ?',
    options: [
      { letter: 'A', text: 'Rouge → Bleu → Vert' },
      { letter: 'B', text: 'Bleu → Vert → Rouge' },
      { letter: 'C', text: 'Vert → Rouge → Bleu' },
      { letter: 'D', text: 'Tous en même temps' },
    ],
  };
  const sel = ui.codeSelected;
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: 'Code de la route · 47/120' })}
      <div class="code-progress"><div class="code-progress__bar" style="width: 39%"></div></div>
      <div class="code-q">
        <div class="code-q__num">Question 47 · ${q.theme}</div>
        <div class="code-q__text">${q.text}</div>
        <div class="code-q__media">${blob({ kind: 'navy', svg: 'dots' })}<div class="code-q__caption">// Schéma intersection 4 voies</div></div>
        ${q.options.map((o) => `<button class="code-opt ${sel === o.letter ? 'code-opt--selected' : ''}" data-code-opt="${o.letter}"><div class="code-opt__letter">${o.letter}</div><div>${o.text}</div></button>`).join('')}
        <button class="btn btn--navy btn--block mt-4" data-toast="Bonne réponse · +1 point">Valider</button>
        <div class="text-center mt-4 muted" style="font-size: 12px; padding-bottom: 24px">Score moyen section : 78%</div>
      </div>
      ${bottomNav('jeune', 'section/calendrier')}
    </section>`;
}

function screenNotes() {
  const u = currentUser();
  const notes = db.filter('notes', (n) => n.userId === u.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Mes notes', right: `<button class="topbar__btn" data-link="#/notes/nouveau">${ICONS.plus}</button>` })}
      <div class="notes">
        ${notes.length === 0 ? `<div class="empty"><div class="empty__icon">${ICONS.notebook}</div><h3 class="h3">Pas encore de notes</h3><p class="muted">Tape sur + pour commencer ton carnet.</p></div>` : notes.map((n) => `
          <div class="note-card">
            <div class="note-card__title">${escapeHtml(n.title)}</div>
            <div class="note-card__excerpt">${escapeHtml(n.content).slice(0, 120)}${n.content.length > 120 ? '…' : ''}</div>
            <div class="note-card__meta">${escapeHtml(n.module || '')} · ${new Date(n.createdAt).toLocaleDateString('fr-FR')}</div>
          </div>`).join('')}
      </div>
      ${bottomNav('jeune', 'accueil')}
    </section>`;
}
function screenNoteNew() {
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Nouvelle note' })}
      <form class="form" data-form="note" style="padding-top: 8px">
        <div class="field"><label class="field__label">Titre</label><input class="field__input" name="title" required /></div>
        <div class="field"><label class="field__label">Module / cours</label>
          <select class="field__select" name="module">
            <option>Module 3 · Auto-école</option>
            <option>Module 1 · Citoyenneté</option>
            <option>Module 2 · Remise à niveau</option>
            <option>Atelier mécanique</option>
            <option>Sport</option>
          </select>
        </div>
        <div class="field"><label class="field__label">Contenu</label><textarea class="field__textarea" name="content" style="min-height: 240px" required></textarea></div>
        <button class="btn btn--fluo btn--block" type="submit">Enregistrer</button>
      </form>
    </section>`;
}

function screenRessources() {
  const items = [
    { icon: 'pdf',    title: 'Fiche code · Priorités', meta: 'PDF · 2 pages' },
    { icon: 'video',  title: 'Vidéo · Vidange moteur', meta: 'Vidéo · 6 min' },
    { icon: 'pdf',    title: 'Citoyenneté · institutions', meta: 'PDF · 8 pages' },
    { icon: 'folder', title: 'Banque exercices · français', meta: '12 fichiers' },
    { icon: 'pdf',    title: 'CV type SMV', meta: 'PDF · 1 page' },
    { icon: 'video',  title: 'Vidéo · Présentation orale', meta: 'Vidéo · 4 min' },
  ];
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Ressources' })}
      <div class="chips" style="padding: 4px 16px 8px">
        <button class="chip chip--active">Tout</button>
        <button class="chip">Module 3</button>
        <button class="chip">Code</button>
        <button class="chip">Mécanique</button>
      </div>
      <div class="res-list">
        ${items.map((r) => `
          <button class="res-item" data-toast="Ouverture · ${r.title}">
            <div class="res-item__icon">${ICONS[r.icon] || ICONS.folder}</div>
            <div>
              <div style="font-family: var(--font-display); font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: .04em">${r.title}</div>
              <div style="font-size: 11px; color: var(--ink-500); margin-top: 2px">${r.meta}</div>
            </div>${ICONS.chevronRight}
          </button>`).join('')}
      </div>
      ${bottomNav('jeune', 'accueil')}
    </section>`;
}

function screenEmploi() {
  const jobs = db.filter('jobs', (j) => j.published !== false);
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: "Offres d'emploi" })}
      <div class="chips" style="padding: 4px 16px 8px">
        <button class="chip chip--active">Toutes</button>
        <button class="chip">Mécanique</button>
        <button class="chip">Logistique</button>
        <button class="chip">17 · La Rochelle</button>
        <button class="chip">Alternance</button>
      </div>
      <div class="screen__scroll" style="padding-top: 8px">
        ${jobs.length === 0 ? `<p class="muted text-center" style="padding: 24px">Aucune offre disponible.</p>` : jobs.map((j) => `
          <div class="offer" data-link="#/emploi/${j.id}">
            <div class="offer__row"><span class="offer__tag">${j.type}</span><span style="font-family: var(--font-mono); font-size: 10px; color: var(--ink-500)">${j.posted}</span></div>
            <div class="offer__title">${escapeHtml(j.title)}</div>
            <div class="offer__meta">${escapeHtml(j.company)} · ${escapeHtml(j.city)}</div>
            <div class="offer__pills">${(j.tags || []).map((t) => `<span class="offer__pill">${escapeHtml(t)}</span>`).join('')}</div>
          </div>`).join('')}
      </div>
      ${bottomNav('jeune', 'emploi')}
    </section>`;
}
function screenEmploiDetail(id) {
  const j = db.byId('jobs', id);
  if (!j) return screenNotFound();
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Offre' })}
      <div class="screen__scroll">
        <div class="px-4">
          <span class="offer__tag">${j.type}</span>
          <h1 class="h2" style="margin-top: 12px">${escapeHtml(j.title)}</h1>
          <p class="muted" style="margin-top: 6px">${escapeHtml(j.company)} · ${escapeHtml(j.city)}</p>
          <div class="offer__pills">${(j.tags || []).map((t) => `<span class="offer__pill">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
        <div class="section-title">Description</div>
        <div class="px-4"><p>${escapeHtml(j.description || '—')}</p></div>
        <div class="section-title">Postuler</div>
        <div class="px-4" style="padding-bottom: 24px">
          <p>La candidature passe par la cellule recrutement du SMV — elle relaie ton CV à <code style="font-family: var(--font-mono)">${escapeHtml(j.email || db.getSettings().candidatureEmail)}</code>.</p>
          <button class="btn btn--fluo btn--block mt-6" data-action="apply-job" data-id="${j.id}">Postuler via le SMV</button>
        </div>
      </div>
      ${bottomNav('jeune', 'emploi')}
    </section>`;
}

/* ---------- Famille (jeune invite) ---------- */
function screenFamilleInviter() {
  const u = currentUser();
  const invites = db.filter('invitations', (i) => i.jeuneId === u.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Inviter ma famille' })}
      <div class="screen__scroll">
        <div class="px-4" style="padding-top: 8px">
          <p class="muted">Génère un code à 6 caractères pour un proche. Précise le lien de parenté.</p>
        </div>
        <form class="form" data-form="famille-invite">
          <div class="field">
            <label class="field__label">Lien de parenté</label>
            <select class="field__select" name="relationship" required>
              ${RELATIONSHIPS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label">Email du proche (optionnel)</label>
            <input class="field__input" type="email" name="email" placeholder="pour le retrouver dans le panel admin" />
          </div>
          <button class="btn btn--fluo btn--block" type="submit">Générer un code d'invitation</button>
        </form>
        <div class="section-title">Mes invitations</div>
        <div class="px-4" style="padding-bottom: 24px">
          ${invites.length === 0 ? `<p class="muted">Aucune invitation pour le moment.</p>` : invites.map((i) => {
            const rel = RELATIONSHIPS.find((r) => r.value === i.relationship)?.label || i.relationship;
            return `
              <div class="card" style="margin-bottom: 10px; padding: 14px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center">
                <div>
                  <div style="font-family: var(--font-display); font-weight: 600; text-transform: uppercase; letter-spacing: .04em">${rel}</div>
                  <div class="muted" style="font-size: 12px; margin-top: 2px">${i.email || 'sans email'} · ${i.status}</div>
                  <div style="font-family: var(--font-mono); font-weight: 700; font-size: 22px; letter-spacing: 4px; margin-top: 6px; color: var(--green)">${i.code}</div>
                </div>
                <button class="btn btn--ghost-ink btn--sm" data-action="invite-copy" data-code="${i.code}">${ICONS.copy}<span>Copier</span></button>
              </div>`;
          }).join('')}
        </div>
      </div>
      ${bottomNav('jeune', 'moi')}
    </section>`;
}

/* ---------- Famille rejoindre (public) ---------- */
function screenFamilleRejoindre() {
  return `
    <section class="screen screen--dark">
      ${statusbar()}
      ${topbar({ back: true, center: 'Rejoindre' })}
      <div class="auth-wrap">
        <div class="eyebrow">// invitation famille</div>
        <h2 class="auth-wrap__title">Code d'<em>invitation.</em></h2>
        <p class="muted" style="color: rgba(255,255,255,.7); margin-bottom: 20px">Saisis le code à 6 caractères reçu de ton proche au SMV, ainsi que tes informations.</p>
        ${ui.banner ? `<div class="banner banner--${ui.banner.kind}">${ICONS.alert}<div>${escapeHtml(ui.banner.msg)}</div></div>` : ''}
        <form data-form="famille-rejoindre" style="display:flex; flex-direction: column; gap: 12px;">
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Code (6 caractères)</label>
            <input class="field__input" name="code" maxlength="6" style="text-transform: uppercase; letter-spacing: 4px; text-align: center; font-family: var(--font-mono); font-size: 22px" required />
          </div>
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Prénom</label>
            <input class="field__input" name="firstName" required />
          </div>
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Nom</label>
            <input class="field__input" name="lastName" required />
          </div>
          <div class="field" style="margin: 0">
            <label class="field__label" style="color: rgba(255,255,255,.7)">Mot de passe</label>
            <input class="field__input" name="password" type="password" minlength="8" required />
          </div>
          <button class="btn btn--fluo btn--block mt-4" type="submit">Activer mon compte</button>
        </form>
      </div>
    </section>`;
}

/* ---------- Profil "Moi" pour tous les rôles connectés ---------- */
function screenMoi() {
  const u = currentUser();
  const isJeune = u.role === 'jeune';
  const adminAccess = canAccessAdmin(u);
  const recruAccess = canAccessRecrutement(u);
  const backupAccess = canAccessBackups(u);
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ center: 'Moi' })}
      <div class="profile-hero">
        <div class="profile-hero__avatar">${initials(u.firstName, u.lastName)}</div>
        <div class="profile-hero__name">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</div>
        <div class="profile-hero__role">${ROLES_LABELS[u.role]}${u.section ? ' · ' + u.section : ''}</div>
        <div class="muted" style="font-family: var(--font-mono); font-size: 11px; margin-top: 6px; color: rgba(255,255,255,.55)">@${u.username}</div>
      </div>
      <div class="profile-list">
        ${isJeune ? `<button class="profile-item" data-link="#/famille/inviter"><div class="profile-item__icon">${ICONS.users}</div><div class="profile-item__name">Inviter ma famille</div><div style="color:var(--ink-300)">${ICONS.chevronRight}</div></button>` : ''}
        <button class="profile-item" data-link="#/moi/mdp"><div class="profile-item__icon">${ICONS.key}</div><div class="profile-item__name">Changer mon mot de passe</div><div style="color:var(--ink-300)">${ICONS.chevronRight}</div></button>
        ${adminAccess ? `<button class="profile-item" data-link="#/admin"><div class="profile-item__icon">${ICONS.cog}</div><div class="profile-item__name">Panel administration</div><div style="color:var(--ink-300)">${ICONS.chevronRight}</div></button>` : ''}
        ${recruAccess ? `<button class="profile-item" data-link="#/recrutement"><div class="profile-item__icon">${ICONS.graduation}</div><div class="profile-item__name">Panel recrutement</div><div style="color:var(--ink-300)">${ICONS.chevronRight}</div></button>` : ''}
        ${backupAccess ? `<button class="profile-item" data-link="#/fondateur/sauvegardes"><div class="profile-item__icon">${ICONS.database}</div><div class="profile-item__name">Sauvegardes (fondateur)</div><div style="color:var(--ink-300)">${ICONS.chevronRight}</div></button>` : ''}
        <button class="profile-item" data-action="logout"><div class="profile-item__icon">${ICONS.logout}</div><div class="profile-item__name">Se déconnecter</div><div style="color:var(--ink-300)">${ICONS.chevronRight}</div></button>
      </div>
      ${bottomNav(u.role, 'moi')}
    </section>`;
}

/* ============================================================
   SCREENS · Cadre
   ============================================================ */
function screenPilote() {
  const u = currentUser();
  const sec = u.section || 'S21';
  const jeunes = db.count('users', (j) => j.section === sec && j.role === 'jeune');
  const evenSem = db.count('events', (e) => e.sec === sec);
  return `
    <section class="screen screen--white">
      ${statusbar()}
      <div class="pilot-hero">
        <img src="./assets/img/blob-dots.svg" alt="" style="position:absolute; right:-30px; top:-30px; width:200px; opacity:.7"/>
        <div class="pilot-hero__role">${ROLES_LABELS[u.role]} · Pilotage ${sec}</div>
        <div class="pilot-hero__name">${escapeHtml(u.lastName)}, ${escapeHtml((u.firstName || '')[0])}.</div>
        <div class="pilot-hero__stats">
          <div><div class="pilot-hero__num">${jeunes}</div><div class="pilot-hero__lbl">volontaires</div></div>
          <div><div class="pilot-hero__num" style="color: #FF6B6B">${db.count('modLog', (m) => m.section === sec && m.status === 'open')}</div><div class="pilot-hero__lbl">signalements</div></div>
          <div><div class="pilot-hero__num">${evenSem}</div><div class="pilot-hero__lbl">évén. semaine</div></div>
        </div>
      </div>

      <div class="alert-list">
        <div class="alert-list__head"><span>À traiter</span><span class="alert-list__count">3</span></div>
        <button class="alert-item" data-link="#/pilote/moderation">
          <div class="alert-item__icon">${ICONS.shield}</div>
          <div><div class="alert-item__title">Messages signalés · Tchat ${sec}</div><div class="alert-item__sub">Voir la modération</div></div>
          ${ICONS.chevronRight}
        </button>
        <button class="alert-item" data-link="#/pilote/moderation">
          <div class="alert-item__icon alert-item__icon--photo">${ICONS.image}</div>
          <div><div class="alert-item__title">Photos à valider</div><div class="alert-item__sub">Portfolio section ${sec}</div></div>
          ${ICONS.chevronRight}
        </button>
        <button class="alert-item" data-link="#/pilote/evenement-nouveau">
          <div class="alert-item__icon alert-item__icon--cal">${ICONS.calendar}</div>
          <div><div class="alert-item__title">+ Nouvel événement</div><div class="alert-item__sub">Planifier une activité</div></div>
          ${ICONS.chevronRight}
        </button>
      </div>

      <div class="section-title">Section ${sec} · présents aujourd'hui</div>
      <div class="attendance">
        <div class="attendance__head"><div class="attendance__h">Présents</div><div class="attendance__num">${Math.max(0, jeunes - 1)}/${jeunes}</div></div>
        <div class="attendance__bar"><div class="attendance__fill" style="width: ${jeunes > 0 ? ((jeunes - 1)/jeunes)*100 : 0}%"></div></div>
        <div class="attendance__note"><span>1 absence non justifiée</span><a href="#" style="color: var(--green); font-family: var(--font-display); font-size: 12px; letter-spacing: .06em; text-transform: uppercase">Voir</a></div>
      </div>

      <div class="px-4" style="padding-bottom: 20px">
        <button class="btn btn--fluo btn--block" data-link="#/pilote/evenement-nouveau">+ Nouvel événement</button>
      </div>
      ${bottomNav('cadre', 'pilote')}
    </section>`;
}

function screenEvenementNouveau() {
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Nouvel événement', right: `<button class="btn btn--fluo btn--sm" data-action="publish-event">Publier</button>` })}
      <form class="form" data-form="event-new">
        <div class="field"><label class="field__label">Titre</label><input class="field__input" name="title" required /></div>
        <div class="field"><label class="field__label">Type</label><select class="field__select" name="type"><option>Sortie pédagogique</option><option>Sport</option><option>Cérémonie</option><option>Cours</option></select></div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px">
          <div class="field"><label class="field__label">Date</label><input class="field__input" type="date" name="day" required /></div>
          <div class="field"><label class="field__label">Heure</label><input class="field__input" name="time" placeholder="14:00" required /></div>
        </div>
        <div class="field"><label class="field__label">Lieu</label><input class="field__input" name="sub" /></div>
        <div class="field"><label class="field__label">Sections concernées</label><input class="field__input" name="sec" value="${currentUser().section || ''}" /></div>
        <div class="field"><label class="field__label">Description</label><textarea class="field__textarea" name="description"></textarea></div>
        <button class="btn btn--fluo btn--block" type="submit">Publier</button>
      </form>
    </section>`;
}

function screenModeration() {
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Modération · ${currentUser().section || 'S21'}` })}
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
          ${[1,2,3,4].map((idx) => `
            <div class="photo-validate">
              ${blob({ kind: idx % 2 === 0 ? 'green' : 'navy', svg: idx % 2 === 0 ? 'fluo' : 'dots' })}
              <div class="photo-validate__actions">
                <button class="photo-validate__btn" data-toast="Photo validée">${ICONS.check}</button>
                <button class="photo-validate__btn photo-validate__btn--reject" data-toast="Photo refusée">${ICONS.close}</button>
                <span class="photo-validate__counter">${idx}/12</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
      ${bottomNav('cadre', 'pilote/moderation')}
    </section>`;
}

function screenSuivi() {
  const tab = ui.statsTab;
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbar({ back: true, center: `Suivi ${currentUser().section || 'S21'}`, right: `<button class="topbar__btn">${ICONS.download}</button>` })}
      <div class="tabs">
        ${[['presence','Présence'],['code','Code'],['stages','Stages'],['bien-etre','Bien-être']].map(([k, l]) => `<button class="tabs__tab ${tab === k ? 'tabs__tab--active' : ''}" data-stats-tab="${k}">${l}</button>`).join('')}
      </div>
      <div class="chart">
        <div class="chart__head">Taux de présence · 30J</div>
        <div class="chart__bars">
          ${[80,90,85,75,95,88,92,70,98,90,95,92].map((h, i) => `<div class="chart__bar ${i % 2 === 0 ? '' : 'chart__bar--alt'}" style="height: ${h}%"></div>`).join('')}
        </div>
        <div class="chart__axis"><span>12 avr</span><span>27 avr</span><span>12 mai</span></div>
      </div>
      <div class="leaderboard">
        <div class="leaderboard__h">Top volontaires · Code</div>
        ${[['KB','Karim B.',92,'green'],['LM','Léa M.',47,'orange'],['IT','Inès T.',34,'orange'],['JB','Julien B.',28,'navy']].map(([init, name, pts, color]) => `
          <div class="leaderboard__row">
            <div class="leaderboard__avatar leaderboard__avatar--${color}">${init}</div>
            <div><div class="leaderboard__name">${name}</div><div class="leaderboard__bar"><div class="leaderboard__fill" style="width: ${(pts/120)*100}%"></div></div></div>
            <div class="leaderboard__pts">${pts}/120</div>
          </div>`).join('')}
      </div>
      ${bottomNav('cadre', 'pilote/suivi')}
    </section>`;
}

/* ============================================================
   SCREENS · Famille
   ============================================================ */
function screenFamillePhotos() {
  const u = currentUser();
  const j = db.byId('users', u.family?.of);
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ center: `Photos · ${escapeHtml(j?.firstName || '')}` })}
      <div class="screen__scroll">
        <div class="portfolio">
          <div class="portfolio__notice">
            ${ICONS.shield}<div>Photos partagées par ${escapeHtml(j?.firstName || '')} et validées par son cadre.</div>
          </div>
          ${[
            { kind: 'navy', label: '// Cérémonie calot', svg: 'dots', badge: '🏅 12/04' },
            { kind: 'green', label: '// Marche · forêt Coubre', svg: 'fluo' },
            { kind: 'navy', label: '// Atelier garage', svg: 'dots' },
            { kind: 'lightblue', label: '// Visite La Pallice', svg: 'dots' },
            { kind: 'green', label: '// Sport collectif', svg: 'fluo' },
            { kind: 'navy', label: '// Cérémonie CAPI', svg: 'dots' },
          ].map((p) => `<div style="position:relative">${blob({ kind: p.kind, label: p.label, svg: p.svg })}${p.badge ? `<div class="portfolio__badge">${p.badge}</div>` : ''}</div>`).join('')}
        </div>
      </div>
      ${bottomNav('famille', 'famille/photos')}
    </section>`;
}

function screenFamilleTchat() {
  const u = currentUser();
  const j = db.byId('users', u.family?.of);
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: `${escapeHtml(j?.firstName || '')} · ${RELATIONSHIPS.find((r) => r.value === u.family?.relationship)?.label || ''}` })}
      <div class="chat">
        <div class="chat__mod">${ICONS.shield} Canal privé · uniquement vous deux</div>
        <div class="msg">
          <div class="msg__avatar msg__avatar--green">${initials(j?.firstName, j?.lastName)}</div>
          <div>
            <div class="msg__name">${escapeHtml(j?.firstName || '')}</div>
            <div class="msg__bubble">Salut ! On a fait sport ce matin, j'ai bien dormi cette nuit 😴</div>
            <div class="msg__meta">08:42</div>
          </div>
        </div>
        <div class="msg msg--mine">
          <div>
            <div class="msg__bubble">Courage, on est fière de toi ❤️</div>
            <div class="msg__meta">08:50</div>
          </div>
        </div>
      </div>
      <form class="composer" data-form="famille-message">
        <button class="composer__btn" type="button">${ICONS.paperclip}</button>
        <input class="composer__input" name="text" placeholder="Message à ${escapeHtml(j?.firstName || '')}" required />
        <button class="composer__send" type="submit">${ICONS.send}</button>
      </form>
    </section>`;
}

/* ============================================================
   404
   ============================================================ */
function screenNotFound() {
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: '404' })}
      <div class="empty">
        <div class="empty__icon">${ICONS.compass}</div>
        <h3 class="h3">Page introuvable</h3>
        <p class="muted">Ce parcours n'existe pas.</p>
        <button class="btn btn--navy" data-link="#/">Retour à l'accueil</button>
      </div>
    </section>`;
}

function screenAccessDenied() {
  return `
    <section class="screen screen--cream">
      ${statusbar()}
      ${topbar({ back: true, center: 'Accès refusé' })}
      <div class="empty">
        <div class="empty__icon">${ICONS.lock}</div>
        <h3 class="h3">Accès refusé</h3>
        <p class="muted">Cette section n'est pas accessible avec ton rôle.</p>
        <button class="btn btn--navy" data-link="#/">Accueil</button>
      </div>
    </section>`;
}

/* ============================================================
   ROUTER
   ============================================================ */
const PUBLIC_ROUTES = new Set(['', 'decouvrir', 'galerie', 'visite', 'candidature', 'connexion', 'famille/rejoindre', 'centre']);
const ADMIN_PREFIX = ['admin', 'recrutement', 'fondateur'];

function getRoute() { return location.hash.replace(/^#\//, ''); }
function isAdminPath(r) { return ADMIN_PREFIX.some((p) => r === p || r.startsWith(p + '/')); }

function resolve() {
  const route = getRoute();
  const user = currentUser();

  // Forcer le change-password si demandé
  if (user && user.mustChangePassword && route !== 'auth/changer-mdp') {
    location.hash = '#/auth/changer-mdp';
    return screenChangePassword(true);
  }

  // Route admin/back-office : appliquer le data-mode pour le layout desktop
  document.body.dataset.mode = isAdminPath(route) ? 'admin' : '';

  // Pas connecté → seules les routes publiques sont accessibles
  if (!user) {
    if (route === '') return screenOnboarding();
    if (route === 'decouvrir')         return screenDecouvrir();
    if (route === 'galerie')           return screenGalerie();
    if (route === 'visite')            return screenVisite();
    if (route === 'candidature')       return screenCandidature();
    if (route === 'connexion')         return screenConnexion();
    if (route === 'famille/rejoindre') return screenFamilleRejoindre();
    if (route === 'centre')            return screenDecouvrir(); // legacy redirect
    // toute autre route → connexion
    location.hash = '#/connexion';
    return screenConnexion();
  }

  // Connecté
  if (route === '' || route === 'connexion') {
    // Par défaut, après login : tout le monde sur le feed social
    if (canAccessAdmin(user) && user.role !== 'cadre' && user.role !== 'jeune') location.hash = '#/admin';
    else if (user.role === 'recrutement') location.hash = '#/recrutement';
    else location.hash = '#/feed';
    return resolve();
  }

  // Anciennes routes "jeune dashboard" → redirection vers le feed social
  // (pour les utilisateurs qui ont d'anciens liens en favoris)
  const LEGACY_REDIRECTS = {
    'accueil': '#/feed',
    'tchat': '#/feed',
    'emploi': '#/feed',
    'famille/photos': '#/feed',
    'famille/tchat': '#/dm',
  };
  if (LEGACY_REDIRECTS[route] && (user.role === 'jeune' || user.role === 'famille' || user.role === 'cadre')) {
    location.hash = LEGACY_REDIRECTS[route];
    return resolve();
  }

  if (route === 'auth/changer-mdp') return screenChangePassword(true);

  // Public toujours accessibles
  if (route === 'decouvrir')   return screenDecouvrir();
  if (route === 'galerie')     return screenGalerie();
  if (route === 'visite')      return screenVisite();
  if (route === 'candidature') return screenCandidature();

  // ===== Routes réseau social =====
  if (route === 'feed') return Social.feedScreen();
  if (route === 'recherche') return Social.searchScreen(ui.searchQuery || '');
  if (route === 'composer') return Social.composerScreen(false);
  if (route === 'composer/bereal') return Social.composerScreen(true);
  if (route === 'dm') return Social.dmListScreen();
  if (route.startsWith('dm/')) return Social.dmConvScreen(route.split('/')[1]);
  if (route.startsWith('post/')) return Social.postDetailScreen(route.split('/')[1]);
  if (route.startsWith('profil/')) return Social.profileScreen(route.split('/')[1]);
  if (route.startsWith('story/')) return Social.storyScreen(route.split('/')[1]);
  if (route === 'moi/edit') return Social.moiEditScreen();

  // Admin/recrutement/fondateur
  if (isAdminPath(route)) {
    if (route === 'admin' && canAccessAdmin(user)) return Admin.adminDashboard(user);
    if (route === 'admin/utilisateurs' && canAccessAdmin(user)) return Admin.adminUsers(user, ui.usersQuery);
    if (route === 'admin/utilisateurs/nouveau' && canAccessAdmin(user)) return Admin.adminUserForm(user, 'nouveau');
    if (route.startsWith('admin/utilisateurs/') && canAccessAdmin(user)) return Admin.adminUserForm(user, route.split('/')[2]);
    if (route === 'admin/candidatures' && (canAccessAdmin(user) || canAccessRecrutement(user))) return Admin.adminCandidatures(user);
    if (route === 'admin/sections' && canAccessAdmin(user)) return Admin.adminSections(user);
    if (route === 'admin/familles' && canAccessAdmin(user)) return Admin.adminFamilles(user);
    if (route === 'admin/parametres' && canAccessAdmin(user)) return Admin.adminSettings(user);
    if (route === 'admin/audit' && canAccessAdmin(user)) return Admin.adminAudit(user, ui.auditFilters || {});
    if (route === 'admin/articles' && canAccessAdmin(user)) return Admin.adminArticles(user);
    if (route.startsWith('admin/candidatures/') && (canAccessAdmin(user) || canAccessRecrutement(user))) {
      const cid = route.split('/')[2];
      return Admin.recrutementCandidature(user, cid);
    }
    if (route === 'recrutement' && canAccessRecrutement(user)) return Admin.recrutementDashboard(user);
    if (route.startsWith('recrutement/incorporations/') && canAccessRecrutement(user)) return Admin.recrutementInco(user, route.split('/')[2]);
    if (route === 'fondateur/sauvegardes' && canAccessBackups(user)) return Admin.fondateurBackups(user);
    return screenAccessDenied();
  }

  // Famille
  if (route === 'famille/photos' && user.role === 'famille') return screenFamillePhotos();
  if (route === 'famille/tchat' && user.role === 'famille') return screenFamilleTchat();
  if (route === 'famille/inviter' && user.role === 'jeune') return screenFamilleInviter();

  // Jeune / Cadre
  if (route === 'accueil')               return screenAccueil();
  if (route === 'section/calendrier')    return screenSection('calendrier');
  if (route === 'section/portfolio')     return screenSection('portfolio');
  if (route === 'section/membres')       return screenSection('membres');
  if (route === 'tchat')                 return screenTchat();
  if (route === 'code')                  return screenCode();
  if (route === 'notes')                 return screenNotes();
  if (route === 'notes/nouveau')         return screenNoteNew();
  if (route === 'ressources')            return screenRessources();
  if (route === 'emploi')                return screenEmploi();
  if (route.startsWith('emploi/'))       return screenEmploiDetail(route.split('/')[1]);
  if (route === 'pilote' && user.role === 'cadre') return screenPilote();
  if (route === 'pilote/evenement-nouveau' && user.role === 'cadre') return screenEvenementNouveau();
  if (route === 'pilote/moderation' && (user.role === 'cadre' || canAccessAdmin(user))) return screenModeration();
  if (route === 'pilote/suivi' && user.role === 'cadre') return screenSuivi();
  if (route === 'moi')                   return screenMoi();
  if (route === 'moi/mdp')               return screenChangePassword(false);

  return screenNotFound();
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  const route = getRoute();
  const user = currentUser();
  const isAdmin = isAdminPath(route);
  let html = resolve();

  // Sur les routes admin, prépend la sidebar admin (pour layout desktop)
  if (isAdmin && user) {
    const active = computeAdminActive(route);
    html = adminSidebar(active, user) + html;
  }
  $app.innerHTML = html;

  // Promouvoir la bottom-nav éventuellement imbriquée dans .screen
  // pour qu'elle soit un enfant direct de .app (nécessaire au layout
  // desktop en grid : grid-area: nav).
  const nestedNav = $app.querySelector('.screen .bottom-nav');
  if (nestedNav) {
    $app.insertBefore(nestedNav, $app.firstChild);
  }

  document.body.scrollTop = 0;
  $app.scrollTop = 0;
}

function computeAdminActive(route) {
  if (route === 'admin' || route === '') return 'admin';
  if (route.startsWith('admin/utilisateurs')) return 'admin/utilisateurs';
  if (route.startsWith('admin/candidatures')) return 'admin/candidatures';
  if (route.startsWith('admin/articles')) return 'admin/articles';
  if (route.startsWith('admin/sections')) return 'admin/sections';
  if (route.startsWith('admin/familles')) return 'admin/familles';
  if (route.startsWith('admin/parametres')) return 'admin/parametres';
  if (route.startsWith('admin/audit')) return 'admin/audit';
  if (route.startsWith('recrutement')) return 'recrutement';
  if (route.startsWith('fondateur/sauvegardes')) return 'fondateur/sauvegardes';
  return route;
}

window.addEventListener('hashchange', render);
onChange(() => render());

/* ============================================================
   EVENT HANDLERS
   ============================================================ */

// Navigation simple
document.addEventListener('click', async (e) => {
  const link = e.target.closest('[data-link]');
  if (link) { e.preventDefault(); location.hash = link.getAttribute('data-link'); return; }

  if (e.target.closest('[data-action="back"]')) { history.length > 1 ? history.back() : (location.hash = '#/'); return; }

  /* ============ RÉSEAU SOCIAL ============ */
  if (e.target.closest('[data-action="like"]')) {
    const btn = e.target.closest('[data-action="like"]');
    const postId = btn.getAttribute('data-id');
    try {
      await Social.toggleLike(postId);
      render();
    } catch (err) { toast('Erreur like : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="post-menu"]')) {
    const btn = e.target.closest('[data-action="post-menu"]');
    const postId = btn.getAttribute('data-id');
    const p = db.byId('posts', postId);
    const me = currentUser();
    const canDelete = p?.authorId === me.id || ['admin','moderateur','cadre'].includes(me.role);
    const canHide = ['admin','moderateur','cadre'].includes(me.role);
    const options = [];
    if (canDelete) options.push('Supprimer');
    if (canHide && !p.hidden) options.push('Masquer (modération)');
    if (options.length === 0) return;
    const choice = await confirmModal(`Que faire avec ce post ?\n\n${options.join(' · ')}`, { confirmLabel: 'Supprimer', danger: true });
    if (!choice) return;
    try {
      if (canDelete) {
        await db.remove('posts', postId);
        toast('Post supprimé');
        if (location.hash.startsWith('#/post/')) location.hash = '#/feed';
      }
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="comment-delete"]')) {
    const id = e.target.closest('[data-action="comment-delete"]').getAttribute('data-id');
    if (!(await confirmModal('Supprimer ce commentaire ?', { confirmLabel: 'Supprimer', danger: true }))) return;
    try { await db.remove('comments', id); render(); } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="toggle-privacy"]')) {
    const me = currentUser();
    try {
      await db.update('users', me.id, { isPrivate: !me.isPrivate });
      toast(me.isPrivate ? 'Profil rendu public 🌍' : 'Profil rendu privé 🔒');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="bereal-trigger"]')) {
    if (!(await confirmModal('Déclencher un round BeReal de 2 minutes pour tout le monde ?', { confirmLabel: 'Déclencher' }))) return;
    try {
      await Social.triggerBereal(2);
      toast('BeReal déclenché ⏱ 2 minutes');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }

  // Burger menu admin (mobile)
  if (e.target.closest('[data-action="admin-burger"]')) {
    document.querySelector('[data-admin-drawer]')?.classList.add('is-open');
    return;
  }
  if (e.target.closest('[data-action="admin-drawer-close"]')) {
    document.querySelector('[data-admin-drawer]')?.classList.remove('is-open');
    // ne pas return — laisse le lien (href) s'exécuter
  }
  // Click sur le fond de l'offcanvas pour fermer
  if (e.target.matches('[data-admin-drawer]')) {
    e.target.classList.remove('is-open');
    return;
  }
  if (e.target.closest('[data-action="logout"]')) {
    try {
      const u = currentUser();
      if (u) await logAction(`Déconnexion de ${u.firstName} ${u.lastName}`, 'session', u.id);
      await authLogout();
      location.hash = '#/connexion';
      render();
      toast('Tu es déconnecté·e');
    } catch (err) {
      console.error('logout failed', err);
      toast('Erreur déconnexion : ' + (err?.message || err));
    }
    return;
  }
  if (e.target.closest('[data-toast]')) { toast(e.target.closest('[data-toast]').getAttribute('data-toast')); return; }

  // Galerie filter
  const gal = e.target.closest('[data-gallery]');
  if (gal) { ui.galleryFilter = gal.getAttribute('data-gallery'); render(); return; }

  // Code option
  const opt = e.target.closest('[data-code-opt]');
  if (opt) { ui.codeSelected = opt.getAttribute('data-code-opt'); render(); return; }

  // Stats tab
  const tab = e.target.closest('[data-stats-tab]');
  if (tab) { ui.statsTab = tab.getAttribute('data-stats-tab'); render(); return; }

  // Apply to job
  const applyBtn = e.target.closest('[data-action="apply-job"]');
  if (applyBtn) {
    const j = db.byId('jobs', applyBtn.getAttribute('data-id'));
    const dest = j?.email || db.getSettings().candidatureEmail;
    toast(`Candidature transmise à ${dest}`);
    return;
  }

  // Copy invite code
  const copy = e.target.closest('[data-action="invite-copy"]');
  if (copy) {
    const code = copy.getAttribute('data-code');
    try { await navigator.clipboard.writeText(code); toast(`Code "${code}" copié`); }
    catch { toast(`Code : ${code}`); }
    return;
  }

  /* ------- ADMIN actions ------- */

  // Users
  if (e.target.closest('[data-action="user-edit"]')) {
    const id = e.target.closest('[data-action="user-edit"]').getAttribute('data-id');
    location.hash = '#/admin/utilisateurs/' + id;
    return;
  }
  if (e.target.closest('[data-action="user-reset-password"]')) {
    const id = e.target.closest('[data-action="user-reset-password"]').getAttribute('data-id');
    if (!(await confirmModal('Réinitialiser le mot de passe et forcer un changement au prochain login ?'))) return;
    const newPwd = await resetPasswordByAdmin(id);
    const u = db.byId('users', id);
    logAction(`Mot de passe réinitialisé pour ${u.firstName} ${u.lastName} (@${u.username})`, 'users', u.id);
    showResetPasswordModal(u, newPwd);
    return;
  }
  if (e.target.closest('[data-action="user-toggle-active"]')) {
    const id = e.target.closest('[data-action="user-toggle-active"]').getAttribute('data-id');
    const u = db.byId('users', id);
    await db.update('users', id, { active: !u.active });
    toast(u.active ? 'Compte désactivé' : 'Compte réactivé');
    return;
  }
  if (e.target.closest('[data-action="user-delete"]')) {
    const id = e.target.closest('[data-action="user-delete"]').getAttribute('data-id');
    const u = db.byId('users', id);
    if (!(await confirmModal(`Supprimer définitivement le compte ${u.username} ? Cette action est tracée dans l'audit log.`))) return;
    await db.remove('users', id);
    toast('Compte supprimé');
    return;
  }

  /* ------- ARTICLES (news CRUD) ------- */
  if (e.target.closest('[data-action="article-add"]')) {
    const r = await inputModal({
      title: 'Nouvel article',
      fields: [
        { name: 'title', label: 'Titre', required: true },
        { name: 'excerpt', label: 'Extrait (résumé court)', type: 'textarea' },
        { name: 'date', label: 'Date affichée (ex. 12/05)', value: new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) },
        { name: 'kind', label: 'Couleur visuel', type: 'select', value: 'navy', options: [
          { value: 'navy', label: 'Marine' }, { value: 'green', label: 'Vert' }, { value: 'lightblue', label: 'Bleu clair' },
        ]},
      ],
      submitLabel: 'Publier',
    });
    if (!r) return;
    try {
      await db.insert('news', { ...r, published: true });
      toast('Article publié ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="article-edit"]')) {
    const id = e.target.closest('[data-action="article-edit"]').getAttribute('data-id');
    const n = db.byId('news', id);
    if (!n) return;
    const r = await inputModal({
      title: 'Modifier l\'article',
      fields: [
        { name: 'title', label: 'Titre', value: n.title, required: true },
        { name: 'excerpt', label: 'Extrait', type: 'textarea', value: n.excerpt || '' },
        { name: 'date', label: 'Date affichée', value: n.date || '' },
      ],
      submitLabel: 'Enregistrer',
    });
    if (!r) return;
    try { await db.update('news', id, r); toast('Article mis à jour ✓'); }
    catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="article-toggle"]')) {
    const id = e.target.closest('[data-action="article-toggle"]').getAttribute('data-id');
    const n = db.byId('news', id);
    try { await db.update('news', id, { published: !n.published }); toast(n.published ? 'Dépublié' : 'Publié ✓'); }
    catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="article-delete"]')) {
    const id = e.target.closest('[data-action="article-delete"]').getAttribute('data-id');
    if (!(await confirmModal('Supprimer cet article ?', { confirmLabel: 'Supprimer', danger: true }))) return;
    try { await db.remove('news', id); toast('Article supprimé ✓'); }
    catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }

  /* ------- CANDIDATURE workflow (statuts) ------- */
  if (e.target.closest('[data-action="cand-status"]')) {
    const btn = e.target.closest('[data-action="cand-status"]');
    const id = btn.getAttribute('data-id');
    const status = btn.getAttribute('data-status');
    try { await db.update('candidatures', id, { status }); toast(`Statut → ${status}`); }
    catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="cand-save-notes"]')) {
    const id = e.target.closest('[data-action="cand-save-notes"]').getAttribute('data-id');
    const ta = document.querySelector(`[data-cand-notes][data-id="${id}"]`);
    try { await db.update('candidatures', id, { notes: ta?.value || '' }); toast('Notes enregistrées ✓'); }
    catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }

  // Candidatures
  if (e.target.closest('[data-action="cand-promote"]')) {
    const id = e.target.closest('[data-action="cand-promote"]').getAttribute('data-id');
    const c = db.byId('candidatures', id);
    if (!(await confirmModal(`Pré-inscrire ${c.firstName} ${c.lastName} comme jeune volontaire ?`))) return;
    const { user: u, initialPassword } = await createUser({ firstName: c.firstName, lastName: c.lastName, email: c.email, role: 'jeune' });
    await db.update('candidatures', id, { status: 'traitee', linkedUserId: u.id });
    showResetPasswordModal(u, initialPassword);
    return;
  }
  if (e.target.closest('[data-action="cand-accept"]')) {
    await db.update('candidatures', e.target.closest('[data-action="cand-accept"]').getAttribute('data-id'), { status: 'traitee' });
    toast('Candidature marquée traitée');
    return;
  }
  if (e.target.closest('[data-action="cand-reject"]')) {
    await db.update('candidatures', e.target.closest('[data-action="cand-reject"]').getAttribute('data-id'), { status: 'rejetee' });
    toast('Candidature rejetée');
    return;
  }

  // Invitations
  if (e.target.closest('[data-action="inv-revoke"]')) {
    const id = e.target.closest('[data-action="inv-revoke"]').getAttribute('data-id');
    if (!(await confirmModal('Révoquer cette invitation ?'))) return;
    await db.update('invitations', id, { status: 'expiree' });
    return;
  }

  // Recrutement · incorporations
  if (e.target.closest('[data-action="inco-add"]')) {
    const r = await inputModal({
      title: 'Nouvelle incorporation',
      fields: [
        { name: 'label', label: 'Libellé (ex. Mai 2027)', placeholder: 'Mai 2027', required: true },
        { name: 'seats', label: 'Places', type: 'number', value: 132 },
      ],
      submitLabel: 'Créer',
    });
    if (!r) return;
    const sl = slug(r.label) || ('inco-' + Date.now());
    try {
      await db.insert('incorporations', { label: r.label, slug: sl, open: true, seats: r.seats || 132, seatsTaken: 0 });
      toast('Incorporation ajoutée ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="inco-edit"]')) {
    location.hash = '#/recrutement/incorporations/' + e.target.closest('[data-action="inco-edit"]').getAttribute('data-id');
    return;
  }
  if (e.target.closest('[data-action="inco-toggle"]')) {
    const id = e.target.closest('[data-action="inco-toggle"]').getAttribute('data-id');
    const i = db.byId('incorporations', id);
    try {
      await db.update('incorporations', id, { open: !i.open });
      toast(i.open ? 'Inscriptions fermées' : 'Inscriptions ouvertes');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="inco-delete"]')) {
    const id = e.target.closest('[data-action="inco-delete"]').getAttribute('data-id');
    if (!(await confirmModal('Supprimer cette incorporation et ses formations ?', { confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      for (const f of db.filter('formations', (g) => g.incorporationId === id)) {
        await db.remove('formations', f.id);
      }
      await db.remove('incorporations', id);
      toast('Incorporation supprimée ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="formation-add"]')) {
    const incoId = e.target.closest('[data-action="formation-add"]').getAttribute('data-inco');
    const r = await inputModal({
      title: 'Nouvelle formation',
      fields: [
        { name: 'code', label: 'Code (ex. AUTO, MECA)', required: true },
        { name: 'name', label: 'Nom complet', required: true },
        { name: 'duration', label: 'Durée', value: '3 mois' },
        { name: 'capacity', label: 'Capacité', type: 'number', value: 12 },
      ],
      submitLabel: 'Créer',
    });
    if (!r) return;
    try {
      await db.insert('formations', { incorporationId: incoId, code: r.code, name: r.name, duration: r.duration, capacity: r.capacity || 12 });
      toast('Formation créée ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="formation-edit"]')) {
    const id = e.target.closest('[data-action="formation-edit"]').getAttribute('data-id');
    const f = db.byId('formations', id);
    if (!f) return;
    const r = await inputModal({
      title: `Modifier formation`,
      fields: [
        { name: 'code', label: 'Code', value: f.code, required: true },
        { name: 'name', label: 'Nom', value: f.name, required: true },
        { name: 'duration', label: 'Durée', value: f.duration },
        { name: 'capacity', label: 'Capacité', type: 'number', value: f.capacity },
      ],
      submitLabel: 'Enregistrer',
    });
    if (!r) return;
    try {
      await db.update('formations', id, r);
      toast('Formation mise à jour ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="formation-delete"]')) {
    const id = e.target.closest('[data-action="formation-delete"]').getAttribute('data-id');
    if (!(await confirmModal('Supprimer cette formation ?', { confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await db.remove('formations', id);
      toast('Formation supprimée ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }

  // Backups
  if (e.target.closest('[data-action="backup-now"]')) {
    backupNow('manuel');
    toast('Sauvegarde créée');
    return;
  }
  if (e.target.closest('[data-action="backup-restore"]')) {
    const id = e.target.closest('[data-action="backup-restore"]').getAttribute('data-id');
    if (!(await confirmModal('Restaurer cette sauvegarde ? Un instantané de l\'état actuel sera créé avant.'))) return;
    if (restoreBackup(id)) toast('Sauvegarde restaurée');
    return;
  }
  if (e.target.closest('[data-action="backup-delete"]')) {
    const id = e.target.closest('[data-action="backup-delete"]').getAttribute('data-id');
    if (!(await confirmModal('Supprimer cette sauvegarde ?'))) return;
    deleteBackup(id);
    render();
    return;
  }

  // Modale close
  if (e.target.closest('[data-action="modal-close"]')) {
    document.querySelector('.modal')?.remove();
    return;
  }

  // Reset logo (admin settings)
  if (e.target.closest('[data-action="logo-reset"]')) {
    if (!(await confirmModal('Réinitialiser le logo par défaut ?'))) return;
    await db.setSettings({ logoUrl: '' });
    updateFavicon();
    toast('Logo réinitialisé');
    return;
  }

  /* ------- SECTIONS (admin) ------- */
  if (e.target.closest('[data-action="section-add"]')) {
    const r = await inputModal({
      title: 'Nouvelle section',
      fields: [
        { name: 'code', label: 'Code (ex. S31)', placeholder: 'S31', required: true },
        { name: 'name', label: 'Nom complet', placeholder: 'Section S31' },
        { name: 'compagnie', label: 'Compagnie (1, 2, 3...)', type: 'number', value: 1, required: true },
      ],
      submitLabel: 'Créer',
    });
    if (!r) return;
    const code = (r.code || '').trim().toUpperCase();
    if (!code) { toast('Code requis'); return; }
    if (db.find('sections', (s) => s.code === code)) { toast('Cette section existe déjà'); return; }
    try {
      await db.insert('sections', { code, name: r.name || ('Section ' + code), compagnie: r.compagnie, description: r.compagnie + 'ᵉ compagnie' });
      toast(`Section ${code} créée ✓`);
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="section-edit"]')) {
    const id = e.target.closest('[data-action="section-edit"]').getAttribute('data-id');
    const s = db.byId('sections', id);
    if (!s) return;
    const r = await inputModal({
      title: `Modifier ${s.code}`,
      fields: [
        { name: 'name', label: 'Nom', value: s.name, required: true },
        { name: 'compagnie', label: 'Compagnie', type: 'number', value: s.compagnie, required: true },
      ],
      submitLabel: 'Enregistrer',
    });
    if (!r) return;
    try {
      await db.update('sections', id, { name: r.name, compagnie: r.compagnie, description: r.compagnie + 'ᵉ compagnie' });
      toast('Section mise à jour ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  if (e.target.closest('[data-action="section-delete"]')) {
    const id = e.target.closest('[data-action="section-delete"]').getAttribute('data-id');
    const s = db.byId('sections', id);
    if (!s) return;
    const members = db.filter('users', (u) => u.section === s.code);
    const msg = members.length > 0
      ? `Cette section a ${members.length} membre(s). En la supprimant, ils seront désaffectés. Continuer ?`
      : `Supprimer la section ${s.code} ?`;
    if (!(await confirmModal(msg, { confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      for (const m of members) await db.update('users', m.id, { section: null });
      await db.remove('sections', id);
      toast('Section supprimée ✓');
    } catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }

  /* ------- AUDIT export ------- */
  if (e.target.closest('[data-action="audit-export"]')) {
    const json = JSON.stringify(db.all('auditLog'), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-mon-smv-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export téléchargé');
    return;
  }

  // Publish event
  if (e.target.closest('[data-action="publish-event"]')) {
    document.querySelector('[data-form="event-new"]')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return;
  }
});

// Preview live du fichier choisi dans le composer (post / story / candidature)
document.addEventListener('change', (e) => {
  const inp = e.target.closest('#composer-file, #story-file');
  if (!inp) return;
  const file = inp.files?.[0];
  const preview = document.getElementById('composer-preview');
  if (!file || !preview) return;
  const url = URL.createObjectURL(file);
  preview.innerHTML = file.type.startsWith('video')
    ? `<video src="${url}" controls playsinline></video>`
    : `<img src="${url}" alt="aperçu" />`;
});

// Upload de logo : upload sur Supabase Storage bucket "logos"
document.addEventListener('change', async (e) => {
  const upl = e.target.closest('[data-logo-upload]');
  if (!upl) return;
  const file = upl.files && upl.files[0];
  if (!file) return;
  const MAX = 500 * 1024;
  if (file.size > MAX) { toast('Image trop grande (max 500 Ko)'); upl.value = ''; return; }
  toast('Upload du logo…');
  try {
    // 1. Upload sur Supabase Storage
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    // 2. Récupérer l'URL publique
    const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
    const url = pub.publicUrl;
    // 3. Stocker dans les settings
    await db.setSettings({ logoUrl: url });
    updateFavicon();
    toast('Logo mis à jour ✓');
    const prev = document.getElementById('logo-preview');
    if (prev) prev.src = url;
    render();
  } catch (err) {
    console.error(err);
    toast(`Erreur : ${err.message || 'upload impossible'}`);
  }
  upl.value = '';
});

// Recherche social
document.addEventListener('input', (e) => {
  const s = e.target.closest('[data-search-input]');
  if (s) {
    ui.searchQuery = s.value;
    render();
    setTimeout(() => {
      const newInput = document.querySelector('[data-search-input]');
      if (newInput) { newInput.focus(); newInput.setSelectionRange(s.value.length, s.value.length); }
    }, 10);
    return;
  }
});

// Filtres audit log
document.addEventListener('input', (e) => {
  const a = e.target.closest('[data-audit-search]');
  if (a) {
    ui.auditFilters = { ...(ui.auditFilters || {}), q: a.value };
    render();
    // Replace focus on the search field
    const newInput = document.querySelector('[data-audit-search]');
    if (newInput) { newInput.focus(); newInput.setSelectionRange(a.value.length, a.value.length); }
  }
});
document.addEventListener('change', async (e) => {
  // Affectation incorporation d'une candidature
  const ci = e.target.closest('[data-action="cand-incorporation"]');
  if (ci) {
    const id = ci.getAttribute('data-id');
    try { await db.update('candidatures', id, { incorporation: ci.value || null }); toast('Incorporation mise à jour'); }
    catch (err) { toast('Erreur : ' + (err?.message || err)); }
    return;
  }
  const cl = e.target.closest('[data-audit-coll]');
  if (cl) { ui.auditFilters = { ...(ui.auditFilters || {}), coll: cl.value }; render(); return; }
  const us = e.target.closest('[data-audit-user]');
  if (us) { ui.auditFilters = { ...(ui.auditFilters || {}), user: us.value }; render(); return; }
});

// Live binding pour la recherche utilisateurs
document.addEventListener('input', (e) => {
  const search = e.target.closest('[data-users-search]');
  if (search) {
    ui.usersQuery = search.value;
    // ré-render que la table
    const wrap = document.querySelector('.admin-table-wrap');
    if (wrap) {
      const fake = document.createElement('div');
      fake.innerHTML = Admin.adminUsers(currentUser(), ui.usersQuery);
      const newWrap = fake.querySelector('.admin-table-wrap');
      const newCount = fake.querySelector('.admin-toolbar span.muted');
      if (newWrap) wrap.replaceWith(newWrap);
      const currentCount = document.querySelector('.admin-toolbar span.muted');
      if (newCount && currentCount) currentCount.textContent = newCount.textContent;
    }
  }
});

// Formulaires
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form');
  if (!form) return;
  const kind = form.getAttribute('data-form');
  if (!kind) return;
  e.preventDefault();
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());

  try { await handleSubmit(kind, data, form); }
  catch (err) {
    console.error('Form submit error', kind, err);
    toast(`Erreur : ${err?.message || err}`);
  }
});

async function handleSubmit(kind, data, form) {
  switch (kind) {
    /* ============ RÉSEAU SOCIAL ============ */
    case 'post-create': {
      const fileInput = form.querySelector('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (!file) { toast('Choisis une photo ou vidéo'); return; }
      toast('Publication en cours…');
      const isBereal = form.getAttribute('data-bereal') === '1';
      await Social.createPost({ file, caption: data.caption, isBereal });
      toast('Publié ✓');
      location.hash = '#/feed';
      break;
    }
    case 'story-create': {
      const fileInput = form.querySelector('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (!file) { toast('Choisis une photo ou vidéo'); return; }
      toast('Upload story…');
      await Social.createStory({ file });
      toast('Story publiée pour 24h ✓');
      location.hash = '#/feed';
      break;
    }
    case 'comment-create': {
      const postId = form.getAttribute('data-post');
      await Social.createComment(postId, data.text);
      form.reset();
      render();
      break;
    }
    case 'dm-send': {
      const channel = form.getAttribute('data-channel');
      await Social.sendDM(channel, data.text);
      form.reset();
      render();
      break;
    }
    case 'profile-edit': {
      const u = currentUser();
      const patch = {
        bio: data.bio || null,
        isPrivate: !!data.isPrivate,
      };
      const avatarFile = form.querySelector('input[name="avatar"]')?.files?.[0];
      if (avatarFile) {
        const { url } = await Social.uploadMedia(avatarFile, 'avatars');
        patch.avatarUrl = url;
      }
      await db.update('users', u.id, patch);
      toast('Profil mis à jour ✓');
      location.hash = '#/profil/' + u.username;
      break;
    }

    case 'candidature': {
      await db.insert('candidatures', {
        firstName: data.firstName, lastName: data.lastName,
        age: parseInt(data.age, 10), postalCode: data.postalCode,
        goal: data.goal, email: data.email, phone: data.phone,
        status: 'nouveau',
      });
      const s = db.getSettings();
      toast(`Demande envoyée à ${s.candidatureEmail}`);
      setTimeout(() => { location.hash = '#/decouvrir'; }, 800);
      break;
    }

    case 'login': {
      const r = await authLogin(data.username, data.password);
      if (!r.ok) {
        ui.loginError = r.error;
        logAction(`Tentative de connexion échouée pour "${data.username}"`, 'session');
        render(); return;
      }
      ui.loginError = null;
      const u = r.user;
      logAction(`Connexion de ${u.firstName} ${u.lastName} (${ROLES_LABELS[u.role]})`, 'session', u.id);
      let to;
      if (r.mustChangePassword) to = '#/auth/changer-mdp';
      else if (canAccessAdmin(u))            to = '#/admin';
      else if (u.role === 'recrutement')     to = '#/recrutement';
      else if (u.role === 'cadre')           to = '#/pilote';
      else if (u.role === 'famille')         to = '#/famille/photos';
      else                                   to = '#/accueil';
      location.hash = to;
      render();
      toast(`Bienvenue ${u.firstName}`);
      break;
    }

    case 'change-password': {
      if (data.password !== data.password2) { ui.banner = { kind: 'error', msg: 'Les deux mots de passe ne correspondent pas.' }; render(); return; }
      if ((data.password || '').length < 8) { ui.banner = { kind: 'error', msg: 'Minimum 8 caractères.' }; render(); return; }
      await changePassword(currentUser().id, data.password);
      ui.banner = null;
      toast('Mot de passe mis à jour');
      location.hash = '#/';
      render();
      break;
    }

    case 'note': {
      const u = currentUser();
      await db.insert('notes', { userId: u.id, title: data.title, content: data.content, module: data.module });
      toast('Note enregistrée');
      location.hash = '#/notes';
      break;
    }

    case 'message': {
      const u = currentUser();
      if (!(data.text || '').trim()) return;
      const channel = form.getAttribute('data-channel') || u.section;
      await db.insert('messages', { channel, userId: u.id, text: data.text.trim(), at: new Date().toISOString() });
      form.reset();
      break;
    }

    case 'famille-message': {
      toast('Message envoyé (démo, pas de relai serveur)');
      form.reset();
      break;
    }

    case 'famille-invite': {
      const u = currentUser();
      const code = genInviteCode();
      await db.insert('invitations', {
        jeuneId: u.id, code, relationship: data.relationship, email: data.email || '',
        status: 'pending',
      });
      toast(`Invitation créée · code ${code}`);
      break;
    }

    case 'famille-rejoindre': {
      const code = (data.code || '').toUpperCase();
      const inv = db.find('invitations', (i) => i.code === code && i.status === 'pending');
      if (!inv) { ui.banner = { kind: 'error', msg: 'Code invalide ou déjà utilisé.' }; render(); return; }
      const jeune = db.byId('users', inv.jeuneId);
      if (!jeune) { ui.banner = { kind: 'error', msg: 'Le volontaire associé est introuvable.' }; render(); return; }
      const { user: u } = await createUser({
        firstName: data.firstName, lastName: data.lastName,
        role: 'famille', email: data.email,
        familyOf: jeune.id, familyRelationship: inv.relationship,
      });
      // remplacer le mot de passe initial par celui choisi
      await changePassword(u.id, data.password);
      await db.update('invitations', inv.id, { status: 'utilisee', usedBy: u.id });
      // login auto
      const r = await authLogin(u.username, data.password);
      ui.banner = null;
      if (r.ok) { location.hash = '#/famille/photos'; render(); toast(`Bienvenue ${u.firstName} · @${u.username}`); }
      break;
    }

    case 'admin-user': {
      const id = form.getAttribute('data-id');
      if (id) {
        await db.update('users', id, {
          firstName: data.firstName, lastName: data.lastName,
          email: data.email, section: data.section || null,
          role: data.role, incorporation: data.incorporation || null,
          accountType: data.accountType || 'user',
          active: !!data.active,
        });
        toast('Utilisateur mis à jour');
        location.hash = '#/admin/utilisateurs';
      } else {
        const { user: u, initialPassword } = await createUser({
          firstName: data.firstName, lastName: data.lastName,
          email: data.email, role: data.role,
          section: data.section || null,
          incorporation: data.incorporation || null,
        });
        if (data.accountType && data.accountType !== 'user') {
          await db.update('users', u.id, { accountType: data.accountType }, { silent: true });
        }
        showResetPasswordModal(u, initialPassword);
      }
      break;
    }

    case 'admin-settings': {
      const patch = {
        applicationName: data.applicationName,
        candidatureEmail: data.candidatureEmail,
        candidaturePhone: data.candidaturePhone,
        signalementEmail: data.signalementEmail,
        fondateurEmail: data.fondateurEmail,
        centreNom: data.centreNom,
        centreAdresse: data.centreAdresse,
        websiteUrl: data.websiteUrl,
        visiteUrl: data.visiteUrl,
        socialUrls: {
          facebook: data.social_facebook,
          instagram: data.social_instagram,
          linkedin: data.social_linkedin,
        },
        onboardingTitle: data.onboardingTitle,
        onboardingSub: data.onboardingSub,
        candidatureButtonLabel: data.candidatureButtonLabel,
        candidatureMessage: data.candidatureMessage,
        rgpdMention: data.rgpdMention,
        instagramHandle: data.instagramHandle || '',
        instagramEmbed: data.instagramEmbed || '',
      };
      await db.setSettings(patch);
      toast('Paramètres enregistrés ✓');
      break;
    }

    case 'inco-edit': {
      const id = form.getAttribute('data-id');
      await db.update('incorporations', id, {
        label: data.label,
        seats: parseInt(data.seats, 10) || 0,
        open: !!data.open,
      });
      toast('Incorporation mise à jour');
      break;
    }

    case 'event-new': {
      const u = currentUser();
      await db.insert('events', {
        sec: data.sec || u.section,
        day: data.day, time: data.time,
        title: data.title, sub: data.sub || '',
        type: data.type, description: data.description,
      });
      toast('Événement publié');
      location.hash = '#/pilote';
      break;
    }
  }
}

/* ============================================================
   Modale "input form" générique (remplace prompt() chains)
   Usage:
     const r = await inputModal({
       title: 'Nouvelle section',
       fields: [
         { name: 'code', label: 'Code (ex. S31)', value: '', required: true },
         { name: 'name', label: 'Nom complet', value: '' },
         { name: 'compagnie', label: 'Compagnie', type: 'number', value: 1 },
       ],
       submitLabel: 'Créer'
     });
     // r === null si annulé, sinon r === { code, name, compagnie }
   ============================================================ */
function inputModal({ title, fields = [], submitLabel = 'Valider', cancelLabel = 'Annuler' }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__panel">
        <div class="modal__head">
          <div class="modal__title">${escapeHtml(title)}</div>
          <button class="modal__close" type="button" aria-label="Fermer">${ICONS.close}</button>
        </div>
        <form class="modal__body">
          ${fields.map((f) => `
            <div class="admin-field">
              <label class="admin-field__label">${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
              ${f.type === 'select'
                ? `<select class="admin-field__select" name="${f.name}" ${f.required ? 'required' : ''}>
                     ${(f.options || []).map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === f.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
                   </select>`
                : f.type === 'textarea'
                ? `<textarea class="admin-field__textarea" name="${f.name}" ${f.required ? 'required' : ''}>${escapeHtml(f.value ?? '')}</textarea>`
                : `<input class="admin-field__input" name="${f.name}" type="${f.type || 'text'}" value="${escapeHtml(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : ''} />`}
              ${f.hint ? `<div class="admin-field__hint">${escapeHtml(f.hint)}</div>` : ''}
            </div>`).join('')}
          <div class="modal__foot" style="margin-top: 8px;">
            <button type="button" class="btn btn--ghost-ink btn--sm" data-modal-cancel>${escapeHtml(cancelLabel)}</button>
            <button type="submit" class="btn btn--navy btn--sm">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    setTimeout(() => wrap.querySelector('input, select, textarea')?.focus(), 50);

    function close(result) { wrap.remove(); resolve(result); }
    wrap.addEventListener('click', (ev) => {
      if (ev.target === wrap) close(null);
      if (ev.target.closest('.modal__close') || ev.target.closest('[data-modal-cancel]')) close(null);
    });
    wrap.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const result = {};
      for (const f of fields) {
        const el = wrap.querySelector(`[name="${f.name}"]`);
        result[f.name] = f.type === 'number' ? Number(el.value) : el.value;
      }
      close(result);
    });
  });
}

async function confirmModal(message, { confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__panel" style="max-width: 420px;">
        <div class="modal__body" style="padding-top: 22px;">
          <div style="font-size: 15px; line-height: 1.5;">${escapeHtml(message)}</div>
          <div class="modal__foot" style="margin-top: 16px; padding: 0; border-top: 0;">
            <button type="button" class="btn btn--ghost-ink btn--sm" data-no>${escapeHtml(cancelLabel)}</button>
            <button type="button" class="btn ${danger ? 'btn--red' : 'btn--navy'} btn--sm" data-yes>${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (ev) => {
      if (ev.target === wrap || ev.target.closest('[data-no]')) { wrap.remove(); resolve(false); }
      if (ev.target.closest('[data-yes]')) { wrap.remove(); resolve(true); }
    });
  });
}

/* ============================================================
   Modale réinitialisation / nouveau compte
   ============================================================ */
function showResetPasswordModal(user, password) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modal__panel">
      <div class="modal__head">
        <div class="modal__title">Identifiants de ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</div>
        <button class="modal__close" data-action="modal-close">${ICONS.close}</button>
      </div>
      <div class="modal__body">
        <p class="muted">Communique ces identifiants au volontaire. Il devra changer son mot de passe à la première connexion. <strong>Ces informations ne seront plus jamais affichées.</strong></p>
        <div class="admin-field" style="margin-top: 16px">
          <label class="admin-field__label">Identifiant</label>
          <div class="password-reveal">
            <code style="flex:1">${user.username}</code>
            <button class="btn btn--ghost-ink btn--sm" type="button" data-action="copy" data-copy="${user.username}">${ICONS.copy}</button>
          </div>
        </div>
        <div class="admin-field">
          <label class="admin-field__label">Mot de passe initial</label>
          <div class="password-reveal">
            <code style="flex:1; letter-spacing: 4px">${password}</code>
            <button class="btn btn--ghost-ink btn--sm" type="button" data-action="copy" data-copy="${password}">${ICONS.copy}</button>
          </div>
          <div class="password-reveal__warn">⚠️ Note ces informations maintenant. Tu pourras toujours réinitialiser le mot de passe, mais celui-ci ne sera plus jamais consultable.</div>
        </div>
      </div>
      <div class="modal__foot">
        <button class="btn btn--navy" type="button" data-action="modal-close">J'ai noté</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', async (e) => {
    if (e.target === wrap) wrap.remove();
    const copy = e.target.closest('[data-action="copy"]');
    if (copy) {
      const val = copy.getAttribute('data-copy');
      try { await navigator.clipboard.writeText(val); toast('Copié'); } catch { toast(val); }
    }
  });
}

/* ============================================================
   Favicon dynamique (suit settings.logoUrl)
   ============================================================ */
function updateFavicon() {
  const url = getLogoUrl();
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
  if (url.startsWith('data:image/svg') || url.endsWith('.svg')) link.type = 'image/svg+xml';
  else if (url.startsWith('data:image/png') || url.endsWith('.png')) link.type = 'image/png';
  else if (url.startsWith('data:image/jpeg') || url.endsWith('.jpg') || url.endsWith('.jpeg')) link.type = 'image/jpeg';
  else link.removeAttribute('type');
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  // Loader visuel pendant le chargement initial
  $app.innerHTML = `
    <section class="screen screen--dark" style="display: grid; place-items: center; min-height: 100dvh;">
      <div style="text-align: center; color: var(--white);">
        <div style="font-family: var(--font-display); font-size: 24px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px;">Mon SMV</div>
        <div style="font-family: var(--font-mono); font-size: 11px; color: rgba(255,255,255,.5); letter-spacing: .12em; text-transform: uppercase;">Chargement…</div>
      </div>
    </section>`;

  try {
    // 1. Bootstrap auth (charge la session si elle existe, charge les données)
    await initAuth();

    // 2. Seed au tout premier lancement
    await seedIfEmpty();

    // 3. Mettre à jour le favicon
    updateFavicon();

    // 4. Réagir aux changements d'auth → re-render
    onAuthChange(() => { updateFavicon(); render(); });
    onChange(() => render());

    // 5. Service worker (PWA)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
    }

    // 6. Route initiale
    if (!location.hash) location.hash = '#/';
    render();
  } catch (e) {
    console.error('Boot failed:', e);
    $app.innerHTML = `
      <section class="screen screen--dark" style="display: grid; place-items: center; min-height: 100dvh; padding: 24px;">
        <div style="text-align: center; color: var(--white); max-width: 360px;">
          <div style="font-family: var(--font-display); font-size: 24px; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 12px; color: var(--red);">Erreur de chargement</div>
          <div style="font-family: var(--font-mono); font-size: 12px; color: rgba(255,255,255,.7); line-height: 1.5;">${(e && e.message) || 'Impossible de joindre Supabase'}</div>
          <button class="btn btn--fluo" style="margin-top: 20px;" onclick="location.reload()">Réessayer</button>
        </div>
      </section>`;
  }
}
boot();
