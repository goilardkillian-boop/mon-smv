/* ============================================================
   Mon SMV · Panel back-office
   - /admin : dashboard, utilisateurs, candidatures, familles,
     paramètres, audit log, modération
   - /recrutement : incorporations, formations, candidatures
   - /fondateur/sauvegardes : 12 backups, restauration
   Accès basé sur le rôle (auth.canAccessAdmin / canAccessRecrutement
   / canAccessBackups).
   ============================================================ */

import { db, getBackups, restoreBackup, backupNow, deleteBackup, getLogoUrl } from './db.js';
import {
  createUser, resetPasswordByAdmin, ROLES_LABELS, RELATIONSHIPS,
  canAccessAdmin, canAccessBackups, canAccessRecrutement, slug,
} from './auth.js';
import { ICONS } from './icons.js';

/* ---------- Helpers de présentation ---------- */
function initials(f = '', l = '') { return ((f[0] || '') + (l[0] || '')).toUpperCase(); }
function escapeAttr(s) { return (s ?? '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('fr-FR'); }
function fmtDateTime(iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function tag(label, cls = 'grey') { return `<span class="tag tag--${cls}">${label}</span>`; }

function adminHeader(active, user) {
  const nav = [
    ['admin',                'Tableau de bord', canAccessAdmin(user)],
    ['admin/utilisateurs',   'Utilisateurs',    canAccessAdmin(user)],
    ['admin/candidatures',   'Candidatures',    canAccessAdmin(user) || canAccessRecrutement(user)],
    ['admin/sections',       'Sections',        canAccessAdmin(user)],
    ['admin/familles',       'Familles',        canAccessAdmin(user)],
    ['recrutement',          'Recrutement',     canAccessRecrutement(user)],
    ['admin/parametres',     'Paramètres',      canAccessAdmin(user)],
    ['admin/audit',          'Audit',           canAccessAdmin(user)],
    ['fondateur/sauvegardes','Sauvegardes',     canAccessBackups(user)],
  ].filter(([,,ok]) => ok);
  return `
    <header class="admin-header">
      <img class="admin-header__logo" src="${getLogoUrl()}" alt="" />
      <div class="admin-header__brand">${db.getSettings().applicationName || 'Mon SMV'}<small>panel · 3ᵉ RSMV</small></div>
      <nav class="admin-header__nav">
        ${nav.map(([slug, label]) => `<a href="#/${slug}" class="${active === slug ? 'is-active' : ''}">${label}</a>`).join('')}
      </nav>
      <div class="admin-header__user">
        <span class="admin-header__avatar">${initials(user.firstName, user.lastName)}</span>
        <span>${user.firstName} · ${ROLES_LABELS[user.role]}</span>
        <button class="admin-header__logout" data-action="logout" aria-label="Déconnexion">${ICONS.logout}</button>
      </div>
    </header>`;
}

function shell(active, user, body) {
  return `
    <div class="admin-shell">
      ${adminHeader(active, user)}
      <main class="admin-body">${body}</main>
    </div>`;
}

/* ============================================================
   ADMIN · Dashboard
   ============================================================ */
export function adminDashboard(user) {
  const users = db.all('users');
  const candidatures = db.filter('candidatures', (c) => c.status !== 'archive');
  const newCand = candidatures.filter((c) => c.status === 'nouveau').length;
  const sections = db.all('sections');
  const audit = db.all('auditLog').slice(0, 8);

  return shell('admin', user, `
    <h1 class="admin-h1">Tableau de <em>bord</em></h1>
    <p class="admin-sub">${db.getSettings().centreNom}</p>

    <div class="admin-grid">
      <div class="admin-kpi">
        <div class="admin-kpi__lbl">Volontaires</div>
        <div class="admin-kpi__num admin-kpi__num--fluo">${users.filter((u) => u.role === 'jeune').length}</div>
        <div class="admin-kpi__hint">${users.filter((u) => u.role === 'jeune' && u.active).length} actifs</div>
      </div>
      <div class="admin-kpi">
        <div class="admin-kpi__lbl">Cadres</div>
        <div class="admin-kpi__num">${users.filter((u) => u.role === 'cadre').length}</div>
        <div class="admin-kpi__hint">${sections.length} sections</div>
      </div>
      <div class="admin-kpi">
        <div class="admin-kpi__lbl">Familles</div>
        <div class="admin-kpi__num">${users.filter((u) => u.role === 'famille').length}</div>
        <div class="admin-kpi__hint">${db.count('invitations', (i) => i.status === 'pending')} invitations en attente</div>
      </div>
      <div class="admin-kpi">
        <div class="admin-kpi__lbl">Candidatures à traiter</div>
        <div class="admin-kpi__num admin-kpi__num--red">${newCand}</div>
        <div class="admin-kpi__hint">${candidatures.length} au total</div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card__head">
        <h2 class="admin-card__title">Activité récente</h2>
      </div>
      ${audit.length === 0 ? `<p class="muted">Aucune activité.</p>` : `
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${audit.map((a) => `
            <li style="display:flex; gap:10px; padding: 8px 0; border-bottom: 1px solid var(--bg-stroke); font-size:13px">
              <span class="muted" style="font-family: var(--font-mono); font-size: 11px; min-width: 130px">${fmtDateTime(a.at)}</span>
              <span>${tag(a.coll, 'navy')}</span>
              <span>${a.action}</span>
              <span class="muted">${a.entityId || ''}</span>
            </li>`).join('')}
        </ul>`}
    </div>
  `);
}

/* ============================================================
   ADMIN · Utilisateurs
   ============================================================ */
export function adminUsers(user, query = '') {
  const all = db.all('users');
  const filtered = !query ? all : all.filter((u) => {
    const t = (u.username + ' ' + u.firstName + ' ' + u.lastName + ' ' + (u.email || '') + ' ' + u.role + ' ' + (u.section || '')).toLowerCase();
    return t.includes(query.toLowerCase());
  });

  return shell('admin/utilisateurs', user, `
    <div class="row-between mb-4">
      <h1 class="admin-h1">Utilisateurs</h1>
      <button class="btn btn--navy" data-link="#/admin/utilisateurs/nouveau">${ICONS.plus}<span>Nouvel utilisateur</span></button>
    </div>
    <p class="admin-sub">${all.length} comptes · pré-inscription, réinitialisation des mots de passe, gestion des rôles et des sections.</p>

    <div class="admin-toolbar">
      <input class="admin-toolbar__search" placeholder="Rechercher par nom, identifiant, rôle, section…" data-users-search value="${query.replace(/"/g, '&quot;')}" />
      <span class="muted" style="font-size: 12px">${filtered.length} résultat${filtered.length > 1 ? 's' : ''}</span>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Identifiant</th>
            <th>Nom complet</th>
            <th>Rôle</th>
            <th>Section</th>
            <th>Statut</th>
            <th>Dernière connexion</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 32px; color: var(--ink-500);">Aucun utilisateur.</td></tr>` : ''}
          ${filtered.map((u) => `
            <tr>
              <td><code style="font-family: var(--font-mono); font-size: 12px">${u.username}</code>${u.mustChangePassword ? ' ' + tag('mdp à changer', 'orange') : ''}</td>
              <td>${u.firstName} ${u.lastName}</td>
              <td>${tag(ROLES_LABELS[u.role] || u.role, roleColor(u.role))}</td>
              <td>${u.section || (u.family ? 'famille de ' + getJeuneName(u.family.of) : '—')}</td>
              <td>${u.active ? tag('actif', 'green') : tag('désactivé', 'red')}</td>
              <td style="font-family: var(--font-mono); font-size: 11px">${u.lastLogin ? fmtDateTime(u.lastLogin) : '—'}</td>
              <td>
                <div class="admin-table__actions">
                  <button data-action="user-edit" data-id="${u.id}" title="Modifier">${ICONS.edit}</button>
                  <button data-action="user-reset-password" data-id="${u.id}" title="Réinit. mot de passe">${ICONS.key}</button>
                  <button data-action="user-toggle-active" data-id="${u.id}" title="${u.active ? 'Désactiver' : 'Réactiver'}">${u.active ? ICONS.eyeOff : ICONS.eye}</button>
                  <button data-action="user-delete" data-id="${u.id}" title="Supprimer" class="danger">${ICONS.trash}</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
}
function roleColor(r) {
  return ({ jeune:'green', cadre:'navy', famille:'orange', admin:'red', moderateur:'orange', recrutement:'navy', fondateur:'fluo' }[r] || 'grey');
}
function getJeuneName(id) { const u = db.byId('users', id); return u ? `${u.firstName} ${u.lastName}` : '—'; }

/* ---- Création / édition utilisateur ---- */
export function adminUserForm(user, idOrNew, form = null) {
  const editing = idOrNew !== 'nouveau';
  const target = editing ? db.byId('users', idOrNew) : null;
  if (editing && !target) return shell('admin/utilisateurs', user, `<p>Utilisateur introuvable.</p>`);
  const f = form || target || { role: 'jeune', firstName: '', lastName: '', email: '', section: '', incorporation: '' };
  const incos = db.all('incorporations');

  return shell('admin/utilisateurs', user, `
    <div class="row-between mb-4">
      <div>
        <h1 class="admin-h1">${editing ? 'Modifier' : 'Pré-inscrire un'} <em>utilisateur</em></h1>
        <p class="admin-sub">${editing ? `Identifiant <code>${target.username}</code>` : 'Un identifiant unique et un mot de passe initial seront générés automatiquement.'}</p>
      </div>
      <button class="btn btn--ghost-ink" data-link="#/admin/utilisateurs">Retour</button>
    </div>
    <div class="admin-card">
      <form data-form="admin-user" data-id="${editing ? target.id : ''}">
        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Prénom</label>
            <input class="admin-field__input" name="firstName" value="${(f.firstName || '').replace(/"/g, '&quot;')}" required />
          </div>
          <div class="admin-field">
            <label class="admin-field__label">Nom</label>
            <input class="admin-field__input" name="lastName" value="${(f.lastName || '').replace(/"/g, '&quot;')}" required />
          </div>
        </div>

        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Rôle</label>
            <select class="admin-field__select" name="role" data-role-select>
              ${Object.entries(ROLES_LABELS).filter(([k]) => k !== 'famille').map(([k, l]) => `<option value="${k}" ${f.role === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <div class="admin-field__hint">Les comptes "famille" sont créés sur invitation par le jeune.</div>
          </div>
          <div class="admin-field" data-section-wrap>
            <label class="admin-field__label">Section</label>
            <select class="admin-field__select" name="section">
              <option value="">—</option>
              ${['S11','S12','S13','S21','S22','S23'].map((s) => `<option value="${s}" ${f.section === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Email</label>
            <input class="admin-field__input" type="email" name="email" value="${(f.email || '').replace(/"/g, '&quot;')}" />
          </div>
          <div class="admin-field" data-inco-wrap>
            <label class="admin-field__label">Incorporation</label>
            <select class="admin-field__select" name="incorporation">
              <option value="">—</option>
              ${incos.map((i) => `<option value="${i.slug}" ${f.incorporation === i.slug ? 'selected' : ''}>${i.label}</option>`).join('')}
            </select>
          </div>
        </div>

        ${editing ? `
          <div class="admin-field">
            <label class="checkbox"><input type="checkbox" name="active" ${target.active ? 'checked' : ''} /> Compte actif</label>
          </div>` : ''}

        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button class="btn btn--navy" type="submit">${editing ? 'Enregistrer' : 'Créer le compte'}</button>
          ${editing ? `<button class="btn btn--ghost-ink" type="button" data-action="user-reset-password" data-id="${target.id}">${ICONS.key}<span>Réinit. mot de passe</span></button>` : ''}
        </div>
      </form>
    </div>
  `);
}

/* ============================================================
   ADMIN · Candidatures
   ============================================================ */
export function adminCandidatures(user) {
  const cands = db.all('candidatures').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return shell('admin/candidatures', user, `
    <h1 class="admin-h1">Candidatures</h1>
    <p class="admin-sub">Demandes reçues via le formulaire public.</p>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Reçue le</th>
            <th>Nom</th>
            <th>Âge</th>
            <th>Code postal</th>
            <th>Recherche</th>
            <th>Contact</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${cands.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding: 32px; color: var(--ink-500);">Aucune candidature pour le moment.</td></tr>` : ''}
          ${cands.map((c) => `
            <tr>
              <td style="font-family: var(--font-mono); font-size: 11px">${fmtDateTime(c.createdAt)}</td>
              <td>${c.firstName} ${c.lastName}</td>
              <td>${c.age}</td>
              <td>${c.postalCode}</td>
              <td>${c.goal}</td>
              <td>${c.email}<br><span class="muted" style="font-size:11px">${c.phone}</span></td>
              <td>${tag(c.status || 'nouveau', c.status === 'traitee' ? 'green' : c.status === 'rejetee' ? 'red' : 'orange')}</td>
              <td>
                <div class="admin-table__actions">
                  <button data-action="cand-promote" data-id="${c.id}" title="Pré-inscrire">${ICONS.plus}</button>
                  <button data-action="cand-accept" data-id="${c.id}" title="Marquer traitée">${ICONS.check}</button>
                  <button data-action="cand-reject" data-id="${c.id}" title="Rejeter" class="danger">${ICONS.close}</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
}

/* ============================================================
   ADMIN · Familles & invitations
   ============================================================ */
export function adminFamilles(user) {
  const invitations = db.all('invitations').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const familles = db.filter('users', (u) => u.role === 'famille');
  return shell('admin/familles', user, `
    <h1 class="admin-h1">Familles & <em>invitations</em></h1>
    <p class="admin-sub">Les jeunes invitent leurs proches depuis l'application avec un code et un lien de famille.</p>

    <div class="admin-card">
      <div class="admin-card__head">
        <h2 class="admin-card__title">Invitations en attente</h2>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Code</th><th>Jeune</th><th>Lien</th><th>Email</th><th>Émise le</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            ${invitations.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--ink-500);">Aucune invitation.</td></tr>` : ''}
            ${invitations.map((i) => {
              const j = db.byId('users', i.jeuneId);
              const rel = RELATIONSHIPS.find((r) => r.value === i.relationship)?.label || i.relationship;
              return `<tr>
                <td><code style="font-family: var(--font-mono); font-size: 13px; font-weight: 700; letter-spacing: 2px">${i.code}</code></td>
                <td>${j ? `${j.firstName} ${j.lastName} <span class="muted">${j.section || ''}</span>` : '—'}</td>
                <td>${rel}</td>
                <td>${i.email || '—'}</td>
                <td style="font-family: var(--font-mono); font-size: 11px">${fmtDateTime(i.createdAt)}</td>
                <td>${tag(i.status, i.status === 'utilisee' ? 'green' : i.status === 'expiree' ? 'red' : 'orange')}</td>
                <td><div class="admin-table__actions"><button data-action="inv-revoke" data-id="${i.id}" class="danger" title="Révoquer">${ICONS.trash}</button></div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card__head">
        <h2 class="admin-card__title">Comptes famille (${familles.length})</h2>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Identifiant</th><th>Nom</th><th>Lien</th><th>Avec le jeune</th><th>Statut</th></tr></thead>
          <tbody>
            ${familles.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--ink-500);">Aucune famille connectée.</td></tr>` : ''}
            ${familles.map((f) => {
              const j = db.byId('users', f.family?.of);
              const rel = RELATIONSHIPS.find((r) => r.value === f.family?.relationship)?.label || f.family?.relationship;
              return `<tr>
                <td><code style="font-family: var(--font-mono)">${f.username}</code></td>
                <td>${f.firstName} ${f.lastName}</td>
                <td>${rel || '—'}</td>
                <td>${j ? `${j.firstName} ${j.lastName}` : '—'}</td>
                <td>${f.active ? tag('actif','green') : tag('désactivé','red')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

/* ============================================================
   ADMIN · Paramètres (settings)
   ============================================================ */
export function adminSettings(user) {
  const s = db.getSettings();
  return shell('admin/parametres', user, `
    <h1 class="admin-h1">Paramètres de l'<em>application</em></h1>
    <p class="admin-sub">Destinataires des emails, contacts, URLs, textes éditoriaux. Toute modification est immédiate côté utilisateur.</p>

    <form data-form="admin-settings">
      <div class="admin-card">
        <div class="admin-card__head"><h2 class="admin-card__title">Identité visuelle</h2></div>
        <div style="display: grid; grid-template-columns: 80px 1fr; gap: 16px; align-items: center; margin-bottom: 16px;">
          <div style="width: 80px; height: 80px; border-radius: 16px; background: var(--bg-soft); display: grid; place-items: center; overflow: hidden; border: 1.5px solid var(--bg-stroke);">
            <img src="${getLogoUrl()}" alt="Logo actuel" style="max-width: 100%; max-height: 100%; object-fit: contain;" id="logo-preview" />
          </div>
          <div>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-logo-upload id="logo-upload" style="display: none;" />
            <button type="button" class="btn btn--ghost-ink btn--sm" onclick="document.getElementById('logo-upload').click()">${ICONS.upload}<span>Téléverser un logo</span></button>
            ${s.logoUrl ? `<button type="button" class="btn btn--ghost-ink btn--sm" data-action="logo-reset" style="margin-left: 8px">${ICONS.refresh}<span>Réinitialiser</span></button>` : ''}
            <div class="admin-field__hint" style="margin-top: 8px">PNG, JPG, SVG ou WebP. Taille max ~500 Ko. Sera utilisé partout : onboarding, header admin, favicon.</div>
          </div>
        </div>
        <div class="admin-field">
          <label class="admin-field__label">Nom de l'application</label>
          <input class="admin-field__input" name="applicationName" value="${escapeAttr(s.applicationName || 'Mon SMV')}" />
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__head"><h2 class="admin-card__title">Routage des contacts</h2></div>
        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Email candidature (formulaire public)</label>
            <input class="admin-field__input" name="candidatureEmail" value="${s.candidatureEmail}" />
            <div class="admin-field__hint">L'email vers lequel les demandes du formulaire <code>#/candidature</code> sont routées.</div>
          </div>
          <div class="admin-field">
            <label class="admin-field__label">Téléphone candidature</label>
            <input class="admin-field__input" name="candidaturePhone" value="${s.candidaturePhone}" />
          </div>
        </div>
        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Email signalements (modération)</label>
            <input class="admin-field__input" name="signalementEmail" value="${s.signalementEmail}" />
          </div>
          <div class="admin-field">
            <label class="admin-field__label">Email fondateur</label>
            <input class="admin-field__input" name="fondateurEmail" value="${s.fondateurEmail}" />
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__head"><h2 class="admin-card__title">Centre</h2></div>
        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Nom du centre</label>
            <input class="admin-field__input" name="centreNom" value="${s.centreNom}" />
          </div>
          <div class="admin-field">
            <label class="admin-field__label">Adresse</label>
            <input class="admin-field__input" name="centreAdresse" value="${s.centreAdresse}" />
          </div>
        </div>
        <div class="admin-field">
          <label class="admin-field__label">URL visite virtuelle</label>
          <input class="admin-field__input" name="visiteUrl" value="${s.visiteUrl || ''}" placeholder="https://visite.le-smv.gouv.fr/..." />
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__head"><h2 class="admin-card__title">Liens externes</h2></div>
        <div class="admin-field">
          <label class="admin-field__label">Site officiel</label>
          <input class="admin-field__input" name="websiteUrl" value="${s.websiteUrl}" />
        </div>
        <div class="admin-field--row">
          <div class="admin-field"><label class="admin-field__label">Facebook</label><input class="admin-field__input" name="social_facebook" value="${s.socialUrls?.facebook || ''}" /></div>
          <div class="admin-field"><label class="admin-field__label">Instagram</label><input class="admin-field__input" name="social_instagram" value="${s.socialUrls?.instagram || ''}" /></div>
        </div>
        <div class="admin-field"><label class="admin-field__label">LinkedIn</label><input class="admin-field__input" name="social_linkedin" value="${s.socialUrls?.linkedin || ''}" /></div>
      </div>

      <div class="admin-card">
        <div class="admin-card__head"><h2 class="admin-card__title">Textes éditoriaux</h2></div>
        <div class="admin-field">
          <label class="admin-field__label">Titre de l'onboarding</label>
          <input class="admin-field__input" name="onboardingTitle" value="${(s.onboardingTitle || '').replace(/"/g,'&quot;')}" />
        </div>
        <div class="admin-field">
          <label class="admin-field__label">Sous-titre de l'onboarding</label>
          <textarea class="admin-field__textarea" name="onboardingSub">${s.onboardingSub || ''}</textarea>
        </div>
        <div class="admin-field--row">
          <div class="admin-field">
            <label class="admin-field__label">Libellé bouton candidature</label>
            <input class="admin-field__input" name="candidatureButtonLabel" value="${(s.candidatureButtonLabel || '').replace(/"/g,'&quot;')}" />
          </div>
          <div class="admin-field">
            <label class="admin-field__label">Message candidature</label>
            <input class="admin-field__input" name="candidatureMessage" value="${(s.candidatureMessage || '').replace(/"/g,'&quot;')}" />
          </div>
        </div>
        <div class="admin-field">
          <label class="admin-field__label">Mention RGPD</label>
          <textarea class="admin-field__textarea" name="rgpdMention">${s.rgpdMention || ''}</textarea>
        </div>
      </div>

      <button class="btn btn--navy" type="submit">${ICONS.check}<span>Enregistrer les paramètres</span></button>
    </form>
  `);
}

/* ============================================================
   ADMIN · Audit log (qui a fait quoi à quel moment)
   ============================================================ */
export function adminAudit(user, filters = {}) {
  let logs = db.all('auditLog');
  if (filters.coll && filters.coll !== 'tout') logs = logs.filter((l) => l.coll === filters.coll);
  if (filters.user) logs = logs.filter((l) => l.by === filters.user);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    logs = logs.filter((l) => (l.description || '').toLowerCase().includes(q) || (l.entityId || '').toLowerCase().includes(q));
  }
  logs = logs.slice(0, 300);

  const collOptions = [...new Set(db.all('auditLog').map((l) => l.coll))];
  const userOptions = [...new Set(db.all('auditLog').map((l) => l.by).filter(Boolean))];

  return shell('admin/audit', user, `
    <div class="row-between mb-4">
      <h1 class="admin-h1">Journal d'<em>activité</em></h1>
      <button class="btn btn--ghost-ink btn--sm" data-action="audit-export">${ICONS.download}<span>Export JSON</span></button>
    </div>
    <p class="admin-sub">Qui a fait quoi, à quel moment. 500 dernières écritures conservées.</p>

    <div class="admin-toolbar">
      <input class="admin-toolbar__search" placeholder="Rechercher dans la description ou l'ID…" data-audit-search value="${escapeAttr(filters.q || '')}" />
      <select class="admin-field__select" data-audit-coll style="max-width: 180px">
        <option value="tout">Toutes les collections</option>
        ${collOptions.map((c) => `<option value="${c}" ${filters.coll === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="admin-field__select" data-audit-user style="max-width: 180px">
        <option value="">Tous les utilisateurs</option>
        ${userOptions.map((id) => {
          const u = db.byId('users', id);
          return u ? `<option value="${id}" ${filters.user === id ? 'selected' : ''}>${u.firstName} ${u.lastName}</option>` : '';
        }).join('')}
      </select>
      <span class="muted" style="font-size: 12px">${logs.length} résultat${logs.length > 1 ? 's' : ''}</span>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Quand</th><th>Par</th><th>Description</th><th>Type</th><th>ID</th></tr></thead>
        <tbody>
          ${logs.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding: 32px; color: var(--ink-500);">Aucune entrée.</td></tr>` : ''}
          ${logs.map((l) => {
            const by = l.by ? db.byId('users', l.by) : null;
            return `<tr>
              <td style="font-family: var(--font-mono); font-size: 11px; white-space: nowrap">${fmtDateTime(l.at)}</td>
              <td>
                ${by ? `<span style="display: inline-flex; align-items: center; gap: 6px"><span class="msg__avatar" style="width: 22px; height: 22px; font-size: 9px">${initials(by.firstName, by.lastName)}</span>${by.firstName} ${by.lastName} <span class="muted" style="font-size: 11px">· ${ROLES_LABELS[by.role] || by.role}</span></span>` : '<span class="muted">système</span>'}
              </td>
              <td>${escapeAttr(l.description || `${l.action} ${l.coll}`)}</td>
              <td>${tag(l.coll, 'navy')} ${tag(l.action, l.action === 'remove' ? 'red' : l.action === 'insert' ? 'green' : l.action === 'event' ? 'fluo' : 'orange')}</td>
              <td><code style="font-family: var(--font-mono); font-size: 10px; color: var(--ink-500)">${l.entityId || '—'}</code></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `);
}

/* ============================================================
   RECRUTEMENT · Dashboard + incorporations + formations
   ============================================================ */
export function recrutementDashboard(user) {
  const incos = db.all('incorporations');
  const formations = db.all('formations');
  const cands = db.all('candidatures');
  const newCands = cands.filter((c) => c.status === 'nouveau' || !c.status);
  return shell('recrutement', user, `
    <h1 class="admin-h1">Cellule <em>recrutement</em></h1>
    <p class="admin-sub">Gestion des incorporations (tous les 2 mois) et des formations proposées.</p>

    <div class="admin-grid">
      <a class="admin-kpi" href="#/recrutement" style="text-decoration:none; color:inherit">
        <div class="admin-kpi__lbl">Incorporations planifiées</div>
        <div class="admin-kpi__num admin-kpi__num--fluo">${incos.length}</div>
        <div class="admin-kpi__hint">${incos.filter((i) => i.open).length} ouvertes</div>
      </a>
      <a class="admin-kpi" href="#/recrutement" style="text-decoration:none; color:inherit">
        <div class="admin-kpi__lbl">Formations proposées</div>
        <div class="admin-kpi__num">${formations.length}</div>
        <div class="admin-kpi__hint">toutes incorporations confondues</div>
      </a>
      <a class="admin-kpi" href="#/admin/candidatures" style="text-decoration:none; color:inherit; ${newCands.length > 0 ? 'border-color: var(--red);' : ''}">
        <div class="admin-kpi__lbl">Candidatures à traiter</div>
        <div class="admin-kpi__num ${newCands.length > 0 ? 'admin-kpi__num--red' : ''}">${newCands.length}</div>
        <div class="admin-kpi__hint">${cands.length} au total · cliquer pour voir</div>
      </a>
    </div>

    ${newCands.length > 0 ? `
      <div class="admin-card">
        <div class="admin-card__head">
          <h2 class="admin-card__title">Dernières candidatures · à traiter</h2>
          <a href="#/admin/candidatures" class="btn btn--ghost-ink btn--sm">Voir toutes</a>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Reçue</th><th>Nom</th><th>Âge</th><th>Recherche</th><th></th></tr></thead>
            <tbody>
              ${newCands.slice(0, 5).map((c) => `
                <tr>
                  <td style="font-family: var(--font-mono); font-size: 11px">${fmtDateTime(c.createdAt)}</td>
                  <td>${escapeAttr(c.firstName)} ${escapeAttr(c.lastName)}</td>
                  <td>${c.age}</td>
                  <td>${escapeAttr(c.goal)}</td>
                  <td><div class="admin-table__actions">
                    <button data-action="cand-promote" data-id="${c.id}" title="Pré-inscrire">${ICONS.plus}</button>
                  </div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

    <div class="admin-card">
      <div class="admin-card__head">
        <h2 class="admin-card__title">Incorporations à venir</h2>
        <button class="btn btn--ghost-ink btn--sm" data-action="inco-add">${ICONS.plus}<span>Ajouter</span></button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Promotion</th><th>Statut</th><th>Places (total / prises)</th><th>Formations</th><th></th></tr></thead>
          <tbody>
            ${incos.map((i) => {
              const fmts = formations.filter((f) => f.incorporationId === i.id);
              return `<tr>
                <td><strong>${i.label}</strong> <span class="muted" style="font-family: var(--font-mono); font-size: 11px">${i.slug}</span></td>
                <td>${i.open ? tag('ouverte', 'green') : tag('fermée', 'grey')}</td>
                <td><strong>${i.seats}</strong> · <span class="muted">${i.seatsTaken} pris</span></td>
                <td>${fmts.length} formation${fmts.length > 1 ? 's' : ''}</td>
                <td>
                  <div class="admin-table__actions">
                    <button data-action="inco-edit" data-id="${i.id}">${ICONS.edit}</button>
                    <button data-action="inco-toggle" data-id="${i.id}">${i.open ? ICONS.lock : ICONS.eye}</button>
                    <button data-action="inco-delete" data-id="${i.id}" class="danger">${ICONS.trash}</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

export function recrutementInco(user, id) {
  const inco = db.byId('incorporations', id);
  if (!inco) return shell('recrutement', user, `<p>Incorporation introuvable.</p>`);
  const formations = db.filter('formations', (f) => f.incorporationId === inco.id);
  return shell('recrutement', user, `
    <div class="row-between mb-4">
      <div>
        <h1 class="admin-h1">${inco.label}</h1>
        <p class="admin-sub">Slug <code>${inco.slug}</code> · ${inco.open ? 'inscriptions ouvertes' : 'inscriptions fermées'}</p>
      </div>
      <button class="btn btn--ghost-ink" data-link="#/recrutement">Retour</button>
    </div>

    <div class="admin-card">
      <div class="admin-card__head"><h2 class="admin-card__title">Détails</h2></div>
      <form data-form="inco-edit" data-id="${inco.id}">
        <div class="admin-field--row">
          <div class="admin-field"><label class="admin-field__label">Libellé</label><input class="admin-field__input" name="label" value="${inco.label}" /></div>
          <div class="admin-field"><label class="admin-field__label">Places totales</label><input class="admin-field__input" type="number" name="seats" value="${inco.seats}" /></div>
        </div>
        <div class="admin-field">
          <label class="checkbox"><input type="checkbox" name="open" ${inco.open ? 'checked' : ''} /> Inscriptions ouvertes</label>
        </div>
        <button class="btn btn--navy" type="submit">Enregistrer</button>
      </form>
    </div>

    <div class="admin-card">
      <div class="admin-card__head">
        <h2 class="admin-card__title">Formations proposées (${formations.length})</h2>
        <button class="btn btn--ghost-ink btn--sm" data-action="formation-add" data-inco="${inco.id}">${ICONS.plus}<span>Ajouter</span></button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Code</th><th>Nom</th><th>Durée</th><th>Capacité</th><th></th></tr></thead>
          <tbody>
            ${formations.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--ink-500);">Aucune formation. Ajoute-en avec le bouton +.</td></tr>` : ''}
            ${formations.map((f) => `
              <tr>
                <td><strong>${f.code}</strong></td>
                <td>${f.name}</td>
                <td>${f.duration}</td>
                <td>${f.capacity}</td>
                <td><div class="admin-table__actions">
                  <button data-action="formation-edit" data-id="${f.id}">${ICONS.edit}</button>
                  <button data-action="formation-delete" data-id="${f.id}" class="danger">${ICONS.trash}</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

/* ============================================================
   FONDATEUR · Sauvegardes (12 max)
   ============================================================ */
export function fondateurBackups(user) {
  const list = getBackups();
  return shell('fondateur/sauvegardes', user, `
    <div class="row-between mb-4">
      <div>
        <h1 class="admin-h1">Sauvegardes</h1>
        <p class="admin-sub">${list.length}/12 instantanés disponibles · une sauvegarde toutes les heures + à la demande.</p>
      </div>
      <button class="btn btn--navy" data-action="backup-now">${ICONS.database}<span>Sauvegarder maintenant</span></button>
    </div>

    <div class="banner banner--info">
      ${ICONS.alert}
      <div>
        <strong>Politique de rétention</strong> · 12 instantanés max conservés (≈ 12h d'historique). Une restauration crée d'abord une sauvegarde de l'état actuel pour pouvoir revenir en arrière.
      </div>
    </div>

    ${list.length === 0 ? `<p class="muted">Aucune sauvegarde. Clique sur "Sauvegarder maintenant" pour créer la première.</p>` : ''}
    ${list.map((b, idx) => `
      <div class="backup-row">
        <div>
          <div class="backup-row__when">${fmtDateTime(b.at)}</div>
          <div class="backup-row__reason">${idx === 0 ? '<strong style="color: var(--green)">État le plus récent</strong> · ' : ''}${b.reason}${b.by ? ' · par ' + (db.byId('users', b.by)?.username || b.by) : ''}</div>
        </div>
        <button class="backup-row__btn backup-row__btn--restore" data-action="backup-restore" data-id="${b.id}">${ICONS.refresh}<span> Restaurer</span></button>
        <button class="backup-row__btn backup-row__btn--delete" data-action="backup-delete" data-id="${b.id}" title="Supprimer">${ICONS.trash}</button>
      </div>`).join('')}
  `);
}

/* ============================================================
   ADMIN · Sections & compagnies
   ============================================================ */
export function adminSections(user) {
  const sections = db.all('sections').sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  const compagnies = [...new Set(sections.map((s) => s.compagnie))].sort();
  const members = db.all('users');
  return shell('admin/sections', user, `
    <div class="row-between mb-4">
      <h1 class="admin-h1">Sections & <em>compagnies</em></h1>
      <button class="btn btn--navy" data-action="section-add">${ICONS.plus}<span>Nouvelle section</span></button>
    </div>
    <p class="admin-sub">Crée, modifie et supprime les sections. Une section appartient à une compagnie (1ʳᵉ, 2ᵉ, etc.).</p>

    <div class="admin-grid">
      <div class="admin-kpi"><div class="admin-kpi__lbl">Sections</div><div class="admin-kpi__num">${sections.length}</div><div class="admin-kpi__hint">${compagnies.length} compagnie${compagnies.length > 1 ? 's' : ''}</div></div>
      <div class="admin-kpi"><div class="admin-kpi__lbl">Volontaires affectés</div><div class="admin-kpi__num admin-kpi__num--fluo">${members.filter((u) => u.role === 'jeune' && u.section).length}</div><div class="admin-kpi__hint">sur ${members.filter((u) => u.role === 'jeune').length}</div></div>
      <div class="admin-kpi"><div class="admin-kpi__lbl">Cadres rattachés</div><div class="admin-kpi__num">${members.filter((u) => u.role === 'cadre' && u.section).length}</div></div>
    </div>

    <div class="admin-card">
      <div class="admin-card__head"><h2 class="admin-card__title">Toutes les sections</h2></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Code</th><th>Nom</th><th>Compagnie</th><th>Cadres</th><th>Volontaires</th><th></th></tr></thead>
          <tbody>
            ${sections.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--ink-500);">Aucune section. Crée-en une avec le bouton +.</td></tr>` : ''}
            ${sections.map((s) => {
              const cadres = members.filter((u) => u.role === 'cadre' && u.section === s.code).length;
              const jeunes = members.filter((u) => u.role === 'jeune' && u.section === s.code).length;
              return `<tr>
                <td><code style="font-family: var(--font-mono); font-weight: 700">${s.code}</code></td>
                <td>${escapeAttr(s.name || s.code)}</td>
                <td>${tag(s.compagnie + 'ᵉ compagnie', 'navy')}</td>
                <td>${cadres}</td>
                <td>${jeunes}</td>
                <td>
                  <div class="admin-table__actions">
                    <button data-action="section-edit" data-id="${s.id}" title="Modifier">${ICONS.edit}</button>
                    <button data-action="section-delete" data-id="${s.id}" title="Supprimer" class="danger">${ICONS.trash}</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card__head">
        <h2 class="admin-card__title">Compagnies (${compagnies.length})</h2>
      </div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px">
        Les compagnies sont déduites des sections. Pour créer une nouvelle compagnie, crée une section avec un numéro de compagnie qui n'existe pas encore.
      </p>
      <div class="admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
        ${compagnies.map((c) => {
          const inSecs = sections.filter((s) => s.compagnie === c);
          return `<div class="admin-kpi">
            <div class="admin-kpi__lbl">${c}ᵉ compagnie</div>
            <div class="admin-kpi__num">${inSecs.length}</div>
            <div class="admin-kpi__hint">${inSecs.map((x) => x.code).join(' · ')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `);
}
