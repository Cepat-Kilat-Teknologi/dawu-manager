import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { dawosRequest, checkNodeHealth } from "@/lib/dawos-client";

/** Per-node result returned to the client. */
export interface FleetOpResult {
  nodeId: string;
  nodeName: string;
  ok: boolean;
  status: number;
  message: string;
}

/** Bounded timeout for per-node fan-out (15 seconds). */
const NODE_TIMEOUT = 15_000;

/** Zod v4 schema for the fleet operation request body. */
const fleetOpSchema = z.object({
  nodeIds: z.array(z.string()).min(1, "Select at least one node"),
  op: z.enum(["health", "restart", "bulk-terminate"]),
  params: z
    .object({
      usernames: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * POST /api/fleet/operations — Run a fleet operation across selected nodes.
 *
 * Fans out concurrently to each selected node. Each node has its own
 * try/catch + timeout — one slow/failing node never blocks or aborts
 * the others. Returns a per-node result array.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorized = await hasRole("operator");
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = fleetOpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { nodeIds, op, params } = parsed.data;

  // Validate bulk-terminate requires usernames
  if (op === "bulk-terminate") {
    const usernames = params?.usernames;
    if (!usernames || usernames.length === 0) {
      return NextResponse.json(
        { error: "usernames required for bulk-terminate" },
        { status: 422 },
      );
    }
  }

  // Fetch selected nodes from DB
  const nodes = await prisma.node.findMany({
    where: { id: { in: nodeIds } },
    select: { id: true, name: true, url: true, apiKey: true },
  });

  if (nodes.length === 0) {
    return NextResponse.json(
      { error: "No matching nodes found" },
      { status: 404 },
    );
  }

  // Fan out concurrently — each node has its own try/catch.
  const results: FleetOpResult[] = await Promise.all(
    nodes.map(async (node) => {
      try {
        return await executeOp(node, op, params);
      } catch {
        return {
          nodeId: node.id,
          nodeName: node.name,
          ok: false,
          status: 502,
          message: "Node unreachable",
        };
      }
    }),
  );

  return NextResponse.json({ results });
}

/** Execute a single operation against one node. */
async function executeOp(
  node: { id: string; name: string; url: string; apiKey: string },
  op: "health" | "restart" | "bulk-terminate",
  params?: { usernames?: string[] },
): Promise<FleetOpResult> {
  if (op === "health") {
    return executeHealth(node);
  }
  if (op === "restart") {
    return executeRestart(node);
  }
  // Validation guarantees usernames exists for bulk-terminate
  return executeBulkTerminate(node, params!.usernames!);
}

/** Refresh health — read-only, uses public /health endpoint + DB update. */
async function executeHealth(
  node: { id: string; name: string; url: string },
): Promise<FleetOpResult> {
  const health = await checkNodeHealth(node.url);
  const newStatus = health.ok ? "online" : "offline";

  await prisma.node.update({
    where: { id: node.id },
    data: {
      status: newStatus,
      lastSeen: health.ok ? new Date() : undefined,
    },
  });

  return {
    nodeId: node.id,
    nodeName: node.name,
    ok: health.ok,
    status: health.status,
    message: health.ok ? "Healthy" : "Unreachable",
  };
}

/** Restart accel-ppp service — DESTRUCTIVE. */
async function executeRestart(
  node: { id: string; name: string; url: string; apiKey: string },
): Promise<FleetOpResult> {
  const res = await dawosRequest(node.url, node.apiKey, "service/action", {
    method: "POST",
    body: { action: "restart" },
    timeout: NODE_TIMEOUT,
  });

  return {
    nodeId: node.id,
    nodeName: node.name,
    ok: res.ok,
    status: res.status,
    message: res.ok ? "Service restarted" : "Restart failed",
  };
}

/** Bulk terminate sessions — DESTRUCTIVE. */
async function executeBulkTerminate(
  node: { id: string; name: string; url: string; apiKey: string },
  usernames: string[],
): Promise<FleetOpResult> {
  const res = await dawosRequest(node.url, node.apiKey, "bulk/terminate", {
    method: "POST",
    body: { usernames },
    timeout: NODE_TIMEOUT,
  });

  return {
    nodeId: node.id,
    nodeName: node.name,
    ok: res.ok,
    status: res.status,
    message: res.ok
      ? `Terminated ${usernames.length} session(s)`
      : "Terminate failed",
  };
}
