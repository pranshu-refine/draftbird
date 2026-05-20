-- ════════════════════════════════════════════════════════════════
--  DraftBird · allow any signed-in user to delete any post
--  Replaces the author-only delete policies on tweets + articles.
-- ════════════════════════════════════════════════════════════════

-- Tweets: allow any authenticated user to delete.
drop policy if exists "tweets_delete_own" on public.tweets;
drop policy if exists "tweets_delete_any_authed" on public.tweets;
create policy "tweets_delete_any_authed" on public.tweets
  for delete using (auth.role() = 'authenticated');

-- Articles: same.
drop policy if exists "articles_delete_own" on public.articles;
drop policy if exists "articles_delete_any_authed" on public.articles;
create policy "articles_delete_any_authed" on public.articles
  for delete using (auth.role() = 'authenticated');
