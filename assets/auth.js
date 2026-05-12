/* ============================================================
   Mon SMV · Auth
   - Hash PBKDF2-SHA256 (100k itérations) avec sel aléatoire
   - Génération d'identifiants k.nom (collision : suffixe numérique)
   - Session en sessionStorage (forcée à l'onglet courant)
   - Forçage du changement de mot de passe au premier login
   ============================================================ */

import { db } from './db.js';

const SESSION_KEY = 'mon-smv:session';
const PBKDF2_ITER = 100000;

/* ---------- Hash ---------- */
function bytesToHex(arr) { return [...arr].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex) {
  const r = new Uint8Array(hex.length / 2);
  for (let i = 0; i < r.length; i++) r[i] = parseInt(hex.substr(i * 2, 2), 16);
  return r;
}
function randomHex(n) { return bytesToHex(crypto.getRandomValues(new Uint8Array(n))); }

async function pbkdf2(password, saltHex) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey, 256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function makeCredentials(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt);
  return { salt, hash };
}

export async function verifyPassword(password, salt, hash) {
  return (await pbkdf2(password, salt)) === hash;
}

/* ---------- Identifiants & mots de passe ---------- */
const SLUG_RE = /[^a-z0-9-]/g;
export function slug(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove diacritics
    .replace(/['\s_]+/g, '-')
    .replace(SLUG_RE, '');
}

export function genUsername(firstName, lastName) {
  const first = slug(firstName)[0] || 'x';
  const last  = slug(lastName) || 'sansnom';
  const base  = `${first}.${last}`;
  const existing = new Set(db.all('users').map((u) => u.username));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}.${n}`)) n++;
  return `${base}.${n}`;
}

export function genInitialPassword() {
  // Sans caractères ambigus (0/O, 1/I/l)
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export function genInviteCode() {
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

/* ---------- Création d'un utilisateur (admin/mod) ---------- */
export async function createUser({ firstName, lastName, role, section = null, incorporation = null, email = '', phone = '', familyOf = null, familyRelationship = null, founder = false }) {
  const username = genUsername(firstName, lastName);
  const initialPassword = genInitialPassword();
  const { salt, hash } = await makeCredentials(initialPassword);
  const user = db.insert('users', {
    username,
    firstName, lastName, email, phone,
    role,                                  // 'jeune' | 'cadre' | 'famille' | 'moderateur' | 'admin' | 'recrutement' | 'fondateur'
    section, incorporation,
    family: familyOf ? { of: familyOf, relationship: familyRelationship } : null,
    salt, hash,
    mustChangePassword: true,
    initialPasswordShown: false,
    active: true,
    founder,                                // bool : peut accéder aux sauvegardes
  });
  return { user, initialPassword };
}

/* ---------- Login ---------- */
export async function login(usernameOrEmail, password) {
  const v = (usernameOrEmail || '').trim().toLowerCase();
  const user = db.find('users', (u) =>
    (u.username || '').toLowerCase() === v ||
    (u.email || '').toLowerCase() === v
  );
  if (!user) return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  if (!user.active) return { ok: false, error: 'Compte désactivé. Contacte un administrateur.' };
  const ok = await verifyPassword(password, user.salt, user.hash);
  if (!ok) return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  db.update('users', user.id, { lastLogin: new Date().toISOString() }, { silent: true });
  setSession(user.id);
  return { ok: true, user, mustChangePassword: !!user.mustChangePassword };
}

export function logout() { sessionStorage.removeItem(SESSION_KEY); }

export async function changePassword(userId, newPassword) {
  const { salt, hash } = await makeCredentials(newPassword);
  return db.update('users', userId, { salt, hash, mustChangePassword: false, initialPasswordShown: true });
}

export async function resetPasswordByAdmin(userId) {
  const newPwd = genInitialPassword();
  const { salt, hash } = await makeCredentials(newPwd);
  db.update('users', userId, { salt, hash, mustChangePassword: true, initialPasswordShown: false });
  return newPwd;
}

/* ---------- Session ---------- */
export function setSession(userId) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, at: Date.now() }));
}
export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function currentUser() {
  const s = getSession(); if (!s) return null;
  return db.byId('users', s.userId);
}

/* ---------- Permissions ---------- */
export const ROLES_LABELS = {
  jeune: 'Jeune volontaire',
  cadre: 'Cadre encadrant',
  famille: 'Famille',
  moderateur: 'Modérateur',
  admin: 'Administrateur',
  recrutement: 'Cellule recrutement',
  fondateur: 'Fondateur',
};

export const RELATIONSHIPS = [
  { value: 'mere',     label: 'Mère' },
  { value: 'pere',     label: 'Père' },
  { value: 'tuteur',   label: 'Tuteur·rice légal·e' },
  { value: 'frere',    label: 'Frère' },
  { value: 'soeur',    label: 'Sœur' },
  { value: 'conjoint', label: 'Conjoint·e' },
  { value: 'grandparent', label: 'Grand-parent' },
  { value: 'autre',    label: 'Autre proche' },
];

export function canAccessAdmin(user) {
  return !!user && ['admin', 'moderateur', 'fondateur'].includes(user.role);
}
export function canEditUsers(user) {
  return !!user && ['admin', 'moderateur'].includes(user.role);
}
export function canAccessBackups(user) {
  return !!user && (user.role === 'fondateur' || user.founder);
}
export function canAccessRecrutement(user) {
  return !!user && ['recrutement', 'admin'].includes(user.role);
}
