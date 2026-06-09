/* ============================================================
   Mon SMV · DB (Supabase-backed)
   - Cache mémoire chargé au boot pour des lectures synchrones rapides
   - Écritures async vers Supabase, cache mis à jour à la réponse
   - API identique à l'ancienne db.js localStorage pour limiter
     l'impact sur le reste du code
   ============================================================ */

import { supabase } from './supabase-client.js';

/* -------- Mapping collection (app) ↔ table (Supabase) -------- */
const TABLES = {
  users: 'profiles',
  sections: 'sections',
  incorporations: 'incorporations',
  formations: 'formations',
  candidatures: 'candidatures',
  invitations: 'invitations',
  events: 'events',
  news: 'news',
  jobs: 'jobs',
  notes: 'notes',
  messages: 'messages',
  auditLog: 'audit_log',
  // Réseau social
  posts: 'posts',
  comments: 'comments',
  reactions: 'reactions',
  stories: 'stories',
  berealRounds: 'bereal_rounds',
};

export const COLLECTIONS = Object.keys(TABLES);

/* -------- Cache mémoire -------- */
const _cache = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
_cache.settings = {};

/* -------- camelCase ↔ snake_case -------- */
function camel(s) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function snake(s) { return s.replace(/([A-Z])/g, (_, c) => '_' + c.toLowerCase()); }

function fromDb(row, coll) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
  if (coll === 'users') {
    if (out.familyOf) out.family = { of: out.familyOf, relationship: out.familyRelationship };
  }
  if (coll === 'jobs' && typeof out.tags === 'string') {
    try { out.tags = JSON.parse(out.tags); } catch { out.tags = []; }
  }
  return out;
}
function toDb(obj, coll) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined) continue;
    if (k === 'family' || k === 'familyOf' || k === 'familyRelationship') continue;
    out[snake(k)] = v;
  }
  if (coll === 'users' && obj && obj.family) {
    out.family_of = obj.family.of;
    out.family_relationship = obj.family.relationship;
  }
  return out;
}

/* -------- Pub/sub -------- */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { for (const l of listeners) try { l(); } catch (e) { console.error(e); } }

/* -------- Chargement initial (à appeler après auth) -------- */
const PUBLIC_TABLES = ['news', 'sections', 'incorporations', 'formations']; // accessible aussi en anon
const AUTH_TABLES = ['users', 'jobs', 'candidatures', 'invitations', 'events', 'notes', 'messages', 'auditLog',
                     'posts', 'comments', 'reactions', 'stories', 'berealRounds'];

export async function loadAll({ authenticated = false } = {}) {
  const toLoad = authenticated ? [...PUBLIC_TABLES, ...AUTH_TABLES] : PUBLIC_TABLES;
  await Promise.all(toLoad.map(async (coll) => {
    const tbl = TABLES[coll];
    try {
      const { data, error } = await supabase.from(tbl).select('*');
      if (error) throw error;
      _cache[coll] = (data || []).map((r) => fromDb(r, coll));
    } catch (e) {
      // silencieux si juste pas d'accès (RLS)
      if (e && e.code !== 'PGRST116') console.warn('Load', tbl, 'failed:', e.message || e);
      _cache[coll] = [];
    }
  }));
  // Settings : table clé-valeur (key, value jsonb)
  try {
    const { data } = await supabase.from('settings').select('*');
    _cache.settings = (data || []).reduce((acc, x) => ({ ...acc, [x.key]: x.value }), {});
  } catch (e) {
    _cache.settings = {};
  }
  notify();
}

/* -------- API lecture synchrone (depuis le cache) -------- */
export const db = {
  all(coll) { return [...(_cache[coll] || [])]; },
  byId(coll, id) { return (_cache[coll] || []).find((x) => x.id === id) || null; },
  find(coll, fn) { return (_cache[coll] || []).find(fn) || null; },
  filter(coll, fn) { return (_cache[coll] || []).filter(fn); },
  count(coll, fn) { return fn ? this.filter(coll, fn).length : (_cache[coll] || []).length; },

  getSettings() {
    // Renvoie un objet plat fusionné avec les défauts
    return { ...DEFAULT_SETTINGS, ..._cache.settings };
  },

  /* -------- Écritures async -------- */
  async insert(coll, entity, opts = {}) {
    const tbl = TABLES[coll];
    if (!tbl) throw new Error(`Collection inconnue : ${coll}`);
    const payload = toDb(entity, coll);
    // Postgres génère l'id si absent (uuid)
    delete payload.id;
    const { data, error } = await supabase.from(tbl).insert(payload).select().single();
    if (error) throw error;
    const row = fromDb(data, coll);
    _cache[coll].push(row);
    if (!opts.silent) await logAudit(coll, 'insert', row.id, opts.description);
    notify();
    return row;
  },

  async update(coll, id, patch, opts = {}) {
    const tbl = TABLES[coll];
    if (!tbl) throw new Error(`Collection inconnue : ${coll}`);
    const payload = toDb(patch, coll);
    delete payload.id;
    delete payload.created_at;
    const { data, error } = await supabase.from(tbl).update(payload).eq('id', id).select().single();
    if (error) throw error;
    const row = fromDb(data, coll);
    const i = _cache[coll].findIndex((x) => x.id === id);
    if (i >= 0) _cache[coll][i] = row;
    else _cache[coll].push(row);
    if (!opts.silent) await logAudit(coll, 'update', id, opts.description);
    notify();
    return row;
  },

  async remove(coll, id, opts = {}) {
    const tbl = TABLES[coll];
    if (!tbl) throw new Error(`Collection inconnue : ${coll}`);
    const { error } = await supabase.from(tbl).delete().eq('id', id);
    if (error) throw error;
    _cache[coll] = _cache[coll].filter((x) => x.id !== id);
    if (!opts.silent) await logAudit(coll, 'remove', id, opts.description);
    notify();
  },

  async setSettings(patch) {
    // Mise à jour clé par clé via upsert sur la table key-value
    const entries = Object.entries(patch || {});
    for (const [key, value] of entries) {
      const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      _cache.settings[key] = value;
    }
    await logAudit('settings', 'update', null);
    notify();
    return this.getSettings();
  },

  // Pour les exports
  snapshot() { return JSON.parse(JSON.stringify(_cache)); },
};

/* -------- Defaults pour les settings (fusionnés à la lecture) -------- */
const DEFAULT_SETTINGS = {
  logoUrl: '',
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

/* -------- Logo helper -------- */
export function getLogoUrl() {
  return (_cache.settings && _cache.settings.logoUrl) || './assets/img/logo.svg';
}

/* -------- Audit log -------- */
function autoDescription(coll, action) {
  const verb = { insert: 'a créé', update: 'a modifié', remove: 'a supprimé', set: 'a configuré' }[action] || action;
  const labels = {
    users: 'un utilisateur',
    sections: 'une section',
    incorporations: 'une incorporation',
    formations: 'une formation',
    candidatures: 'une candidature',
    invitations: 'une invitation famille',
    events: 'un événement',
    news: 'une actualité',
    jobs: "une offre d'emploi",
    notes: 'une note',
    messages: 'un message',
    settings: 'les paramètres',
  };
  return `${verb} ${labels[coll] || coll}`;
}

async function getSessionUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch { return null; }
}

async function logAudit(coll, action, entityId, description = null) {
  try {
    const by = await getSessionUserId();
    const payload = {
      coll, action,
      entity_id: entityId,
      description: description || autoDescription(coll, action),
      by,
    };
    const { data, error } = await supabase.from('audit_log').insert(payload).select().single();
    if (error) {
      // Souvent c'est juste que l'utilisateur n'a pas le droit (anon). Pas grave.
      return;
    }
    _cache.auditLog.unshift(fromDb(data, 'auditLog'));
    if (_cache.auditLog.length > 500) _cache.auditLog.length = 500;
  } catch {}
}

// API publique pour logger une action métier (login, logout, etc.)
export async function logAction(description, coll = 'system', entityId = null) {
  try {
    const by = await getSessionUserId();
    const payload = { coll, action: 'event', entity_id: entityId, description, by };
    const { data, error } = await supabase.from('audit_log').insert(payload).select().single();
    if (error) return;
    _cache.auditLog.unshift(fromDb(data, 'auditLog'));
    if (_cache.auditLog.length > 500) _cache.auditLog.length = 500;
    notify();
  } catch {}
}

/* -------- Backups : on garde l'API mais c'est désactivé en mode Supabase
   (la vraie politique de backup est gérée côté Supabase) -------- */
export function getBackups() { return []; }
export function backupNow() { return null; }
export function restoreBackup() { return false; }
export function deleteBackup() {}
export function tickAutoBackup() {}

/* -------- Helpers -------- */
export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
