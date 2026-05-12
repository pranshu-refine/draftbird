// scripts/check-avatar-setup.mjs
// Diagnostic: verify avatar upload prerequisites are present in the DB.
//   - profiles.avatar_url column
//   - storage.buckets row for 'avatars'
//   - storage.objects RLS policies scoped to 'avatars'

import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('ERROR: SUPABASE_DB_URL is not set.');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log('Connected.\n');

  // 1. profiles.avatar_url column
  const colRes = await client.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url'`
  );
  if (colRes.rows.length === 0) {
    console.log('[1] profiles.avatar_url  ✗  MISSING');
  } else {
    const r = colRes.rows[0];
    console.log(`[1] profiles.avatar_url  ✓  ${r.data_type} (nullable=${r.is_nullable})`);
  }

  // 2. avatars storage bucket
  const bucketRes = await client.query(
    `select id, name, public, created_at from storage.buckets where id = 'avatars'`
  );
  if (bucketRes.rows.length === 0) {
    console.log('[2] storage.buckets[avatars]  ✗  MISSING');
  } else {
    const b = bucketRes.rows[0];
    console.log(`[2] storage.buckets[avatars]  ✓  public=${b.public} created=${b.created_at.toISOString()}`);
  }

  // 3. RLS policies on storage.objects that mention 'avatars' in their definition
  const polRes = await client.query(
    `select policyname, cmd, qual, with_check
       from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and (qual ilike '%avatars%' or with_check ilike '%avatars%' or policyname ilike '%avatar%')
      order by policyname`
  );
  if (polRes.rows.length === 0) {
    console.log('[3] storage.objects RLS for avatars  ✗  NO MATCHING POLICIES');
  } else {
    console.log(`[3] storage.objects RLS for avatars  ✓  ${polRes.rows.length} policy/policies:`);
    for (const p of polRes.rows) {
      console.log(`     - ${p.policyname} [${p.cmd}]`);
      if (p.qual)       console.log(`         USING:      ${p.qual}`);
      if (p.with_check) console.log(`         WITH CHECK: ${p.with_check}`);
    }
  }

  // 4. Check that RLS is enabled on storage.objects (it is by default on Supabase but worth confirming)
  const rlsRes = await client.query(
    `select relrowsecurity from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'storage' and c.relname = 'objects'`
  );
  if (rlsRes.rows.length) {
    console.log(`[4] storage.objects rowsecurity = ${rlsRes.rows[0].relrowsecurity}`);
  }
}

main()
  .catch((err) => {
    console.error('\nDiagnostic failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));
