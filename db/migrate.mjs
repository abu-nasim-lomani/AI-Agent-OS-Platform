// সরল migration runner (S0-03) — sequential .sql ফাইল, applied তালিকা schema_migrations-এ
// TODO(S0-03): production-এ checksum verify + advisory lock যোগ করা
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgresql://agentos:agentos_dev@localhost:5432/agentos",
});

await client.connect();
await client.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
);

const applied = new Set(
  (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
);

for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  const sql = await readFile(join(dir, file), "utf8");
  console.log(`applying ${file} ...`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`FAILED ${file}:`, e.message);
    process.exit(1);
  }
}
console.log("migrations up to date");
await client.end();
