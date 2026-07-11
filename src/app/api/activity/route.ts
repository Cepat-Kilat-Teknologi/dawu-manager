import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** One item in the unified activity feed. */
export interface ActivityItem {
  id: string;
  ts: string;
  actor: string;
  nodeId: string | null;
  nodeName: string | null;
  action: string;
  detail: string | null;
}

/** Build a clamped integer from a query param string. */
function parseLimit(raw: string | null): number {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 500) : 100;
}

/** Parse an ISO-ish date string; returns undefined on invalid input. */
function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/**
 * GET /api/activity — unified, cross-node activity feed.
 *
 * Returns recent AuditLog entries (every proxy mutation + node CRUD is logged)
 * joined with the acting user and target node, newest first. Filterable by
 * node, user, action, date range, and capped by `limit`. Powers the live
 * activity timeline on /audit, which polls this endpoint on an interval.
 *
 * Query params:
 *   `nodeId`  — filter to one node
 *   `userId`  — filter to one user
 *   `action`  — filter to one action string
 *   `from`    — ISO date, inclusive lower bound on createdAt
 *   `to`      — ISO date, inclusive upper bound on createdAt
 *   `limit`   — default 100, max 500
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
  const limit = parseLimit(url.searchParams.get("limit"));

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

  const items: ActivityItem[] = logs.map((log) => ({
    id: log.id,
    ts: log.createdAt.toISOString(),
    actor: log.user?.name ?? "system",
    nodeId: log.nodeId,
    nodeName: log.node?.name ?? null,
    action: log.action,
    detail: log.detail,
  }));

  return NextResponse.json({ items });
}
