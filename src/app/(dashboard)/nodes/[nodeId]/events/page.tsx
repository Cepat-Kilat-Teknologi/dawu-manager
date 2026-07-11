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
import { RefreshCw, Loader2, Trash2 } from "lucide-react";

interface EventHook {
  id: string;
  event: string;
  action: string;
  enabled: boolean;
  description?: string;
}

interface EventHistoryEntry {
  timestamp: string;
  event: string;
  detail?: string;
  source?: string;
}

/**
 * Events management page.
 * Displays event hooks and event history.
 * Covers dawos-agent endpoints: events/hooks (GET/POST/DELETE),
 * events/fire, events/history.
 */
export default function EventsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  // Hook create form state
  const [hookName, setHookName] = useState("");
  const [hookEvent, setHookEvent] = useState("");
  const [hookAction, setHookAction] = useState("");

  // Hook delete state
  const [deleteHookName, setDeleteHookName] = useState("");

  const hooks = useNodeProxy<EventHook[]>(nodeId, "events/hooks", { extract: "hooks" });
  const history = useNodeProxy<EventHistoryEntry[]>(nodeId, "events/history", {
    refetchInterval: 15_000,
    extract: "entries",
  });

  const fireMutation = useNodeProxyMutation<{ event: string }>(
    nodeId,
    "events/fire",
    {
      invalidates: ["events"],
      onSuccess: () => toast.success("Event fired"),
    },
  );

  // Hook create mutation (Group 7)
  const createHookMutation = useNodeProxyMutation<{
    name: string;
    event: string;
    action: string;
    enabled: boolean;
  }>(nodeId, "events/hooks", {
    invalidates: ["events"],
    onSuccess: () => {
      toast.success("Event hook created");
      setHookName("");
      setHookEvent("");
      setHookAction("");
    },
  });

  // Hook delete mutation (Group 7)
  const deleteHookMutation = useNodeProxyMutation(
    nodeId,
    `events/hooks/${encodeURIComponent(deleteHookName || "_")}`,
    {
      method: "DELETE",
      invalidates: ["events"],
      onSuccess: () => {
        toast.success("Event hook deleted");
        setDeleteHookName("");
      },
    },
  );

  function handleCreateHook() {
    const name = hookName.trim();
    const event = hookEvent.trim();
    const action = hookAction.trim();
    if (!name) {
      toast.error("Hook name is required");
      return;
    }
    if (!event) {
      toast.error("Event type is required");
      return;
    }
    if (!action) {
      toast.error("Action is required");
      return;
    }
    createHookMutation.mutate({ name, event, action, enabled: true });
  }

  const hookColumns: ProxyColumn<EventHook>[] = [
    { header: "Event", accessorKey: "event", className: "font-medium" },
    { header: "Action", accessorKey: "action", className: "font-mono text-xs" },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant={row.enabled ? "default" : "outline"}>
          {row.enabled ? "enabled" : "disabled"}
        </Badge>
      ),
    },
    { header: "Description", accessorKey: "description" },
    {
      header: "Test",
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fireMutation.mutate({ event: row.event })}
            disabled={fireMutation.isPending}
          >
            Fire
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteHookName(String(row.event ?? ""))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const historyColumns: ProxyColumn<EventHistoryEntry>[] = [
    { header: "Time", accessorKey: "timestamp" },
    { header: "Event", accessorKey: "event", className: "font-medium" },
    { header: "Detail", accessorKey: "detail" },
    { header: "Source", accessorKey: "source" },
  ];

  return (
    <div className="space-y-6">
      <NodePageShell
        title={`Event Hooks (${hooks.data?.length ?? 0})`}
        isLoading={hooks.isLoading}
        error={hooks.error}
        onRetry={() => hooks.refetch()}
        isEmpty={hooks.data?.length === 0}
        emptyMessage="No event hooks configured."
        actions={
          <Button variant="outline" size="sm" onClick={() => hooks.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={hookColumns} data={hooks.data ?? []} getRowKey={(r) => r.id} />
      </NodePageShell>

      {/* Create Event Hook (Group 7) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Create Event Hook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="hook-name">Hook Name</Label>
              <Input
                id="hook-name"
                placeholder="notify-on-connect"
                value={hookName}
                onChange={(e) => setHookName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hook-event">Event Type</Label>
              <Input
                id="hook-event"
                placeholder="session-up"
                value={hookEvent}
                onChange={(e) => setHookEvent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hook-action">Action</Label>
              <Input
                id="hook-action"
                placeholder="notify"
                className="font-mono"
                value={hookAction}
                onChange={(e) => setHookAction(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreateHook}
            disabled={createHookMutation.isPending}
          >
            {createHookMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Create Hook
          </Button>
        </CardContent>
      </Card>

      <NodePageShell
        title={`Event History (${history.data?.length ?? 0})`}
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
        isEmpty={history.data?.length === 0}
        emptyMessage="No recent events."
        actions={
          <Button variant="outline" size="sm" onClick={() => history.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <ProxyDataTable columns={historyColumns} data={history.data ?? []} />
      </NodePageShell>

      {/* Hook delete ConfirmDialog (Group 7) */}
      <ConfirmDialog
        open={!!deleteHookName}
        onOpenChange={() => setDeleteHookName("")}
        title="Delete Event Hook"
        description={`Permanently delete event hook for "${deleteHookName}"? This hook will no longer fire on matching events.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteHookMutation.mutate({})}
      />
    </div>
  );
}
