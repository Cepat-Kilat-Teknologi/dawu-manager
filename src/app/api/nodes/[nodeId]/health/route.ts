import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkNodeHealth } from "@/lib/dawos-client";

interface RouteParams {
  params: Promise<{ nodeId: string }>;
}

/**
 * GET /api/nodes/:nodeId/health — Check node health and update status.
 * Public /health endpoint on dawos-agent (no API key required).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, url: true },
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  const health = await checkNodeHealth(node.url);
  const newStatus = health.ok ? "online" : "offline";

  // Update node status in DB
  await prisma.node.update({
    where: { id: nodeId },
    data: {
      status: newStatus,
      lastSeen: health.ok ? new Date() : undefined,
    },
  });

  return NextResponse.json({
    nodeId,
    status: newStatus,
    health: health.data,
  });
}
