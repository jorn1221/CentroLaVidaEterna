-- UECF Worship Songbook — Supabase schema
-- Run in Supabase SQL Editor on a NEW project, or review carefully before applying to an existing project.
-- Do NOT put the Supabase service_role key in index.html.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'member' check (role in ('super_admin','admin','editor','member')),
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default 'Unknown',
  key_signature text not null default 'N/A',
  tempo text not null default 'N/A',
  category text not null default 'N/A',
  language text not null default 'Tagalog',
  lyrics_chordpro text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  primary key (playlist_id, song_id)
);

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

-- Security-definer helper avoids recursive profiles RLS checks.
create or replace function public.my_role()
returns text language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_approved_editor()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (
  select 1 from public.profiles
  where id = auth.uid() and is_approved = true and role in ('super_admin','admin','editor')
) $$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (
  select 1 from public.profiles
  where id = auth.uid() and is_approved = true and role = 'super_admin'
) $$;

-- Profile access: users can read their own profile; super admin can list profiles.
drop policy if exists "profiles read own or super admin" on public.profiles;
create policy "profiles read own or super admin" on public.profiles for select
using (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles insert own pending member" on public.profiles;
create policy "profiles insert own pending member" on public.profiles for insert
with check (id = auth.uid() and role = 'member' and is_approved = false);

drop policy if exists "super admin updates profiles" on public.profiles;
create policy "super admin updates profiles" on public.profiles for update
using (public.is_super_admin())
with check (public.is_super_admin());

-- Public can read songs; only approved editors/admins can change them.
drop policy if exists "public read songs" on public.songs;
create policy "public read songs" on public.songs for select using (true);

drop policy if exists "approved editors insert songs" on public.songs;
create policy "approved editors insert songs" on public.songs for insert
with check (public.is_approved_editor());

drop policy if exists "approved editors update songs" on public.songs;
create policy "approved editors update songs" on public.songs for update
using (public.is_approved_editor()) with check (public.is_approved_editor());

drop policy if exists "approved editors delete songs" on public.songs;
create policy "approved editors delete songs" on public.songs for delete
using (public.is_approved_editor());

-- Anyone can see public playlists; approved editors can manage them.
drop policy if exists "read public playlists" on public.playlists;
create policy "read public playlists" on public.playlists for select
using (is_public = true or public.is_approved_editor());

drop policy if exists "approved editors manage playlists" on public.playlists;
create policy "approved editors manage playlists" on public.playlists for all
using (public.is_approved_editor()) with check (public.is_approved_editor());

drop policy if exists "read playlist song links" on public.playlist_songs;
create policy "read playlist song links" on public.playlist_songs for select
using (exists (select 1 from public.playlists p where p.id=playlist_id and (p.is_public=true or public.is_approved_editor())));

drop policy if exists "approved editors manage playlist song links" on public.playlist_songs;
create policy "approved editors manage playlist song links" on public.playlist_songs for all
using (public.is_approved_editor()) with check (public.is_approved_editor());

-- Automatically create a pending member profile after signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_approved)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'member', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- IMPORTANT FIRST SUPER ADMIN SETUP:
-- Sign up using the intended Super Admin email, then securely run a one-time update
-- in SQL Editor using that user's auth.users UUID. Do not expose service_role keys.
-- UPDATE public.profiles SET role='super_admin', is_approved=true WHERE id='YOUR_AUTH_USER_UUID';
-- Afterwards, remove/comment this bootstrap instruction from any public-facing documentation.
