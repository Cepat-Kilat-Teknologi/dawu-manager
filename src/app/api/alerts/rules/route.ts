import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

/** Field definitions shared by the create and update schemas (no defaults). */
const alertRuleFields = {
  name: z.string().min(1).max(120),
  nodeId: z.string().nullable().optional(),
  metric: z.enum([
    "node_offline",
    "cpu_percent",
    "mem_percent",
    "disk_percent",
    "session_count",
  ]),
  operator: z.enum(["gt", "lt"]),
  threshold: z.number(),
  enabled: z.boolean(),
  webhookUrl: z.url().nullable().optional(),
};

/** Zod schema for creating an alert rule (applies defaults for omitted fields). */
export const alertRuleSchema = z.object({
  ...alertRuleFields,
  operator: z.enum(["gt", "lt"]).default("gt"),
  threshold: z.number().default(0),
  enabled: z.boolean().default(true),
});

/**
 * Zod schema for partially updating a rule. Every field is optional and — unlike
 * {@link alertRuleSchema} — no defaults are injected, so a `{ enabled }`-only PUT
 * never silently rewrites the operator or threshold.
 */
export const alertRuleUpdateSchema = z.object(alertRuleFields).partial();

/** GET /api/alerts/rules — list all alert rules (newest first). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rules = await prisma.alertRule.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ rules });
}

/** POST /api/alerts/rules — create a rule (operator+). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasRole("operator"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = alertRuleSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const rule = await prisma.alertRule.create({
    data: {
      name: parsed.data.name,
      nodeId: parsed.data.nodeId ?? null,
      metric: parsed.data.metric,
      operator: parsed.data.operator,
      threshold: parsed.data.threshold,
      enabled: parsed.data.enabled,
      webhookUrl: parsed.data.webhookUrl ?? null,
    },
  });
  return NextResponse.json(rule, { status: 201 });
}
