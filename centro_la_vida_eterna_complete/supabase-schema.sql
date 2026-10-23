-- CENTRO LA VIDA ETERNA Songbook: isolated schema for an existing Supabase project.
-- Uses cle_songbook_* table names to avoid touching tables used by your other app.
-- Safe to run more than once. Review SQL output for any errors.

create extension if not exists pgcrypto;

create table if not exists public.cle_songbook_songs (
  id text primary key,
  title text not null,
  artist text not null default '',
  category text not null default 'Worship',
  key text not null default '',
  tempo text not null default '',
  lyrics text not null default '',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cle_songbook_playlists (
  id text primary key,
  name text not null,
  date date,
  song_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cle_songbook_admin_users (
  email text primary key check (email = lower(email)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.cle_songbook_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.cle_songbook_admin_users a
    where a.email = lower(coalesce(auth.jwt()->>'email','')) and a.active = true
  );
$$;

grant execute on function public.cle_songbook_is_admin() to anon, authenticated;

alter table public.cle_songbook_songs enable row level security;
alter table public.cle_songbook_playlists enable row level security;
alter table public.cle_songbook_admin_users enable row level security;

drop policy if exists cle_songbook_public_read_songs on public.cle_songbook_songs;
create policy cle_songbook_public_read_songs on public.cle_songbook_songs
  for select to anon, authenticated using (true);
drop policy if exists cle_songbook_admin_manage_songs on public.cle_songbook_songs;
create policy cle_songbook_admin_manage_songs on public.cle_songbook_songs
  for all to authenticated using (public.cle_songbook_is_admin()) with check (public.cle_songbook_is_admin());

drop policy if exists cle_songbook_public_read_playlists on public.cle_songbook_playlists;
create policy cle_songbook_public_read_playlists on public.cle_songbook_playlists
  for select to anon, authenticated using (true);
drop policy if exists cle_songbook_admin_manage_playlists on public.cle_songbook_playlists;
create policy cle_songbook_admin_manage_playlists on public.cle_songbook_playlists
  for all to authenticated using (public.cle_songbook_is_admin()) with check (public.cle_songbook_is_admin());

drop policy if exists cle_songbook_admin_read_admins on public.cle_songbook_admin_users;
create policy cle_songbook_admin_read_admins on public.cle_songbook_admin_users
  for select to authenticated
  using (public.cle_songbook_is_admin() or email = lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists cle_songbook_admin_add_admins on public.cle_songbook_admin_users;
create policy cle_songbook_admin_add_admins on public.cle_songbook_admin_users
  for insert to authenticated with check (public.cle_songbook_is_admin());
drop policy if exists cle_songbook_admin_remove_admins on public.cle_songbook_admin_users;
create policy cle_songbook_admin_remove_admins on public.cle_songbook_admin_users
  for delete to authenticated using (public.cle_songbook_is_admin());

grant select on public.cle_songbook_songs, public.cle_songbook_playlists to anon, authenticated;
grant insert, update, delete on public.cle_songbook_songs, public.cle_songbook_playlists to authenticated;
grant select, insert, delete on public.cle_songbook_admin_users to authenticated;

-- LIVE UPDATES: add these tables to Supabase Realtime publication when it exists.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.cle_songbook_songs;
    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.cle_songbook_playlists;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- FIRST ADMIN BOOTSTRAP:
-- 1) Create this person's account in Authentication > Users first.
-- 2) Uncomment the next line, replace the email, and run it once.
-- insert into public.cle_songbook_admin_users(email) values ('your-admin@example.com') on conflict (email) do nothing;

-- IMPORTANT: only active emails in cle_songbook_admin_users can manage songbook data.
-- Do not put service_role or secret keys in config.js.
