-- ════════════════════════════════════════════════════════════════
--  DraftBird · Supabase schema
--  Paste this entire file into your Supabase SQL Editor and run.
--  Re-running is safe (idempotent where possible).
-- ════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null,
  name text not null,
  email text,
  color text default '#1d9bf0',
  verified boolean default false,
  created_at timestamptz default now()
);

create index if not exists profiles_handle_idx on public.profiles (handle);

-- Auto-create a profile row whenever a new auth.user signs up.
-- Reads `handle` and `name` from the `options.data` you pass to signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  picked_color text;
  palette text[] := array[
    '#1d9bf0', '#f97316', '#8b5cf6', '#06b6d4',
    '#ec4899', '#10b981', '#eab308', '#ef4444', '#22d3ee'
  ];
begin
  picked_color := palette[1 + floor(random() * array_length(palette, 1))::int];

  insert into public.profiles (id, handle, name, email, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    picked_color
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Tweets ──────────────────────────────────────────────────────
create table if not exists public.tweets (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  status text default 'pending' not null
    check (status in ('pending', 'approved', 'rejected')),
  urgent boolean default false,
  is_thread boolean default false,
  thread_count integer,
  rejection_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tweets_status_idx     on public.tweets (status);
create index if not exists tweets_created_at_idx on public.tweets (created_at desc);
create index if not exists tweets_urgent_idx     on public.tweets (urgent) where urgent = true;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists tweets_set_updated_at on public.tweets;
create trigger tweets_set_updated_at
  before update on public.tweets
  for each row execute function public.set_updated_at();

-- ── Media (1..N per tweet) ──────────────────────────────────────
create table if not exists public.tweet_media (
  id uuid primary key default uuid_generate_v4(),
  tweet_id uuid references public.tweets(id) on delete cascade not null,
  url text not null,
  type text not null check (type in ('image', 'video')),
  position integer default 0
);

create index if not exists tweet_media_tweet_idx on public.tweet_media (tweet_id);

-- ── Comments / review notes ─────────────────────────────────────
create table if not exists public.tweet_comments (
  id uuid primary key default uuid_generate_v4(),
  tweet_id uuid references public.tweets(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists tweet_comments_tweet_idx on public.tweet_comments (tweet_id);

-- ── Bookmarks (private per user) ────────────────────────────────
create table if not exists public.bookmarks (
  user_id uuid references public.profiles(id) on delete cascade not null,
  tweet_id uuid references public.tweets(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, tweet_id)
);

-- ════════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════════

alter table public.profiles       enable row level security;
alter table public.tweets         enable row level security;
alter table public.tweet_media    enable row level security;
alter table public.tweet_comments enable row level security;
alter table public.bookmarks      enable row level security;

-- Profiles: public read, owner can update
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Tweets: public read; signed-in users can post + approve/reject anyone's;
-- author can delete their own.
drop policy if exists "tweets_select" on public.tweets;
create policy "tweets_select" on public.tweets for select using (true);

drop policy if exists "tweets_insert_own" on public.tweets;
create policy "tweets_insert_own" on public.tweets for insert
  with check (auth.uid() = author_id);

drop policy if exists "tweets_update_any_authed" on public.tweets;
create policy "tweets_update_any_authed" on public.tweets for update
  using (auth.role() = 'authenticated');

drop policy if exists "tweets_delete_own" on public.tweets;
create policy "tweets_delete_own" on public.tweets for delete
  using (auth.uid() = author_id);

-- Media: public read; signed-in can insert (paired with their own tweet)
drop policy if exists "media_select" on public.tweet_media;
create policy "media_select" on public.tweet_media for select using (true);

drop policy if exists "media_insert_own_tweet" on public.tweet_media;
create policy "media_insert_own_tweet" on public.tweet_media for insert
  with check (exists (
    select 1 from public.tweets t
    where t.id = tweet_id and t.author_id = auth.uid()
  ));

drop policy if exists "media_delete_own_tweet" on public.tweet_media;
create policy "media_delete_own_tweet" on public.tweet_media for delete
  using (exists (
    select 1 from public.tweets t
    where t.id = tweet_id and t.author_id = auth.uid()
  ));

-- Comments: public read; signed-in can write; author owns their own.
drop policy if exists "comments_select" on public.tweet_comments;
create policy "comments_select" on public.tweet_comments for select using (true);

drop policy if exists "comments_insert_own" on public.tweet_comments;
create policy "comments_insert_own" on public.tweet_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "comments_update_own" on public.tweet_comments;
create policy "comments_update_own" on public.tweet_comments for update
  using (auth.uid() = author_id);

drop policy if exists "comments_delete_own" on public.tweet_comments;
create policy "comments_delete_own" on public.tweet_comments for delete
  using (auth.uid() = author_id);

-- Bookmarks: private to each user.
drop policy if exists "bookmarks_select_own" on public.bookmarks;
create policy "bookmarks_select_own" on public.bookmarks for select
  using (auth.uid() = user_id);

drop policy if exists "bookmarks_insert_own" on public.bookmarks;
create policy "bookmarks_insert_own" on public.bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "bookmarks_delete_own" on public.bookmarks;
create policy "bookmarks_delete_own" on public.bookmarks for delete
  using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════
--  Storage bucket for media (images + videos)
-- ════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
  values ('tweet-media', 'tweet-media', true)
  on conflict (id) do nothing;

drop policy if exists "media_bucket_read" on storage.objects;
create policy "media_bucket_read" on storage.objects for select
  using (bucket_id = 'tweet-media');

drop policy if exists "media_bucket_upload" on storage.objects;
create policy "media_bucket_upload" on storage.objects for insert
  with check (bucket_id = 'tweet-media' and auth.role() = 'authenticated');

drop policy if exists "media_bucket_delete_own" on storage.objects;
create policy "media_bucket_delete_own" on storage.objects for delete
  using (bucket_id = 'tweet-media' and auth.uid()::text = (storage.foldername(name))[1]);

-- ════════════════════════════════════════════════════════════════
--  Realtime — broadcast changes so all open clients see updates
-- ════════════════════════════════════════════════════════════════

-- Add tables to the realtime publication (safe to run multiple times)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tweets'
  ) then
    alter publication supabase_realtime add table public.tweets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tweet_comments'
  ) then
    alter publication supabase_realtime add table public.tweet_comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tweet_media'
  ) then
    alter publication supabase_realtime add table public.tweet_media;
  end if;
end $$;
