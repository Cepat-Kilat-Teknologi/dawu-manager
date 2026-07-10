import Link from "next/link";
import { prisma } from "@/lib/db";
import { NodeCard } from "@/components/dashboard/node-card";
import { Button } from "@/components/ui/button";
import { Plus, Server } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Node list page (server component).
 * Fetches all registered dawos-agent nodes and displays them in a responsive grid.
 * Shows an empty-state with "Add Node" CTA when no nodes are configured.
 */
export default async function NodesPage() {
  const nodes = await prisma.node.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nodes</h1>
          <p className="text-muted-foreground">
            Manage your dawos-agent BNG nodes.
          </p>
        </div>
        <Button render={<Link href="/nodes/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Node
        </Button>
      </div>

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
          <h3 className="mt-4 text-lg font-semibold">No nodes yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first dawos-agent node to get started.
          </p>
          <Button render={<Link href="/nodes/new" />} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Add Node
          </Button>
        </div>
      )}
    </div>
  );
}
