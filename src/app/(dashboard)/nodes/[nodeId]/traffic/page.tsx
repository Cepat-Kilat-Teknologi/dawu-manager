"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { TrafficChartLazy } from "@/components/charts/traffic-chart-lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Gauge, Trash2, Info } from "lucide-react";

/**
 * Traffic page.
 * Real-time aggregate throughput chart (SSE) + a manual per-user rate-limit
 * override tool. Per-session shaper limits themselves are RADIUS-assigned and
 * shown on the Sessions page and the chart's top-talkers list.
 * Covers: traffic/stream (SSE), traffic/ratelimit/{username} (POST/DELETE).
 */
export default function TrafficPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [username, setUsername] = useState("");
  const [rate, setRate] = useState("");

  // Path carries the username; rebuilt as the field changes.
  const target = username.trim();
  const applyMutation = useNodeProxyMutation<{ rate: string }>(
    nodeId,
    `traffic/ratelimit/${target}`,
    {
      method: "POST",
      onSuccess: () => toast.success(`Rate limit applied to ${target}`),
    },
  );
  const clearMutation = useNodeProxyMutation(
    nodeId,
    `traffic/ratelimit/${target}`,
    {
      method: "DELETE",
      onSuccess: () => toast.success(`Rate limit override cleared for ${target}`),
    },
  );

  const canSubmit = target.length > 0;

  return (
    <div className="space-y-6">
      {/* Real-time chart */}
      <section className="rounded-xl border bg-card p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg">Real-time Traffic</h2>
          <p className="text-sm text-muted-foreground">
            Live aggregate throughput of all active sessions.
          </p>
        </div>
        <TrafficChartLazy nodeId={nodeId} height={380} />
      </section>

      {/* Manual rate-limit override */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Rate-Limit Override
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Per-session limits are assigned by RADIUS (shown on{" "}
              <span className="font-medium text-foreground">Sessions</span> and in
              the chart’s top talkers). This tool applies a temporary manual{" "}
              <span className="font-mono">tc</span> override to one active
              subscriber — it does not list existing limits.
            </span>
          </div>

          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) applyMutation.mutate({ rate });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rl-user">Username</Label>
              <Input
                id="rl-user"
                placeholder="kantor_kepala_desa_sewaka"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rl-rate">Rate (down/up)</Label>
              <Input
                id="rl-rate"
                placeholder="5M/20M"
                className="font-mono"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!canSubmit || applyMutation.isPending}>
                {applyMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Gauge className="mr-1.5 h-3.5 w-3.5" />
                )}
                {applyMutation.isPending ? "Applying…" : "Apply"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canSubmit || clearMutation.isPending}
                onClick={() => clearMutation.mutate(undefined)}
                title="Clear override"
              >
                {clearMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="sr-only">Clear override</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
