#!/usr/bin/env node

/**
 * dawu-manager CLI entry point.
 * Usage: npx dawu-manager [--port 3789]
 *
 * Runs Prisma migrations then starts the Next.js production server.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

// Data directory
const dataDir = resolve(homedir(), ".dawu-manager");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
const dbPath = resolve(dataDir, "data.db");

// Set environment
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORT = String(port);

if (!process.env.NEXTAUTH_SECRET) {
  // Generate a default secret for development use
  const crypto = await import("node:crypto");
  process.env.NEXTAUTH_SECRET = crypto.randomBytes(32).toString("base64");
  console.log(
    "⚠  NEXTAUTH_SECRET not set — using auto-generated secret (sessions will not persist across restarts)",
  );
}

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = `http://localhost:${port}`;
}

// Run Prisma migrations
console.log(`📦 Database: ${dbPath}`);
try {
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
} catch {
  console.error("⚠  Migration failed — database may need manual setup.");
}

// Start Next.js production server
console.log(`\n🚀 Starting dawu-manager on http://localhost:${port}\n`);

const server = spawn("node_modules/.bin/next", ["start", "-p", String(port)], {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env },
});

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
