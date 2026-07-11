import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Zod schema for recording a fired alert event. */
const alertEventSchema = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  nodeId: z.string().nullable().optional(),
  nodeName: z.string().nullable().optional(),
  metric: z.string().min(1),
  value: z.number(),
  threshold: z.number(),
  message: z.string().min(1),
});

/** GET /api/alerts/events — recent fired alerts (newest first). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const rawLimit = limitParam ? Number(limitParam) : NaN;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500)
    : 100;

  const events = await prisma.alertEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ events });
}

/**
 * POST /api/alerts/events — record a fired alert (called by the client
 * evaluator on breach). Fires the rule's outbound webhook server-side so the
 * webhook URL never reaches the browser.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = alertEventSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const event = await prisma.alertEvent.create({ data: parsed.data });

  // Best-effort outbound webhook (never blocks the response on failure).
  const rule = await prisma.alertRule.findUnique({
    where: { id: parsed.data.ruleId },
    select: { webhookUrl: true },
  });
  if (rule?.webhookUrl) {
    try {
      await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[dawu-manager] ${parsed.data.ruleName}: ${parsed.data.message}`,
          event,
        }),
      });
    } catch {
      // Webhook delivery is best-effort — swallow errors.
    }
  }

  return NextResponse.json(event, { status: 201 });
}
