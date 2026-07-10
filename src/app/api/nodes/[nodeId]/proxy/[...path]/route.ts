import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dawosRequest } from "@/lib/dawos-client";

interface RouteParams {
  params: Promise<{ nodeId: string; path: string[] }>;
}

/**
 * Universal proxy: forwards any request to dawos-agent.
 *
 * GET|POST|PUT|DELETE /api/nodes/:nodeId/proxy/[...path]
 *   → GET|POST|PUT|DELETE http://<node>/api/v1/<path>
 *
 * - Injects the node's encrypted API key (decrypted at proxy time)
 * - Logs mutation operations (POST/PUT/DELETE) to audit log
 * - Role-based: viewers can only GET, operators can mutate, admins can do all
 */
async function proxyHandler(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId, path: pathSegments } = await params;
  const method = request.method;
  const role = session.user.role;

  // RBAC: viewers can only GET
  if (method !== "GET" && role === "viewer") {
    return NextResponse.json(
      { error: "Viewers have read-only access." },
      { status: 403 },
    );
  }

  // Look up node
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, name: true, url: true, apiKey: true },
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  // Build target path — reject path traversal or encoded segments
  if (pathSegments.some((s: string) => s.includes("..") || s.includes("%") || s === "")) {
    return NextResponse.json(
      { error: "Invalid proxy path." },
      { status: 400 },
    );
  }
  const targetPath = pathSegments.join("/");

  // Forward query string from the original request (DM-H09)
  const url = new URL(request.url);
  const queryString = url.search; // includes leading "?" if present

  // Parse body for mutations
  let body: unknown = undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await request.json();
    } catch {
      // No body or non-JSON body — proceed without
    }
  }

  // Proxy to dawos-agent (include query string if present)
  const proxyPath = queryString ? `${targetPath}${queryString}` : targetPath;
  const result = await dawosRequest(node.url, node.apiKey, proxyPath, {
    method,
    body,
    timeout: 30_000,
  });

  // Audit log for mutations
  if (method !== "GET" && method !== "HEAD") {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        nodeId: node.id,
        action: `proxy.${method.toLowerCase()}.${targetPath}`,
        detail: JSON.stringify({
          status: result.status,
          ok: result.ok,
        }),
      },
    });
  }

  // Return proxied response
  if (result.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(result.data, { status: result.status });
}

/** GET handler — proxies read requests to dawos-agent. */
export const GET = proxyHandler;
/** POST handler — proxies create/action requests to dawos-agent. */
export const POST = proxyHandler;
/** PUT handler — proxies update requests to dawos-agent. */
export const PUT = proxyHandler;
/** DELETE handler — proxies delete requests to dawos-agent. */
export const DELETE = proxyHandler;
/** PATCH handler — proxies partial-update requests to dawos-agent. */
export const PATCH = proxyHandler;
