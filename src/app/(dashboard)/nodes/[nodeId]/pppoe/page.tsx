"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, RefreshCw, ShieldCheck } from "lucide-react";

/** A PPPoE access interface as returned by dawos-agent (`pppoe/interfaces`). */
interface PppoeInterface {
  /** Interface name, e.g. "ens19". */
  name: string;
  /** Space-separated accel-ppp options string (may be empty). */
  options: string;
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

/** Card for a single PPPoE interface: name heading + parsed option chips. */
function InterfaceCard({ iface }: { iface: PppoeInterface }) {
  const tokens = splitOptions(iface.options);
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="font-heading text-sm font-semibold">{iface.name}</h3>
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
 * Shows the accel-ppp PPPoE access interfaces as cards (name + option chips)
 * and the MAC filter status.
 * Covers dawos-agent endpoints: pppoe/interfaces, pppoe/mac-filter.
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

  // Coerce defensively: raw_output is documented as a string, but never trust
  // the agent's shape — a non-string would otherwise crash parseStatusValue.
  const macStatus = parseStatusValue(String(macFilter.data?.raw_output ?? ""));
  const macEnabled = macStatus.toLowerCase() === "enabled";

  return (
    <div className="space-y-6">
      <NodePageShell
        title={`PPPoE Interfaces (${interfaces.data?.length ?? 0})`}
        isLoading={interfaces.isLoading}
        error={interfaces.error}
        onRetry={() => interfaces.refetch()}
        isEmpty={interfaces.data?.length === 0}
        emptyMessage="No PPPoE interfaces configured."
        actions={
          <Button variant="outline" size="sm" onClick={() => interfaces.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Access interfaces where accel-ppp listens for subscriber discovery
          (PADI) packets. Each interface can carry many concurrent PPPoE sessions;
          the tags below are the per-interface options set in accel-ppp.conf.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(interfaces.data ?? []).map((iface) => (
            <InterfaceCard key={iface.name} iface={iface} />
          ))}
        </div>
      </NodePageShell>

      <NodePageShell
        title="MAC Filter"
        isLoading={macFilter.isLoading}
        error={macFilter.error}
        onRetry={() => macFilter.refetch()}
        isEmpty={!macFilter.data?.raw_output}
        emptyMessage="MAC filter status not reported by this node."
      >
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
            {macStatus}
          </Badge>
        </div>
      </NodePageShell>
    </div>
  );
}
