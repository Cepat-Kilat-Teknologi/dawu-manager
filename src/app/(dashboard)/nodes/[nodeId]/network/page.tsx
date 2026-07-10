"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface NetworkInterface {
  name: string;
  state: string;
  mtu: number;
  mac: string;
  ipv4?: string;
  ipv6?: string;
  type?: string;
  speed?: string;
}

interface RouteEntry {
  destination: string;
  gateway: string;
  interface: string;
  metric?: number;
  protocol?: string;
}

interface VlanEntry {
  id: number;
  parent: string;
  name: string;
  state?: string;
}

/**
 * Network management page.
 * Displays interfaces, routes, VLANs, and DNS configuration.
 * Covers dawos-agent endpoints: network/interfaces, network/routes,
 * network/vlans, network/dns.
 */
export default function NetworkPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const interfaces = useNodeProxy<NetworkInterface[]>(nodeId, "network/interfaces", { extract: "interfaces" });
  const routes = useNodeProxy<RouteEntry[]>(nodeId, "network/routes", { extract: "routes" });
  const vlans = useNodeProxy<VlanEntry[]>(nodeId, "network/vlans", { extract: "vlans" });
  const dns = useNodeProxy<Record<string, unknown>>(nodeId, "network/dns");

  const ifColumns: ProxyColumn<NetworkInterface>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    {
      header: "State",
      cell: (row) => (
        <Badge variant={row.state === "UP" || row.state === "up" ? "default" : "outline"}>
          {row.state}
        </Badge>
      ),
    },
    { header: "IPv4", accessorKey: "ipv4", className: "font-mono text-xs" },
    { header: "MAC", accessorKey: "mac", className: "font-mono text-xs" },
    { header: "MTU", accessorKey: "mtu" },
    { header: "Speed", accessorKey: "speed" },
  ];

  const routeColumns: ProxyColumn<RouteEntry>[] = [
    { header: "Destination", accessorKey: "destination", className: "font-mono text-xs" },
    { header: "Gateway", accessorKey: "gateway", className: "font-mono text-xs" },
    { header: "Interface", accessorKey: "interface" },
    { header: "Metric", accessorKey: "metric" },
    { header: "Protocol", accessorKey: "protocol" },
  ];

  const vlanColumns: ProxyColumn<VlanEntry>[] = [
    { header: "ID", accessorKey: "id" },
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Parent", accessorKey: "parent" },
    {
      header: "State",
      cell: (row) => (
        <Badge variant={row.state === "UP" || row.state === "up" ? "default" : "outline"}>
          {row.state ?? "—"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <NodePageShell
        title={`Interfaces (${interfaces.data?.length ?? 0})`}
        isLoading={interfaces.isLoading}
        error={interfaces.error}
        onRetry={() => interfaces.refetch()}
        isEmpty={interfaces.data?.length === 0}
        emptyMessage="No network interfaces found."
        actions={
          <Button variant="outline" size="sm" onClick={() => interfaces.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={ifColumns} data={interfaces.data ?? []} getRowKey={(r) => r.name} />
      </NodePageShell>

      <NodePageShell
        title={`Routes (${routes.data?.length ?? 0})`}
        isLoading={routes.isLoading}
        error={routes.error}
        onRetry={() => routes.refetch()}
        isEmpty={routes.data?.length === 0}
        emptyMessage="No routes configured."
      >
        <ProxyDataTable columns={routeColumns} data={routes.data ?? []} />
      </NodePageShell>

      <div className="grid gap-6 lg:grid-cols-2">
        <NodePageShell
          title={`VLANs (${vlans.data?.length ?? 0})`}
          isLoading={vlans.isLoading}
          error={vlans.error}
          onRetry={() => vlans.refetch()}
          isEmpty={vlans.data?.length === 0}
          emptyMessage="No VLANs configured."
        >
          <ProxyDataTable columns={vlanColumns} data={vlans.data ?? []} />
        </NodePageShell>

        <NodePageShell
          title="DNS Configuration"
          isLoading={dns.isLoading}
          error={dns.error}
          onRetry={() => dns.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {dns.data &&
              Object.entries(dns.data).map(([key, val]) => (
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
    </div>
  );
}
