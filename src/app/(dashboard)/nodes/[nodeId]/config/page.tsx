"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import {
  RefreshCw,
  Save,
  Undo2,
  CheckCircle,
  Loader2,
  Pencil,
  X,
} from "lucide-react";

interface ConfigBackup {
  name: string;
  created: string;
  size?: number;
  path?: string;
}

interface ConfigData {
  path: string;
  content: string;
  last_modified: string;
}

/**
 * Configuration management page.
 * View and inline-edit accel-ppp configuration, apply/confirm/rollback the
 * guarded-apply workflow, and browse backups and revisions.
 * Covers dawos-agent endpoints: config, config/apply, config/confirm,
 * config/rollback, config/backups, config/revisions.
 */
export default function ConfigPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const config = useNodeProxy<ConfigData>(nodeId, "config");
  const backups = useNodeProxy<ConfigBackup[]>(nodeId, "config/backups");
  const revisions = useNodeProxy<Record<string, unknown>[]>(nodeId, "config/revisions", { extract: "revisions" });

  const applyMutation = useNodeProxyMutation(nodeId, "config/apply", {
    invalidates: ["config"],
    onSuccess: () => {
      toast.success("Configuration applied", {
        description: "Confirm within the guard window to keep it, or it rolls back.",
      });
      setConfirmAction(null);
      setEditing(false);
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
      setEditing(false);
    },
  });

  /** Enter edit mode, seeding the draft from the currently loaded config. */
  function startEditing() {
    setDraft(config.data?.content ?? "");
    setEditing(true);
  }

  const backupColumns: ProxyColumn<ConfigBackup>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    { header: "Created", accessorKey: "created" },
    { header: "Size", cell: (row) => (row.size ? `${Math.round(row.size / 1024)} KB` : "—") },
  ];

  return (
    <div className="space-y-6">
      {/* Current config — view + inline edit */}
      <NodePageShell
        title="Current Configuration"
        isLoading={config.isLoading}
        error={config.error}
        onRetry={() => config.refetch()}
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => applyMutation.mutate({ content: draft })}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                {applyMutation.isPending ? "Saving…" : "Save & Apply"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={applyMutation.isPending}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={startEditing}
                disabled={!config.data}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction("confirm")}
                disabled={confirmMutation.isPending}
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Confirm
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction("rollback")}
                disabled={rollbackMutation.isPending}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Rollback
              </Button>
            </div>
          )
        }
      >
        {editing ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Editing{" "}
              <span className="font-mono">{config.data?.path ?? "config"}</span>.
              Saving applies with a guard timer — press Confirm afterwards to keep
              the change, otherwise it auto-rolls back.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label="Configuration content"
              className="h-96 w-full resize-y rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : (
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
            {config.data?.content ?? "No data"}
          </pre>
        )}
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
        title={confirmAction === "rollback" ? "Rollback Configuration" : "Confirm Configuration"}
        description={
          confirmAction === "rollback"
            ? "This will revert to the previous configuration and may disconnect active sessions. Are you sure?"
            : "Confirm the currently applied configuration so it persists past the guard window?"
        }
        confirmLabel={confirmAction ?? "Confirm"}
        variant={confirmAction === "rollback" ? "destructive" : "default"}
        onConfirm={async () => {
          if (confirmAction === "confirm") await confirmMutation.mutateAsync({});
          else await rollbackMutation.mutateAsync({});
        }}
      />
    </div>
  );
}
