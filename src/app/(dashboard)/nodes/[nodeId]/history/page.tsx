"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import {
  RefreshCw,
  Camera,
  Trash2,
  Loader2,
  Download,
  BarChart3,
} from "lucide-react";
import { formatValue } from "@/lib/utils";

/** A past session record from `sessions/history`. */
interface HistoryEntry {
  username?: string;
  ip?: string;
  calling_sid?: string;
  ifname?: string;
  start_time?: string;
  end_time?: string;
  duration?: string;
  terminate_cause?: string;
  [key: string]: unknown;
}

/** Stats summary from `sessions/history/stats`. */
interface HistoryStats {
  [key: string]: string | number | undefined;
}

/**
 * Session History page.
 * Lists past (disconnected) sessions, snapshot creation, history purge,
 * CSV export, and history statistics.
 * Covers dawos-agent endpoints: sessions/history, sessions/snapshot,
 * sessions/history/purge, sessions/history/stats, sessions/history/export.
 */
export default function HistoryPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [confirmPurge, setConfirmPurge] = useState(false);

  const history = useNodeProxy<HistoryEntry[]>(nodeId, "sessions/history", {
    extract: "records",
  });
  const historyStats = useNodeProxy<HistoryStats>(
    nodeId,
    "sessions/history/stats",
  );

  const snapshotMutation = useNodeProxyMutation(nodeId, "sessions/snapshot", {
    invalidates: ["sessions/history"],
    onSuccess: () => toast.success("Session snapshot created"),
  });

  const purgeMutation = useNodeProxyMutation(nodeId, "sessions/history/purge", {
    invalidates: ["sessions/history", "sessions/history/stats"],
    onSuccess: () => {
      toast.success("Session history purged");
      setConfirmPurge(false);
    },
  });

  function handleCsvExport() {
    const proxy = `/api/nodes/${encodeURIComponent(nodeId)}/proxy/sessions/history/export?format=csv`;
    const a = document.createElement("a");
    a.href = proxy;
    a.download = "session-history.csv";
    a.click();
  }

  const entries = history.data ?? [];

  const columns: ProxyColumn<HistoryEntry>[] = [
    {
      header: "Username",
      accessorKey: "username",
      className: "font-medium",
    },
    {
      header: "IP",
      accessorKey: "ip",
      className: "font-mono text-xs",
    },
    {
      header: "MAC",
      accessorKey: "calling_sid",
      className: "font-mono text-xs",
    },
    { header: "Interface", accessorKey: "ifname" },
    { header: "Start", accessorKey: "start_time" },
    { header: "End", accessorKey: "end_time" },
    { header: "Duration", accessorKey: "duration" },
    { header: "Cause", accessorKey: "terminate_cause" },
  ];

  /** Keys already shown in dedicated cards or too noisy for the stats grid. */
  const STATS_SKIP = new Set(["raw_output"]);

  return (
    <div className="space-y-6">
      {/* History stats */}
      <NodePageShell
        title="History Statistics"
        isLoading={historyStats.isLoading}
        error={historyStats.error}
        onRetry={() => historyStats.refetch()}
        isEmpty={
          historyStats.data !== null &&
          historyStats.data !== undefined &&
          Object.keys(historyStats.data).filter((k) => !STATS_SKIP.has(k))
            .length === 0
        }
        emptyMessage="No history statistics available."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => historyStats.refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        {historyStats.data && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(historyStats.data)
              .filter(([key]) => !STATS_SKIP.has(key))
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

      {/* Session history list */}
      <NodePageShell
        title={`Session History (${entries.length})`}
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
        isEmpty={entries.length === 0}
        emptyMessage="No session history entries. Create a snapshot to capture current sessions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => snapshotMutation.mutate({})}
              disabled={snapshotMutation.isPending}
            >
              {snapshotMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="mr-1.5 h-3.5 w-3.5" />
              )}
              Snapshot
            </Button>
            <Button variant="outline" size="sm" onClick={handleCsvExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmPurge(true)}
              disabled={purgeMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Purge
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => history.refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      >
        <ProxyDataTable
          columns={columns}
          data={entries}
          getRowKey={(r) =>
            `${r.username}-${r.start_time}-${r.calling_sid}`
          }
        />
      </NodePageShell>

      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={(open) => !open && setConfirmPurge(false)}
        title="Purge Session History"
        description="This will permanently delete all session history records from this node. This action cannot be undone."
        confirmLabel="Purge All"
        variant="destructive"
        onConfirm={async () => {
          await purgeMutation.mutateAsync({});
        }}
      />
    </div>
  );
}
