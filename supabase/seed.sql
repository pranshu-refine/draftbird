-- ════════════════════════════════════════════════════════════════
--  Demo seed
--
--  Creates one test account so you can sign in immediately
--  without going through the full sign-up flow.
--
--  After running this in the Supabase SQL Editor, sign in with:
--    ID:       pranshu          (or pranshu@draftbird.app)
--    Password: 12345
--
--  Run schema.sql FIRST, then this file.
--  Safe to re-run — checks for existing user.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

do $$
declare
  uid uuid := gen_random_uuid();
begin
  -- Skip if already seeded
  if exists (select 1 from auth.users where email = 'pranshu@draftbird.app') then
    raise notice 'Demo user pranshu already exists — nothing to do.';
    return;
  end if;

  -- Insert directly into auth.users.
  -- This is the same row Supabase would create via signUp(), with a
  -- bcrypt-hashed password. Sign-in via signInWithPassword() will
  -- verify against this hash and succeed.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated',
    'authenticated',
    'pranshu@draftbird.app',
    crypt('12345', gen_salt('bf')),
    now(),                                            -- email pre-confirmed
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Pranshu","handle":"pranshu"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  );

  -- The on_auth_user_created trigger from schema.sql will normally
  -- create the matching profiles row. Belt-and-suspenders: if for
  -- any reason it didn't, create it explicitly.
  insert into public.profiles (id, handle, name, email, color, verified)
  values (uid, 'pranshu', 'Pranshu', 'pranshu@draftbird.app', '#1d9bf0', false)
  on conflict (id) do update
    set handle = excluded.handle,
        name = excluded.name,
        email = excluded.email;

  raise notice 'Demo user created. Sign in with @pranshu / 12345.';
end $$;

-- ─── Verify ────────────────────────────────────────────────────
select
  u.email                     as auth_email,
  p.handle                    as profile_handle,
  p.name                      as profile_name,
  case when u.encrypted_password is not null then 'set' else 'missing' end as password,
  u.email_confirmed_at is not null as email_confirmed
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'pranshu@draftbird.app';
