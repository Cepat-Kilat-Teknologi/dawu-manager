import Link from "next/link";
import { prisma } from "@/lib/db";
import { NodesTable } from "@/components/nodes/nodes-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Node list page (server component).
 * Fetches all registered dawos-agent nodes and renders them in a client
 * DataTable (sortable, searchable, responsive). Empty state is handled by the
 * table itself.
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
        <Button render={<Link href="/nodes/new" />} className="press-scale">
          <Plus className="mr-2 h-4 w-4" />
          Add Node
        </Button>
      </div>

      <NodesTable
        nodes={nodes.map((node) => ({
          id: node.id,
          name: node.name,
          url: node.url,
          status: node.status,
          location: node.location,
          lastSeen: node.lastSeen,
        }))}
      />
    </div>
  );
}
