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

  // Scheduler
  const scheduler = useNodeProxy<SchedulerJob[]>(nodeId, "scheduler/jobs", { extract: "jobs" });

  // Zones
  const zones = useNodeProxy<Zone[]>(nodeId, "firewall/zones", { extract: "zones" });

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

      {/* VRRP + DNS + Limits + Bulk */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "VRRP", query: vrrp },
          { title: "DNS Forwarding", query: dns },
          { title: "Limits", query: limits },
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
    </div>
  );
}
