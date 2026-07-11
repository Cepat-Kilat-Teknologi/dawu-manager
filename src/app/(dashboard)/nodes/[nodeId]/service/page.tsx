"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Play, Square, RotateCcw, Power, Loader2 } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: string;
  pid?: number;
  uptime?: string;
  version?: string;
}

/**
 * Service management page.
 * Controls accel-ppp service lifecycle: start, stop, restart, shutdown.
 * Covers dawos-agent endpoints: service/status, service/action,
 * service/command, service/shutdown.
 */
export default function ServicePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useNodeProxy<ServiceStatus>(
    nodeId,
    "service/status",
    { refetchInterval: 10_000 },
  );

  const actionMutation = useNodeProxyMutation<{ action: string }>(
    nodeId,
    "service/action",
    {
      invalidates: ["service"],
      onSuccess: () => {
        toast.success(`Service ${confirmAction} completed`);
        setConfirmAction(null);
      },
    },
  );

  const shutdownMutation = useNodeProxyMutation<{ mode?: string }>(
    nodeId,
    "service/shutdown",
    {
      invalidates: ["service"],
      onSuccess: () => {
        toast.success("Shutdown initiated — active sessions will drain");
        setConfirmAction(null);
      },
    },
  );

  const isRunning = data?.status === "running" || data?.status === "active";

  const actions = [
    { key: "start", label: "Start", icon: Play, variant: "default" as const, disabled: isRunning },
    { key: "stop", label: "Stop", icon: Square, variant: "destructive" as const, disabled: !isRunning },
    { key: "restart", label: "Restart", icon: RotateCcw, variant: "outline" as const, disabled: !isRunning },
    { key: "shutdown", label: "Graceful Shutdown", icon: Power, variant: "outline" as const, disabled: !isRunning },
  ];

  return (
    <div className="space-y-4">
      <NodePageShell
        title="Service Control"
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
      >
        <div className="space-y-6">
          {/* Status card */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={isRunning ? "default" : "destructive"}>
                  {data?.status ?? "unknown"}
                </Badge>
              </CardContent>
            </Card>
            {data?.pid && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">PID</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-mono font-semibold">{data.pid}</p>
                </CardContent>
              </Card>
            )}
            {data?.uptime && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{data.uptime}</p>
                </CardContent>
              </Card>
            )}
            {data?.version && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Version</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{data.version}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant}
                disabled={action.disabled || actionMutation.isPending}
                onClick={() => setConfirmAction(action.key)}
              >
                {actionMutation.isPending && confirmAction === action.key ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <action.icon className="mr-2 h-4 w-4" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </NodePageShell>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`${confirmAction?.charAt(0).toUpperCase()}${confirmAction?.slice(1) ?? ""} Service`}
        description={
          confirmAction === "shutdown"
            ? "Graceful shutdown will stop accepting new sessions and wait for existing sessions to end. Are you sure?"
            : confirmAction === "stop"
              ? "Stopping the service will immediately disconnect all active PPPoE sessions. Are you sure?"
              : confirmAction === "restart"
                ? "Restarting accel-ppp drops all active PPPoE sessions at once; subscribers reconnect only after it is back up. Continue?"
                : `Are you sure you want to ${confirmAction} the accel-ppp service?`
        }
        confirmLabel={
          confirmAction === "stop" ||
          confirmAction === "shutdown" ||
          confirmAction === "restart"
            ? confirmAction
            : "Confirm"
        }
        variant={
          confirmAction === "stop" ||
          confirmAction === "shutdown" ||
          confirmAction === "restart"
            ? "destructive"
            : "default"
        }
        onConfirm={async () => {
          if (confirmAction === "shutdown") {
            await shutdownMutation.mutateAsync({});
          } else {
            await actionMutation.mutateAsync({ action: confirmAction! });
          }
        }}
      />
    </div>
  );
}
