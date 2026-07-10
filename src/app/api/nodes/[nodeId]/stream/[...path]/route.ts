import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface RouteParams {
  params: Promise<{ nodeId: string; path: string[] }>;
}

/**
 * SSE streaming passthrough: pipes a Server-Sent Events stream from
 * dawos-agent to the browser without buffering.
 *
 * GET /api/nodes/:nodeId/stream/[...path]
 *   → GET http://<node>/api/v1/<path> (Accept: text/event-stream)
 *
 * Used for real-time traffic (/traffic/sse) and log tailing endpoints.
 * The node API key is decrypted server-side and never reaches the browser.
 * The upstream connection is aborted when the client disconnects.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId, path: pathSegments } = await params;

  // Reject path traversal or encoded segments (same policy as the JSON proxy)
  if (
    pathSegments.some((s) => s.includes("..") || s.includes("%") || s === "")
  ) {
    return NextResponse.json({ error: "Invalid stream path." }, { status: 400 });
  }

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { url: true, apiKey: true },
  });
  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  const targetPath = pathSegments.join("/");
  const search = new URL(request.url).search;
  const upstreamUrl = `${node.url.replace(/\/+$/, "")}/api/v1/${targetPath}${search}`;

  // Abort upstream fetch when the browser disconnects
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        "X-API-Key": decrypt(node.apiKey),
        Accept: "text/event-stream",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to node" },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Node returned ${upstream.status}` },
      { status: upstream.status },
    );
  }
  if (!upstream.body) {
    return NextResponse.json(
      { error: "Node returned an empty stream" },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
