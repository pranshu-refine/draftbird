import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const SCHEMA_PATH = resolve(projectRoot, 'supabase', 'schema.sql');
const SEED_PATH = resolve(projectRoot, 'supabase', 'seed.sql');

// Optional single-file mode: `node scripts/setup-db.mjs path/to/file.sql`
const singleFileArg = process.argv[2];

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('ERROR: SUPABASE_DB_URL is not set.');
  console.error('Set it to your Supabase Postgres connection string.');
  console.error('Find it in Supabase: Project Settings → Database → Connection string (URI).');
  console.error('Example (PowerShell): $env:SUPABASE_DB_URL = "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"');
  process.exit(1);
}

async function runSqlFile(client, label, path) {
  const rel = relative(projectRoot, path);
  console.log(`\n→ Reading ${label} (${rel})`);
  let sql;
  try {
    sql = await readFile(path, 'utf8');
  } catch (err) {
    console.error(`  ✗ Could not read ${rel}: ${err.message}`);
    throw err;
  }
  if (!sql.trim()) {
    console.warn(`  ⚠ ${rel} is empty — skipping`);
    return;
  }
  console.log(`→ Executing ${label} (${sql.length} chars)`);
  try {
    await client.query(sql);
    console.log(`  ✓ ${label} applied`);
  } catch (err) {
    console.error(`  ✗ ${label} failed: ${err.message}`);
    if (err.position) console.error(`    position: ${err.position}`);
    if (err.detail) console.error(`    detail:   ${err.detail}`);
    if (err.hint) console.error(`    hint:     ${err.hint}`);
    if (err.where) console.error(`    where:    ${err.where}`);
    throw err;
  }
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

let failed = false;
try {
  console.log('Connecting to Supabase database…');
  await client.connect();
  console.log('  ✓ Connected');

  if (singleFileArg) {
    const path = resolve(projectRoot, singleFileArg);
    await runSqlFile(client, singleFileArg, path);
    console.log('\n✅ Migration applied.');
  } else {
    await runSqlFile(client, 'schema.sql', SCHEMA_PATH);
    await runSqlFile(client, 'seed.sql', SEED_PATH);
    console.log('\n✅ Database setup complete.');
  }
} catch (err) {
  failed = true;
  console.error('\n❌ Database setup failed.');
  if (err) {
    console.error(`   ${err.message}`);
    if (err.code) console.error(`   code: ${err.code}`);
    if (err.address) console.error(`   address: ${err.address}`);
    if (err.port) console.error(`   port: ${err.port}`);
  }
} finally {
  try {
    await client.end();
  } catch {
    // ignore
  }
}

process.exit(failed ? 1 : 0);
