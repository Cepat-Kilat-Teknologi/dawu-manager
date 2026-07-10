import { prisma } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { NodeCard } from "@/components/dashboard/node-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Server, Wifi, WifiOff, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Dashboard overview page (server component).
 * Fetches all nodes from the database and displays:
 * - Summary stat cards (total, online, offline, degraded counts)
 * - A responsive grid of NodeCard components for each registered node
 * - An EmptyState prompt with "Add Node" CTA when no nodes exist
 */
export default async function DashboardPage() {
  const nodes = await prisma.node.findMany({
    orderBy: { name: "asc" },
  });

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => n.status === "online").length;
  const offlineNodes = nodes.filter((n) => n.status === "offline").length;
  const degradedNodes = nodes.filter((n) => n.status === "degraded").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all managed BNG nodes.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nodes"
          value={totalNodes}
          icon={Server}
          variant="default"
          description="Managed BNG nodes"
        />
        <StatCard
          title="Online"
          value={onlineNodes}
          icon={Wifi}
          variant="success"
          description={
            totalNodes > 0
              ? `${Math.round((onlineNodes / totalNodes) * 100)}% availability`
              : "No nodes configured"
          }
        />
        <StatCard
          title="Offline"
          value={offlineNodes}
          icon={WifiOff}
          variant="danger"
          description={offlineNodes > 0 ? "Needs attention" : "All nodes healthy"}
        />
        <StatCard
          title="Degraded"
          value={degradedNodes}
          icon={Activity}
          variant="warning"
          description={
            degradedNodes > 0 ? "Partial service" : "No degraded nodes"
          }
        />
      </div>

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
