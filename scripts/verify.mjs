import { createClient } from '@supabase/supabase-js';
const URL = 'https://csbmqnlehdkmkptaikdp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYm1xbmxlaGRrbWtwdGFpa2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk3NTUsImV4cCI6MjA5NDE1NTc1NX0.7B5g2KUHAjNuCXWJM8K9FkYwzCuu_V-nuV0gVjOOBks';
const supabase = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const tests = [
  ['admin', 'admin123'],
  ['fondateur', 'fondateur'],
  ['mod', 'mod1234'],
  ['recrutement', 'recrutement'],
  ['t.bertin', 'cadre1'],
  ['l.costa', 'cadre1'],
  ['l.morel', 'jeune1'],
];
for (const [user, pwd] of tests) {
  const email = `${user}@smv.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
  if (error) console.log(`❌ ${user} / ${pwd} → ${error.message}`);
  else {
    const { data: p } = await supabase.from('profiles').select('username,first_name,last_name,role,section').eq('id', data.user.id).single();
    console.log(`✅ ${user} / ${pwd} → role=${p?.role} section=${p?.section || '—'}`);
  }
  await supabase.auth.signOut();
}

// Vérif data
console.log('\n=== Données seed ===');
const { count: sCount } = await supabase.from('sections').select('*', { count: 'exact', head: true });
console.log('Sections:', sCount);
const { count: iCount } = await supabase.from('incorporations').select('*', { count: 'exact', head: true });
console.log('Incorporations:', iCount);
const { count: fCount } = await supabase.from('formations').select('*', { count: 'exact', head: true });
console.log('Formations:', fCount);
const { count: nCount } = await supabase.from('news').select('*', { count: 'exact', head: true });
console.log('News:', nCount);
const { count: jCount } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
console.log('Jobs:', jCount);
