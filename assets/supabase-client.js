/* ============================================================
   Mon SMV · Client Supabase
   - URL et clé anon (publique, safe à exposer)
   - persistSession : la session reste après refresh
   ============================================================ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const SUPABASE_URL = 'https://csbmqnlehdkmkptaikdp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYm1xbmxlaGRrbWtwdGFpa2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzk3NTUsImV4cCI6MjA5NDE1NTc1NX0.7B5g2KUHAjNuCXWJM8K9FkYwzCuu_V-nuV0gVjOOBks';

// Domaine synthétique pour mapper username ↔ email côté Supabase Auth
// (Supabase Auth requiert un email ; on garde l'UX "identifiant" côté app)
export const SYNTHETIC_EMAIL_DOMAIN = '@smv.app';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export function usernameToEmail(username) {
  // si l'entrée contient déjà un @, on suppose que c'est un vrai email
  if ((username || '').includes('@')) return username;
  return `${(username || '').toLowerCase()}${SYNTHETIC_EMAIL_DOMAIN}`;
}
export function emailToUsername(email) {
  if (!email) return '';
  if (email.endsWith(SYNTHETIC_EMAIL_DOMAIN)) return email.replace(SYNTHETIC_EMAIL_DOMAIN, '');
  return email;
}
