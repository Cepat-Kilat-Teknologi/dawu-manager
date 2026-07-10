"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, Loader2 } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface DhcpLease {
  ip: string;
  mac: string;
  hostname?: string;
  expires?: string;
  state?: string;
}

/**
 * DHCP management page.
 * Displays DHCP server status, leases, and relay configuration.
 * Covers dawos-agent endpoints: dhcp/status, dhcp/leases,
 * dhcp/restart, dhcp/relay.
 */
export default function DhcpPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const status = useNodeProxy<Record<string, unknown>>(nodeId, "dhcp/status");
  const leases = useNodeProxy<DhcpLease[]>(nodeId, "dhcp/leases", { refetchInterval: 30_000, extract: "leases" });
  const relay = useNodeProxy<Record<string, unknown>>(nodeId, "dhcp/relay");

  const restartMutation = useNodeProxyMutation(nodeId, "dhcp/restart", {
    invalidates: ["dhcp"],
    onSuccess: () => toast.success("DHCP service restarted"),
  });

  const leaseColumns: ProxyColumn<DhcpLease>[] = [
    { header: "IP Address", accessorKey: "ip", className: "font-mono text-xs" },
    { header: "MAC Address", accessorKey: "mac", className: "font-mono text-xs" },
    { header: "Hostname", accessorKey: "hostname" },
    { header: "Expires", accessorKey: "expires" },
    {
      header: "State",
      cell: (row) => (
        <Badge variant={row.state === "active" ? "default" : "outline"}>
          {row.state ?? "active"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <NodePageShell
          title="DHCP Status"
          isLoading={status.isLoading}
          error={status.error}
          onRetry={() => status.refetch()}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => restartMutation.mutate({})}
              disabled={restartMutation.isPending}
            >
              {restartMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Restart
            </Button>
          }
        >
          <dl className="grid gap-2 text-sm">
            {status.data &&
              Object.entries(status.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
          </dl>
        </NodePageShell>

        <NodePageShell
          title="DHCP Relay"
          isLoading={relay.isLoading}
          error={relay.error}
          onRetry={() => relay.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {relay.data &&
              Object.entries(relay.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">
                    {formatValue(val)}
                  </dd>
                </div>
              ))}
          </dl>
        </NodePageShell>
      </div>

      <NodePageShell
        title={`DHCP Leases (${leases.data?.length ?? 0})`}
        isLoading={leases.isLoading}
        error={leases.error}
        onRetry={() => leases.refetch()}
        isEmpty={leases.data?.length === 0}
        emptyMessage="No active DHCP leases."
        actions={
          <Button variant="outline" size="sm" onClick={() => leases.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={leaseColumns} data={leases.data ?? []} getRowKey={(r) => r.mac} />
      </NodePageShell>
    </div>
  );
}
