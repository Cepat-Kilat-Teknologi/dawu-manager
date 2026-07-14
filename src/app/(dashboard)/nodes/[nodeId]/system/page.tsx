"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import { cn, formatUptime, formatValue } from "@/lib/utils";

/** Live resource metrics from `system/metrics` (nested objects, polled). */
interface Metrics {
  cpu?: { count?: number; percent?: number; load_avg?: number[] };
  memory?: { total_mb?: number; used_mb?: number; available_mb?: number; percent?: number };
  disk?: { total_gb?: number; used_gb?: number; free_gb?: number; percent?: number };
  timestamp?: number | string;
}

/** Interface entry embedded in `system/info`. */
interface SysInterface {
  name: string;
  addresses?: unknown[];
  is_up?: boolean;
}

/** Host identity from `system/info`. */
interface SysInfo {
  hostname?: string;
  os?: string;
  kernel?: string;
  arch?: string;
  boot_time?: number | string;
  interfaces?: SysInterface[];
}

/** Time-sync status from `ntp/status`. */
interface NtpStatus {
  synced?: boolean;
  reference?: string;
  stratum?: number;
  system_time_offset?: string | number;
  last_offset?: string | number;
  frequency?: string | number;
  raw_output?: string;
}

/** LLDP neighbour from `lldp/neighbors`. */
interface LldpNeighbor {
  local_port?: string;
  remote_system?: string;
  remote_port?: string;
  remote_description?: string;
  ttl?: number;
}

/** Extended stats entry — key-value pairs from `sessions/stats-extended`. */
interface ExtendedStatsEntry {
  [key: string]: string | number | undefined;
}

/** Stat keys that should NOT appear in extended stats (already shown in gauges). */
const EXTENDED_SKIP = new Set(["cpu_percent", "pool_used", "pool_total"]);

/** Progress-bar colour by utilisation: green ≤ 70 < amber ≤ 90 < red. */
function usageColor(pct: number): string {
  if (pct > 90) return "bg-red-500";
  if (pct > 70) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Format megabytes as GB when ≥ 1 GB, else MB; em dash when unknown. */
function formatMb(mb: number | undefined): string {
  if (mb === undefined) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

/** Format gigabytes to one decimal; em dash when unknown. */
function formatGb(gb: number | undefined): string {
  if (gb === undefined) return "—";
  return `${gb.toFixed(1)} GB`;
}

/** Compute a human uptime from a boot timestamp (unix seconds/ms or a date string). */
function computeUptime(bootTime: number | string | undefined): string {
  if (!bootTime) return "—";
  let bootMs: number;
  if (typeof bootTime === "number") {
    bootMs = bootTime > 1e12 ? bootTime : bootTime * 1000;
  } else {
    const parsed = new Date(bootTime).getTime();
    if (Number.isNaN(parsed)) return "—";
    bootMs = parsed;
  }
  const seconds = Math.max(0, Math.floor((Date.now() - bootMs) / 1000));
  return formatUptime(seconds);
}

/** Render one interface address (string or `{ address, prefix_len }`) as text. */
function addressText(addr: unknown): string {
  if (typeof addr === "string") return addr;
  if (addr && typeof addr === "object" && "address" in addr) {
    const a = addr as { address?: string; prefix_len?: number };
    return a.prefix_len != null ? `${a.address}/${a.prefix_len}` : String(a.address);
  }
  return String(addr);
}

/**
 * Render an NTP field value, dashing empty strings and missing values.
 * When the clock is unsynced accel-ppp returns "" for most fields — nullish
 * coalescing alone would leave those blank, so empty strings must dash too.
 */
function dashValue(value: string | number | undefined): string {
  if (value === undefined || value === "") return "—";
  return String(value);
}

interface GaugeProps {
  label: string;
  percent: number;
  primary: string;
  secondary: string;
}

/** A labelled utilisation gauge card (CPU / Memory / Disk). */
function MetricGauge({ label, percent, primary, secondary }: GaugeProps) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{percent}%</span>
          <span className="text-xs text-muted-foreground">{primary}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${usageColor(percent)}`}
            style={{ width: `${width}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{secondary}</p>
      </CardContent>
    </Card>
  );
}

/**
 * System information page.
 * Resource gauges (system/metrics, polled every 15s), host identity + computed
 * uptime and interfaces (system/info), NTP sync status (ntp/status), and LLDP
 * neighbours (lldp/neighbors). audit/log and ntp/peers are omitted (404).
 */
export default function SystemPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const info = useNodeProxy<SysInfo>(nodeId, "system/info");
  const metrics = useNodeProxy<Metrics>(nodeId, "system/metrics", { refetchInterval: 15_000 });
  const ntp = useNodeProxy<NtpStatus>(nodeId, "ntp/status");
  const lldp = useNodeProxy<LldpNeighbor[]>(nodeId, "lldp/neighbors", { extract: "neighbors" });
  const extendedStats = useNodeProxy<ExtendedStatsEntry>(nodeId, "sessions/stats-extended");

  const cpu = metrics.data?.cpu;
  const mem = metrics.data?.memory;
  const disk = metrics.data?.disk;
  const loadAvg = cpu?.load_avg ?? [];
  const ntpSynced = ntp.data?.synced ?? false;

  const identity = [
    { label: "Hostname", value: info.data?.hostname },
    { label: "OS", value: info.data?.os },
    { label: "Kernel", value: info.data?.kernel },
    { label: "Architecture", value: info.data?.arch },
    { label: "Uptime", value: computeUptime(info.data?.boot_time) },
  ];

  const ntpFields = [
    { label: "Reference", value: ntp.data?.reference },
    { label: "Stratum", value: ntp.data?.stratum },
    { label: "System Time Offset", value: ntp.data?.system_time_offset },
    { label: "Last Offset", value: ntp.data?.last_offset },
    { label: "Frequency", value: ntp.data?.frequency },
  ];

  const ifColumns: ProxyColumn<SysInterface>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    {
      header: "Addresses",
      className: "font-mono text-xs",
      cell: (row) =>
        row.addresses && row.addresses.length > 0 ? (
          <span>{row.addresses.map(addressText).join(", ")}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "State",
      cell: (row) => (
        <Badge variant={row.is_up ? "default" : "outline"}>{row.is_up ? "UP" : "DOWN"}</Badge>
      ),
    },
  ];

  const lldpColumns: ProxyColumn<LldpNeighbor>[] = [
    { header: "Local Port", accessorKey: "local_port", className: "font-mono text-xs" },
    { header: "Remote System", accessorKey: "remote_system", className: "font-medium" },
    { header: "Remote Port", accessorKey: "remote_port", className: "font-mono text-xs" },
    { header: "Description", accessorKey: "remote_description" },
    { header: "TTL", accessorKey: "ttl" },
  ];

  return (
    <div className="space-y-6">
      {/* Resource usage gauges */}
      <NodePageShell
        title="Resource Usage"
        isLoading={metrics.isLoading}
        error={metrics.error}
        onRetry={() => metrics.refetch()}
        actions={
          <Button variant="outline" size="sm" onClick={() => metrics.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricGauge
            label="CPU"
            percent={cpu?.percent ?? 0}
            primary={`${cpu?.count ?? 0} cores`}
            secondary={loadAvg.length > 0 ? `load ${loadAvg.join(" / ")}` : "load —"}
          />
          <MetricGauge
            label="Memory"
            percent={mem?.percent ?? 0}
            primary={`${formatMb(mem?.used_mb)} / ${formatMb(mem?.total_mb)}`}
            secondary={`${formatMb(mem?.available_mb)} available`}
          />
          <MetricGauge
            label="Disk"
            percent={disk?.percent ?? 0}
            primary={`${formatGb(disk?.used_gb)} / ${formatGb(disk?.total_gb)}`}
            secondary={`${formatGb(disk?.free_gb)} free`}
          />
        </div>
      </NodePageShell>

      {/* Host identity */}
      <NodePageShell
        title="Host Information"
        isLoading={info.isLoading}
        error={info.error}
        onRetry={() => info.refetch()}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {identity.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-mono text-sm break-all">{item.value || "—"}</p>
            </div>
          ))}
        </div>
      </NodePageShell>

      {/* Interfaces reported by system/info */}
      <NodePageShell
        title={`Interfaces (${info.data?.interfaces?.length ?? 0})`}
        isLoading={info.isLoading}
        error={info.error}
        onRetry={() => info.refetch()}
        isEmpty={info.data?.interfaces?.length === 0}
        emptyMessage="No interfaces reported."
      >
        <ProxyDataTable
          columns={ifColumns}
          data={info.data?.interfaces ?? []}
          getRowKey={(r) => r.name}
        />
      </NodePageShell>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* NTP status */}
        <NodePageShell
          title="NTP Status"
          isLoading={ntp.isLoading}
          error={ntp.error}
          onRetry={() => ntp.refetch()}
        >
          <div className="space-y-3">
            {/* Prominent sync banner */}
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5",
                ntpSynced
                  ? "border-success/30 bg-success/10"
                  : "border-warning/30 bg-warning/10",
              )}
            >
              {ntpSynced ? (
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-success"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="h-5 w-5 shrink-0 text-warning"
                  aria-hidden="true"
                />
              )}
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    ntpSynced ? "text-success" : "text-warning",
                  )}
                >
                  {ntpSynced ? "Synced" : "Not synced"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ntpSynced
                    ? "System clock is synchronised with an NTP source."
                    : "System clock is not synchronised with an NTP source."}
                </p>
              </div>
            </div>

            {/* Detail fields — empty values render dashed, never blank */}
            <dl className="grid gap-2 text-sm">
              {ntpFields.map((f) => (
                <div
                  key={f.label}
                  className="flex justify-between gap-4 border-b py-1.5 last:border-0"
                >
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-mono text-xs">{dashValue(f.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </NodePageShell>

        {/* LLDP neighbours */}
        <div className="space-y-2">
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
          {lldp.data?.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              LLDP is active; no neighbours are advertising on connected links.
            </p>
          )}
        </div>
      </div>

      {/* Extended statistics from sessions/stats-extended */}
      <NodePageShell
        title="Extended Statistics"
        isLoading={extendedStats.isLoading}
        error={extendedStats.error}
        onRetry={() => extendedStats.refetch()}
        isEmpty={
          extendedStats.data !== null &&
          extendedStats.data !== undefined &&
          Object.keys(extendedStats.data).filter((k) => !EXTENDED_SKIP.has(k))
            .length === 0
        }
        emptyMessage="No extended statistics available."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => extendedStats.refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        {extendedStats.data && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(extendedStats.data)
              .filter(([key]) => !EXTENDED_SKIP.has(key))
              .map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                      {formatValue(value)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </NodePageShell>
    </div>
  );
}
