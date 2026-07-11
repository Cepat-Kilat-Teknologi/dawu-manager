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

/**
 * GET /api/activity — unified, cross-node activity feed.
 *
 * Returns recent AuditLog entries (every proxy mutation + node CRUD is logged)
 * joined with the acting user and target node, newest first. Filterable by
 * node and capped by `limit`. Powers the live activity timeline on /audit,
 * which polls this endpoint on an interval.
 *
 * Query params: `nodeId` (filter to one node), `limit` (default 100, max 500).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const nodeId = url.searchParams.get("nodeId") || undefined;
  const limitParam = url.searchParams.get("limit");
  // Number(null) is 0 (finite), so guard the missing/empty case explicitly.
  const rawLimit = limitParam ? Number(limitParam) : NaN;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500)
    : 100;

  const logs = await prisma.auditLog.findMany({
    where: nodeId ? { nodeId } : {},
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
