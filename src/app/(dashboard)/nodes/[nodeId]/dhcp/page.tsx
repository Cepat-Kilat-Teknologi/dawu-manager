"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, Loader2, Info, Trash2 } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface DhcpLease {
  ip: string;
  mac: string;
  hostname?: string;
  expires?: string;
  state?: string;
}

/** Parse comma-separated DNS servers into a trimmed, deduplicated array. */
export function parseServers(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(",")) {
    const s = raw.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      result.push(s);
    }
  }
  return result;
}

/**
 * DHCP management page.
 * Displays DHCP server status, leases, and relay configuration.
 * Also includes DNS forwarding config (PUT + flush).
 * Covers dawos-agent endpoints: dhcp/status, dhcp/leases,
 * dhcp/restart, dhcp/relay, dns/forwarding, dns/forwarding/config,
 * dns/forwarding/flush.
 */
export default function DhcpPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [dnsServers, setDnsServers] = useState("");
  const [dnsCacheSize, setDnsCacheSize] = useState("");

  const status = useNodeProxy<Record<string, unknown>>(nodeId, "dhcp/status");
  const leases = useNodeProxy<DhcpLease[]>(nodeId, "dhcp/leases", { refetchInterval: 30_000, extract: "leases" });
  const relay = useNodeProxy<Record<string, unknown>>(nodeId, "dhcp/relay");

  const restartMutation = useNodeProxyMutation(nodeId, "dhcp/restart", {
    invalidates: ["dhcp"],
    onSuccess: () => toast.success("DHCP service restarted"),
  });

  // DNS Forwarding
  const dnsForwarding = useNodeProxy<Record<string, unknown>>(
    nodeId,
    "dns/forwarding",
  );

  const dnsConfigMutation = useNodeProxyMutation<{
    servers: string[];
    cache_size: number;
  }>(nodeId, "dns/forwarding/config", {
    method: "PUT",
    invalidates: ["dns"],
    onSuccess: () => toast.success("DNS forwarding config updated"),
  });

  const dnsFlushMutation = useNodeProxyMutation(
    nodeId,
    "dns/forwarding/flush",
    {
      invalidates: ["dns"],
      onSuccess: () => toast.success("DNS cache flushed"),
    },
  );

  function handleDnsConfigUpdate() {
    const servers = parseServers(dnsServers);
    const cacheSize = parseInt(dnsCacheSize, 10);
    if (servers.length === 0) {
      toast.error("Enter at least one DNS server");
      return;
    }
    if (!dnsCacheSize.trim() || isNaN(cacheSize) || cacheSize < 0) {
      toast.error("Cache size must be a non-negative integer");
      return;
    }
    dnsConfigMutation.mutate({ servers, cache_size: cacheSize });
  }

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

      {/* DNS Forwarding */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">DNS Forwarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dnsForwarding.isLoading ? (
            <div className="animate-pulse h-6 w-32 rounded bg-muted" />
          ) : dnsForwarding.data ? (
            <dl className="grid gap-1 text-sm">
              {Object.entries(dnsForwarding.data).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b py-1.5 last:border-0"
                >
                  <dt className="text-muted-foreground">
                    {k.replace(/_/g, " ")}
                  </dt>
                  <dd className="font-mono text-xs">{formatValue(v)}</dd>
                </div>
              ))}
            </dl>
          ) : dnsForwarding.error ? (
            <Badge variant="outline">unavailable</Badge>
          ) : (
            <p className="text-xs text-muted-foreground">
              No DNS forwarding data.
            </p>
          )}

          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Update the DNS forwarding configuration. Servers are
              comma-separated IP addresses.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="dns-servers">DNS Servers</Label>
              <Input
                id="dns-servers"
                placeholder="8.8.8.8, 1.1.1.1"
                className="font-mono"
                value={dnsServers}
                onChange={(e) => setDnsServers(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dns-cache-size">Cache Size</Label>
              <Input
                id="dns-cache-size"
                type="number"
                min={0}
                placeholder="10000"
                value={dnsCacheSize}
                onChange={(e) => setDnsCacheSize(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleDnsConfigUpdate}
              disabled={dnsConfigMutation.isPending}
            >
              {dnsConfigMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Update Config
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dnsFlushMutation.mutate({})}
              disabled={dnsFlushMutation.isPending}
            >
              {dnsFlushMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Flush Cache
            </Button>
          </div>
        </CardContent>
      </Card>

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
