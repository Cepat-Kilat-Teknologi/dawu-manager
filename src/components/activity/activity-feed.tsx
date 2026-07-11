"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkeletonText } from "@/components/shared/skeleton-blocks";
import {
  formatActivity,
  formatDetail,
  type ActivityTone,
} from "@/lib/activity-format";
import {
  Search,
  RefreshCw,
  Radio,
  Server,
  Activity as ActivityIcon,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  ts: string;
  actor: string;
  nodeId: string | null;
  nodeName: string | null;
  action: string;
  detail: string | null;
}

/** Options for the node filter dropdown. */
export interface ActivityNodeOption {
  id: string;
  name: string;
}

const TONE_DOT: Record<ActivityTone, string> = {
  create: "bg-success",
  update: "bg-primary",
  destructive: "bg-destructive",
  default: "bg-muted-foreground",
};

/** Poll interval for the "live" feed (ms). */
const REFRESH_MS = 10_000;

interface ActivityFeedProps {
  nodes: ActivityNodeOption[];
}

/**
 * Live, cross-node activity timeline. Polls /api/activity on an interval and
 * renders operator actions (session terminations, config applies, node CRUD…)
 * newest-first, with a node filter and free-text search. Auto-refreshes so a
 * NOC operator sees fleet activity without reloading.
 */
export function ActivityFeed({ nodes }: ActivityFeedProps) {
  const [nodeId, setNodeId] = useState("");
  const [search, setSearch] = useState("");

  const query = useQuery<{ items: ActivityItem[] }>({
    queryKey: ["activity", nodeId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (nodeId) params.set("nodeId", nodeId);
      const res = await fetch(`/api/activity?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const items = query.data?.items ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? items.filter((it) => {
        const label = formatActivity(it.action).label.toLowerCase();
        return (
          label.includes(term) ||
          it.actor.toLowerCase().includes(term) ||
          (it.nodeName ?? "").toLowerCase().includes(term)
        );
      })
    : items;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              query.isFetching ? "bg-success animate-led-pulse" : "bg-success",
            )}
            aria-hidden="true"
          />
          Live
        </span>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search action, user, node…"
            className="h-9 pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          aria-label="Filter by node"
          className="h-9 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All nodes</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={cn("mr-1.5 h-3.5 w-3.5", query.isFetching && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4">
              <SkeletonText lines={8} />
            </div>
          ) : query.error ? (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Could not load activity.
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Radio className="h-8 w-8" />
              <p className="font-medium text-foreground">No activity yet</p>
              <p>Operator actions across your nodes will appear here in real time.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border content-fade-in">
              {filtered.map((it) => {
                const { label, tone } = formatActivity(it.action);
                const detail = formatDetail(it.detail);
                return (
                  <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{it.actor}</span>{" "}
                        <span className="text-muted-foreground">{label}</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {it.nodeName && (
                          <span className="inline-flex items-center gap-1">
                            <Server className="h-3 w-3" aria-hidden="true" />
                            {it.nodeName}
                          </span>
                        )}
                        {detail && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <ActivityIcon className="h-3 w-3" aria-hidden="true" />
                            {detail}
                          </span>
                        )}
                      </div>
                    </div>
                    <time
                      className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                      dateTime={it.ts}
                      title={new Date(it.ts).toLocaleString()}
                    >
                      {formatDistanceToNow(new Date(it.ts), { addSuffix: true })}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
