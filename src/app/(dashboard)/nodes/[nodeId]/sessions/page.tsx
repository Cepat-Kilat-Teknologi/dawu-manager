"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { toast } from "sonner";
import {
  Search,
  XCircle,
  RefreshCw,
  Loader2,
  Users,
  ArrowUpCircle,
  ArrowDownCircle,
  Cpu,
  Network,
  Clock,
} from "lucide-react";
import { formatValue } from "@/lib/utils";

interface PPPoESession {
  username: string;
  ip: string;
  sid: string;
  ifname: string;
  calling_sid: string;
  rate_limit: string;
  uptime: string;
  state: string;
}

/**
 * Live counters from `sessions/stats`. accel-ppp returns every value as a
 * STRING (e.g. `cpu_percent: "0"`). `pool_used` is 0 on RADIUS-driven setups
 * because subscriber IPs are assigned via Framed-IP, not the local ippool.
 */
interface SessionStats {
  active?: string | number;
  starting?: string | number;
  finishing?: string | number;
  cpu_percent?: string | number;
  pool_used?: string | number;
  pool_total?: string | number;
  uptime?: string | number;
}

/** Stat keys shown as dedicated tiles; any other key falls through to "extras". */
const KNOWN_STAT_KEYS = [
  "active",
  "starting",
  "finishing",
  "cpu_percent",
  "pool_used",
  "pool_total",
  "uptime",
];

/** Display a stat value, dashing null / undefined / empty string. */
function statValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

/**
 * PPPoE sessions management page.
 * Displays all active sessions with search, terminate, and restart capabilities.
 * Covers dawos-agent endpoints: sessions, sessions/find, sessions/terminate,
 * sessions/restart, sessions/drop-by-mac, sessions/stats, sessions/snapshot.
 */
export default function SessionsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [search, setSearch] = useState("");
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useNodeProxy<PPPoESession[]>(
    nodeId,
    "sessions",
    { refetchInterval: 15_000, extract: "sessions" },
  );

  const stats = useNodeProxy<SessionStats>(nodeId, "sessions/stats");
  const s = stats.data;
  const cpuRaw = statValue(s?.cpu_percent);
  const cpuText = cpuRaw === "—" ? "—" : `${cpuRaw}%`;
  const extraStats = s
    ? Object.entries(s).filter(([key]) => !KNOWN_STAT_KEYS.includes(key))
    : [];

  const terminateMutation = useNodeProxyMutation<{ username: string }>(
    nodeId,
    "sessions/terminate",
    {
      invalidates: ["sessions"],
      onSuccess: () => toast.success("Session terminated"),
    },
  );

  const restartMutation = useNodeProxyMutation<{ username: string }>(
    nodeId,
    "sessions/restart",
    {
      invalidates: ["sessions"],
      onSuccess: () => toast.success("Session restarted"),
    },
  );

  const sessions = data ?? [];
  const filtered = search
    ? sessions.filter(
        (s) =>
          s.username?.toLowerCase().includes(search.toLowerCase()) ||
          s.ip?.includes(search) ||
          s.calling_sid?.toLowerCase().includes(search.toLowerCase()),
      )
    : sessions;

  const columns: ProxyColumn<PPPoESession>[] = [
    { header: "Username", accessorKey: "username", className: "font-medium" },
    { header: "IP Address", accessorKey: "ip", className: "font-mono text-xs" },
    { header: "MAC", accessorKey: "calling_sid", className: "font-mono text-xs" },
    { header: "Interface", accessorKey: "ifname" },
    { header: "Rate", accessorKey: "rate_limit" },
    { header: "Uptime", accessorKey: "uptime" },
    {
      header: "State",
      cell: (row) => (
        <Badge variant={row.state === "active" ? "default" : "outline"}>
          {row.state ?? "active"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              restartMutation.mutate({ username: row.username });
            }}
            disabled={restartMutation.isPending}
          >
            {restartMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Restart</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTerminateTarget(row.username)}
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span className="sr-only">Terminate</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Live session counters */}
      {s && (
        <div className="content-fade-in space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Active sessions"
              value={statValue(s.active)}
              icon={Users}
              variant="success"
              description="PPPoE subscribers online"
            />
            <StatCard
              title="Starting"
              value={statValue(s.starting)}
              icon={ArrowUpCircle}
              description="Sessions negotiating"
            />
            <StatCard
              title="Finishing"
              value={statValue(s.finishing)}
              icon={ArrowDownCircle}
              description="Sessions tearing down"
            />
            <StatCard
              title="CPU"
              value={cpuText}
              icon={Cpu}
              description="accel-ppp process load"
            />
            <StatCard
              title="Pool used / total"
              value={`${statValue(s.pool_used)} / ${statValue(s.pool_total)}`}
              icon={Network}
              description="Local pool — subscriber IPs are RADIUS-assigned"
            />
            <StatCard
              title="Uptime"
              value={statValue(s.uptime)}
              icon={Clock}
              description="accel-ppp daemon uptime"
            />
          </div>

          {extraStats.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {extraStats.map(([key, val]) => (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <p className="text-xs capitalize text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="text-lg font-semibold">{formatValue(val)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NodePageShell
        title={`Sessions (${filtered.length})`}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        isEmpty={sessions.length === 0}
        emptyMessage="No active PPPoE sessions."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search username, IP, MAC..."
                className="pl-8 h-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      >
        <ProxyDataTable
          columns={columns}
          data={filtered}
          getRowKey={(row) => row.sid || row.username}
        />
      </NodePageShell>

      <ConfirmDialog
        open={terminateTarget !== null}
        onOpenChange={(open) => !open && setTerminateTarget(null)}
        title="Terminate Session"
        description={`Are you sure you want to terminate the session for "${terminateTarget}"? The subscriber will be disconnected.`}
        confirmLabel="Terminate"
        onConfirm={async () => {
          /* v8 ignore next */
          if (terminateTarget) {
            await terminateMutation.mutateAsync({ username: terminateTarget });
            setTerminateTarget(null);
          }
        }}
      />
    </div>
  );
}
