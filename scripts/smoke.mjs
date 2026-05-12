/* ============================================================
   Mon SMV · smoke test (architecture beta)
   - DB, auth (PBKDF2), seed, collision d'identifiants
   - Backups (12 slots), rendu des écrans admin
   Usage : npm run smoke
   ============================================================ */
import { webcrypto } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Polyfills minimaux : crypto + localStorage + sessionStorage
function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const { db, backupNow, getBackups } = await import('file://' + ROOT + '/assets/db.js');
const auth = await import('file://' + ROOT + '/assets/auth.js');
const seed = await import('file://' + ROOT + '/assets/seed.js');
const sa   = await import('file://' + ROOT + '/assets/screens-admin.js');

let pass = 0, total = 0;
const t = (label, ok) => { total++; if (ok) pass++; console.log(`${ok ? '✓' : '✗'} ${label}`); };

console.log('=== Seed ===');
await seed.seedIfEmpty();
t('6 sections', db.all('sections').length === 6);
t('6 incorporations', db.all('incorporations').length === 6);
t('formations >= 24', db.all('formations').length >= 24);
t('utilisateurs seedés', db.all('users').length >= 10);
t('admin existe',       !!db.find('users', u => u.username === 'admin'));
t('fondateur existe',   !!db.find('users', u => u.username === 'fondateur'));
t('recrutement existe', !!db.find('users', u => u.username === 'recrutement'));

console.log('\n=== Auth ===');
let r = await auth.login('admin', 'admin');
t('login admin', r.ok);
auth.logout();
r = await auth.login('admin', 'wrong');
t('mot de passe incorrect rejeté', !r.ok);
r = await auth.login('l.morel', 'jeune');
t('login l.morel', r.ok);
auth.logout();

console.log('\n=== Création + collision username ===');
await auth.login('admin', 'admin');
const c1 = await auth.createUser({ firstName: 'Killian', lastName: 'Goilard', role: 'jeune', section: 'S21' });
t('username k.goilard', c1.user.username === 'k.goilard');
t('mot de passe initial 8 chars', c1.initialPassword.length === 8);
t('mustChangePassword=true',  c1.user.mustChangePassword);
const c2 = await auth.createUser({ firstName: 'Karim', lastName: 'Goilard', role: 'jeune', section: 'S22' });
t('collision → k.goilard.2', c2.user.username === 'k.goilard.2');
const c3 = await auth.createUser({ firstName: 'Kevin', lastName: 'Goilard', role: 'jeune', section: 'S22' });
t('collision → k.goilard.3', c3.user.username === 'k.goilard.3');

console.log('\n=== Force change password ===');
auth.logout();
r = await auth.login('k.goilard', c1.initialPassword);
t('login avec mdp initial → mustChangePassword', r.ok && r.mustChangePassword);
await auth.changePassword(c1.user.id, 'nouveauMDP12345');
auth.logout();
r = await auth.login('k.goilard', 'nouveauMDP12345');
t('login avec nouveau mdp', r.ok && !r.mustChangePassword);

console.log('\n=== Sauvegardes (max 12) ===');
auth.logout();
await auth.login('fondateur', 'fondateur');
backupNow('t1'); backupNow('t2'); backupNow('t3');
t('au moins 3 sauvegardes', getBackups().length >= 3);
for (let i = 0; i < 15; i++) backupNow('stress');
t('rétention 12 slots', getBackups().length === 12);

console.log('\n=== Rendu des écrans back-office ===');
auth.logout();
await auth.login('admin', 'admin');
const adm = auth.currentUser();
t('adminDashboard',     sa.adminDashboard(adm).includes('Tableau de'));
t('adminUsers',         sa.adminUsers(adm, '').includes('Utilisateurs'));
t('adminCandidatures',  sa.adminCandidatures(adm).includes('Candidatures'));
t('adminFamilles',      sa.adminFamilles(adm).includes('Familles'));
t('adminSettings',      sa.adminSettings(adm).includes('Paramètres'));
t('adminAudit',         sa.adminAudit(adm).includes('audit'));
t('recrutementDashboard', sa.recrutementDashboard(adm).includes('recrutement'));
const inco = db.all('incorporations')[0];
t('recrutementInco',    sa.recrutementInco(adm, inco.id).includes(inco.label));
t('fondateurBackups',   sa.fondateurBackups(adm).includes('Sauvegardes'));

console.log(`\n${pass}/${total} tests OK`);
process.exit(pass === total ? 0 : 1);
