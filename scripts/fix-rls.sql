-- ============================================================
-- Mon SMV · Fix RLS récursion infinie
-- À coller dans le SQL Editor de Supabase puis Run
-- ============================================================

-- 1. Fonction helper SECURITY DEFINER pour vérifier les rôles
--    (bypass RLS → pas de récursion quand utilisée dans les policies de profiles)
create or replace function public.has_role(check_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = any(check_roles)
  );
$$;

revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated, anon;

-- 2. Drop des policies qui causaient la récursion
drop policy if exists "Profils lisibles par tous les authentifiés" on public.profiles;
drop policy if exists "On modifie son propre profil"           on public.profiles;
drop policy if exists "Admins gèrent les profils"              on public.profiles;
drop policy if exists "Lecture profils authentifiés"           on public.profiles;
drop policy if exists "Modif son propre profil"                on public.profiles;
drop policy if exists "Insert son propre profil"               on public.profiles;
drop policy if exists "Admin gère tous profils"                on public.profiles;

-- 3. Policies propres sur profiles (pas de récursion)
create policy "Profils lisibles authentifiés"
  on public.profiles for select to authenticated using (true);

create policy "Profil : modifie le sien"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Profil : insère le sien (au signup)"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Admin gère profils"
  on public.profiles for all to authenticated
  using (public.has_role(array['admin','moderateur']))
  with check (public.has_role(array['admin','moderateur']));

-- 4. Rejoue les policies des autres tables avec la fonction has_role
--    (perf + cohérence)

drop policy if exists "Admin écrit" on public.sections;
create policy "Admin écrit" on public.sections for all to authenticated
  using (public.has_role(array['admin','moderateur']))
  with check (public.has_role(array['admin','moderateur']));

drop policy if exists "Recru/admin écrit" on public.incorporations;
create policy "Recru/admin écrit" on public.incorporations for all to authenticated
  using (public.has_role(array['admin','recrutement']))
  with check (public.has_role(array['admin','recrutement']));

drop policy if exists "Recru/admin écrit" on public.formations;
create policy "Recru/admin écrit" on public.formations for all to authenticated
  using (public.has_role(array['admin','recrutement']))
  with check (public.has_role(array['admin','recrutement']));

drop policy if exists "Admin/recru lit"   on public.candidatures;
drop policy if exists "Admin/recru écrit" on public.candidatures;
create policy "Admin/recru lit" on public.candidatures for select to authenticated
  using (public.has_role(array['admin','moderateur','recrutement']));
create policy "Admin/recru écrit" on public.candidatures for update to authenticated
  using (public.has_role(array['admin','moderateur','recrutement']));

drop policy if exists "Admin gère" on public.invitations;
create policy "Admin gère" on public.invitations for all to authenticated
  using (public.has_role(array['admin','moderateur']));

drop policy if exists "Cadre/admin écrit" on public.events;
create policy "Cadre/admin écrit" on public.events for all to authenticated
  using (public.has_role(array['admin','moderateur','cadre']))
  with check (public.has_role(array['admin','moderateur','cadre']));

drop policy if exists "Admin écrit" on public.news;
create policy "Admin écrit news" on public.news for all to authenticated
  using (public.has_role(array['admin','moderateur']))
  with check (public.has_role(array['admin','moderateur']));

drop policy if exists "Recru/admin écrit" on public.jobs;
create policy "Recru/admin écrit jobs" on public.jobs for all to authenticated
  using (public.has_role(array['admin','recrutement']))
  with check (public.has_role(array['admin','recrutement']));

drop policy if exists "Modération" on public.messages;
create policy "Modération" on public.messages for update to authenticated
  using (public.has_role(array['admin','moderateur','cadre']));

drop policy if exists "Audit visible admin" on public.audit_log;
create policy "Audit visible admin" on public.audit_log for select to authenticated
  using (public.has_role(array['admin','moderateur','fondateur']));

drop policy if exists "Admin écrit settings" on public.settings;
create policy "Admin écrit settings" on public.settings for all to authenticated
  using (public.has_role(array['admin','moderateur']))
  with check (public.has_role(array['admin','moderateur']));

-- 5. Vérification
select '✅ RLS fixé. Tu peux fermer cet onglet.' as status;
