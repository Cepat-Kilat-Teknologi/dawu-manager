import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { NodeCard } from "@/components/dashboard/node-card";
import { Server, Wifi, WifiOff, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Dashboard overview page (server component).
 * Fetches all nodes from the database and displays:
 * - Summary stat cards (total, online, offline, degraded counts)
 * - A grid of NodeCard components for each registered node
 * - An empty-state prompt with "Add Node" CTA when no nodes exist
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
    <div className="space-y-6">
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
      {nodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="rounded-lg border bg-card p-12 text-center">
          <Server
            className="mx-auto h-12 w-12 text-muted-foreground/50"
            aria-hidden="true"
          />
          <h3 className="mt-4 text-lg font-semibold">No nodes configured</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first dawos-agent node to start managing your BNG
            infrastructure.
          </p>
          <Link
            href="/nodes/new"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add Node
          </Link>
        </div>
      )}
    </div>
  );
}
