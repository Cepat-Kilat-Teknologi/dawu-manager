import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dawosRequest } from "@/lib/dawos-client";

/** Per-node metrics shape from system/metrics. */
interface NodeMetrics {
  cpu?: { percent?: number };
  memory?: { percent?: number };
  disk?: { percent?: number };
}

/** Per-node session stats shape from sessions/stats. */
interface SessionStats {
  active?: number | string;
}

/** Per-node result after fan-out. */
interface NodeResult {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "unknown";
  sessions: number;
  cpu: number;
  memory: number;
  disk: number;
}

/** Aggregated fleet overview response. */
export interface FleetOverviewResponse {
  nodes: {
    total: number;
    online: number;
    offline: number;
    degraded: number;
    unknown: number;
  };
  sessions: { total: number };
  topNodes: NodeResult[];
}

/** Bounded timeout for per-node fan-out (10 seconds). */
const NODE_TIMEOUT = 10_000;

/** Maximum nodes to include in the top-N ranked list. */
const TOP_N = 5;

/**
 * GET /api/fleet/overview — Aggregate live stats across all registered nodes.
 *
 * Fans out concurrently to each node's system/metrics and sessions/stats,
 * aggregates totals, and returns a fleet-wide overview. Unreachable nodes
 * are counted as "offline" — one slow node never blocks the response.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbNodes = await prisma.node.findMany({
    select: { id: true, name: true, url: true, apiKey: true, status: true },
    orderBy: { name: "asc" },
  });

  if (dbNodes.length === 0) {
    const empty: FleetOverviewResponse = {
      nodes: { total: 0, online: 0, offline: 0, degraded: 0, unknown: 0 },
      sessions: { total: 0 },
      topNodes: [],
    };
    return NextResponse.json(empty);
  }

  // Fan out concurrently — each node has its own try/catch + timeout.
  // Status comes from the DB (set by health checks), NOT from the fan-out.
  // The fan-out is only for fetching live metrics (cpu, memory, sessions).
  const results: NodeResult[] = await Promise.all(
    dbNodes.map(async (node) => {
      const dbStatus = (node.status || "unknown") as NodeResult["status"];
      try {
        const [metricsRes, statsRes] = await Promise.all([
          dawosRequest<NodeMetrics>(node.url, node.apiKey, "system/metrics", {
            timeout: NODE_TIMEOUT,
          }),
          dawosRequest<SessionStats>(node.url, node.apiKey, "sessions/stats", {
            timeout: NODE_TIMEOUT,
          }),
        ]);

        const cpu = metricsRes.ok
          ? (metricsRes.data.cpu?.percent ?? 0)
          : 0;
        const memory = metricsRes.ok
          ? (metricsRes.data.memory?.percent ?? 0)
          : 0;
        const disk = metricsRes.ok
          ? (metricsRes.data.disk?.percent ?? 0)
          : 0;
        const sessions = statsRes.ok
          ? (Number(statsRes.data.active) || 0)
          : 0;

        return {
          id: node.id,
          name: node.name,
          status: dbStatus,
          sessions,
          cpu,
          memory,
          disk,
        } satisfies NodeResult;
      } catch {
        // Node completely unreachable — use DB status (last known).
        return {
          id: node.id,
          name: node.name,
          status: dbStatus,
          sessions: 0,
          cpu: 0,
          memory: 0,
          disk: 0,
        } satisfies NodeResult;
      }
    }),
  );

  // Aggregate counts from DB-sourced status values.
  const counts = { total: results.length, online: 0, offline: 0, degraded: 0, unknown: 0 };
  let totalSessions = 0;
  for (const r of results) {
    if (r.status === "online") counts.online++;
    else if (r.status === "offline") counts.offline++;
    else if (r.status === "degraded") counts.degraded++;
    else counts.unknown++;
    totalSessions += r.sessions;
  }

  // Top N nodes by session count (descending), then by name (ascending).
  const topNodes = [...results]
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, TOP_N);

  const overview: FleetOverviewResponse = {
    nodes: counts,
    sessions: { total: totalSessions },
    topNodes,
  };

  return NextResponse.json(overview);
}
