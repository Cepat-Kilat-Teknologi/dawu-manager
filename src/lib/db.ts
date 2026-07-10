import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Create a new PrismaClient instance using the libSQL driver adapter.
 * Reads DATABASE_URL from environment, defaulting to a local SQLite file.
 * Logs warnings and errors in development; only errors in production.
 * @returns Configured PrismaClient instance
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  const adapter = new PrismaLibSql({ url });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton PrismaClient instance.
 * Reuses the same client across hot-reloads in development by caching it on `globalThis`.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
