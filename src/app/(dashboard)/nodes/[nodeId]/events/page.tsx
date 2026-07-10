"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface EventHook {
  id: string;
  event: string;
  action: string;
  enabled: boolean;
  description?: string;
}

interface EventHistoryEntry {
  timestamp: string;
  event: string;
  detail?: string;
  source?: string;
}

/**
 * Events management page.
 * Displays event hooks and event history.
 * Covers dawos-agent endpoints: events/hooks, events/hooks (POST/DELETE),
 * events/fire, events/history.
 */
export default function EventsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const hooks = useNodeProxy<EventHook[]>(nodeId, "events/hooks", { extract: "hooks" });
  const history = useNodeProxy<EventHistoryEntry[]>(nodeId, "events/history", {
    refetchInterval: 15_000,
    extract: "entries",
  });

  const fireMutation = useNodeProxyMutation<{ event: string }>(
    nodeId,
    "events/fire",
    {
      invalidates: ["events"],
      onSuccess: () => toast.success("Event fired"),
    },
  );

  const hookColumns: ProxyColumn<EventHook>[] = [
    { header: "Event", accessorKey: "event", className: "font-medium" },
    { header: "Action", accessorKey: "action", className: "font-mono text-xs" },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant={row.enabled ? "default" : "outline"}>
          {row.enabled ? "enabled" : "disabled"}
        </Badge>
      ),
    },
    { header: "Description", accessorKey: "description" },
    {
      header: "Test",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fireMutation.mutate({ event: row.event })}
          disabled={fireMutation.isPending}
        >
          Fire
        </Button>
      ),
    },
  ];

  const historyColumns: ProxyColumn<EventHistoryEntry>[] = [
    { header: "Time", accessorKey: "timestamp" },
    { header: "Event", accessorKey: "event", className: "font-medium" },
    { header: "Detail", accessorKey: "detail" },
    { header: "Source", accessorKey: "source" },
  ];

  return (
    <div className="space-y-6">
      <NodePageShell
        title={`Event Hooks (${hooks.data?.length ?? 0})`}
        isLoading={hooks.isLoading}
        error={hooks.error}
        onRetry={() => hooks.refetch()}
        isEmpty={hooks.data?.length === 0}
        emptyMessage="No event hooks configured."
        actions={
          <Button variant="outline" size="sm" onClick={() => hooks.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={hookColumns} data={hooks.data ?? []} getRowKey={(r) => r.id} />
      </NodePageShell>

      <NodePageShell
        title={`Event History (${history.data?.length ?? 0})`}
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
        isEmpty={history.data?.length === 0}
        emptyMessage="No recent events."
        actions={
          <Button variant="outline" size="sm" onClick={() => history.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={historyColumns} data={history.data ?? []} />
      </NodePageShell>
    </div>
  );
}
