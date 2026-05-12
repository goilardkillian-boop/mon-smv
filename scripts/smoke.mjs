/* ============================================================
   Smoke test · vérifie que toutes les routes principales rendent
   sans erreur. Requiert : npm i -D jsdom (ou utilise --experimental)
   Usage : npm run smoke
   ============================================================ */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

const dom = new JSDOM(read('index.html'), {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.structuredClone = globalThis.structuredClone || ((x) => JSON.parse(JSON.stringify(x)));

const bundle =
  read('assets/icons.js').replace('export const ICONS', 'var ICONS') + '\n' +
  read('assets/data.js').replace('export const DATA', 'var DATA') + '\n' +
  read('assets/app.js')
    .replace("import { ICONS } from './icons.js';", '')
    .replace("import { DATA } from './data.js';", '');
window.eval(bundle);

const app = window.document.getElementById('app');
const wait = () => new Promise((r) => setTimeout(r, 20));

const cases = [
  ['#/',                          'seconde'],
  ['#/centre',                    'La Rochelle'],
  ['#/decouvrir',                 'Armé pour'],
  ['#/galerie',                   'Sport · matin'],
  ['#/visite',                    'Découvre'],
  ['#/contact',                   'On reprend'],
  ['#/login',                     'de retour'],
  ['#/signup',                    'Qui es-'],
];

let pass = 0;
for (const [hash, needle] of cases) {
  window.location.hash = hash;
  window.dispatchEvent(new window.Event('hashchange'));
  await wait();
  const ok = app.innerHTML.includes(needle);
  if (ok) pass++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${hash.padEnd(25)}  contient "${needle}"`);
}

// flow connecté (jeune)
window.location.hash = '#/login';
window.dispatchEvent(new window.Event('hashchange'));
await wait();
app.querySelector('[data-demo="jeune"]')?.click();
await wait();

for (const [hash, needle] of [
  ['#/accueil', 'Bonjour'],
  ['#/section/calendrier', 'Section S21'],
  ['#/tchat', 'Sgt Bertin'],
  ['#/code', 'Priorités'],
  ['#/emploi', 'Préparateur'],
]) {
  window.location.hash = hash;
  window.dispatchEvent(new window.Event('hashchange'));
  await wait();
  const ok = app.innerHTML.includes(needle);
  if (ok) pass++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${hash.padEnd(25)}  contient "${needle}"`);
}

const total = cases.length + 5;
console.log(`\n${pass}/${total} routes vérifiées`);
process.exit(pass === total ? 0 : 1);
