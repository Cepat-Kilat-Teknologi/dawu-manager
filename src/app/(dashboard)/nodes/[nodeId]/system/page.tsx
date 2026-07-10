"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface LldpNeighbor {
  local_port: string;
  remote_system: string;
  remote_port: string;
  remote_description?: string;
  ttl?: number;
}

interface NtpPeer {
  remote: string;
  refid?: string;
  stratum?: number;
  reach?: number;
  delay?: string;
  offset?: string;
  jitter?: string;
  tally?: string;
}

interface AuditEntry {
  timestamp: string;
  user: string;
  action: string;
  detail?: string;
  source_ip?: string;
}

/**
 * System information page.
 * Displays system info, metrics, LLDP neighbors, NTP peers, and audit log.
 * Covers dawos-agent endpoints: system/info, system/metrics, lldp/neighbors,
 * ntp/status, ntp/peers, audit/log.
 */
export default function SystemPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const sysInfo = useNodeProxy<Record<string, unknown>>(nodeId, "system/info");
  const sysMetrics = useNodeProxy<Record<string, unknown>>(nodeId, "system/metrics", {
    refetchInterval: 15_000,
  });
  const lldp = useNodeProxy<LldpNeighbor[]>(nodeId, "lldp/neighbors", { extract: "neighbors" });
  const ntpStatus = useNodeProxy<Record<string, unknown>>(nodeId, "ntp/status");
  const ntpPeers = useNodeProxy<NtpPeer[]>(nodeId, "ntp/peers", { extract: "peers" });
  const audit = useNodeProxy<AuditEntry[]>(nodeId, "audit/log", { extract: "entries" });

  const lldpColumns: ProxyColumn<LldpNeighbor>[] = [
    { header: "Local Port", accessorKey: "local_port", className: "font-mono text-xs" },
    { header: "Remote System", accessorKey: "remote_system", className: "font-medium" },
    { header: "Remote Port", accessorKey: "remote_port", className: "font-mono text-xs" },
    { header: "Description", accessorKey: "remote_description" },
    { header: "TTL", accessorKey: "ttl" },
  ];

  const ntpColumns: ProxyColumn<NtpPeer>[] = [
    {
      header: "Tally",
      cell: (row) => (
        <Badge variant={row.tally === "*" ? "default" : "outline"}>{row.tally ?? "-"}</Badge>
      ),
    },
    { header: "Remote", accessorKey: "remote", className: "font-mono text-xs" },
    { header: "Ref ID", accessorKey: "refid", className: "font-mono text-xs" },
    { header: "Stratum", accessorKey: "stratum" },
    { header: "Delay", accessorKey: "delay" },
    { header: "Offset", accessorKey: "offset" },
    { header: "Jitter", accessorKey: "jitter" },
  ];

  const auditColumns: ProxyColumn<AuditEntry>[] = [
    { header: "Time", accessorKey: "timestamp" },
    { header: "User", accessorKey: "user", className: "font-medium" },
    { header: "Action", accessorKey: "action" },
    { header: "Detail", accessorKey: "detail" },
    { header: "Source IP", accessorKey: "source_ip", className: "font-mono text-xs" },
  ];

  return (
    <div className="space-y-6">
      {/* System Info + Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NodePageShell
          title="System Information"
          isLoading={sysInfo.isLoading}
          error={sysInfo.error}
          onRetry={() => sysInfo.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {sysInfo.data &&
              Object.entries(sysInfo.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
          </dl>
        </NodePageShell>

        <NodePageShell
          title="System Metrics"
          isLoading={sysMetrics.isLoading}
          error={sysMetrics.error}
          onRetry={() => sysMetrics.refetch()}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {sysMetrics.data &&
              Object.entries(sysMetrics.data).map(([key, val]) => (
                <Card key={key}>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold tabular-nums">
                      {formatValue(val)}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </NodePageShell>
      </div>

      {/* NTP Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        <NodePageShell
          title="NTP Status"
          isLoading={ntpStatus.isLoading}
          error={ntpStatus.error}
          onRetry={() => ntpStatus.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {ntpStatus.data &&
              Object.entries(ntpStatus.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
          </dl>
        </NodePageShell>

        <div className="lg:col-span-2">
          <NodePageShell
            title={`NTP Peers (${ntpPeers.data?.length ?? 0})`}
            isLoading={ntpPeers.isLoading}
            error={ntpPeers.error}
            onRetry={() => ntpPeers.refetch()}
            isEmpty={ntpPeers.data?.length === 0}
            emptyMessage="No NTP peers configured."
          >
            <ProxyDataTable
              columns={ntpColumns}
              data={ntpPeers.data ?? []}
              getRowKey={(r) => r.remote}
            />
          </NodePageShell>
        </div>
      </div>

      {/* LLDP Neighbors */}
      <NodePageShell
        title={`LLDP Neighbors (${lldp.data?.length ?? 0})`}
        isLoading={lldp.isLoading}
        error={lldp.error}
        onRetry={() => lldp.refetch()}
        isEmpty={lldp.data?.length === 0}
        emptyMessage="No LLDP neighbors discovered."
        actions={
          <Button variant="outline" size="sm" onClick={() => lldp.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable
          columns={lldpColumns}
          data={lldp.data ?? []}
          getRowKey={(r) => `${r.local_port}-${r.remote_system}`}
        />
      </NodePageShell>

      {/* Audit Log */}
      <NodePageShell
        title={`Audit Log (${audit.data?.length ?? 0})`}
        isLoading={audit.isLoading}
        error={audit.error}
        onRetry={() => audit.refetch()}
        isEmpty={audit.data?.length === 0}
        emptyMessage="No audit entries."
        actions={
          <Button variant="outline" size="sm" onClick={() => audit.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={auditColumns} data={audit.data ?? []} />
      </NodePageShell>
    </div>
  );
}
