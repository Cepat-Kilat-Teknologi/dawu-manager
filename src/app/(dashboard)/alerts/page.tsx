import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { AlertsManager } from "@/components/alerts/alerts-manager";

export const dynamic = "force-dynamic";

/**
 * Alerts page (operator+).
 * Manage threshold rules per node and review fired-alert history. Rules are
 * evaluated client-side while this page is open — a documented MVP limitation;
 * server-side scheduling is a future step.
 */
export default async function AlertsPage() {
  await requireAuth("operator");

  const nodes = await prisma.node.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get notified when a node goes offline or a metric crosses a threshold.
        </p>
      </div>
      <AlertsManager nodes={nodes} />
    </div>
  );
}
