"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface IpPool {
  name: string;
  range: string;
  used: number;
  available: number;
  total: number;
}

/**
 * IP Pool management page.
 * Displays IP address pools with usage statistics.
 * Covers dawos-agent endpoints: ip-pool, ip-pool (POST), ip-pool (DELETE), ip-pool/usage.
 */
export default function IpPoolPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const pools = useNodeProxy<IpPool[]>(nodeId, "ip-pool", { refetchInterval: 30_000, extract: "pools" });
  const usage = useNodeProxy<Record<string, unknown>>(nodeId, "ip-pool/usage");

  const removeMutation = useNodeProxyMutation<{ name: string }>(
    nodeId,
    "ip-pool",
    {
      method: "DELETE",
      invalidates: ["ip-pool"],
      onSuccess: () => toast.success("Pool removed"),
    },
  );

  const columns: ProxyColumn<IpPool>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Range", accessorKey: "range", className: "font-mono text-xs" },
    { header: "Used", accessorKey: "used" },
    { header: "Available", accessorKey: "available" },
    { header: "Total", accessorKey: "total" },
    {
      header: "Usage",
      cell: (row) => {
        const pct = row.total > 0 ? Math.round((row.used / row.total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => removeMutation.mutate({ name: row.name })}
          disabled={removeMutation.isPending}
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Usage summary */}
      {usage.data && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {Object.entries(usage.data).map(([key, val]) => (
            <div key={key} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
              <p className="text-lg font-semibold">{formatValue(val)}</p>
            </div>
          ))}
        </div>
      )}

      <NodePageShell
        title={`IP Pools (${pools.data?.length ?? 0})`}
        isLoading={pools.isLoading}
        error={pools.error}
        onRetry={() => pools.refetch()}
        isEmpty={pools.data?.length === 0}
        emptyMessage="No IP pools configured."
        actions={
          <Button variant="outline" size="sm" onClick={() => pools.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={columns} data={pools.data ?? []} getRowKey={(r) => r.name} />
      </NodePageShell>
    </div>
  );
}
