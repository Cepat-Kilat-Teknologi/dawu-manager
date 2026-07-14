"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  CircleDot,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { formatValue } from "@/lib/utils";

/** RADIUS server configuration (read-only view, never secrets). */
interface RadiusConfig {
  [key: string]: unknown;
}

/** RADIUS server connection status. */
interface RadiusStatus {
  [key: string]: unknown;
}

/** Health check result from `POST radius/health-check`. */
interface RadiusHealthResult {
  success?: boolean;
  message?: string;
  latency_ms?: number;
  [key: string]: unknown;
}

/** Keys to skip in the display (noisy / raw output). */
const SKIP_KEYS = new Set(["raw_output"]);

/**
 * RADIUS diagnostics page.
 * Shows RADIUS server configuration (read-only — never exposes shared secrets),
 * connection status, and on-demand health check.
 * Covers dawos-agent endpoints: radius/config, radius/status, radius/health-check.
 */
export default function RadiusPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [healthResult, setHealthResult] = useState<RadiusHealthResult | null>(
    null,
  );

  const config = useNodeProxy<RadiusConfig>(nodeId, "radius/config");
  const status = useNodeProxy<RadiusStatus>(nodeId, "radius/status");

  const healthCheckMutation = useNodeProxyMutation(
    nodeId,
    "radius/health-check",
    {
      onSuccess: () => {
        toast.success("RADIUS health check sent");
      },
    },
  );

  async function runHealthCheck() {
    setHealthResult(null);
    try {
      const res = (await healthCheckMutation.mutateAsync(
        {},
      )) as RadiusHealthResult;
      setHealthResult(res);
      if (res.success) {
        toast.success("RADIUS health check passed", {
          description: res.latency_ms
            ? `Latency: ${res.latency_ms}ms`
            : undefined,
        });
      } else {
        toast.error("RADIUS health check failed", {
          description: res.message ?? "Unknown error",
        });
      }
    } catch {
      toast.error("Health check request failed");
    }
  }

  /** Render a key-value data section as definition list. */
  function renderKeyValues(
    data: Record<string, unknown> | null | undefined,
  ) {
    if (!data) return null;
    const entries = Object.entries(data).filter(([k]) => !SKIP_KEYS.has(k));
    if (entries.length === 0) {
      return (
        <span className="text-xs text-muted-foreground">No data available</span>
      );
    }
    return (
      <dl className="grid gap-2 text-sm">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className="flex justify-between gap-4 border-b py-1.5 last:border-0"
          >
            <dt className="text-muted-foreground">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="font-mono text-xs text-right">
              {formatValue(val)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* RADIUS Configuration (read-only) */}
        <NodePageShell
          title="RADIUS Configuration"
          isLoading={config.isLoading}
          error={config.error}
          onRetry={() => config.refetch()}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => config.refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                Read-only view. Shared secrets are never exposed via the API.
              </span>
            </div>
            {renderKeyValues(config.data)}
          </div>
        </NodePageShell>

        {/* RADIUS Status */}
        <NodePageShell
          title="RADIUS Status"
          isLoading={status.isLoading}
          error={status.error}
          onRetry={() => status.refetch()}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => status.refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          }
        >
          {renderKeyValues(status.data)}
        </NodePageShell>
      </div>

      {/* Health Check */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-4 w-4" />
            RADIUS Health Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Test connectivity to the configured RADIUS server(s). This sends a
            status-server request to verify the server is reachable and
            responding.
          </p>
          <Button
            size="sm"
            onClick={() => runHealthCheck()}
            disabled={healthCheckMutation.isPending}
          >
            {healthCheckMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CircleDot className="mr-1.5 h-3.5 w-3.5" />
            )}
            {healthCheckMutation.isPending
              ? "Checking…"
              : "Run Health Check"}
          </Button>

          {healthResult && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {healthResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600">
                      RADIUS server is healthy
                    </span>
                    {healthResult.latency_ms != null && (
                      <Badge variant="outline" className="ml-auto">
                        {healthResult.latency_ms}ms
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600">
                      Health check failed
                    </span>
                  </>
                )}
              </div>
              {healthResult.message && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {healthResult.message}
                </p>
              )}
              {/* Show any extra fields returned by the health check */}
              {Object.keys(healthResult).filter(
                (k) =>
                  !["success", "message", "latency_ms", "raw_output"].includes(
                    k,
                  ),
              ).length > 0 && (
                <dl className="mt-2 grid gap-1 text-xs">
                  {Object.entries(healthResult)
                    .filter(
                      ([k]) =>
                        ![
                          "success",
                          "message",
                          "latency_ms",
                          "raw_output",
                        ].includes(k),
                    )
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted-foreground">
                          {k.replace(/_/g, " ")}
                        </dt>
                        <dd className="font-mono">{formatValue(v)}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
