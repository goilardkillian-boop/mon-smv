/* Seed manuel depuis Node — pour quand le seed auto navigateur échoue */
import { createClient } from '@supabase/supabase-js';

const URL = 'https://csbmqnlehdkmkptaikdp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYm1xbmxlaGRrbWtwdGFpa2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk3NTUsImV4cCI6MjA5NDE1NTc1NX0.7B5g2KUHAjNuCXWJM8K9FkYwzCuu_V-nuV0gVjOOBks';
const supabase = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const DEMO_USERS = [
  { username: 'admin',      password: 'admin123',   firstName: 'Sophie', lastName: 'Durand',  role: 'admin',       email: 'admin@smv.gouv.fr' },
  { username: 'fondateur',  password: 'fondateur',  firstName: 'Marc',   lastName: 'Lefevre', role: 'fondateur',   email: 'fondateur@smv.gouv.fr', founder: true },
  { username: 'mod',        password: 'mod1234',    firstName: 'Julien', lastName: 'Roche',   role: 'moderateur',  email: 'moderation@smv.gouv.fr' },
  { username: 'recrutement',password: 'recrutement',firstName: 'Claire', lastName: 'Vidal',   role: 'recrutement', email: 'recrutement@smv.gouv.fr' },
  { username: 't.bertin',   password: 'cadre1',     firstName: 'Thomas', lastName: 'Bertin',  role: 'cadre', section: 'S21', email: 't.bertin@smv.gouv.fr' },
  { username: 'l.costa',    password: 'cadre1',     firstName: 'Léonie', lastName: 'Costa',   role: 'cadre', section: 'S22', email: 'l.costa@smv.gouv.fr' },
  { username: 'l.morel',    password: 'jeune1',     firstName: 'Léa',    lastName: 'Morel',   role: 'jeune', section: 'S21', email: 'l.morel@smv.gouv.fr' },
  { username: 'k.boucher',  password: 'jeune1',     firstName: 'Karim',  lastName: 'Boucher', role: 'jeune', section: 'S21', email: 'k.boucher@smv.gouv.fr' },
  { username: 'i.tessier',  password: 'jeune1',     firstName: 'Inès',   lastName: 'Tessier', role: 'jeune', section: 'S21', email: 'i.tessier@smv.gouv.fr' },
  { username: 'j.boutet',   password: 'jeune1',     firstName: 'Julien', lastName: 'Boutet',  role: 'jeune', section: 'S22', email: 'j.boutet@smv.gouv.fr' },
];

async function createUser(u) {
  const email = `${u.username}@smv.app`;
  process.stdout.write(`  · ${u.username} ... `);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: u.password,
    options: { data: { username: u.username, first_name: u.firstName, last_name: u.lastName, role: u.role } },
  });
  if (error) {
    if (/already|registered/i.test(error.message)) {
      console.log('déjà existant');
      // Tente de login pour patcher
      const { data: l, error: le } = await supabase.auth.signInWithPassword({ email, password: u.password });
      if (le) { console.log('    login échec:', le.message); return null; }
      return l.user.id;
    }
    console.log('erreur:', error.message);
    return null;
  }
  console.log('créé', data.user.id);
  // Petite pause pour que le trigger ait le temps de créer le profil
  await new Promise(r => setTimeout(r, 300));
  return data.user.id;
}

async function patchProfile(id, u) {
  const patch = { must_change_password: false };
  if (u.section) patch.section = u.section;
  if (u.email) patch.email = u.email;
  if (u.founder) patch.founder = true;
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) console.log('    patch profil échec:', error.message);
}

console.log('\n=== Étape 1 · Création admin ===');
const adminId = await createUser(DEMO_USERS[0]);
if (adminId) await patchProfile(adminId, DEMO_USERS[0]);

console.log('\n=== Étape 2 · Seed sections ===');
const sections = ['S11','S12','S13','S21','S22','S23'].map((code, i) => ({
  code, name: `Section ${code}`, compagnie: i < 3 ? 1 : 2,
  description: i < 3 ? '1ʳᵉ compagnie' : '2ᵉ compagnie',
}));
const { error: secErr } = await supabase.from('sections').insert(sections);
if (secErr) console.log('  Erreur sections:', secErr.message);
else console.log('  6 sections créées');

console.log('\n=== Étape 3 · Seed incorporations ===');
const INCO_MONTHS = [0, 2, 4, 6, 8, 10];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const now = new Date();
let y = now.getFullYear(), m = now.getMonth();
let i = INCO_MONTHS.findIndex(x => x >= m);
if (i < 0) { i = 0; y++; }
const incos = [];
for (let k = 0; k < 6; k++) {
  const mo = INCO_MONTHS[i];
  incos.push({
    slug: `${y}-${String(mo+1).padStart(2,'0')}`,
    label: `${MOIS[mo]} ${y}`,
    year: y, month: mo,
    seats: 132, seats_taken: Math.floor(Math.random()*90),
    open: true,
  });
  i++; if (i >= INCO_MONTHS.length) { i = 0; y++; }
}
const { data: incosCreated, error: incoErr } = await supabase.from('incorporations').insert(incos).select();
if (incoErr) console.log('  Erreur incos:', incoErr.message);
else console.log(`  ${incosCreated.length} incorporations créées`);

console.log('\n=== Étape 4 · Formations ===');
const formationsBase = [
  { code: 'AUTO', name: 'Auto-école · permis B',    capacity: 24, duration: '4 mois' },
  { code: 'MECA', name: 'Atelier mécanique VL',     capacity: 12, duration: '3 mois' },
  { code: 'LOG',  name: 'Logistique & manutention', capacity: 18, duration: '3 mois' },
  { code: 'REST', name: 'Restauration collective',  capacity: 10, duration: '3 mois' },
];
if (incosCreated) {
  const allFormations = incosCreated.flatMap(inco =>
    formationsBase.map(f => ({ ...f, incorporation_id: inco.id }))
  );
  const { error: fErr } = await supabase.from('formations').insert(allFormations);
  if (fErr) console.log('  Erreur formations:', fErr.message);
  else console.log(`  ${allFormations.length} formations créées`);
}

console.log('\n=== Étape 5 · News ===');
await supabase.from('news').insert([
  { date: '11/05', title: 'Cérémonie remise de calot · CAPI 2026', excerpt: "Vendredi 16 mai, place d'armes Beauregard.", kind: 'navy', published: true },
  { date: '10/05', title: 'Nouveau partenaire · Carrefour Logistique', excerpt: "4 contrats d'apprentissage à pourvoir.", kind: 'green', published: true },
  { date: '08/05', title: 'Marche commémorative · 80 ans', excerpt: 'Avec les écoles de La Rochelle.', kind: 'lightblue', published: true },
]);
console.log('  3 news');

console.log('\n=== Étape 6 · Jobs ===');
await supabase.from('jobs').insert([
  { type: 'Alternance', title: 'Mécanicien VL · alternance', company: 'Carrosserie Lemoine', city: 'La Rochelle (17)', tags: ['Permis B','Mécanique','CAP'], description: "Tu sors de formation SMV, tu as ton permis B et l'envie d'apprendre.", email: 'rh@lemoine.fr', published: true, posted: 'récente' },
  { type: 'CDI', title: 'Préparateur de commandes', company: 'Carrefour Logistique', city: 'Aytré (17)', tags: ['CACES','Équipe','2x8'], description: '2x8.', email: 'rh@carrefour-log.fr', published: true, posted: 'récente' },
  { type: 'CDD', title: 'Commis de cuisine', company: 'Mess Marine', city: 'Rochefort (17)', tags: ['HACCP'], description: 'Commis.', email: 'rh@mess-marine.fr', published: true, posted: 'récente' },
  { type: 'Apprentissage', title: 'Apprenti menuisier', company: 'Bois Pallice', city: 'La Pallice (17)', tags: ['CAP','Manuel'], description: 'Menuiserie.', email: 'rh@bois-pallice.fr', published: true, posted: 'récente' },
]);
console.log('  4 jobs');

console.log('\n=== Étape 7 · Marquer seeded ===');
await supabase.from('settings').upsert({ key: 'seeded', value: true }, { onConflict: 'key' });
console.log('  OK');

console.log('\n=== Étape 8 · Déconnexion admin + création autres comptes ===');
await supabase.auth.signOut();

for (const u of DEMO_USERS.slice(1)) {
  const id = await createUser(u);
  if (id) await patchProfile(id, u);
  await supabase.auth.signOut();
}

console.log('\n=== Étape 9 · Vérification login admin/admin ===');
const { data: t, error: te } = await supabase.auth.signInWithPassword({ email: 'admin@smv.app', password: 'admin' });
if (te) console.log('❌ Login admin échec:', te.message);
else console.log('✅ Login admin OK · user id:', t.user.id);
