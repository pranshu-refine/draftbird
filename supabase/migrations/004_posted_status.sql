-- ════════════════════════════════════════════════════════════════
--  DraftBird · add 'posted' status value to tweets + articles
--  'posted' means an approved item has been published to X.
-- ════════════════════════════════════════════════════════════════

-- Drop the existing status check constraint on tweets (name may vary), then
-- recreate it including 'posted'.
do $$
declare
  cname text;
begin
  select conname into cname from pg_constraint
  where conrelid = 'public.tweets'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';
  if cname is not null then
    execute format('alter table public.tweets drop constraint %I', cname);
  end if;
end $$;

alter table public.tweets add constraint tweets_status_check
  check (status in ('pending', 'approved', 'rejected', 'posted'));

-- Same for articles.
do $$
declare
  cname text;
begin
  select conname into cname from pg_constraint
  where conrelid = 'public.articles'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';
  if cname is not null then
    execute format('alter table public.articles drop constraint %I', cname);
  end if;
end $$;

alter table public.articles add constraint articles_status_check
  check (status in ('pending', 'approved', 'rejected', 'draft', 'posted'));
