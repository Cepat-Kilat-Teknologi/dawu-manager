import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { ActivityFeed } from "@/components/activity/activity-feed";

export const dynamic = "force-dynamic";

/**
 * Audit / Activity page (admin-only).
 * A live, cross-node activity timeline backed by the AuditLog — every proxy
 * mutation and node CRUD is recorded. Auto-refreshes so a NOC operator sees
 * fleet-wide operator activity without reloading. Filters by user, node,
 * action, and date range with CSV export.
 */
export default async function AuditPage() {
  await requireAuth("admin");

  const [nodes, users, actionRows] = await Promise.all([
    prisma.node.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);

  const actions = actionRows.map((r) => r.action);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live audit trail of every operator action across your nodes.
        </p>
      </div>
      <ActivityFeed nodes={nodes} users={users} actions={actions} />
    </div>
  );
}
