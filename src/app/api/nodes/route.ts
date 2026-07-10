import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { checkNodeHealth } from "@/lib/dawos-client";
import { createNodeSchema, formatZodError } from "@/lib/schemas";
import { validateNodeUrl } from "@/lib/url-validation";

/**
 * GET /api/nodes — List all nodes.
 * Requires authentication (any role).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nodes = await prisma.node.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      location: true,
      tags: true,
      status: true,
      lastSeen: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(nodes);
}

/**
 * POST /api/nodes — Create a new node.
 * Requires admin or operator role.
 * Validates input with Zod schema and checks URL against SSRF blocklist.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Zod validation (DM-M05)
    const parsed = createNodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }

    const { name, url, apiKey, location, tags } = parsed.data;

    // SSRF prevention (DM-H01) — allow private IPs for BNG nodes
    const urlCheck = validateNodeUrl(url, true);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { error: urlCheck.error },
        { status: 400 },
      );
    }

    // Check connectivity before saving
    const health = await checkNodeHealth(url);

    // Encrypt API key before storing
    const encryptedApiKey = encrypt(apiKey);

    const node = await prisma.node.create({
      data: {
        name,
        url: url.replace(/\/+$/, ""), // strip trailing slash
        apiKey: encryptedApiKey,
        location: location || null,
        tags: tags ? JSON.stringify(tags) : null,
        status: health.ok ? "online" : "offline",
        lastSeen: health.ok ? new Date() : null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        nodeId: node.id,
        action: "node.create",
        detail: JSON.stringify({ name, url, location }),
      },
    });

    const response = NextResponse.json(
      {
        id: node.id,
        name: node.name,
        url: node.url,
        location: node.location,
        tags: node.tags,
        status: node.status,
        lastSeen: node.lastSeen,
        createdAt: node.createdAt,
      },
      { status: 201 },
    );

    // Cleartext HTTP warning header (DM-M03)
    if (urlCheck.warning) {
      response.headers.set("X-Security-Warning", urlCheck.warning);
    }

    return response;
  } catch (error) {
    // Prisma-specific error handling (DM-M19)
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        error.message.includes("UNIQUE constraint failed"))
    ) {
      return NextResponse.json(
        { error: "A node with this name already exists." },
        { status: 409 },
      );
    }
    console.error("[nodes] Create error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
