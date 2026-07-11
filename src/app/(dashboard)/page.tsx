import { prisma } from "@/lib/db";
import { NodeCard } from "@/components/dashboard/node-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FleetOverview } from "@/components/dashboard/fleet-overview";
import { Server } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Dashboard overview page (server component).
 * Fetches all nodes from the database and displays:
 * - Live aggregate fleet stats via FleetOverview (client component)
 * - A responsive grid of NodeCard components for each registered node
 * - An EmptyState prompt with "Add Node" CTA when no nodes exist
 */
export default async function DashboardPage() {
  const nodes = await prisma.node.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all managed BNG nodes.
        </p>
      </div>

      {/* Live fleet stats (client component with auto-refresh) */}
      {nodes.length > 0 && <FleetOverview />}

      {/* Node grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Nodes</h2>
        {nodes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-4">
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                id={node.id}
                name={node.name}
                url={node.url}
                status={node.status}
                location={node.location}
                lastSeen={node.lastSeen}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Server}
            title="No nodes configured"
            description="Add your first dawos-agent node to start managing your BNG infrastructure."
            action={{ label: "Add your first node", href: "/nodes/new" }}
          />
        )}
      </section>
    </div>
  );
}
