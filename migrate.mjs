/**
 * Lightweight migration runner using Node.js 22 built-in node:sqlite.
 * Applies Prisma migrations without requiring the full prisma CLI.
 * Compatible with Prisma's _prisma_migrations tracking table.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = (process.env.DATABASE_URL || "file:/data/dawu.db").replace(
  "file:",
  "",
);
const MIGRATIONS_DIR = join(import.meta.dirname, "prisma", "migrations");

console.log(`  Database: ${DB_PATH}`);

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA foreign_keys=ON");

// Create Prisma migration tracking table (compatible with prisma migrate deploy)
db.exec(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
  )
`);

// Find and apply pending migrations
const applied = new Set(
  db
    .prepare('SELECT "migration_name" FROM "_prisma_migrations"')
    .all()
    .map((r) => r.migration_name),
);

const dirs = readdirSync(MIGRATIONS_DIR).filter((d) => {
  const sqlPath = join(MIGRATIONS_DIR, d, "migration.sql");
  return existsSync(sqlPath);
});
dirs.sort();

let count = 0;
for (const dir of dirs) {
  if (applied.has(dir)) continue;
  const sql = readFileSync(join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
  console.log(`  Applying: ${dir}`);
  db.exec(sql);
  db.prepare(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
     VALUES (?, ?, ?, datetime('now'), 1)`,
  ).run(crypto.randomUUID(), "docker-migrate", dir);
  count++;
}

db.close();
console.log(
  count > 0
    ? `  ${count} migration(s) applied.`
    : "  Database is up to date.",
);
