import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Parse an ISO-ish date string; returns undefined on invalid input. */
function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/**
 * Escape a single CSV field for safe spreadsheet consumption.
 *
 * 1. Formula-injection guard: if the first character is one of = + - @ \t \r,
 *    prefix with a single-quote so Excel/Sheets/LibreOffice treats the cell as
 *    literal text instead of evaluating it as a formula.
 * 2. RFC 4180: fields containing commas, double-quotes, or newlines are wrapped
 *    in quotes; internal double-quotes are doubled.
 */
export function escapeCSV(value: string): string {
  let safe = value;
  if (safe.length > 0 && /^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * GET /api/activity/export — download the audit log as CSV.
 *
 * Admin-only. Accepts the same filter query params as GET /api/activity:
 *   nodeId, userId, action, from, to, limit (default 1000, max 10000).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "viewer";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const nodeId = url.searchParams.get("nodeId") || undefined;
  const userId = url.searchParams.get("userId") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const rawLimit = url.searchParams.get("limit")
    ? Number(url.searchParams.get("limit"))
    : NaN;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 10_000)
    : 1000;

  const where: Record<string, unknown> = {};
  if (nodeId) where.nodeId = nodeId;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    where.createdAt = createdAt;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true } },
      node: { select: { name: true } },
    },
  });

  const header = ["Timestamp", "User", "Node", "Action", "Detail"];
  const rows = logs.map((log) => [
    escapeCSV(log.createdAt.toISOString()),
    escapeCSV(log.user?.name ?? "system"),
    escapeCSV(log.node?.name ?? ""),
    escapeCSV(log.action),
    escapeCSV(log.detail ?? ""),
  ]);

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${today}.csv"`,
    },
  });
}
