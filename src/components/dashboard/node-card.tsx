"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { sparklinePoints } from "@/components/dashboard/stat-card";
import { cn, formatDate } from "@/lib/utils";
import { NODE_STATUS } from "@/lib/constants";
import { RefreshCw, Settings } from "lucide-react";

/** LED dot color + pulse per node status. */
const ledStyles: Record<string, string> = {
  [NODE_STATUS.ONLINE]: "bg-success animate-led-pulse shadow-success",
  [NODE_STATUS.OFFLINE]: "bg-muted-foreground/50",
  [NODE_STATUS.DEGRADED]: "bg-warning",
  [NODE_STATUS.UNKNOWN]: "bg-muted-foreground/40",
};

/** Props for the NodeCard component. */
interface NodeCardProps {
  /** Unique node identifier (used for the detail page link). */
  id: string;
  /** Human-readable node name (e.g. "bng-jakarta-1"). */
  name: string;
  /** dawos-agent base URL (e.g. "http://192.168.1.10:8470"). */
  url: string;
  /** Current health status — online, offline, degraded, or unknown. */
  status: string;
  /** Optional physical location label. */
  location?: string | null;
  /** Timestamp of the last successful health check. */
  lastSeen?: Date | string | null;
  /** Optional human-readable uptime string (e.g. "2d 5h"). */
  uptime?: string | null;
  /** Optional CPU utilization percentage (0–100). */
  cpu?: number | null;
  /** Optional RAM utilization percentage (0–100). */
  ram?: number | null;
  /** Optional active session count. */
  sessions?: number | null;
  /** Optional recent traffic series for the sparkline. */
  sparkline?: number[];
  /** Optional tag chips. */
  tags?: string[];
  /** Optional restart action handler (quick action). */
  onRestart?: () => void;
}

/** Extract a `host:port` label from a base URL, falling back to the raw URL. */
function hostLabel(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** Small labeled utilization bar (2px, rounded). */
function UsageBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Node summary card for the dashboard/list grid.
 * Shows an LED status dot, name, host:port, uptime, CPU/RAM bars, a session
 * count badge, a 24h traffic sparkline, and tag chips. The whole card links to
 * the node detail page; quick-action buttons stop propagation.
 */
export function NodeCard({
  id,
  name,
  url,
  status,
  location,
  lastSeen,
  uptime,
  cpu,
  ram,
  sessions,
  sparkline,
  tags,
  onRestart,
}: NodeCardProps) {
  const led = ledStyles[status] ?? ledStyles[NODE_STATUS.UNKNOWN];
  const series = sparkline && sparkline.length > 0 ? sparkline : [1, 1];

  return (
    <Link href={`/nodes/${id}`} className="group block">
      <Card className="card-glow transition-transform group-hover:scale-[1.02] group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="space-y-4 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", led)}
                  aria-hidden="true"
                />
                <h3 className="truncate font-heading text-base font-semibold">
                  {name}
                </h3>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {hostLabel(url)}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <UsageBar label="CPU" value={cpu ?? 0} color="bg-primary" />
            <UsageBar label="RAM" value={ram ?? 0} color="bg-success" />
          </div>

          {/* Sparkline */}
          <svg
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="h-6 w-full text-primary/70"
            aria-hidden="true"
            data-testid="node-sparkline"
          >
            <polyline
              points={sparklinePoints(series, 100, 24)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">
                {location || "No location set"}
              </span>
              <span
                className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                title="Active sessions"
              >
                {sessions ?? 0} sess
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="Restart node"
                aria-label="Restart node"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRestart?.();
                }}
                className="press-scale rounded-md p-1 hover:bg-accent hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Node settings"
                aria-label="Node settings"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="press-scale rounded-md p-1 hover:bg-accent hover:text-foreground"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Uptime + last seen + tags */}
          {(uptime || lastSeen || (tags && tags.length > 0)) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
              {uptime && <span>Up {uptime}</span>}
              {lastSeen && <span>Last seen: {formatDate(lastSeen)}</span>}
              {tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent px-1.5 py-0.5 text-accent-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
