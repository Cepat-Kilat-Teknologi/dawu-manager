"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/** A single address bound to an interface (from `network/interfaces`). */
interface InterfaceAddress {
  family: "inet" | "inet6";
  address: string;
  prefix_len: number;
  broadcast?: string | null;
  scope?: string;
}

/** Network interface as returned by `network/interfaces`. */
interface NetworkInterface {
  name: string;
  index?: number;
  mac_address?: string;
  mtu?: number;
  state: string;
  flags?: string[];
  addresses?: InterfaceAddress[];
  link_type?: string;
}

/** Kernel route as returned by `network/routes`. */
interface RouteEntry {
  destination: string;
  gateway?: string;
  device?: string;
  protocol?: string;
  scope?: string;
  metric?: number | null;
  source?: string | null;
}

/** VLAN interface as returned by `network/vlans` (many entries are empty junk). */
interface VlanEntry {
  name: string;
  parent?: string;
  vlan_id: number;
  protocol?: string;
  state?: string;
  mac_address?: string;
  mtu?: number;
}

/** DNS resolver configuration as returned by `network/dns`. */
interface DnsResponse {
  success?: boolean;
  message?: string;
  config?: {
    nameservers?: string[];
    search_domains?: string[];
  };
}

/**
 * Return a non-alarming badge variant for a link state.
 * `ppp*` point-to-point interfaces legitimately report `UNKNOWN` — render those
 * (and any other unexpected value) as a neutral outline badge, not destructive.
 */
function stateVariant(state: string | undefined): "default" | "destructive" | "outline" {
  if (state === "UP") return "default";
  if (state === "DOWN") return "destructive";
  return "outline";
}

/**
 * Derive an `address/prefix` string for the first address of the given family,
 * or `null` when the interface has no address of that family.
 */
function deriveAddress(
  addresses: InterfaceAddress[] | undefined,
  family: "inet" | "inet6",
): string | null {
  const match = addresses?.find((a) => a.family === family);
  return match ? `${match.address}/${match.prefix_len}` : null;
}

/** Display helper: render null / undefined / empty string as an em dash. */
function orDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/**
 * Network management page.
 * Interfaces, routes, VLANs, and DNS configuration for a dawos-agent node.
 * Covers: network/interfaces, network/routes, network/vlans, network/dns.
 */
export default function NetworkPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const interfaces = useNodeProxy<NetworkInterface[]>(nodeId, "network/interfaces", {
    extract: "interfaces",
  });
  const routes = useNodeProxy<RouteEntry[]>(nodeId, "network/routes", { extract: "routes" });
  const vlansRaw = useNodeProxy<VlanEntry[]>(nodeId, "network/vlans", { extract: "vlans" });
  const dns = useNodeProxy<DnsResponse>(nodeId, "network/dns");

  // The VLAN endpoint returns mostly-empty placeholder rows — keep real VLANs only.
  const vlans = (vlansRaw.data ?? []).filter((v) => v.vlan_id > 0 || v.name);

  const ifColumns: ProxyColumn<NetworkInterface>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    {
      header: "State",
      cell: (row) => <Badge variant={stateVariant(row.state)}>{row.state}</Badge>,
    },
    {
      header: "IPv4",
      className: "font-mono text-xs",
      cell: (row) => <span>{deriveAddress(row.addresses, "inet") ?? "—"}</span>,
    },
    {
      header: "IPv6",
      className: "font-mono text-xs",
      cell: (row) => (
        <span className="text-muted-foreground">
          {deriveAddress(row.addresses, "inet6") ?? "—"}
        </span>
      ),
    },
    {
      header: "MAC",
      className: "font-mono text-xs",
      cell: (row) => <span>{orDash(row.mac_address)}</span>,
    },
    { header: "MTU", cell: (row) => <span>{orDash(row.mtu)}</span> },
    { header: "Link", cell: (row) => <span>{orDash(row.link_type)}</span> },
  ];

  const routeColumns: ProxyColumn<RouteEntry>[] = [
    { header: "Destination", accessorKey: "destination", className: "font-mono text-xs" },
    {
      header: "Gateway",
      className: "font-mono text-xs",
      cell: (row) => <span>{orDash(row.gateway)}</span>,
    },
    { header: "Device", cell: (row) => <span>{orDash(row.device)}</span> },
    { header: "Protocol", cell: (row) => <span>{orDash(row.protocol)}</span> },
    { header: "Metric", cell: (row) => <span>{orDash(row.metric)}</span> },
  ];

  const vlanColumns: ProxyColumn<VlanEntry>[] = [
    { header: "ID", accessorKey: "vlan_id" },
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Parent", cell: (row) => <span>{orDash(row.parent)}</span> },
    { header: "Protocol", cell: (row) => <span>{orDash(row.protocol)}</span> },
    {
      header: "State",
      cell: (row) => <Badge variant={stateVariant(row.state)}>{row.state ?? "—"}</Badge>,
    },
  ];

  const nameservers = dns.data?.config?.nameservers ?? [];
  const searchDomains = dns.data?.config?.search_domains ?? [];

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
          title={`VLANs (${vlans.length})`}
          isLoading={vlansRaw.isLoading}
          error={vlansRaw.error}
          onRetry={() => vlansRaw.refetch()}
          isEmpty={vlans.length === 0}
          emptyMessage="No VLANs configured."
        >
          <ProxyDataTable
            columns={vlanColumns}
            data={vlans}
            getRowKey={(r) => `${r.vlan_id}-${r.name}`}
          />
        </NodePageShell>

        <NodePageShell
          title="DNS Configuration"
          isLoading={dns.isLoading}
          error={dns.error}
          onRetry={() => dns.refetch()}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nameservers
              </p>
              {nameservers.length > 0 ? (
                <ul className="space-y-1">
                  {nameservers.map((ns) => (
                    <li key={ns} className="font-mono text-sm">
                      {ns}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None configured</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Search Domains
              </p>
              {searchDomains.length > 0 ? (
                <ul className="space-y-1">
                  {searchDomains.map((d) => (
                    <li key={d} className="font-mono text-sm">
                      {d}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None configured</p>
              )}
            </div>
          </div>
        </NodePageShell>
      </div>
    </div>
  );
}
