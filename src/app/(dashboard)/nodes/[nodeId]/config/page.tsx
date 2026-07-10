"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { RefreshCw, Save, Undo2, CheckCircle, Loader2 } from "lucide-react";

interface ConfigBackup {
  name: string;
  created: string;
  size?: number;
  path?: string;
}

/**
 * Configuration management page.
 * View, apply, rollback, and manage accel-ppp configuration and backups.
 * Covers dawos-agent endpoints: config, config/apply, config/confirm,
 * config/rollback, config/backups, config/revisions, config/diff.
 */
export default function ConfigPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const config = useNodeProxy<{ path: string; content: string; last_modified: string }>(nodeId, "config");
  const backups = useNodeProxy<ConfigBackup[]>(nodeId, "config/backups");
  const revisions = useNodeProxy<Record<string, unknown>[]>(nodeId, "config/revisions", { extract: "revisions" });

  const applyMutation = useNodeProxyMutation(nodeId, "config/apply", {
    invalidates: ["config"],
    onSuccess: () => {
      toast.success("Configuration applied");
      setConfirmAction(null);
    },
  });

  const confirmMutation = useNodeProxyMutation(nodeId, "config/confirm", {
    invalidates: ["config"],
    onSuccess: () => {
      toast.success("Configuration confirmed");
      setConfirmAction(null);
    },
  });

  const rollbackMutation = useNodeProxyMutation(nodeId, "config/rollback", {
    invalidates: ["config"],
    onSuccess: () => {
      toast.success("Configuration rolled back");
      setConfirmAction(null);
    },
  });

  const backupColumns: ProxyColumn<ConfigBackup>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Created", accessorKey: "created" },
    { header: "Size", cell: (row) => (row.size ? `${Math.round(row.size / 1024)} KB` : "—") },
  ];

  return (
    <div className="space-y-6">
      {/* Current config */}
      <NodePageShell
        title="Current Configuration"
        isLoading={config.isLoading}
        error={config.error}
        onRetry={() => config.refetch()}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction("apply")} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Apply
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmAction("confirm")} disabled={confirmMutation.isPending}>
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Confirm
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmAction("rollback")} disabled={rollbackMutation.isPending}>
              <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Rollback
            </Button>
          </div>
        }
      >
        <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
          {config.data?.content ?? "No data"}
        </pre>
      </NodePageShell>

      {/* Backups */}
      <NodePageShell
        title={`Backups (${backups.data?.length ?? 0})`}
        isLoading={backups.isLoading}
        error={backups.error}
        onRetry={() => backups.refetch()}
        isEmpty={backups.data?.length === 0}
        emptyMessage="No configuration backups available."
      >
        <ProxyDataTable columns={backupColumns} data={backups.data ?? []} getRowKey={(r) => r.name} />
      </NodePageShell>

      {/* Revisions */}
      <NodePageShell
        title={`Revisions (${revisions.data?.length ?? 0})`}
        isLoading={revisions.isLoading}
        error={revisions.error}
        onRetry={() => revisions.refetch()}
        isEmpty={revisions.data?.length === 0}
        emptyMessage="No configuration revisions."
        actions={
          <Button variant="outline" size="sm" onClick={() => revisions.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable
          columns={[
            { header: "Name", accessorKey: "name", className: "font-medium" },
            { header: "Created", accessorKey: "created" },
            { header: "Size", cell: (row: Record<string, unknown>) => (row.size ? `${Math.round(Number(row.size) / 1024)} KB` : "—") },
          ]}
          data={revisions.data ?? []}
        />
      </NodePageShell>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`${confirmAction?.charAt(0).toUpperCase()}${confirmAction?.slice(1) ?? ""} Configuration`}
        description={
          confirmAction === "rollback"
            ? "This will revert to the previous configuration and disconnect active sessions. Are you sure?"
            : confirmAction === "apply"
              ? "Apply the pending configuration changes? Active sessions may be affected."
              : "Confirm the currently applied configuration?"
        }
        confirmLabel={confirmAction ?? "Confirm"}
        variant={confirmAction === "rollback" ? "destructive" : "default"}
        onConfirm={async () => {
          if (confirmAction === "apply") await applyMutation.mutateAsync({});
          else if (confirmAction === "confirm") await confirmMutation.mutateAsync({});
          else await rollbackMutation.mutateAsync({});
        }}
      />
    </div>
  );
}
