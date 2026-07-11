"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { TrafficChartLazy } from "@/components/charts/traffic-chart-lazy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface RateLimitEntry {
  username: string;
  rate: string;
  direction?: string;
  interface?: string;
}

interface QueueStat {
  interface: string;
  sent_bytes: number;
  sent_packets: number;
  dropped: number;
  overlimits: number;
  backlog?: number;
}

/**
 * Traffic management page.
 * Displays rate limits, queue statistics, and traffic streaming.
 * Covers dawos-agent endpoints: traffic/ratelimit, traffic/ratelimit (POST),
 * traffic/queue, traffic/queue/stats, traffic/stream (SSE).
 */
export default function TrafficPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const ratelimits = useNodeProxy<RateLimitEntry[]>(nodeId, "traffic/ratelimit", { extract: "limits" });
  const queueStats = useNodeProxy<QueueStat[]>(nodeId, "traffic/queue/stats", {
    refetchInterval: 10_000,
    extract: "queues",
  });

  const resetMutation = useNodeProxyMutation<{ username: string }>(
    nodeId,
    "traffic/ratelimit",
    {
      method: "DELETE",
      invalidates: ["traffic"],
      onSuccess: () => toast.success("Rate limit removed"),
    },
  );

  const rlColumns: ProxyColumn<RateLimitEntry>[] = [
    { header: "Username", accessorKey: "username", className: "font-medium" },
    { header: "Rate", accessorKey: "rate", className: "font-mono" },
    { header: "Direction", accessorKey: "direction" },
    { header: "Interface", accessorKey: "interface" },
    {
      header: "Actions",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => resetMutation.mutate({ username: row.username })}
          disabled={resetMutation.isPending}
        >
          Remove
        </Button>
      ),
    },
  ];

  const queueColumns: ProxyColumn<QueueStat>[] = [
    { header: "Interface", accessorKey: "interface", className: "font-medium" },
    { header: "Sent Bytes", cell: (row) => formatBytes(row.sent_bytes) },
    { header: "Sent Packets", accessorKey: "sent_packets" },
    {
      header: "Dropped",
      cell: (row) => (
        <Badge variant={row.dropped > 0 ? "destructive" : "outline"}>
          {row.dropped}
        </Badge>
      ),
    },
    { header: "Overlimits", accessorKey: "overlimits" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg">Real-time Traffic</h2>
          <p className="text-sm text-muted-foreground">
            Live aggregate throughput of all active sessions — rolling window,
            2s resolution.
          </p>
        </div>
        <TrafficChartLazy nodeId={nodeId} height={380} />
      </section>

      <NodePageShell
        title={`Rate Limits (${ratelimits.data?.length ?? 0})`}
        isLoading={ratelimits.isLoading}
        error={ratelimits.error}
        onRetry={() => ratelimits.refetch()}
        isEmpty={ratelimits.data?.length === 0}
        emptyMessage="No active rate limits."
        actions={
          <Button variant="outline" size="sm" onClick={() => ratelimits.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={rlColumns} data={ratelimits.data ?? []} getRowKey={(r) => r.username} />
      </NodePageShell>

      <NodePageShell
        title="Queue Statistics"
        isLoading={queueStats.isLoading}
        error={queueStats.error}
        onRetry={() => queueStats.refetch()}
        isEmpty={queueStats.data?.length === 0}
        emptyMessage="No queue statistics available."
        actions={
          <Button variant="outline" size="sm" onClick={() => queueStats.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={queueColumns} data={queueStats.data ?? []} getRowKey={(r) => r.interface} />
      </NodePageShell>
    </div>
  );
}

/** Format bytes into a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
