"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, Loader2 } from "lucide-react";

interface MonitorExporter {
  service: string;
  active: boolean;
  port: number;
}

/**
 * Monitoring management page.
 * Displays monitoring status, metrics, and configuration.
 * Covers dawos-agent endpoints: monitoring/status, monitoring/metrics,
 * monitoring/configure, monitoring/restart.
 */
export default function MonitoringPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const status = useNodeProxy<{ exporters: MonitorExporter[]; count: number }>(nodeId, "monitoring/status");
  const metrics = useNodeProxy<Record<string, unknown>>(nodeId, "monitoring/metrics", {
    refetchInterval: 15_000,
  });

  const restartMutation = useNodeProxyMutation(nodeId, "monitoring/restart", {
    invalidates: ["monitoring"],
    onSuccess: () => toast.success("Monitoring service restarted"),
  });

  const metricCards = metrics.data
    ? Object.entries(metrics.data).map(([key, value]) => ({
        label: key.replace(/_/g, " "),
        value: typeof value === "number" ? value.toLocaleString() : String(value),
      }))
    : [];

  return (
    <div className="space-y-6">
      <NodePageShell
        title="Monitoring Status"
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
        <dl className="grid gap-2 text-sm">
          {status.data?.exporters?.map((exp) => (
            <div key={exp.service} className="flex justify-between border-b py-1.5 last:border-0">
              <dt className="text-muted-foreground">{exp.service} (:{exp.port})</dt>
              <dd>
                <Badge variant={exp.active ? "default" : "outline"}>
                  {exp.active ? "active" : "inactive"}
                </Badge>
              </dd>
            </div>
          ))}
        </dl>
      </NodePageShell>

      <NodePageShell
        title="Metrics"
        isLoading={metrics.isLoading}
        error={metrics.error}
        onRetry={() => metrics.refetch()}
        isEmpty={metricCards.length === 0}
        emptyMessage="No metrics available."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground capitalize">{label}</CardTitle>
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
