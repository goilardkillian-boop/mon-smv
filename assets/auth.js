/* ============================================================
   Mon SMV · Auth (Supabase)
   - Login/Logout via Supabase Auth (email/password)
   - L'identifiant "k.nom" est mappé vers un email synthétique
     k.nom@smv.app pour rester dans le modèle Supabase
   - Profil applicatif stocké dans public.profiles (lié à auth.users)
   - Forçage du changement de mdp via flag `mustChangePassword` sur le
     profil (réinitialisé à false après le 1er changement)
   ============================================================ */

import { supabase, usernameToEmail, emailToUsername } from './supabase-client.js';
import { db, loadAll } from './db.js';

/* -------- Cache du user courant (synchrone) -------- */
let _currentUser = null;
let _session = null;
const _listeners = new Set();
export function onAuthChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
function notify() { for (const l of _listeners) try { l(); } catch (e) { console.error(e); } }

export function currentUser() { return _currentUser; }
export function currentSession() { return _session; }

/* -------- Bootstrap : appelle au démarrage de l'app -------- */
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  _session = session;
  if (session) {
    await loadAll({ authenticated: true });
    _currentUser = db.byId('users', session.user.id) || null;
  } else {
    await loadAll({ authenticated: false });
    _currentUser = null;
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    _session = session;
    if (session) {
      await loadAll({ authenticated: true });
      _currentUser = db.byId('users', session.user.id) || null;
    } else {
      await loadAll({ authenticated: false });
      _currentUser = null;
    }
    notify();
  });
}

/* -------- Login -------- */
export async function login(usernameOrEmail, password) {
  const email = usernameToEmail(usernameOrEmail);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: humanError(error.message) };
  }
  // Recharger le profil
  await loadAll({ authenticated: true });
  const profile = db.byId('users', data.user.id);
  if (!profile) {
    return { ok: false, error: "Profil utilisateur introuvable. Contacte un administrateur." };
  }
  if (!profile.active) {
    await supabase.auth.signOut();
    return { ok: false, error: "Compte désactivé. Contacte un administrateur." };
  }
  await db.update('users', profile.id, { lastLogin: new Date().toISOString() }, { silent: true });
  _currentUser = db.byId('users', profile.id) || profile;
  notify();
  return { ok: true, user: _currentUser, mustChangePassword: !!_currentUser.mustChangePassword };
}

function humanError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credential')) return 'Identifiant ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Email non confirmé. Contacte l'administrateur.";
  if (m.includes('user not found')) return 'Identifiant ou mot de passe incorrect.';
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans 1 minute.';
  return msg || 'Erreur inconnue.';
}

export async function logout() {
  // IMPORTANT : on vide le cache utilisateur SYNCHRONIQUEMENT avant le signOut.
  // Sinon le listener onAuthStateChange est asynchrone (await loadAll), et un render()
  // appelé juste après authLogout() voit encore l'ancien _currentUser → la redirection
  // depuis /admin vers /connexion ne fonctionne pas (l'utilisateur "reste connecté").
  _currentUser = null;
  _session = null;
  notify();
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('signOut error (non bloquant)', e);
  }
}

/* -------- Changement de mdp (utilisateur connecté) -------- */
export async function changePassword(userId, newPassword) {
  // L'utilisateur Supabase ne peut changer QUE son propre mdp via cette API
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  await db.update('users', userId, { mustChangePassword: false }, { silent: true });
  return true;
}

/* -------- Identifiants & génération -------- */
const SLUG_RE = /[^a-z0-9-]/g;
export function slug(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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

/* -------- Création d'un utilisateur par admin/mod -------- */
/* Stratégie : on appelle supabase.auth.signUp() qui crée auth.users.
   Le trigger handle_new_user crée le profil avec le rôle voulu.
   PROBLÈME : signUp auto-signe-in le nouvel user, ce qui déconnecte l'admin.
   SOLUTION : on sauvegarde la session admin, on signUp, on signe le nouvel user,
   puis on restaure la session admin via setSession(refresh_token). */

export async function createUser({ firstName, lastName, role, section = null, incorporation = null, email = '', phone = '', familyOf = null, familyRelationship = null }) {
  const username = genUsername(firstName, lastName);
  const initialPassword = genInitialPassword();
  const syntheticEmail = usernameToEmail(username);

  // 1. Sauvegarder la session admin courante
  const { data: { session: adminSession } } = await supabase.auth.getSession();

  // 2. Créer le compte (signUp auto-signe-in)
  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail,
    password: initialPassword,
    options: {
      data: {
        username,
        first_name: firstName,
        last_name: lastName,
        role,
      },
    },
  });

  if (error) {
    // Restaurer la session admin avant de remonter l'erreur
    if (adminSession) await supabase.auth.setSession(adminSession);
    throw error;
  }

  const newUserId = data.user?.id;

  // 3. Compléter le profil avec section, incorporation, email pro, famille
  //    Le trigger a déjà créé le profil de base. On le met à jour.
  //    Mais on est connecté comme le nouvel user, qui n'a pas le droit d'écrire
  //    sur d'autres profils. Heureusement il peut écrire le SIEN.
  if (newUserId) {
    const profilePatch = {
      section,
      incorporation,
      phone,
      must_change_password: true,
    };
    if (email && email !== syntheticEmail) profilePatch.email = email;
    if (familyOf) {
      profilePatch.family_of = familyOf;
      profilePatch.family_relationship = familyRelationship;
    }
    await supabase.from('profiles').update(profilePatch).eq('id', newUserId);
  }

  // 4. Déconnecter le nouvel user et restaurer l'admin
  await supabase.auth.signOut();
  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }

  // 5. Recharger les données + renvoyer
  await loadAll({ authenticated: !!adminSession });
  const created = db.byId('users', newUserId);

  return {
    user: created || { id: newUserId, username, firstName, lastName, role, section, incorporation, email, mustChangePassword: true, active: true },
    initialPassword,
  };
}

/* -------- Réinitialisation de mot de passe par admin -------- */
/* Le seul moyen côté client est de passer par updateUser après s'être
   reconnecté en tant que la cible. Comme on ne peut pas en pratique,
   on génère un nouveau mdp et on signale au user qu'il devra le changer.
   Solution réelle : Edge Function avec service_role.
   Pour cette beta, on utilise un workaround : on signUp avec un nouveau
   compte temporaire — pas idéal mais ça marche. */
/* En réalité, on utilise admin.updateUserById qui nécessite service_role.
   Sans backend, on ne peut PAS réinitialiser un mdp sans connaître l'ancien.
   Pour la beta, on indique à l'admin de transmettre un lien de réinit
   ou d'utiliser le flux "mot de passe oublié" de Supabase. */
export async function resetPasswordByAdmin(userId) {
  // Marquer le user comme "doit changer" et envoyer un email de reset
  const profile = db.byId('users', userId);
  if (!profile) throw new Error('Utilisateur introuvable');
  const syntheticEmail = usernameToEmail(profile.username);
  // Note : sans backend admin, on ne peut pas FORCER un nouveau mdp.
  // On envoie un email de reset Supabase + on met le flag.
  await supabase.auth.resetPasswordForEmail(syntheticEmail);
  await db.update('users', userId, { mustChangePassword: true }, { silent: true });
  return 'Un email de réinitialisation a été envoyé (vérifier dans le tableau de bord Supabase si pas reçu).';
}

/* -------- Permissions -------- */
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

/* -------- Compat : currentUser comme avant -------- */
export function getSession() { return _session; }
