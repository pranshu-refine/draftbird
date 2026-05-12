create table if not exists public.articles (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  subtitle text,
  cover_image_url text,
  content text not null default '',
  status text default 'pending' not null
    check (status in ('pending', 'approved', 'rejected', 'draft')),
  urgent boolean default false,
  rejection_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists articles_status_idx on public.articles (status);
create index if not exists articles_created_at_idx on public.articles (created_at desc);

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

alter table public.articles enable row level security;

drop policy if exists "articles_select" on public.articles;
create policy "articles_select" on public.articles for select using (true);

drop policy if exists "articles_insert_own" on public.articles;
create policy "articles_insert_own" on public.articles for insert
  with check (auth.uid() = author_id);

drop policy if exists "articles_update_any_authed" on public.articles;
create policy "articles_update_any_authed" on public.articles for update
  using (auth.role() = 'authenticated');

drop policy if exists "articles_delete_own" on public.articles;
create policy "articles_delete_own" on public.articles for delete
  using (auth.uid() = author_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'articles'
  ) then
    alter publication supabase_realtime add table public.articles;
  end if;
end $$;
