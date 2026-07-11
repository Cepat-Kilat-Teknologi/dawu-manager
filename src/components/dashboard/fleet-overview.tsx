"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { HEALTH_POLL_INTERVAL } from "@/lib/constants";
import type { FleetOverviewResponse } from "@/app/api/fleet/overview/route";

/**
 * Live fleet overview panel for the dashboard.
 *
 * Fetches aggregated cross-node stats from `/api/fleet/overview` and
 * auto-refreshes at the health-poll interval. Shows total active sessions,
 * live node counts by status, and a ranked list of the busiest nodes.
 */
export function FleetOverview() {
  const { data, isLoading, isError } = useQuery<FleetOverviewResponse>({
    queryKey: ["fleet", "overview"],
    queryFn: async () => {
      const res = await fetch("/api/fleet/overview");
      if (!res.ok) throw new Error("Failed to fetch fleet overview");
      return res.json();
    },
    refetchInterval: HEALTH_POLL_INTERVAL,
  });

  if (isLoading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="fleet-loading"
      >
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground"
        data-testid="fleet-error"
      >
        <AlertTriangle className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
        Unable to load live fleet stats. Showing cached data below.
      </div>
    );
  }

  const { nodes, sessions, topNodes } = data;

  return (
    <div className="space-y-6" data-testid="fleet-overview">
      {/* Live stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Subscribers"
          value={sessions.total.toLocaleString()}
          icon={Users}
          variant="default"
          description={`Across ${nodes.online} reachable node${nodes.online !== 1 ? "s" : ""}`}
        />
        <StatCard
          title="Online"
          value={nodes.online}
          icon={Wifi}
          variant="success"
          description={
            nodes.total > 0
              ? `${Math.round((nodes.online / nodes.total) * 100)}% availability`
              : "No nodes"
          }
        />
        <StatCard
          title="Offline"
          value={nodes.offline}
          icon={WifiOff}
          variant="danger"
          description={nodes.offline > 0 ? "Needs attention" : "All reachable"}
        />
        <StatCard
          title="Degraded"
          value={nodes.degraded}
          icon={Activity}
          variant="warning"
          description={
            nodes.degraded > 0 ? "Partial service" : "No degraded nodes"
          }
        />
      </div>

      {/* Top nodes by load */}
      {topNodes.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Top Nodes by Load</h3>
            </div>
            <div className="space-y-3">
              {topNodes.map((node, idx) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between gap-3 text-sm"
                  data-testid="top-node-row"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{node.name}</span>
                    <StatusBadge status={node.status} />
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                    <span title="Active sessions">
                      {node.sessions.toLocaleString()} sess
                    </span>
                    <span title="CPU usage">{node.cpu}% CPU</span>
                    <span title="Memory usage">{node.memory}% RAM</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
