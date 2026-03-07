-- Operation: Buyuk Goc (MySQL -> Supabase PostgreSQL)
-- Date: 2026-03-07

create extension if not exists pgcrypto;

-- ========================
-- Core Quran Tables
-- ========================
create table if not exists public.surahs (
  id integer primary key,
  name text not null,
  name_en text,
  name_original text,
  slug text,
  verse_count integer not null,
  page_number integer default 0,
  audio_mp3 text,
  audio_duration integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.verses (
  id integer primary key,
  surah_id integer not null references public.surahs(id) on delete cascade,
  verse_number integer not null,
  verse_text text not null,
  verse_simplified text,
  verse_without_vowel text,
  transcription text,
  transcription_en text,
  audio_mp3 text,
  audio_duration integer default 0,
  page integer default 0,
  juz_number integer default 1,
  created_at timestamptz not null default now(),
  unique (surah_id, verse_number)
);

create index if not exists idx_verses_surah on public.verses (surah_id);
create index if not exists idx_verses_page on public.verses (page);
create index if not exists idx_verses_juz on public.verses (juz_number);

create table if not exists public.authors (
  id integer primary key,
  name text not null,
  description text,
  language varchar(8) default 'tr',
  created_at timestamptz not null default now()
);

create table if not exists public.translations (
  id integer primary key,
  verse_id integer not null references public.verses(id) on delete cascade,
  author_id integer not null references public.authors(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  unique (verse_id, author_id)
);

create index if not exists idx_translations_verse on public.translations (verse_id);
create index if not exists idx_translations_author on public.translations (author_id);
create index if not exists idx_translations_text_trgm on public.translations using gin (to_tsvector('simple', coalesce(text, '')));

create table if not exists public.footnotes (
  id integer primary key,
  translation_id integer not null references public.translations(id) on delete cascade,
  number integer default 1,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_footnotes_translation on public.footnotes (translation_id);

create table if not exists public.roots (
  id integer primary key,
  latin text,
  arabic text,
  transcription text,
  mean_tr text,
  mean_en text,
  created_at timestamptz not null default now()
);

create index if not exists idx_roots_latin on public.roots (latin);
create index if not exists idx_roots_arabic on public.roots (arabic);

create table if not exists public.verse_words (
  id integer primary key,
  verse_id integer not null references public.verses(id) on delete cascade,
  sort_number integer default 1,
  arabic text,
  transcription_tr text,
  transcription_en text,
  translation_tr text,
  translation_en text,
  root_id integer references public.roots(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_verse_words_verse on public.verse_words (verse_id);
create index if not exists idx_verse_words_root on public.verse_words (root_id);

-- ========================
-- User Domain (Supabase Auth linked)
-- ========================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  email text unique,
  profile_icon text default 'muessis',
  pro_expires_at timestamptz,
  bio text,
  hatim_count integer not null default 0,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_format check (username ~ '^[a-zA-Z0-9._-]{3,50}$')
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_bookmarks (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('surah', 'verse', 'last_read', 'string_bookmark')),
  surah_id integer,
  verse_number integer,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, item_id, item_type)
);

create index if not exists idx_user_bookmarks_user on public.user_bookmarks (user_id);

create table if not exists public.user_notes (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  verse_id integer not null references public.verses(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, verse_id)
);

create table if not exists public.user_playlists (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  items_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_playlists_user on public.user_playlists (user_id);

create table if not exists public.user_support_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  ads_enabled boolean not null default false,
  ads_watched integer not null default 0,
  usage_seconds bigint not null default 0,
  supporter_until timestamptz,
  milestone_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_support_ads on public.user_support_stats (ads_watched);
create index if not exists idx_user_support_usage on public.user_support_stats (usage_seconds);
create index if not exists idx_user_support_until on public.user_support_stats (supporter_until);

create table if not exists public.rewarded_ad_callbacks (
  id bigserial primary key,
  transaction_id varchar(128) not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  reward_item varchar(128) default 'quick_pro_hour',
  reward_amount integer not null default 1,
  callback_payload jsonb,
  key_id varchar(64),
  signature text,
  verified boolean not null default false,
  source varchar(32) not null default 'google_ssv',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_reward_user_created on public.rewarded_ad_callbacks (user_id, created_at);
create index if not exists idx_reward_verified on public.rewarded_ad_callbacks (verified);

create table if not exists public.user_daily_pro_ad_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  usage_date date not null,
  used_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.user_pro_access_grants (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  callback_id bigint references public.rewarded_ad_callbacks(id) on delete set null,
  transaction_id varchar(128),
  previous_expires_at timestamptz,
  new_expires_at timestamptz not null,
  duration_minutes integer not null default 60,
  source varchar(32) not null default 'rewarded_ad',
  granted_at timestamptz not null default now(),
  unique (transaction_id)
);

create index if not exists idx_pro_grants_user on public.user_pro_access_grants (user_id, granted_at);

-- ========================
-- Updated At Trigger
-- ========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_set_updated_at on public.user_settings;
create trigger trg_user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_notes_set_updated_at on public.user_notes;
create trigger trg_user_notes_set_updated_at
before update on public.user_notes
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_playlists_set_updated_at on public.user_playlists;
create trigger trg_user_playlists_set_updated_at
before update on public.user_playlists
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_support_stats_set_updated_at on public.user_support_stats;
create trigger trg_user_support_stats_set_updated_at
before update on public.user_support_stats
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_daily_pro_ad_usage_set_updated_at on public.user_daily_pro_ad_usage;
create trigger trg_user_daily_pro_ad_usage_set_updated_at
before update on public.user_daily_pro_ad_usage
for each row execute function public.set_updated_at();

-- ========================
-- Auth -> Public Users Trigger
-- ========================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_full_name text;
  v_profile_icon text;
begin
  v_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user_' || substr(new.id::text, 1, 8))));
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'fullName', '')), '');
  v_profile_icon := coalesce(nullif(trim(new.raw_user_meta_data ->> 'profile_icon'), ''), 'muessis');

  insert into public.users (id, username, full_name, email, profile_icon)
  values (new.id, v_username, v_full_name, new.email, v_profile_icon)
  on conflict (id) do update
    set username = excluded.username,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        email = excluded.email,
        profile_icon = coalesce(excluded.profile_icon, public.users.profile_icon),
        updated_at = now();

  insert into public.user_settings (user_id, settings_json)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  insert into public.user_support_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill existing auth users (safe idempotent)
insert into public.users (id, username, full_name, email, profile_icon)
select
  au.id,
  lower(trim(coalesce(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1), 'user_' || substr(au.id::text, 1, 8)))) as username,
  nullif(trim(coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'fullName', '')), '') as full_name,
  au.email,
  coalesce(nullif(trim(au.raw_user_meta_data ->> 'profile_icon'), ''), 'muessis') as profile_icon
from auth.users au
on conflict (id) do nothing;

insert into public.user_settings (user_id, settings_json)
select id, '{}'::jsonb from public.users
on conflict (user_id) do nothing;

insert into public.user_support_stats (user_id)
select id from public.users
on conflict (user_id) do nothing;

-- ========================
-- RLS
-- ========================
alter table public.surahs enable row level security;
alter table public.verses enable row level security;
alter table public.authors enable row level security;
alter table public.translations enable row level security;
alter table public.footnotes enable row level security;
alter table public.roots enable row level security;
alter table public.verse_words enable row level security;
alter table public.users enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_bookmarks enable row level security;
alter table public.user_notes enable row level security;
alter table public.user_playlists enable row level security;
alter table public.user_support_stats enable row level security;
alter table public.rewarded_ad_callbacks enable row level security;
alter table public.user_daily_pro_ad_usage enable row level security;
alter table public.user_pro_access_grants enable row level security;

-- Public read-only Quran data
-- Note: DROP+CREATE is used for broad PostgreSQL compatibility.
drop policy if exists surahs_public_select on public.surahs;
create policy surahs_public_select on public.surahs
for select using (true);

drop policy if exists verses_public_select on public.verses;
create policy verses_public_select on public.verses
for select using (true);

drop policy if exists authors_public_select on public.authors;
create policy authors_public_select on public.authors
for select using (true);

drop policy if exists translations_public_select on public.translations;
create policy translations_public_select on public.translations
for select using (true);

drop policy if exists footnotes_public_select on public.footnotes;
create policy footnotes_public_select on public.footnotes
for select using (true);

drop policy if exists roots_public_select on public.roots;
create policy roots_public_select on public.roots
for select using (true);

drop policy if exists verse_words_public_select on public.verse_words;
create policy verse_words_public_select on public.verse_words
for select using (true);

-- Users: own row only (read/write)
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists users_delete_own on public.users;
create policy users_delete_own on public.users
for delete using (auth.uid() = id);

-- Settings: own row only
drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
for select using (auth.uid() = user_id);

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
for insert with check (auth.uid() = user_id);

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_delete_own on public.user_settings
for delete using (auth.uid() = user_id);

-- Bookmarks: own rows only
drop policy if exists user_bookmarks_select_own on public.user_bookmarks;
create policy user_bookmarks_select_own on public.user_bookmarks
for select using (auth.uid() = user_id);

drop policy if exists user_bookmarks_insert_own on public.user_bookmarks;
create policy user_bookmarks_insert_own on public.user_bookmarks
for insert with check (auth.uid() = user_id);

drop policy if exists user_bookmarks_update_own on public.user_bookmarks;
create policy user_bookmarks_update_own on public.user_bookmarks
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_bookmarks_delete_own on public.user_bookmarks;
create policy user_bookmarks_delete_own on public.user_bookmarks
for delete using (auth.uid() = user_id);

-- Other user-scoped tables
drop policy if exists user_notes_all_own on public.user_notes;
create policy user_notes_all_own on public.user_notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_playlists_all_own on public.user_playlists;
create policy user_playlists_all_own on public.user_playlists
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_support_stats_all_own on public.user_support_stats;
create policy user_support_stats_all_own on public.user_support_stats
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists rewarded_callbacks_all_own on public.rewarded_ad_callbacks;
create policy rewarded_callbacks_all_own on public.rewarded_ad_callbacks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists daily_pro_usage_all_own on public.user_daily_pro_ad_usage;
create policy daily_pro_usage_all_own on public.user_daily_pro_ad_usage
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pro_grants_all_own on public.user_pro_access_grants;
create policy pro_grants_all_own on public.user_pro_access_grants
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ========================
-- Public Contributor RPC (safe fields only)
-- ========================
create or replace function public.get_supporter_contributors(p_limit integer default 160)
returns table (
  user_id uuid,
  full_name text,
  profile_icon text,
  is_supporter boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.full_name,
    u.profile_icon,
    coalesce(s.supporter_until > now(), false) as is_supporter
  from public.user_support_stats s
  join public.users u on u.id = s.user_id
  where s.ads_watched > 0
    and u.full_name is not null
    and btrim(u.full_name) <> ''
    and lower(btrim(u.full_name)) <> lower(btrim(coalesce(u.username, '')))
  order by s.updated_at desc, u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 160), 300));
$$;

revoke all on function public.get_supporter_contributors(integer) from public;
grant execute on function public.get_supporter_contributors(integer) to anon, authenticated;
