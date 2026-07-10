import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";
import { RefreshHealthButton } from "@/components/dashboard/refresh-health-button";
import { EditNodeDialog } from "@/components/dashboard/edit-node-dialog";
import { DeleteNodeButton } from "@/components/dashboard/delete-node-button";
import { NodeSubNav } from "@/components/node/node-sub-nav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

interface NodeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ nodeId: string }>;
}

/**
 * Per-node layout (server component).
 * Wraps all node sub-pages with a shared header (name, status, actions)
 * and a horizontal sub-navigation bar for switching between categories.
 * Fetches live health status to show the correct status badge.
 */
export default async function NodeLayout({
  children,
  params,
}: NodeLayoutProps) {
  const { nodeId } = await params;

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
  });

  if (!node) {
    notFound();
  }

  // Quick health check for status badge
  let effectiveStatus = node.status;
  try {
    const healthUrl = `${node.url.replace(/\/+$/, "")}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(healthUrl, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      effectiveStatus = data.status === "ok" ? "online" : "degraded";
    }
  } catch {
    // Node unreachable — use stored status
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="p-4 md:p-6 pb-0 space-y-4">
        <div className="flex items-center gap-4">
          <Button render={<Link href="/nodes" />} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to nodes</span>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {node.name}
              </h1>
              <StatusBadge status={effectiveStatus} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {node.url}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshHealthButton nodeId={node.id} />
            <EditNodeDialog
              nodeId={node.id}
              initialName={node.name}
              initialUrl={node.url}
              initialLocation={node.location}
            />
            <DeleteNodeButton nodeId={node.id} nodeName={node.name} />
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="px-4 md:px-6">
        <NodeSubNav nodeId={nodeId} />
      </div>

      {/* Page content */}
      <div className="p-4 md:p-6">{children}</div>
    </div>
  );
}
