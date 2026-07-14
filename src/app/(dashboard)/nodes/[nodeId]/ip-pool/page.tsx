"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Plus, Loader2, ChevronDown, ChevronRight } from "lucide-react";

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

/** Per-pool detail entry from `ip-pool/detail`. */
interface PoolDetailEntry {
  ip?: string;
  username?: string;
  session_id?: string;
  [key: string]: unknown;
}

/** Pool detail response — keyed by pool name. */
interface PoolDetail {
  [poolName: string]: PoolDetailEntry[] | unknown;
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
  const [addOpen, setAddOpen] = useState(false);
  const [poolName, setPoolName] = useState("");
  const [ipRange, setIpRange] = useState("");
  const [expandedPool, setExpandedPool] = useState<string | null>(null);

  const pools = useNodeProxy<IpPool[]>(nodeId, "ip-pool", {
    refetchInterval: 30_000,
    extract: "pools",
  });
  const usage = useNodeProxy<IpPoolUsage>(nodeId, "ip-pool/usage");
  const detail = useNodeProxy<PoolDetail>(nodeId, "ip-pool/detail");

  const removeMutation = useNodeProxyMutation<{ name: string }>(
    nodeId,
    "ip-pool",
    {
      method: "DELETE",
      invalidates: ["ip-pool"],
      onSuccess: () => toast.success("Pool removed"),
    },
  );

  const addMutation = useNodeProxyMutation<{ name: string; ip_range: string }>(
    nodeId,
    "ip-pool",
    {
      method: "POST",
      invalidates: ["ip-pool"],
      onSuccess: () => {
        toast.success("Pool created");
        setAddOpen(false);
        setPoolName("");
        setIpRange("");
      },
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
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Pool
            </Button>
            <Button variant="outline" size="sm" onClick={() => pools.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      >
        <ProxyDataTable columns={columns} data={pools.data ?? []} getRowKey={(r) => r.name} />
      </NodePageShell>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add IP Pool</DialogTitle>
            <DialogDescription>
              Define a named address pool for accel-ppp to allocate from.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate({ name: poolName, ip_range: ipRange });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pool-name">Name</Label>
              <Input
                id="pool-name"
                placeholder="soho"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                required
                disabled={addMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-range">
                IP range{" "}
                <span className="font-normal text-muted-foreground">(CIDR)</span>
              </Label>
              <Input
                id="pool-range"
                className="font-mono"
                placeholder="10.20.0.0/24"
                value={ipRange}
                onChange={(e) => setIpRange(e.target.value)}
                required
                disabled={addMutation.isPending}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={addMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending || !poolName || !ipRange}
              >
                {addMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {addMutation.isPending ? "Creating…" : "Create Pool"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pool detail — per-pool IP allocations */}
      <NodePageShell
        title="Pool Detail"
        isLoading={detail.isLoading}
        error={detail.error}
        onRetry={() => detail.refetch()}
        isEmpty={
          detail.data !== null &&
          detail.data !== undefined &&
          Object.keys(detail.data).length === 0
        }
        emptyMessage="No pool allocation details available."
        actions={
          <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        {detail.data && (
          <div className="space-y-2">
            {Object.entries(detail.data).map(([name, entries]) => {
              const items = Array.isArray(entries) ? entries : [];
              const isExpanded = expandedPool === name;
              return (
                <div key={name} className="rounded-lg border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
                    onClick={() =>
                      setExpandedPool(isExpanded ? null : name)
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>{name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {items.length} allocation{items.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  {isExpanded && items.length > 0 && (
                    <div className="border-t px-4 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="py-1 text-left font-medium">IP</th>
                            <th className="py-1 text-left font-medium">
                              Username
                            </th>
                            <th className="py-1 text-left font-medium">
                              Session ID
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((entry, idx) => (
                            <tr
                              key={entry.ip ?? idx}
                              className="border-t border-border/50"
                            >
                              <td className="py-1 font-mono">
                                {entry.ip ?? "—"}
                              </td>
                              <td className="py-1">
                                {entry.username ?? "—"}
                              </td>
                              <td className="py-1 font-mono text-muted-foreground">
                                {entry.session_id ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isExpanded && items.length === 0 && (
                    <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                      No allocations in this pool.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </NodePageShell>
    </div>
  );
}
