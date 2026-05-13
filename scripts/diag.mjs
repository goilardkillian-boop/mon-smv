import { createClient } from '@supabase/supabase-js';
const URL = 'https://csbmqnlehdkmkptaikdp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYm1xbmxlaGRrbWtwdGFpa2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk3NTUsImV4cCI6MjA5NDE1NTc1NX0.7B5g2KUHAjNuCXWJM8K9FkYwzCuu_V-nuV0gVjOOBks';
const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

console.log('=== 1. Flag seeded ? ===');
const { data: s } = await supabase.from('settings').select('*').eq('key', 'seeded').maybeSingle();
console.log('seeded:', s?.value);

console.log('\n=== 2. Combien de sections ? ===');
const { count: secCount } = await supabase.from('sections').select('*', { count: 'exact', head: true });
console.log('sections:', secCount);

console.log('\n=== 3. Combien d\'incorporations ? ===');
const { count: incoCount } = await supabase.from('incorporations').select('*', { count: 'exact', head: true });
console.log('incorporations:', incoCount);

console.log('\n=== 4. Login admin/admin ===');
const { data: l1, error: e1 } = await supabase.auth.signInWithPassword({ email: 'admin@smv.app', password: 'admin' });
if (e1) console.log('Erreur login:', e1.message);
else console.log('Login OK, user id:', l1.user.id);

if (l1 && l1.user) {
  console.log('\n=== 5. Profil admin présent ? ===');
  const { data: p, error: pe } = await supabase.from('profiles').select('*').eq('id', l1.user.id).single();
  if (pe) console.log('Erreur profil:', pe.message);
  else console.log('Profil:', p);
  
  console.log('\n=== 6. Tous les profils ===');
  const { data: all } = await supabase.from('profiles').select('username,first_name,last_name,role');
  console.log('Profils trouvés:', all?.length || 0);
  if (all) all.forEach(u => console.log(' -', u.username, '·', u.role, '·', u.first_name, u.last_name));
  
  await supabase.auth.signOut();
}

console.log('\n=== 7. signUp test manuel ===');
const { data: su, error: sue } = await supabase.auth.signUp({
  email: 'testuser@smv.app',
  password: 'testpass1',
  options: { data: { username: 'testuser', first_name: 'Test', last_name: 'User', role: 'jeune' } }
});
if (sue) console.log('Erreur signUp:', sue.message, '· code:', sue.code, '· status:', sue.status);
else console.log('signUp OK:', su.user?.id, '· email_confirmed_at:', su.user?.email_confirmed_at, '· session:', !!su.session);
