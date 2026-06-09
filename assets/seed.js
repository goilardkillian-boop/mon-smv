/* ============================================================
   Mon SMV · Seed
   Bootstrap automatique au tout premier lancement contre Supabase.
   - Tente d'abord de se connecter en admin
   - Si admin n'existe pas → signUp admin → seed sections/incos/etc.
   - Crée les comptes de démo (fondateur, mod, recrutement, cadres,
     jeunes, famille)
   - Met un flag `seeded=true` dans settings pour ne pas recommencer
   ============================================================ */

import { supabase, usernameToEmail } from './supabase-client.js';
import { db } from './db.js';

const INCO_MONTHS = [0, 2, 4, 6, 8, 10];
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function nextIncorporations(count = 6) {
  const now = new Date();
  const out = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  let i = INCO_MONTHS.findIndex((x) => x >= m);
  if (i < 0) { i = 0; y += 1; }
  for (let k = 0; k < count; k++) {
    const month = INCO_MONTHS[i];
    out.push({ year: y, month, label: `${MOIS_LABELS[month]} ${y}`, slug: `${y}-${String(month+1).padStart(2,'0')}` });
    i++;
    if (i >= INCO_MONTHS.length) { i = 0; y += 1; }
  }
  return out;
}

// Mots de passe ≥ 6 caractères (contrainte Supabase Auth)
const DEMO_USERS = [
  { username: 'admin',        password: 'admin123',     firstName: 'Sophie',  lastName: 'Durand',   role: 'admin',       email: 'admin@smv.gouv.fr' },
  { username: 'fondateur',    password: 'fondateur',    firstName: 'Marc',    lastName: 'Lefevre',  role: 'fondateur',   email: 'fondateur@smv.gouv.fr', founder: true },
  { username: 'mod',          password: 'mod1234',      firstName: 'Julien',  lastName: 'Roche',    role: 'moderateur',  email: 'moderation@smv.gouv.fr' },
  { username: 'recrutement',  password: 'recrutement',  firstName: 'Claire',  lastName: 'Vidal',    role: 'recrutement', email: 'recrutement@smv.gouv.fr' },
  { username: 't.bertin',     password: 'cadre1',       firstName: 'Thomas',  lastName: 'Bertin',   role: 'cadre', section: 'S21', email: 't.bertin@smv.gouv.fr' },
  { username: 'l.costa',      password: 'cadre1',       firstName: 'Léonie',  lastName: 'Costa',    role: 'cadre', section: 'S22', email: 'l.costa@smv.gouv.fr' },
  { username: 'l.morel',      password: 'jeune1',       firstName: 'Léa',     lastName: 'Morel',    role: 'jeune', section: 'S21', email: 'l.morel@smv.gouv.fr' },
  { username: 'k.boucher',    password: 'jeune1',       firstName: 'Karim',   lastName: 'Boucher',  role: 'jeune', section: 'S21', email: 'k.boucher@smv.gouv.fr' },
  { username: 'i.tessier',    password: 'jeune1',       firstName: 'Inès',    lastName: 'Tessier',  role: 'jeune', section: 'S21', email: 'i.tessier@smv.gouv.fr' },
  { username: 'j.boutet',     password: 'jeune1',       firstName: 'Julien',  lastName: 'Boutet',   role: 'jeune', section: 'S22', email: 'j.boutet@smv.gouv.fr' },
];

async function trySignUpDemo(u) {
  const email = usernameToEmail(u.username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: u.password,
    options: {
      data: {
        username: u.username,
        first_name: u.firstName,
        last_name: u.lastName,
        role: u.role,
      },
    },
  });
  if (error) {
    // déjà existant : on essaie de se connecter (pour récupérer l'id)
    if (/already/i.test(error.message) || /registered/i.test(error.message)) {
      const { data: l } = await supabase.auth.signInWithPassword({ email, password: u.password });
      return l?.user?.id || null;
    }
    throw error;
  }
  return data?.user?.id || null;
}

async function completeProfile(userId, u) {
  const patch = { must_change_password: false }; // pour démo, pas de forçage
  if (u.section) patch.section = u.section;
  if (u.email) patch.email = u.email;
  if (u.founder) patch.founder = true;
  await supabase.from('profiles').update(patch).eq('id', userId);
}

async function isSeeded() {
  // On vérifie via la table settings (publique en lecture)
  const { data } = await supabase.from('settings').select('value').eq('key', 'seeded').maybeSingle();
  return !!(data && data.value === true);
}

async function markSeeded() {
  await supabase.from('settings').upsert({ key: 'seeded', value: true }, { onConflict: 'key' });
}

/* -------- Seed sections / incorporations / formations / news / jobs -------- */
async function seedReferenceData() {
  // Sections
  const { count: sCount } = await supabase.from('sections').select('*', { count: 'exact', head: true });
  if (!sCount) {
    const sections = ['S11','S12','S13','S21','S22','S23'].map((code, i) => ({
      code, name: `Section ${code}`, compagnie: i < 3 ? 1 : 2,
      description: i < 3 ? '1ʳᵉ compagnie' : '2ᵉ compagnie',
    }));
    await supabase.from('sections').insert(sections);
  }

  // Incorporations + formations
  const { count: iCount } = await supabase.from('incorporations').select('*', { count: 'exact', head: true });
  if (!iCount) {
    const incos = nextIncorporations(6).map((i) => ({
      slug: i.slug, label: i.label, year: i.year, month: i.month,
      seats: 132, seats_taken: Math.floor(Math.random() * 90), open: true,
    }));
    const { data: created } = await supabase.from('incorporations').insert(incos).select();
    const formationsBase = [
      { code: 'AUTO',  name: 'Auto-école · permis B',     capacity: 24, duration: '4 mois' },
      { code: 'MECA',  name: 'Atelier mécanique VL',      capacity: 12, duration: '3 mois' },
      { code: 'LOG',   name: 'Logistique & manutention',  capacity: 18, duration: '3 mois' },
      { code: 'REST',  name: 'Restauration collective',   capacity: 10, duration: '3 mois' },
    ];
    const allFormations = (created || []).flatMap((inco) =>
      formationsBase.map((f) => ({ ...f, incorporation_id: inco.id }))
    );
    if (allFormations.length) await supabase.from('formations').insert(allFormations);
  }

  // News
  const { count: nCount } = await supabase.from('news').select('*', { count: 'exact', head: true });
  if (!nCount) {
    await supabase.from('news').insert([
      { date: '11/05', title: 'Cérémonie remise de calot · CAPI 2026', excerpt: 'Vendredi 16 mai, place d\'armes Beauregard.', kind: 'navy', published: true },
      { date: '10/05', title: 'Nouveau partenaire · Carrefour Logistique', excerpt: '4 contrats d\'apprentissage à pourvoir.', kind: 'green', published: true },
      { date: '08/05', title: 'Marche commémorative · 80 ans', excerpt: 'Avec les écoles de La Rochelle.', kind: 'lightblue', published: true },
    ]);
  }

  // Jobs
  const { count: jCount } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
  if (!jCount) {
    await supabase.from('jobs').insert([
      { type: 'Alternance', title: 'Mécanicien VL · alternance', company: 'Carrosserie Lemoine', city: 'La Rochelle (17)', tags: ['Permis B','Mécanique','CAP'], description: "Tu sors de formation SMV, tu as ton permis B et l'envie d'apprendre un métier de terrain.", email: 'rh@lemoine.fr', published: true, posted: 'récente' },
      { type: 'CDI', title: 'Préparateur de commandes', company: 'Carrefour Logistique', city: 'Aytré (17)', tags: ['Permis CACES','Équipe','2x8'], description: 'Préparation de commandes en équipe 2x8.', email: 'rh@carrefour-log.fr', published: true, posted: 'récente' },
      { type: 'CDD', title: 'Commis de cuisine', company: 'Mess officiers Marine', city: 'Rochefort (17)', tags: ['Restauration','HACCP'], description: 'Commis dans un mess officiers.', email: 'rh@mess-marine.fr', published: true, posted: 'récente' },
      { type: 'Apprentissage', title: 'Apprenti menuisier', company: 'Bois Pallice', city: 'La Pallice (17)', tags: ['CAP','Manuel','Permis B'], description: 'Atelier menuiserie, équipe de 5.', email: 'rh@bois-pallice.fr', published: true, posted: 'récente' },
    ]);
  }

  // Events (planning d'exemple S21)
  const { count: eCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
  if (!eCount) {
    await supabase.from('events').insert([
      { sec: 'S21', day: '2026-05-12', time: '06:30', title: 'Réveil & sport', sub: 'Stade · toute la section' },
      { sec: 'S21', day: '2026-05-12', time: '09:00', title: 'Auto-école · Code', sub: 'Salle 2 · Sgt Bertin' },
      { sec: 'S21', day: '2026-05-12', time: '10:00', title: 'Sport collectif', sub: 'Stade · S21' },
      { sec: 'S21', day: '2026-05-12', time: '12:00', title: 'Repas', sub: 'Mess' },
      { sec: 'S21', day: '2026-05-12', time: '14:00', title: 'Atelier insertion', sub: 'Salle 5 · cellule emploi' },
      { sec: 'S21', day: '2026-05-12', time: '17:00', title: 'Sport individuel', sub: 'Salle de muscu' },
    ]);
  }
}

/* -------- API principale -------- */
export async function seedIfEmpty() {
  // Si déjà seedé, on sort
  if (await isSeeded()) return false;

  console.log('[seed] Première initialisation Supabase...');

  // Préserver la session courante si on en a une
  const { data: { session: prev } } = await supabase.auth.getSession();
  if (prev) await supabase.auth.signOut();

  // 1. Créer le compte admin
  const adminId = await trySignUpDemo(DEMO_USERS[0]);
  // signUp auto-connecté en admin. On en profite pour patcher son profil.
  if (adminId) await completeProfile(adminId, DEMO_USERS[0]);

  // 2. Seed les données de référence (sections, incos, news, jobs)
  //    On est connecté en admin → RLS OK
  try {
    await seedReferenceData();
  } catch (e) {
    console.warn('[seed] reference data:', e.message || e);
  }

  // 3. Marquer comme seedé
  try { await markSeeded(); } catch (e) { console.warn('[seed] markSeeded:', e); }

  // 4. Se déconnecter pour préparer la création des autres comptes
  await supabase.auth.signOut();

  // 5. Créer les autres comptes de démo
  for (const u of DEMO_USERS.slice(1)) {
    try {
      const id = await trySignUpDemo(u);
      if (id) await completeProfile(id, u);
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[seed] user', u.username, ':', e.message || e);
    }
  }

  console.log('[seed] Terminé');
  return true;
}
