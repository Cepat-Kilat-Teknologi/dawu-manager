"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface IpPool {
  name: string;
  range: string;
  used: number;
  available: number;
  total: number;
}

/** Shape of the dawos-agent `ip-pool/usage` response (values are STRINGS). */
interface IpPoolUsage {
  used?: string;
  total?: string;
  available?: string;
}

/** Parse a possibly-undefined string metric into a finite number (0 fallback). */
function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Percentage of a pool that is in use (0 when total is unknown). */
function usagePercent(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0;
}

/** Bar colour by utilisation: red >90%, amber >70%, emerald otherwise. */
function usageBarColor(pct: number): string {
  if (pct > 90) return "bg-red-500";
  if (pct > 70) return "bg-amber-500";
  return "bg-emerald-500";
}

/**
 * IP Pool management page.
 * This node commonly has ZERO named pools; the summary tiles come from
 * `ip-pool/usage` (string values, parsed to numbers) so operators still see
 * how many addresses are available for allocation.
 * Covers dawos-agent endpoints: ip-pool, ip-pool (DELETE), ip-pool/usage.
 */
export default function IpPoolPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const pools = useNodeProxy<IpPool[]>(nodeId, "ip-pool", {
    refetchInterval: 30_000,
    extract: "pools",
  });
  const usage = useNodeProxy<IpPoolUsage>(nodeId, "ip-pool/usage");

  const removeMutation = useNodeProxyMutation<{ name: string }>(
    nodeId,
    "ip-pool",
    {
      method: "DELETE",
      invalidates: ["ip-pool"],
      onSuccess: () => toast.success("Pool removed"),
    },
  );

  const used = toNum(usage.data?.used);
  const total = toNum(usage.data?.total);
  const available = toNum(usage.data?.available);
  const overallPct = usagePercent(used, total);

  const usageTiles = [
    { label: "Used", value: used },
    { label: "Total", value: total },
    { label: "Available", value: available },
  ];

  const columns: ProxyColumn<IpPool>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Range", accessorKey: "range", className: "font-mono text-xs" },
    { header: "Used", accessorKey: "used" },
    { header: "Available", accessorKey: "available" },
    { header: "Total", accessorKey: "total" },
    {
      header: "Usage",
      cell: (row) => {
        const pct = usagePercent(row.used, row.total);
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${usageBarColor(pct)}`}
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
      {/* Usage summary — parsed from the string-valued usage endpoint */}
      {usage.data && (
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-3">
            {usageTiles.map((tile) => (
              <div key={tile.label} className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="text-lg font-semibold">
                  {tile.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall usage</span>
              <span className="font-medium">{overallPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${usageBarColor(overallPct)}`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <NodePageShell
        title={`IP Pools (${pools.data?.length ?? 0})`}
        isLoading={pools.isLoading}
        error={pools.error}
        onRetry={() => pools.refetch()}
        isEmpty={pools.data?.length === 0}
        emptyMessage={`No named IP pools defined on this node. ${available.toLocaleString()} addresses available for allocation.`}
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
