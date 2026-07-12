#!/usr/bin/env node

/**
 * dawu-manager CLI entry point.
 * Usage: npx dawu-manager [--port 3789]
 *
 * Supports two modes:
 * 1. Pre-built (npm package) — uses .next/standalone/server.js directly
 * 2. From source (dev/clone) — uses node_modules/.bin/next start
 *
 * Runs database migrations then starts the Next.js production server.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Parse args
const args = process.argv.slice(2);
let port = 3789;
const portIdx = args.indexOf("--port");
if (portIdx !== -1 && args[portIdx + 1]) {
  port = parseInt(args[portIdx + 1], 10) || 3789;
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  dawu-manager — BNG fleet management dashboard

  Usage:
    npx dawu-manager [options]

  Options:
    --port <number>   Server port (default: 3789)
    --help, -h        Show this help message
    --version, -v     Show version

  Environment:
    NEXTAUTH_SECRET   JWT signing secret (auto-generated if not set)
    NEXTAUTH_URL      Canonical URL (default: http://localhost:<port>)
    DATABASE_URL      SQLite path (default: file:~/.dawu-manager/data.db)

  Examples:
    npx dawu-manager
    npx dawu-manager --port 4000
    NEXTAUTH_SECRET="my-secret" npx dawu-manager
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = JSON.parse(
    readFileSync(resolve(projectRoot, "package.json"), "utf8"),
  );
  console.log(`dawu-manager v${pkg.version}`);
  process.exit(0);
}

// Data directory
const dataDir = resolve(homedir(), ".dawu-manager");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
const dbPath = resolve(dataDir, "data.db");

// Set environment
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${dbPath}`;
process.env.PORT = String(port);
process.env.HOSTNAME = "0.0.0.0";

if (!process.env.NEXTAUTH_SECRET) {
  const crypto = await import("node:crypto");
  process.env.NEXTAUTH_SECRET = crypto.randomBytes(32).toString("base64");
  console.log(
    "⚠  NEXTAUTH_SECRET not set — using auto-generated secret (sessions will not persist across restarts)",
  );
}

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = `http://localhost:${port}`;
}

// ---------------------------------------------------------------------------
// Database migration
// ---------------------------------------------------------------------------
const actualDbPath = process.env.DATABASE_URL.replace("file:", "");
console.log(`📦 Database: ${actualDbPath}`);

let migrated = false;

// Strategy 1: Lightweight migration using Node.js 22+ built-in node:sqlite
try {
  const { DatabaseSync } = await import("node:sqlite");
  if (DatabaseSync) {
    const migrationsDir = resolve(projectRoot, "prisma", "migrations");
    if (existsSync(migrationsDir)) {
      const db = new DatabaseSync(actualDbPath);
      db.exec("PRAGMA journal_mode=WAL");
      db.exec("PRAGMA foreign_keys=ON");

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

      const applied = new Set(
        db
          .prepare('SELECT "migration_name" FROM "_prisma_migrations"')
          .all()
          .map((r) => r.migration_name),
      );

      const dirs = readdirSync(migrationsDir)
        .filter((d) => existsSync(join(migrationsDir, d, "migration.sql")))
        .sort();

      let count = 0;
      for (const dir of dirs) {
        if (applied.has(dir)) continue;
        const sql = readFileSync(
          join(migrationsDir, dir, "migration.sql"),
          "utf8",
        );
        console.log(`  Applying: ${dir}`);
        db.exec(sql);
        const id = (await import("node:crypto")).randomUUID();
        db.prepare(
          `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
           VALUES (?, ?, ?, datetime('now'), 1)`,
        ).run(id, "cli-migrate", dir);
        count++;
      }

      db.close();
      console.log(
        count > 0
          ? `  ✓ ${count} migration(s) applied.`
          : "  ✓ Database is up to date.",
      );
      migrated = true;
    }
  }
} catch {
  // node:sqlite not available (Node < 22) — fall through to Strategy 2
}

// Strategy 2: Fall back to Prisma CLI
if (!migrated) {
  try {
    execSync("npx prisma migrate deploy", {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch {
    console.error("⚠  Migration failed — database may need manual setup.");
  }
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const standaloneServer = resolve(
  projectRoot,
  ".next",
  "standalone",
  "server.js",
);

console.log(`\n🚀 Starting dawu-manager on http://localhost:${port}\n`);

let server;

if (existsSync(standaloneServer)) {
  // Pre-built mode (npm package / production build)
  // Copy public/ and .next/static/ are expected alongside standalone
  server = spawn("node", [standaloneServer], {
    cwd: resolve(projectRoot, ".next", "standalone"),
    stdio: "inherit",
    env: { ...process.env },
  });
} else {
  // From-source mode (development / git clone)
  const nextBin = resolve(projectRoot, "node_modules", ".bin", "next");
  if (!existsSync(nextBin)) {
    console.error(
      "❌ Neither standalone build nor node_modules found.\n" +
        '   Run "pnpm build" first or install via "npx dawu-manager".',
    );
    process.exit(1);
  }
  server = spawn(nextBin, ["start", "-p", String(port)], {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
}

server.on("exit", (code) => {
  process.exit(code ?? 0);
});

// Forward termination signals
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.kill(sig);
  });
}
