"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormAlert } from "@/components/shared/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Network, RefreshCw, ShieldCheck, Plus, Trash2, Loader2 } from "lucide-react";

/** A PPPoE access interface as returned by dawos-agent (`pppoe/interfaces`). */
interface PppoeInterface {
  /** Interface name, e.g. "ens19". */
  name: string;
  /** Space-separated accel-ppp options string (may be empty). */
  options: string;
}

/** A pending deletion driving the shared confirm dialog. */
type DeleteTarget = { kind: "interface" | "mac"; name: string };

/** Canonical MAC address, colon- or hyphen-separated (e.g. 00:11:22:33:44:55). */
const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

/** Whether a string is a syntactically valid MAC address. */
function isValidMac(value: string): boolean {
  return MAC_PATTERN.test(value.trim());
}

/** Extract a human-readable message from a thrown value, with a fallback. */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Split an accel-ppp options string into individual option tokens.
 * Returns an empty array when no options are configured.
 */
function splitOptions(options: string): string[] {
  return options.trim() ? options.trim().split(/\s+/) : [];
}

/**
 * Parse the value portion of a "key: value" status string.
 * `"filter type: disabled"` → `"disabled"`; falls back to the whole string.
 */
function parseStatusValue(raw: string): string {
  const trimmed = raw.trim();
  const idx = trimmed.indexOf(":");
  return idx >= 0 ? trimmed.slice(idx + 1).trim() : trimmed;
}

/**
 * Pull any individual MAC entries the node happens to expose in its filter
 * `raw_output`. Most builds report only an enabled/disabled status line and
 * expose no entries — in that case this returns an empty array.
 */
function extractMacEntries(lines: string[]): string[] {
  return lines.filter((line) => isValidMac(line));
}

/** Card for a single PPPoE interface: name heading + parsed option chips. */
function InterfaceCard({
  iface,
  onDelete,
}: {
  iface: PppoeInterface;
  onDelete: (name: string) => void;
}) {
  const tokens = splitOptions(iface.options);
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="font-heading text-sm font-semibold">{iface.name}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 px-2 text-muted-foreground hover:text-destructive"
          aria-label={`Delete interface ${iface.name}`}
          onClick={() => onDelete(iface.name)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tokens.length > 0 ? (
          tokens.map((token, i) => (
            <Badge key={i} variant="outline" className="font-mono text-[11px]">
              {token}
            </Badge>
          ))
        ) : (
          <span className="text-xs italic text-muted-foreground">
            default options
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * PPPoE configuration page.
 * Lists the accel-ppp PPPoE access interfaces as cards (name + option chips)
 * with add/delete management, plus a manageable MAC filter (status + add/remove).
 * Covers dawos-agent endpoints: pppoe/interfaces (GET/POST/DELETE),
 * pppoe/mac-filter (GET/POST/DELETE).
 */
export default function PppoePage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const interfaces = useNodeProxy<PppoeInterface[]>(nodeId, "pppoe/interfaces", {
    extract: "interfaces",
  });
  const macFilter = useNodeProxy<{ raw_output: unknown; count: number }>(
    nodeId,
    "pppoe/mac-filter",
  );

  // Add-interface dialog state.
  const [addOpen, setAddOpen] = useState(false);
  const [ifaceName, setIfaceName] = useState("");
  const [ifaceOptions, setIfaceOptions] = useState("");
  const [addError, setAddError] = useState("");

  // Add-MAC form state.
  const [macInput, setMacInput] = useState("");
  const [macError, setMacError] = useState("");

  // Pending deletion (interface or MAC) driving the shared confirm dialog.
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Both list queries are two-segment paths, so invalidate the FULL paths:
  // ["pppoe"] alone would not partial-match ["node-proxy", id, "pppoe/*"].
  const invalidates = ["pppoe/interfaces", "pppoe/mac-filter"];

  const addInterface = useNodeProxyMutation<{
    interface: string;
    options: string;
  }>(nodeId, "pppoe/interfaces", { invalidates });
  const addMac = useNodeProxyMutation<{ mac: string }>(
    nodeId,
    "pppoe/mac-filter",
    { invalidates },
  );

  const deletePath =
    deleteTarget?.kind === "interface"
      ? `pppoe/interfaces/${encodeURIComponent(deleteTarget.name)}`
      : deleteTarget?.kind === "mac"
        ? `pppoe/mac-filter/${encodeURIComponent(deleteTarget.name)}`
        : "pppoe/interfaces";
  const deleteEntry = useNodeProxyMutation(nodeId, deletePath, {
    method: "DELETE",
    invalidates,
  });

  const ifaceList = interfaces.data ?? [];

  // Coerce defensively: raw_output is documented as a string, but never trust
  // the agent's shape. Status is the first line; any later MAC-shaped lines are
  // exposed as removable entries.
  const macLines = String(macFilter.data?.raw_output ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const macStatus = parseStatusValue(macLines[0] ?? "");
  const macEnabled = macStatus.toLowerCase() === "enabled";
  const macEntries = extractMacEntries(macLines);

  async function handleAddInterface(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError("");
    const name = ifaceName.trim();
    if (!name) {
      setAddError("Interface name is required.");
      return;
    }
    try {
      await addInterface.mutateAsync({
        interface: name,
        options: ifaceOptions.trim(),
      });
      toast.success(`Interface ${name} added`);
      setAddOpen(false);
      setIfaceName("");
      setIfaceOptions("");
    } catch (err) {
      const msg = errorMessage(err, "Failed to add interface.");
      setAddError(msg);
      toast.error("Add failed", { description: msg });
    }
  }

  async function handleAddMac(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMacError("");
    const mac = macInput.trim();
    if (!mac) {
      setMacError("MAC address is required.");
      return;
    }
    if (!isValidMac(mac)) {
      setMacError("Enter a valid MAC address, e.g. 00:11:22:33:44:55.");
      return;
    }
    try {
      await addMac.mutateAsync({ mac });
      toast.success(`MAC ${mac} added to filter`);
      setMacInput("");
    } catch (err) {
      const msg = errorMessage(err, "Failed to add MAC address.");
      setMacError(msg);
      toast.error("Add failed", { description: msg });
    }
  }

  async function handleConfirmDelete(target: DeleteTarget) {
    try {
      await deleteEntry.mutateAsync(undefined);
      toast.success(
        target.kind === "interface"
          ? `Interface ${target.name} removed`
          : `MAC ${target.name} removed from filter`,
      );
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Delete failed", {
        description: errorMessage(err, "Failed to delete."),
      });
    }
  }

  return (
    <div className="space-y-6">
      <NodePageShell
        title={`PPPoE Interfaces (${interfaces.data?.length ?? 0})`}
        isLoading={interfaces.isLoading}
        error={interfaces.error}
        onRetry={() => interfaces.refetch()}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Interface
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => interfaces.refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Access interfaces where accel-ppp listens for subscriber discovery
          (PADI) packets. Each interface can carry many concurrent PPPoE sessions;
          the tags below are the per-interface options set in accel-ppp.conf.
        </p>
        {ifaceList.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ifaceList.map((iface) => (
              <InterfaceCard
                key={iface.name}
                iface={iface}
                onDelete={(name) => setDeleteTarget({ kind: "interface", name })}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No PPPoE interfaces configured.
          </p>
        )}
      </NodePageShell>

      <NodePageShell
        title="MAC Filter"
        isLoading={macFilter.isLoading}
        error={macFilter.error}
        onRetry={() => macFilter.refetch()}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">
              Restricts which client MAC addresses may open PPPoE sessions.
            </p>
            <Badge
              variant={macEnabled ? "default" : "secondary"}
              className="ml-auto shrink-0"
            >
              {macStatus || "Unknown"}
            </Badge>
          </div>

          <form
            onSubmit={handleAddMac}
            className="flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="add-mac" className="sr-only">
                MAC address
              </Label>
              <Input
                id="add-mac"
                value={macInput}
                onChange={(e) => setMacInput(e.target.value)}
                placeholder="00:11:22:33:44:55"
                className="font-mono"
                aria-label="MAC address to add"
                disabled={addMac.isPending}
              />
              <FormAlert message={macError} />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={addMac.isPending}
            >
              {addMac.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add MAC
            </Button>
          </form>

          {macEntries.length > 0 ? (
            <ul className="space-y-1.5">
              {macEntries.map((mac) => (
                <li
                  key={mac}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2"
                >
                  <span className="font-mono text-xs">{mac}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove MAC ${mac}`}
                    onClick={() => setDeleteTarget({ kind: "mac", name: mac })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              This node reports only the filter&apos;s enabled/disabled status,
              not individual MAC entries. Add an address above to append it to
              the filter.
            </p>
          )}
        </div>
      </NodePageShell>

      {/* Add-interface dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add PPPoE Interface</DialogTitle>
            <DialogDescription>
              Register a network interface for accel-ppp to accept PPPoE sessions
              on.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddInterface} className="space-y-4">
            <FormAlert message={addError} />
            <div className="space-y-2">
              <Label htmlFor="iface-name">Interface</Label>
              <Input
                id="iface-name"
                value={ifaceName}
                onChange={(e) => setIfaceName(e.target.value)}
                placeholder="ens19"
                disabled={addInterface.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iface-options">
                Options{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="iface-options"
                value={ifaceOptions}
                onChange={(e) => setIfaceOptions(e.target.value)}
                placeholder="mtu 1492 mru 1492"
                className="font-mono"
                disabled={addInterface.isPending}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={addInterface.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addInterface.isPending}>
                {addInterface.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Interface
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shared delete confirmation (interface or MAC entry) */}
      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteTarget(null)}
          title={
            deleteTarget.kind === "interface"
              ? "Delete PPPoE interface?"
              : "Remove MAC entry?"
          }
          description={
            deleteTarget.kind === "interface"
              ? `Interface ${deleteTarget.name} will stop accepting new PPPoE sessions. This cannot be undone.`
              : `MAC ${deleteTarget.name} will be removed from the filter.`
          }
          confirmLabel="Delete"
          loading={deleteEntry.isPending}
          onConfirm={() => handleConfirmDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
