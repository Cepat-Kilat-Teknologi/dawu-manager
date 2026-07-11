import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { alertRuleUpdateSchema } from "../route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/alerts/rules/:id — update a rule (operator+). */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasRole("operator"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = alertRuleUpdateSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const rule = await prisma.alertRule.update({
      where: { id },
      data: {
        ...parsed.data,
        nodeId: parsed.data.nodeId ?? undefined,
        webhookUrl: parsed.data.webhookUrl ?? undefined,
      },
    });
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }
}

/** DELETE /api/alerts/rules/:id — delete a rule (operator+). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasRole("operator"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.alertRule.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }
}
