/* Test : qu'est-ce qui foire côté écritures Supabase ? */
import { createClient } from '@supabase/supabase-js';
const URL = 'https://csbmqnlehdkmkptaikdp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYm1xbmxlaGRrbWtwdGFpa2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk3NTUsImV4cCI6MjA5NDE1NTc1NX0.7B5g2KUHAjNuCXWJM8K9FkYwzCuu_V-nuV0gVjOOBks';
const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

console.log('=== Tests en tant qu\'admin ===');
const { data: l, error: le } = await supabase.auth.signInWithPassword({ email: 'admin@smv.app', password: 'admin123' });
if (le) { console.log('Login échec:', le); process.exit(1); }
console.log('Logged in as admin, id:', l.user.id);

console.log('\n--- Test 1: upsert settings (la cause probable du bouton enregistrer) ---');
const r1 = await supabase.from('settings').upsert({ key: 'test', value: { a: 1 } }, { onConflict: 'key' });
console.log('Upsert settings:', r1.error ? '❌ ' + r1.error.message + ' (code: ' + r1.error.code + ')' : '✅');

console.log('\n--- Test 2: insert audit_log (utilisé sur chaque écriture) ---');
const r2 = await supabase.from('audit_log').insert({ coll: 'test', action: 'event', description: 'test', by: l.user.id }).select().single();
console.log('Insert audit:', r2.error ? '❌ ' + r2.error.message + ' (code: ' + r2.error.code + ')' : '✅');

console.log('\n--- Test 3: insert formations ---');
const incos = (await supabase.from('incorporations').select('id').limit(1)).data;
const r3 = await supabase.from('formations').insert({ incorporation_id: incos[0].id, code: 'TEST', name: 'Test formation', duration: '1 mois', capacity: 10 }).select().single();
console.log('Insert formation:', r3.error ? '❌ ' + r3.error.message : '✅');
if (r3.data) await supabase.from('formations').delete().eq('id', r3.data.id);

console.log('\n--- Test 4: insert sections ---');
const r4 = await supabase.from('sections').insert({ code: 'S99', name: 'Section test', compagnie: 9 }).select().single();
console.log('Insert section:', r4.error ? '❌ ' + r4.error.message : '✅');
if (r4.data) await supabase.from('sections').delete().eq('id', r4.data.id);

console.log('\n--- Test 5: update sa propre profile ---');
const r5 = await supabase.from('profiles').update({ phone: '06 11 11 11 11' }).eq('id', l.user.id);
console.log('Update own profile:', r5.error ? '❌ ' + r5.error.message : '✅');

console.log('\n--- Test 6: has_role function existe ? ---');
const r6 = await supabase.rpc('has_role', { check_roles: ['admin'] });
console.log('has_role admin:', r6.error ? '❌ ' + r6.error.message : '✅ → ' + r6.data);
