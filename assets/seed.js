/* ============================================================
   Mon SMV · Seed
   Initialise la DB au premier lancement :
   - 6 sections (S11..S23)
   - 6 incorporations sur 1 an (Jan, Mar, Mai, Jul, Sep, Nov)
   - Formations par défaut
   - Comptes administrateur, fondateur, modérateur, recrutement, 2 cadres,
     une poignée de volontaires, une famille
   - Quelques actualités, offres d'emploi, événements de planning
   ============================================================ */

import { db } from './db.js';
import { makeCredentials } from './auth.js';

const SEED_FLAG_KEY = 'mon-smv:seeded:v2';

const INCO_MONTHS = [0, 2, 4, 6, 8, 10]; // janv, mars, mai, juil, sept, nov
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function nextIncorporations(count = 6) {
  const now = new Date();
  const out = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  // démarre à la prochaine incorporation passée ou en cours
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

async function makeUser({ firstName, lastName, role, username, password, section = null, incorporation = null, email = '', founder = false, mustChangePassword = false }) {
  const { salt, hash } = await makeCredentials(password);
  return db.insert('users', {
    username, firstName, lastName, email,
    role, section, incorporation, founder,
    salt, hash, mustChangePassword,
    initialPassword: mustChangePassword ? password : null,
    initialPasswordShown: mustChangePassword,
    active: true,
    family: null,
  }, { silent: true });
}

export async function seedIfEmpty() {
  if (localStorage.getItem(SEED_FLAG_KEY)) return false;
  if (db.all('users').length > 0) {
    localStorage.setItem(SEED_FLAG_KEY, '1');
    return false;
  }

  /* ---------- Sections ---------- */
  ['S11','S12','S13','S21','S22','S23'].forEach((code, i) => {
    db.insert('sections', {
      code,
      compagnie: i < 3 ? 1 : 2,
      name: `Section ${code}`,
      description: i < 3 ? '1ʳᵉ compagnie' : '2ᵉ compagnie',
    }, { silent: true });
  });

  /* ---------- Incorporations + formations ---------- */
  const incos = nextIncorporations(6);
  const formationsBase = [
    { code: 'AUTO',  name: 'Auto-école · permis B',     capacity: 24, duration: '4 mois' },
    { code: 'MECA',  name: 'Atelier mécanique VL',      capacity: 12, duration: '3 mois' },
    { code: 'LOG',   name: 'Logistique & manutention',  capacity: 18, duration: '3 mois' },
    { code: 'REST',  name: 'Restauration collective',   capacity: 10, duration: '3 mois' },
    { code: 'BAT',   name: 'Bâtiment second œuvre',     capacity: 12, duration: '3 mois' },
    { code: 'SECU',  name: 'Sécurité privée',           capacity: 14, duration: '2 mois' },
  ];
  incos.forEach((i) => {
    const inco = db.insert('incorporations', {
      ...i,
      open: true,
      seats: 132,
      seatsTaken: Math.floor(Math.random() * 90),
    }, { silent: true });
    // 4 formations par incorporation par défaut
    formationsBase.slice(0, 4).forEach((f) => {
      db.insert('formations', { ...f, incorporationId: inco.id }, { silent: true });
    });
  });

  /* ---------- Comptes par défaut ---------- */
  // Tous avec mots de passe simples pour la démo. Ils peuvent les changer ensuite.
  // Le `mustChangePassword: false` pour les comptes de démo afin que le PR soit
  // immédiatement testable. En prod il faudrait mettre true partout.
  await makeUser({ username: 'fondateur',  firstName: 'Marc',    lastName: 'Lefevre',  role: 'fondateur', password: 'fondateur', founder: true, email: 'fondateur@smv.gouv.fr' });
  await makeUser({ username: 'admin',      firstName: 'Sophie',  lastName: 'Durand',   role: 'admin',     password: 'admin',      email: 'admin@smv.gouv.fr' });
  await makeUser({ username: 'mod',        firstName: 'Julien',  lastName: 'Roche',    role: 'moderateur',password: 'mod',        email: 'moderation@smv.gouv.fr' });
  await makeUser({ username: 'recrutement',firstName: 'Claire',  lastName: 'Vidal',    role: 'recrutement',password: 'recrutement', email: 'recrutement@smv.gouv.fr' });
  await makeUser({ username: 't.bertin',   firstName: 'Thomas',  lastName: 'Bertin',   role: 'cadre',     password: 'cadre', section: 'S21', email: 't.bertin@smv.gouv.fr' });
  await makeUser({ username: 'l.costa',    firstName: 'Léonie',  lastName: 'Costa',    role: 'cadre',     password: 'cadre', section: 'S22', email: 'l.costa@smv.gouv.fr' });

  const incoCurrent = db.all('incorporations')[0];
  await makeUser({ username: 'l.morel',    firstName: 'Léa',     lastName: 'Morel',    role: 'jeune', password: 'jeune', section: 'S21', incorporation: incoCurrent?.slug, email: 'l.morel@smv.gouv.fr' });
  await makeUser({ username: 'k.boucher',  firstName: 'Karim',   lastName: 'Boucher',  role: 'jeune', password: 'jeune', section: 'S21', incorporation: incoCurrent?.slug, email: 'k.boucher@smv.gouv.fr' });
  await makeUser({ username: 'i.tessier',  firstName: 'Inès',    lastName: 'Tessier',  role: 'jeune', password: 'jeune', section: 'S21', incorporation: incoCurrent?.slug, email: 'i.tessier@smv.gouv.fr' });
  await makeUser({ username: 'j.boutet',   firstName: 'Julien',  lastName: 'Boutet',   role: 'jeune', password: 'jeune', section: 'S22', incorporation: incoCurrent?.slug, email: 'j.boutet@smv.gouv.fr' });

  // Famille de Léa
  const lea = db.find('users', (u) => u.username === 'l.morel');
  if (lea) {
    const { salt, hash } = await makeCredentials('famille');
    db.insert('users', {
      username: 'fam.morel',
      firstName: 'Christelle', lastName: 'Morel',
      role: 'famille', section: null, incorporation: null,
      family: { of: lea.id, relationship: 'mere' },
      salt, hash,
      email: 'c.morel@email.fr',
      mustChangePassword: false,
      active: true,
    }, { silent: true });
  }

  /* ---------- Actualités ---------- */
  [
    { date: '11/05', title: 'Cérémonie remise de calot · CAPI 2026', excerpt: 'Vendredi 16 mai, place d\'armes Beauregard.', kind: 'navy' },
    { date: '10/05', title: 'Nouveau partenaire · Carrefour Logistique', excerpt: '4 contrats d\'apprentissage à pourvoir.', kind: 'green' },
    { date: '08/05', title: 'Marche commémorative · 80 ans', excerpt: 'Avec les écoles de La Rochelle.', kind: 'lightblue' },
  ].forEach((n) => db.insert('news', { ...n, published: true }, { silent: true }));

  /* ---------- Offres ---------- */
  [
    { type: 'Alternance', title: 'Mécanicien VL · alternance', company: 'Carrosserie Lemoine', city: 'La Rochelle (17)', tags: ['Permis B','Mécanique','CAP'], description: 'Tu sors de formation SMV, tu as ton permis B et l\'envie d\'apprendre un métier de terrain.', email: 'rh@lemoine.fr' },
    { type: 'CDI', title: 'Préparateur de commandes', company: 'Carrefour Logistique', city: 'Aytré (17)', tags: ['Permis CACES','Équipe','2x8'], description: 'Préparation de commandes en équipe 2x8.', email: 'rh@carrefour-log.fr' },
    { type: 'CDD', title: 'Commis de cuisine', company: 'Mess officiers Marine', city: 'Rochefort (17)', tags: ['Restauration','HACCP'], description: 'Commis dans un mess officiers.', email: 'rh@mess-marine.fr' },
    { type: 'Apprentissage', title: 'Apprenti menuisier', company: 'Bois Pallice', city: 'La Pallice (17)', tags: ['CAP','Manuel','Permis B'], description: 'Atelier menuiserie, équipe de 5.', email: 'rh@bois-pallice.fr' },
    { type: 'CDI', title: 'Agent de sécurité portuaire', company: 'Securitas Port', city: 'La Pallice (17)', tags: ['SST','Permis B','Nuit'], description: 'Sécurité portuaire en équipe nuit.', email: 'rh@securitas-port.fr' },
  ].forEach((j) => db.insert('jobs', { ...j, published: true, posted: 'récente' }, { silent: true }));

  /* ---------- Events (planning de la S21 sur Mardi 13) ---------- */
  [
    { sec: 'S21', day: '2026-05-12', time: '06:30', title: 'Réveil & sport', sub: 'Stade · toute la section' },
    { sec: 'S21', day: '2026-05-12', time: '09:00', title: 'Auto-école · Code', sub: 'Salle 2 · Sgt Bertin' },
    { sec: 'S21', day: '2026-05-12', time: '10:00', title: 'Sport collectif', sub: 'Stade · S21' },
    { sec: 'S21', day: '2026-05-12', time: '12:00', title: 'Repas', sub: 'Mess' },
    { sec: 'S21', day: '2026-05-12', time: '14:00', title: 'Atelier insertion', sub: 'Salle 5 · cellule emploi' },
    { sec: 'S21', day: '2026-05-12', time: '17:00', title: 'Sport individuel', sub: 'Salle de muscu' },
    { sec: 'S21', day: '2026-05-13', time: '14:00', title: 'Visite Carrefour Logistique', sub: 'Aytré · zone Atlantique', type: 'sortie' },
  ].forEach((e) => db.insert('events', e, { silent: true }));

  /* ---------- Messages ---------- */
  if (lea) {
    const tb = db.find('users', (u) => u.username === 't.bertin');
    const kb = db.find('users', (u) => u.username === 'k.boucher');
    const it = db.find('users', (u) => u.username === 'i.tessier');
    [
      { channel: 'S21', userId: tb?.id, text: "Demain 14h00 : briefing visite entreprise. Tenue de service, calots.", at: '2026-05-12T08:02:00Z' },
      { channel: 'S21', userId: lea.id, text: 'Reçu sergent 👍', at: '2026-05-12T08:14:00Z' },
      { channel: 'S21', userId: kb?.id, text: "Quelqu'un a perdu un brassard rouge salle 3 hier ?", at: '2026-05-12T08:21:00Z' },
      { channel: 'S21', userId: lea.id, text: "Oui c'est à moi merci !", at: '2026-05-12T08:22:00Z' },
      { channel: 'S21', userId: it?.id, text: "Le code 47 c'est lequel déjà ?", at: '2026-05-12T09:01:00Z' },
    ].forEach((m) => db.insert('messages', m, { silent: true }));
  }

  /* ---------- Marqueur d'init ---------- */
  localStorage.setItem(SEED_FLAG_KEY, '1');
  return true;
}

export function resetSeed() {
  localStorage.removeItem(SEED_FLAG_KEY);
  db.reset();
}
