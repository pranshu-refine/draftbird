-- ════════════════════════════════════════════════════════════════
--  DraftBird · article_comments
--  Mirrors tweet_comments: review notes attached to an article.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.article_comments (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references public.articles(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists article_comments_article_idx on public.article_comments (article_id);

alter table public.article_comments enable row level security;

drop policy if exists "article_comments_select" on public.article_comments;
create policy "article_comments_select" on public.article_comments for select using (true);

drop policy if exists "article_comments_insert_own" on public.article_comments;
create policy "article_comments_insert_own" on public.article_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "article_comments_update_own" on public.article_comments;
create policy "article_comments_update_own" on public.article_comments for update
  using (auth.uid() = author_id);

drop policy if exists "article_comments_delete_own" on public.article_comments;
create policy "article_comments_delete_own" on public.article_comments for delete
  using (auth.uid() = author_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'article_comments'
  ) then
    alter publication supabase_realtime add table public.article_comments;
  end if;
end $$;
