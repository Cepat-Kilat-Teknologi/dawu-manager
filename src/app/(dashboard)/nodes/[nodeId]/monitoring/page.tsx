"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, Loader2, Power, Activity } from "lucide-react";

interface MonitorExporter {
  service: string;
  active: boolean;
  port: number;
}

/**
 * Monitoring management page.
 * Shows exporter status (node_exporter, snmpd) with enable/disable + restart,
 * and Prometheus metrics. When metrics are unavailable because an exporter is
 * down, it explains how to enable them.
 * Covers: monitoring/status, monitoring/metrics, monitoring/configure,
 * monitoring/restart.
 */
export default function MonitoringPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const status = useNodeProxy<{ exporters: MonitorExporter[]; count: number }>(
    nodeId,
    "monitoring/status",
  );
  const metrics = useNodeProxy<Record<string, unknown>>(
    nodeId,
    "monitoring/metrics",
    { refetchInterval: 15_000 },
  );

  const restartMutation = useNodeProxyMutation(nodeId, "monitoring/restart", {
    invalidates: ["monitoring"],
    onSuccess: () => toast.success("Monitoring service restarted"),
  });

  const configureMutation = useNodeProxyMutation<{ service: string; enable: boolean }>(
    nodeId,
    "monitoring/configure",
    {
      invalidates: ["monitoring"],
      onSuccess: () => toast.success("Exporter updated"),
    },
  );

  const exporters = status.data?.exporters ?? [];
  const nodeExporter = exporters.find((e) => e.service === "node_exporter");
  const metricsInactive = nodeExporter ? !nodeExporter.active : false;

  const metricCards = metrics.data
    ? Object.entries(metrics.data).map(([key, value]) => ({
        label: key.replace(/_/g, " "),
        value:
          typeof value === "number" ? value.toLocaleString() : String(value),
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Exporter status + controls */}
      <NodePageShell
        title="Monitoring Exporters"
        isLoading={status.isLoading}
        error={status.error}
        onRetry={() => status.refetch()}
        actions={
          <div className="flex gap-2">
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
            <Button variant="outline" size="sm" onClick={() => status.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {exporters.map((exp) => (
            <Card key={exp.service}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {exp.service}
                  <span className="font-mono text-xs text-muted-foreground">
                    :{exp.port}
                  </span>
                </CardTitle>
                <Badge variant={exp.active ? "default" : "outline"}>
                  {exp.active ? "active" : "inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    configureMutation.mutate({
                      service: exp.service,
                      enable: !exp.active,
                    })
                  }
                  disabled={configureMutation.isPending}
                >
                  {configureMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Power className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {exp.active ? "Disable" : "Enable"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </NodePageShell>

      {/* Metrics — with actionable guidance when node_exporter is down */}
      <NodePageShell
        title="Prometheus Metrics"
        isLoading={metrics.isLoading}
        error={metrics.error}
        onRetry={() => metrics.refetch()}
        isEmpty={metricCards.length === 0}
        emptyMessage="No metrics reported."
        unavailableHint={
          metricsInactive ? (
            <div className="space-y-2">
              <p>
                Metrics are exposed by{" "}
                <span className="font-mono">node_exporter</span>, which is
                currently <span className="text-warning">inactive</span> on this
                node. Enable it to collect metrics:
              </p>
              <Button
                size="sm"
                onClick={() =>
                  configureMutation.mutate({
                    service: "node_exporter",
                    enable: true,
                  })
                }
                disabled={configureMutation.isPending}
              >
                {configureMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                )}
                Enable node_exporter
              </Button>
            </div>
          ) : (
            <p>
              The monitoring endpoint isn’t exposed by this dawos-agent build.
              Metrics are still scrapable directly from the exporter ports above
              (Prometheus/Grafana).
            </p>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </NodePageShell>
    </div>
  );
}
