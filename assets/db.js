/* ============================================================
   Mon SMV · DB
   Stockage local (localStorage), CRUD typé, audit trail,
   et système de sauvegardes en anneau (12 slots horaires).
   ============================================================ */

const STORE = 'mon-smv:db:v2';
const BACKUPS = 'mon-smv:backups:v2';
const META = 'mon-smv:meta:v2';
const MAX_BACKUPS = 12;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

export const COLLECTIONS = [
  'users',          // utilisateurs : jeunes, cadres, familles, mods, admins, recrutement, fondateur
  'sections',       // S11, S12, S13, S21, S22, S23
  'incorporations', // promotions (tous les 2 mois)
  'formations',     // formations disponibles par incorporation
  'candidatures',   // candidatures publiques (depuis #/candidature)
  'invitations',    // codes d'invitation famille
  'events',         // événements de planning
  'news',           // actualités
  'jobs',           // offres d'emploi
  'notes',          // notes des jeunes
  'messages',       // messages tchat
  'auditLog',       // toutes les écritures
  'modLog',         // actions de modération
];

const DEFAULT_DB = () => {
  const d = {};
  COLLECTIONS.forEach((c) => { d[c] = []; });
  d.settings = {
    logoUrl: '',                          // URL ou data:URL (vide = logo par défaut SVG)
    applicationName: 'Mon SMV',
    candidatureEmail: 'recrutement.3rsmv@defense.gouv.fr',
    candidaturePhone: '05 46 00 00 00',
    signalementEmail: 'moderation.3rsmv@defense.gouv.fr',
    fondateurEmail: 'fondateur.3rsmv@defense.gouv.fr',
    centreNom: '3ᵉ RSMV · La Rochelle',
    centreAdresse: 'Caserne Beauregard · 17000 La Rochelle',
    websiteUrl: 'https://le-smv.gouv.fr',
    socialUrls: { facebook: '', instagram: '', linkedin: '' },
    onboardingTitle: 'Une seconde chance, tracée.',
    onboardingSub: "Tu as entre 18 et 25 ans. Tu cherches un cap. Le SMV te forme et t'accompagne vers l'emploi.",
    candidatureButtonLabel: 'Envoyer ma demande',
    candidatureMessage: 'La cellule recrutement te rappelle sous 48h ouvrées.',
    visiteUrl: '',
    rgpdMention: 'Tes données restent au sein du 3ᵉ RSMV. Suppression possible à tout moment via la cellule communication.',
  };
  return d;
};

function read() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return DEFAULT_DB();
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DB(), ...parsed, settings: { ...DEFAULT_DB().settings, ...(parsed.settings || {}) } };
  } catch { return DEFAULT_DB(); }
}

function write(snapshot) {
  localStorage.setItem(STORE, JSON.stringify(snapshot));
}

let _db = read();

/* -------------------- API CRUD -------------------- */
export const db = {
  all(coll) { return [..._db[coll] || []]; },
  byId(coll, id) { return (_db[coll] || []).find((x) => x.id === id) || null; },
  find(coll, fn) { return (_db[coll] || []).find(fn) || null; },
  filter(coll, fn) { return (_db[coll] || []).filter(fn); },
  count(coll, fn) { return fn ? this.filter(coll, fn).length : (_db[coll] || []).length; },

  insert(coll, entity, opts = {}) {
    if (!_db[coll]) _db[coll] = [];
    if (!entity.id) entity.id = uid(coll.slice(0, 3));
    entity.createdAt = entity.createdAt || new Date().toISOString();
    _db[coll].push(entity);
    if (!opts.silent) logAudit(coll, 'insert', entity.id);
    write(_db);
    notify();
    return entity;
  },

  update(coll, id, patch, opts = {}) {
    const i = (_db[coll] || []).findIndex((x) => x.id === id);
    if (i < 0) return null;
    _db[coll][i] = { ..._db[coll][i], ...patch, updatedAt: new Date().toISOString() };
    if (!opts.silent) logAudit(coll, 'update', id);
    write(_db);
    notify();
    return _db[coll][i];
  },

  remove(coll, id, opts = {}) {
    _db[coll] = (_db[coll] || []).filter((x) => x.id !== id);
    if (!opts.silent) logAudit(coll, 'remove', id);
    write(_db);
    notify();
  },

  getSettings() { return { ..._db.settings }; },
  setSettings(patch) {
    _db.settings = { ..._db.settings, ...patch };
    logAudit('settings', 'update', null);
    write(_db);
    notify();
    return _db.settings;
  },

  // accès brut au snapshot (pour les exports)
  snapshot() { return JSON.parse(JSON.stringify(_db)); },
  replace(next) { _db = next; write(_db); notify(); },
  reset() { _db = DEFAULT_DB(); write(_db); notify(); },
};

/* -------------------- Audit log -------------------- */
function getSessionUserId() {
  try {
    const s = sessionStorage.getItem('mon-smv:session');
    if (!s) return null;
    return JSON.parse(s).userId || null;
  } catch { return null; }
}

function logAudit(coll, action, entityId) {
  _db.auditLog = _db.auditLog || [];
  _db.auditLog.unshift({
    id: uid('log'),
    at: new Date().toISOString(),
    coll, action, entityId,
    by: getSessionUserId(),
  });
  if (_db.auditLog.length > 500) _db.auditLog.length = 500;
}

/* -------------------- Backups (12 slots) -------------------- */
function readMeta() {
  try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch { return {}; }
}
function writeMeta(m) { localStorage.setItem(META, JSON.stringify(m)); }

export function backupNow(reason = 'manual') {
  const list = JSON.parse(localStorage.getItem(BACKUPS) || '[]');
  list.unshift({
    id: uid('bk'),
    at: new Date().toISOString(),
    reason,
    by: getSessionUserId(),
    data: JSON.parse(JSON.stringify(_db)),
  });
  if (list.length > MAX_BACKUPS) list.length = MAX_BACKUPS;
  localStorage.setItem(BACKUPS, JSON.stringify(list));
  writeMeta({ ...readMeta(), lastBackupAt: Date.now() });
  return list[0];
}

export function getBackups() {
  try { return JSON.parse(localStorage.getItem(BACKUPS) || '[]'); }
  catch { return []; }
}

export function restoreBackup(id) {
  const list = getBackups();
  const bk = list.find((b) => b.id === id);
  if (!bk) return false;
  // Avant de restaurer, snapshot l'état actuel
  backupNow('avant-restauration');
  _db = bk.data;
  write(_db);
  notify();
  return true;
}

export function deleteBackup(id) {
  const list = getBackups().filter((b) => b.id !== id);
  localStorage.setItem(BACKUPS, JSON.stringify(list));
}

// Auto-backup horaire pendant que l'app est ouverte
export function tickAutoBackup() {
  const meta = readMeta();
  const last = meta.lastBackupAt || 0;
  if (Date.now() - last >= BACKUP_INTERVAL_MS) {
    backupNow('auto');
  }
}

/* -------------------- Helpers -------------------- */
export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* -------------------- Pub/sub (re-render) -------------------- */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { for (const l of listeners) try { l(); } catch {} }

/* -------------------- Logo helper -------------------- */
export function getLogoUrl() {
  return (_db.settings && _db.settings.logoUrl) || './assets/img/logo.svg';
}
