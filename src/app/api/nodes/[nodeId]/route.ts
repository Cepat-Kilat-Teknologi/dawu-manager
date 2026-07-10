import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { updateNodeSchema, formatZodError } from "@/lib/schemas";
import { validateNodeUrl } from "@/lib/url-validation";

interface RouteParams {
  params: Promise<{ nodeId: string }>;
}

/**
 * GET /api/nodes/:nodeId — Get a single node.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
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

  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  return NextResponse.json(node);
}

/**
 * PUT /api/nodes/:nodeId — Update a node.
 * Requires admin or operator role.
 * Validates input with Zod schema and checks URL against SSRF blocklist.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nodeId } = await params;

  const existing = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!existing) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  try {
    const body = await request.json();

    // Zod validation (DM-M05)
    const parsed = updateNodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }

    const { name, url, apiKey, location, tags } = parsed.data;

    // SSRF prevention on URL change (DM-H01) — allow private IPs for BNG nodes
    if (url !== undefined) {
      const urlCheck = validateNodeUrl(url, true);
      if (!urlCheck.valid) {
        return NextResponse.json(
          { error: urlCheck.error },
          { status: 400 },
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (url !== undefined) data.url = url.replace(/\/+$/, "");
    if (apiKey !== undefined) data.apiKey = encrypt(apiKey);
    if (location !== undefined) data.location = location || null;
    if (tags !== undefined) data.tags = tags ? JSON.stringify(tags) : null;

    const node = await prisma.node.update({
      where: { id: nodeId },
      data,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        nodeId: node.id,
        action: "node.update",
        detail: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({
      id: node.id,
      name: node.name,
      url: node.url,
      location: node.location,
      tags: node.tags,
      status: node.status,
      lastSeen: node.lastSeen,
    });
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
    console.error("[nodes] Update error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/nodes/:nodeId — Delete a node.
 * Requires admin role.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nodeId } = await params;

  const existing = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!existing) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  await prisma.node.delete({ where: { id: nodeId } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      nodeId: null,
      action: "node.delete",
      detail: JSON.stringify({ name: existing.name, url: existing.url }),
    },
  });

  return new NextResponse(null, { status: 204 });
}
