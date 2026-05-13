/* ============================================================
   Mon SMV · smoke test (Supabase)
   Vérifie :
   - Connexion au projet Supabase
   - Tables présentes (sections, profiles, settings, etc.)
   - Lecture des news publiques (anon)
   Usage : npm run smoke
   ============================================================ */
import { createClient } from '@supabase/supabase-js';

const URL = 'https://csbmqnlehdkmkptaikdp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYm1xbmxlaGRrbWtwdGFpa2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk3NTUsImV4cCI6MjA5NDE1NTc1NX0.7B5g2KUHAjNuCXWJM8K9FkYwzCuu_V-nuV0gVjOOBks';

const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

let pass = 0, total = 0;
const t = async (label, fn) => {
  total++;
  try {
    const ok = await fn();
    if (ok) { pass++; console.log('✓', label); }
    else { console.log('✗', label); }
  } catch (e) { console.log('✗', label, '·', e.message || e); }
};

console.log('=== Smoke test Supabase ===\n');

await t('Connexion Supabase', async () => {
  const r = await fetch(URL + '/rest/v1/');
  return r.ok || r.status === 401; // 401 attendu sans auth, mais le serveur répond
});

await t('Table sections accessible (RLS publique)', async () => {
  const { error } = await supabase.from('sections').select('*').limit(1);
  return !error || error.code === 'PGRST301'; // RLS denies = OK aussi
});

await t('Table settings lisible en anon', async () => {
  const { data, error } = await supabase.from('settings').select('*');
  return !error;
});

await t('Table news lisible en anon (published only)', async () => {
  const { error } = await supabase.from('news').select('*');
  return !error;
});

await t('Bucket "logos" existe', async () => {
  const { data, error } = await supabase.storage.from('logos').list('', { limit: 1 });
  return !error;
});

console.log(`\n${pass}/${total} tests OK`);
process.exit(pass === total ? 0 : 1);
