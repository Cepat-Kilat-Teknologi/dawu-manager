"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/** Node from the list API. */
interface NodeEntry {
  id: string;
  name: string;
  url: string;
  status: string;
}

/** Per-node result from the fleet operation API. */
interface FleetOpResult {
  nodeId: string;
  nodeName: string;
  ok: boolean;
  status: number;
  message: string;
}

/** Available fleet operations. */
const OPERATIONS = [
  {
    id: "health" as const,
    label: "Refresh Health",
    description: "Check health status of each node (read-only)",
    destructive: false,
  },
  {
    id: "restart" as const,
    label: "Restart Service",
    description:
      "Restart accel-ppp on each node — disconnects ALL active sessions",
    destructive: true,
  },
  {
    id: "bulk-terminate" as const,
    label: "Bulk Terminate Sessions",
    description: "Terminate sessions for specific usernames on each node",
    destructive: true,
  },
] as const;

type OpId = (typeof OPERATIONS)[number]["id"];

/**
 * Fleet Operations manager — select multiple nodes and run an operation
 * across all of them concurrently, with per-node result reporting.
 */
export function OperationsManager() {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedOp, setSelectedOp] = useState<OpId>("health");
  const [usernames, setUsernames] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<FleetOpResult[] | null>(null);

  // Fetch all nodes for the selection list
  const nodesQuery = useQuery<{ nodes: NodeEntry[] }>({
    queryKey: ["fleet-nodes"],
    queryFn: async () => {
      const res = await fetch("/api/nodes");
      if (!res.ok) throw new Error("Failed to fetch nodes");
      return res.json();
    },
  });

  const nodes: NodeEntry[] = nodesQuery.data?.nodes ?? [];

  // Fleet operation mutation
  const mutation = useMutation<
    { results: FleetOpResult[] },
    Error,
    { nodeIds: string[]; op: OpId; params?: { usernames?: string[] } }
  >({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fleet/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as Record<string, string>).error ||
            `Request failed (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data.results);
      const ok = data.results.filter((r) => r.ok).length;
      const failed = data.results.length - ok;
      if (failed === 0) {
        toast.success(`Operation completed: ${ok} node(s) succeeded`);
      } else {
        toast.error(`Partial failure: ${ok} succeeded, ${failed} failed`);
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const currentOp = OPERATIONS.find((o) => o.id === selectedOp)!;

  /** Toggle a single node's selection. */
  function toggleNode(nodeId: string) {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    setResults(null);
  }

  /** Toggle select-all / deselect-all. */
  function toggleAll() {
    if (selectedNodeIds.size === nodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(nodes.map((n) => n.id)));
    }
    setResults(null);
  }

  /** Change the selected operation. */
  function changeOp(op: OpId) {
    setSelectedOp(op);
    setResults(null);
  }

  /** Build the payload and either confirm or run directly. */
  function handleRun() {
    if (selectedOp === "bulk-terminate") {
      const parsed = usernames
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      if (parsed.length === 0) {
        toast.error("Enter at least one username");
        return;
      }
    }

    if (currentOp.destructive) {
      setConfirmOpen(true);
    } else {
      executeOp();
    }
  }

  /** Execute the operation (called directly for safe ops, or after confirm). */
  function executeOp() {
    const nodeIds = Array.from(selectedNodeIds);
    const params: { usernames?: string[] } = {};

    if (selectedOp === "bulk-terminate") {
      params.usernames = usernames
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
    }

    mutation.mutate({
      nodeIds,
      op: selectedOp,
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    setConfirmOpen(false);
  }

  /** Build the confirm dialog description based on the operation. */
  function confirmDescription(): string {
    const count = selectedNodeIds.size;
    if (selectedOp === "restart") {
      return `Restart accel-ppp on ${count} node(s) — this disconnects ALL active PPPoE sessions on each node. Continue?`;
    }
    const usernameList = usernames
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    return `Terminate ${usernameList.length} session(s) across ${count} node(s). Affected users will be disconnected. Continue?`;
  }

  // Summary counts
  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failedCount = results ? results.length - okCount : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Fleet Operations
        </h1>
        <p className="text-muted-foreground">
          Run operations across multiple nodes simultaneously
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Node Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Nodes</CardTitle>
            <CardDescription>
              Choose which nodes to target ({selectedNodeIds.size} of{" "}
              {nodes.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nodesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading nodes…
              </div>
            ) : nodesQuery.isError ? (
              <p className="text-destructive">Failed to load nodes</p>
            ) : nodes.length === 0 ? (
              <p className="text-muted-foreground">
                No nodes registered. Add nodes first.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 pb-2 border-b">
                  <input
                    type="checkbox"
                    checked={
                      nodes.length > 0 &&
                      selectedNodeIds.size === nodes.length
                    }
                    onChange={toggleAll}
                    aria-label="Select all nodes"
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
                {nodes.map((node) => (
                  <label key={node.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNodeIds.has(node.id)}
                      onChange={() => toggleNode(node.id)}
                      aria-label={`Select ${node.name}`}
                    />
                    <span className="text-sm">{node.name}</span>
                    <Badge
                      variant={
                        node.status === "online" ? "default" : "secondary"
                      }
                    >
                      {node.status}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operation Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Operation</CardTitle>
            <CardDescription>
              Choose an operation to run on selected nodes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {OPERATIONS.map((op) => (
                <label
                  key={op.id}
                  className="flex items-start gap-2 p-2 rounded border cursor-pointer"
                >
                  <input
                    type="radio"
                    name="operation"
                    value={op.id}
                    checked={selectedOp === op.id}
                    onChange={() => changeOp(op.id)}
                    aria-label={op.label}
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {op.label}
                      {op.destructive && (
                        <Badge variant="destructive">Destructive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {op.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Parameters for bulk-terminate */}
            {selectedOp === "bulk-terminate" && (
              <div className="space-y-2">
                <Label htmlFor="usernames">
                  Usernames (comma-separated)
                </Label>
                <Input
                  id="usernames"
                  value={usernames}
                  onChange={(e) => setUsernames(e.target.value)}
                  placeholder="user1, user2, user3"
                />
              </div>
            )}

            <Button
              onClick={handleRun}
              disabled={mutation.isPending || selectedNodeIds.size === 0}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Operation
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {(results || mutation.isPending) && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            {results && (
              <CardDescription>
                {mutation.isPending ? (
                  "Running…"
                ) : (
                  <span className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      {okCount} succeeded
                    </span>
                    {failedCount > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        {failedCount} failed
                      </span>
                    )}
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {mutation.isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running operation across {selectedNodeIds.size} node(s)…
              </div>
            ) : (
              results && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.nodeId}>
                      <TableCell className="font-medium">
                        {r.nodeName}
                      </TableCell>
                      <TableCell>
                        {r.ok ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Future extension note */}
      <Card>
        <CardContent className="flex items-center gap-2 py-4">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Cross-node config apply is planned for a future release.
          </p>
        </CardContent>
      </Card>

      {/* Confirm dialog for destructive operations */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Confirm: ${currentOp.label}`}
        description={confirmDescription()}
        confirmLabel={currentOp.label}
        onConfirm={executeOp}
        variant="destructive"
      />
    </div>
  );
}
