"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, Play, Loader2, Trash2 } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface DoctorCheck {
  name: string;
  status: string;
  detail?: string;
  severity?: string;
}

interface Playbook {
  name: string;
  description?: string;
  role_required?: string;
}

interface SchedulerJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

interface Zone {
  name: string;
  interfaces?: string[];
  policy?: string;
}

interface ConntrackEntry {
  protocol: string;
  src: string;
  dst: string;
  sport?: string;
  dport?: string;
  state?: string;
  timeout?: number;
}

/**
 * Diagnostics & advanced tools page.
 * Consolidates doctor, playbooks, limits, scheduler, zones,
 * VRRP, conntrack, flow, bulk, and DNS forwarding.
 * Covers dawos-agent endpoints across multiple categories.
 */
export default function DiagnosticsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  // Scheduler form state
  const [jobName, setJobName] = useState("");
  const [jobCommand, setJobCommand] = useState("");
  const [jobInterval, setJobInterval] = useState("");
  const [deleteJobName, setDeleteJobName] = useState("");
  const [runJobName, setRunJobName] = useState("");

  // Zone form state (Group 5)
  const [zoneName, setZoneName] = useState("");
  const [zoneInterfaces, setZoneInterfaces] = useState("");
  const [deleteZoneName, setDeleteZoneName] = useState("");

  // VRRP state (Group 6)
  const [failoverGroup, setFailoverGroup] = useState("");
  const [confirmFailover, setConfirmFailover] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Limits form state (Group 7)
  const [maxSessions, setMaxSessions] = useState("");
  const [maxStarting, setMaxStarting] = useState("");

  // Doctor checks
  const doctor = useNodeProxy<DoctorCheck[]>(nodeId, "diagnostics/doctor", { extract: "checks" });

  // Playbooks
  const playbooks = useNodeProxy<Playbook[]>(nodeId, "playbooks", { extract: "playbooks" });
  const runPlaybookMutation = useNodeProxyMutation<{ id: string }>(
    nodeId,
    "playbooks/run",
    {
      invalidates: ["playbooks"],
      onSuccess: () => toast.success("Playbook started"),
    },
  );

  // Scheduler mutations
  const createJobMutation = useNodeProxyMutation<{
    name: string;
    command: string;
    interval_seconds: number;
    enabled: boolean;
  }>(nodeId, "scheduler/jobs", {
    invalidates: ["scheduler"],
    onSuccess: () => {
      toast.success("Scheduler job created");
      setJobName("");
      setJobCommand("");
      setJobInterval("");
    },
  });

  const deleteJobMutation = useNodeProxyMutation(
    nodeId,
    `scheduler/jobs/${encodeURIComponent(deleteJobName || "_")}`,
    {
      method: "DELETE",
      invalidates: ["scheduler"],
      onSuccess: () => {
        toast.success("Scheduler job deleted");
        setDeleteJobName("");
      },
    },
  );

  const runJobMutation = useNodeProxyMutation(
    nodeId,
    `scheduler/jobs/${encodeURIComponent(runJobName || "_")}/run`,
    {
      invalidates: ["scheduler"],
      onSuccess: () => {
        toast.success("Job executed successfully");
        setRunJobName("");
      },
    },
  );

  // Zone mutations (Group 5)
  const createZoneMutation = useNodeProxyMutation<{
    name: string;
    interfaces: string[];
  }>(nodeId, "zones", {
    invalidates: ["zones"],
    onSuccess: () => {
      toast.success("Zone created");
      setZoneName("");
      setZoneInterfaces("");
    },
  });

  const deleteZoneMutation = useNodeProxyMutation(
    nodeId,
    `zones/${encodeURIComponent(deleteZoneName || "_")}`,
    {
      method: "DELETE",
      invalidates: ["zones"],
      onSuccess: () => {
        toast.success("Zone deleted");
        setDeleteZoneName("");
      },
    },
  );

  // VRRP mutations (Group 6)
  const failoverMutation = useNodeProxyMutation<{ group: string }>(
    nodeId,
    "vrrp/failover",
    {
      invalidates: ["vrrp"],
      onSuccess: () => {
        toast.success("VRRP failover initiated");
        setConfirmFailover(false);
      },
    },
  );

  const restartVrrpMutation = useNodeProxyMutation(
    nodeId,
    "vrrp/restart",
    {
      invalidates: ["vrrp"],
      onSuccess: () => {
        toast.success("VRRP service restarted");
        setConfirmRestart(false);
      },
    },
  );

  // Limits mutation (Group 7)
  const updateLimitsMutation = useNodeProxyMutation<{
    max_sessions?: number;
    max_starting?: number;
  }>(nodeId, "limits", {
    method: "PUT",
    invalidates: ["limits"],
    onSuccess: () => {
      toast.success("Limits updated");
      setMaxSessions("");
      setMaxStarting("");
    },
  });

  function handleCreateJob() {
    const name = jobName.trim();
    const command = jobCommand.trim();
    const interval = parseInt(jobInterval, 10);
    if (!name) {
      toast.error("Job name is required");
      return;
    }
    if (!command) {
      toast.error("Command is required");
      return;
    }
    if (!jobInterval.trim() || isNaN(interval) || interval < 10) {
      toast.error("Interval must be at least 10 seconds");
      return;
    }
    createJobMutation.mutate({
      name,
      command,
      interval_seconds: interval,
      enabled: true,
    });
  }

  function handleCreateZone() {
    const name = zoneName.trim();
    if (!name) {
      toast.error("Zone name is required");
      return;
    }
    const ifaces = zoneInterfaces
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    createZoneMutation.mutate({ name, interfaces: ifaces });
  }

  function handleUpdateLimits() {
    const sessions = maxSessions.trim() ? parseInt(maxSessions, 10) : undefined;
    const starting = maxStarting.trim() ? parseInt(maxStarting, 10) : undefined;
    if (sessions === undefined && starting === undefined) {
      toast.error("Provide at least one limit value");
      return;
    }
    if (sessions !== undefined && (isNaN(sessions) || sessions < 1)) {
      toast.error("Max sessions must be a positive integer");
      return;
    }
    if (starting !== undefined && (isNaN(starting) || starting < 1)) {
      toast.error("Max starting must be a positive integer");
      return;
    }
    const body: { max_sessions?: number; max_starting?: number } = {};
    if (sessions !== undefined) body.max_sessions = sessions;
    if (starting !== undefined) body.max_starting = starting;
    updateLimitsMutation.mutate(body);
  }

  // Scheduler
  const scheduler = useNodeProxy<SchedulerJob[]>(nodeId, "scheduler/jobs", { extract: "jobs" });

  // Zones — dawos-agent serves zones at /api/v1/zones (NOT firewall/zones)
  const zones = useNodeProxy<Zone[]>(nodeId, "zones", { extract: "zones" });

  // VRRP
  const vrrp = useNodeProxy<Record<string, unknown>>(nodeId, "vrrp/status");

  // Conntrack
  const conntrack = useNodeProxy<ConntrackEntry[]>(nodeId, "conntrack/entries", { extract: "entries" });

  // Flow — returns stats object, not array
  const flow = useNodeProxy<Record<string, unknown>>(nodeId, "flow/stats");

  // Bulk operations
  const bulk = useNodeProxy<Record<string, unknown>>(nodeId, "bulk/status");

  // DNS Forwarding
  const dns = useNodeProxy<Record<string, unknown>>(nodeId, "dns/forwarding");

  // Limits
  const limits = useNodeProxy<Record<string, unknown>>(nodeId, "limits");

  const doctorColumns: ProxyColumn<DoctorCheck>[] = [
    { header: "Check", accessorKey: "name", className: "font-medium" },
    {
      header: "Status",
      cell: (row) => {
        const variant =
          row.status === "ok" || row.status === "pass"
            ? "default"
            : row.status === "warn" || row.status === "warning"
              ? "outline"
              : "destructive";
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    { header: "Detail", accessorKey: "detail" },
  ];

  const playbookColumns: ProxyColumn<Playbook>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Description", accessorKey: "description" },
    { header: "Role", accessorKey: "role_required" },
    {
      header: "Action",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => runPlaybookMutation.mutate({ id: row.name })}
          disabled={runPlaybookMutation.isPending}
        >
          {runPlaybookMutation.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1 h-3.5 w-3.5" />
          )}
          Run
        </Button>
      ),
    },
  ];

  const schedulerColumns: ProxyColumn<SchedulerJob>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Schedule", accessorKey: "schedule", className: "font-mono text-xs" },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant={row.enabled ? "default" : "outline"}>
          {row.enabled ? "enabled" : "disabled"}
        </Badge>
      ),
    },
    { header: "Last Run", accessorKey: "last_run" },
    { header: "Next Run", accessorKey: "next_run" },
    {
      header: "Action",
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRunJobName(String(row.name ?? ""))}
            disabled={runJobMutation.isPending}
          >
            {runJobMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1 h-3.5 w-3.5" />
            )}
            Run
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteJobName(String(row.name ?? ""))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const zoneColumns: ProxyColumn<Zone>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    {
      header: "Interfaces",
      cell: (row) => (
        <span className="font-mono text-xs">{row.interfaces?.join(", ") ?? "-"}</span>
      ),
    },
    { header: "Policy", accessorKey: "policy" },
    {
      header: "Action",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteZoneName(String(row.name ?? ""))}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  const conntrackColumns: ProxyColumn<ConntrackEntry>[] = [
    { header: "Protocol", accessorKey: "protocol" },
    { header: "Source", accessorKey: "src", className: "font-mono text-xs" },
    { header: "Destination", accessorKey: "dst", className: "font-mono text-xs" },
    { header: "S.Port", accessorKey: "sport" },
    { header: "D.Port", accessorKey: "dport" },
    { header: "State", accessorKey: "state" },
    { header: "Timeout", accessorKey: "timeout" },
  ];

  return (
    <div className="space-y-6">
      {/* Doctor */}
      <NodePageShell
        title="System Doctor"
        isLoading={doctor.isLoading}
        error={doctor.error}
        onRetry={() => doctor.refetch()}
        isEmpty={doctor.data?.length === 0}
        emptyMessage="No doctor checks available."
        actions={
          <Button variant="outline" size="sm" onClick={() => doctor.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Run Checks
          </Button>
        }
      >
        <ProxyDataTable
          columns={doctorColumns}
          data={doctor.data ?? []}
          getRowKey={(r) => r.name}
        />
      </NodePageShell>

      {/* Playbooks + Scheduler */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NodePageShell
          title={`Playbooks (${playbooks.data?.length ?? 0})`}
          isLoading={playbooks.isLoading}
          error={playbooks.error}
          onRetry={() => playbooks.refetch()}
          isEmpty={playbooks.data?.length === 0}
          emptyMessage="No playbooks defined."
        >
          <ProxyDataTable
            columns={playbookColumns}
            data={playbooks.data ?? []}
            getRowKey={(r) => r.name}
          />
        </NodePageShell>

        <NodePageShell
          title={`Scheduler Jobs (${scheduler.data?.length ?? 0})`}
          isLoading={scheduler.isLoading}
          error={scheduler.error}
          onRetry={() => scheduler.refetch()}
          isEmpty={scheduler.data?.length === 0}
          emptyMessage="No scheduled jobs."
        >
          <ProxyDataTable
            columns={schedulerColumns}
            data={scheduler.data ?? []}
            getRowKey={(r) => r.id}
          />
        </NodePageShell>
      </div>

      {/* Create Scheduler Job */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Create Scheduler Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="job-name">Job Name</Label>
              <Input
                id="job-name"
                placeholder="daily-backup"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-command">Command</Label>
              <Input
                id="job-command"
                placeholder="/usr/bin/backup.sh"
                className="font-mono"
                value={jobCommand}
                onChange={(e) => setJobCommand(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-interval">Interval (seconds)</Label>
              <Input
                id="job-interval"
                type="number"
                min={10}
                placeholder="3600"
                value={jobInterval}
                onChange={(e) => setJobInterval(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreateJob}
            disabled={createJobMutation.isPending}
          >
            {createJobMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Create Job
          </Button>
        </CardContent>
      </Card>

      {/* VRRP (Group 6) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">VRRP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vrrp.isLoading ? (
            <div className="animate-pulse h-6 w-20 rounded bg-muted" />
          ) : vrrp.error ? (
            <Badge variant="outline">unavailable</Badge>
          ) : vrrp.data ? (
            <dl className="grid gap-1 text-xs">
              {Object.entries(vrrp.data)
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-mono">{formatValue(v)}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <span className="text-xs text-muted-foreground">No data</span>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="failover-group">VRRP Group</Label>
              <Input
                id="failover-group"
                placeholder="group1"
                value={failoverGroup}
                onChange={(e) => setFailoverGroup(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={failoverMutation.isPending}
              onClick={() => {
                if (!failoverGroup.trim()) {
                  toast.error("VRRP group is required");
                  return;
                }
                setConfirmFailover(true);
              }}
            >
              {failoverMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Failover
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={restartVrrpMutation.isPending}
              onClick={() => setConfirmRestart(true)}
            >
              {restartVrrpMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Restart VRRP
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Limits (Group 7) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Session Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {limits.isLoading ? (
            <div className="animate-pulse h-6 w-20 rounded bg-muted" />
          ) : limits.error ? (
            <Badge variant="outline">unavailable</Badge>
          ) : limits.data ? (
            <dl className="grid gap-1 text-xs">
              {Object.entries(limits.data)
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-mono">{formatValue(v)}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <span className="text-xs text-muted-foreground">No data</span>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="max-sessions">Max Sessions</Label>
              <Input
                id="max-sessions"
                type="number"
                min={1}
                placeholder="10000"
                value={maxSessions}
                onChange={(e) => setMaxSessions(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-starting">Max Starting</Label>
              <Input
                id="max-starting"
                type="number"
                min={1}
                placeholder="100"
                value={maxStarting}
                onChange={(e) => setMaxStarting(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleUpdateLimits}
            disabled={updateLimitsMutation.isPending}
          >
            {updateLimitsMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Update Limits
          </Button>
        </CardContent>
      </Card>

      {/* DNS + Bulk status cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {[
          { title: "DNS Forwarding", query: dns },
          { title: "Bulk Operations", query: bulk },
        ].map(({ title, query }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <div className="animate-pulse h-6 w-20 rounded bg-muted" />
              ) : query.error ? (
                <Badge variant="outline">unavailable</Badge>
              ) : query.data ? (
                <dl className="grid gap-1 text-xs">
                  {Object.entries(query.data)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                        <dd className="font-mono">{formatValue(v)}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <span className="text-xs text-muted-foreground">No data</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Zones */}
      <NodePageShell
        title={`Firewall Zones (${zones.data?.length ?? 0})`}
        isLoading={zones.isLoading}
        error={zones.error}
        onRetry={() => zones.refetch()}
        isEmpty={zones.data?.length === 0}
        emptyMessage="No firewall zones defined."
      >
        <ProxyDataTable columns={zoneColumns} data={zones.data ?? []} getRowKey={(r) => r.name} />
      </NodePageShell>

      {/* Create Zone (Group 5) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Create Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Zone Name</Label>
              <Input
                id="zone-name"
                placeholder="dmz"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-interfaces">Interfaces (comma-separated)</Label>
              <Input
                id="zone-interfaces"
                placeholder="eth0, eth1"
                className="font-mono"
                value={zoneInterfaces}
                onChange={(e) => setZoneInterfaces(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreateZone}
            disabled={createZoneMutation.isPending}
          >
            {createZoneMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Create Zone
          </Button>
        </CardContent>
      </Card>

      {/* Conntrack */}
      <NodePageShell
        title={`Conntrack Entries (${conntrack.data?.length ?? 0})`}
        isLoading={conntrack.isLoading}
        error={conntrack.error}
        onRetry={() => conntrack.refetch()}
        isEmpty={conntrack.data?.length === 0}
        emptyMessage="No conntrack entries."
        actions={
          <Button variant="outline" size="sm" onClick={() => conntrack.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable
          columns={conntrackColumns}
          data={conntrack.data ?? []}
          getRowKey={(r) => `${r.protocol}-${r.src}-${r.dst}-${r.sport}-${r.dport}`}
        />
      </NodePageShell>

      {/* Flow Stats */}
      <NodePageShell
        title="Flow Statistics"
        isLoading={flow.isLoading}
        error={flow.error}
        onRetry={() => flow.refetch()}
        actions={
          <Button variant="outline" size="sm" onClick={() => flow.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <dl className="grid gap-2 text-sm">
          {flow.data &&
            Object.entries(flow.data)
              .filter(([k]) => k !== "raw_output")
              .map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
        </dl>
      </NodePageShell>

      {/* Scheduler ConfirmDialogs */}
      <ConfirmDialog
        open={!!deleteJobName}
        onOpenChange={() => setDeleteJobName("")}
        title="Delete Scheduler Job"
        description={`Permanently delete scheduler job "${deleteJobName}"? Scheduled executions will stop immediately.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteJobMutation.mutate({})}
      />
      <ConfirmDialog
        open={!!runJobName}
        onOpenChange={() => setRunJobName("")}
        title="Run Scheduler Job"
        description={`Execute scheduler job "${runJobName}" immediately? This triggers the job outside its regular schedule.`}
        confirmLabel="Run"
        onConfirm={() => runJobMutation.mutate({})}
      />

      {/* Zone ConfirmDialog (Group 5) */}
      <ConfirmDialog
        open={!!deleteZoneName}
        onOpenChange={() => setDeleteZoneName("")}
        title="Delete Zone"
        description={`Permanently delete firewall zone "${deleteZoneName}"? All zone rules and interface bindings will be removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteZoneMutation.mutate({})}
      />

      {/* VRRP ConfirmDialogs (Group 6) */}
      <ConfirmDialog
        open={confirmFailover}
        onOpenChange={() => setConfirmFailover(false)}
        title="VRRP Failover"
        description={`Initiate VRRP failover for group "${failoverGroup}"? This forces a master transition and may briefly interrupt traffic.`}
        confirmLabel="Failover"
        variant="destructive"
        onConfirm={() => failoverMutation.mutate({ group: failoverGroup.trim() })}
      />
      <ConfirmDialog
        open={confirmRestart}
        onOpenChange={() => setConfirmRestart(false)}
        title="Restart VRRP"
        description="Restart the VRRP service? All VRRP groups will re-negotiate master/backup roles, causing brief traffic interruption."
        confirmLabel="Restart"
        variant="destructive"
        onConfirm={() => restartVrrpMutation.mutate({})}
      />
    </div>
  );
}
