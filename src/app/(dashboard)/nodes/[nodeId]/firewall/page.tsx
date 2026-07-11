"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useNodeProxy,
  useNodeProxyMutation,
  ProxyError,
} from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  RefreshCw,
  Save,
  Loader2,
  Filter,
  Activity,
  ArrowRightLeft,
  Boxes,
  ShieldCheck,
  Info,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";

/**
 * A feature endpoint may legitimately be absent on a given node build.
 * Treat 404/405 responses as "not available" rather than a hard error.
 */
function isUnavailable(error: Error | null): boolean {
  return (
    error instanceof ProxyError &&
    (error.status === 404 || error.status === 405)
  );
}

/** Escape a user-supplied string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Render a ruleset line with the active filter term highlighted. */
function HighlightedLine({ line, term }: { line: string; term: string }) {
  if (!term) return <>{line}</>;
  const parts = line.split(new RegExp(`(${escapeRegExp(term)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded bg-primary/30 px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** One parsed network sysctl key/value pair. */
interface SysctlPair {
  key: string;
  value: string;
}

/**
 * Parse the dawos-agent sysctl status into key/value pairs.
 * The agent returns an object (`{ ip_forward: true, ip6_forward: false }`);
 * older builds returned a string (`"ip_forward: true, ip6_forward: false"`).
 * Both shapes are handled defensively.
 */
function parseSysctl(status: unknown): SysctlPair[] {
  if (status && typeof status === "object") {
    return Object.entries(status as Record<string, unknown>).map(
      ([key, value]) => ({ key, value: String(value) }),
    );
  }
  if (typeof status !== "string") return [];
  return status
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      return idx >= 0
        ? { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() }
        : { key: pair, value: "" };
    });
}

/** Minimal query shape consumed by {@link OptionalFeature}. */
interface OptionalQuery {
  data: unknown;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Compact tile for an optional firewall capability. Renders a graceful
 * "Not available on this node" note for 404/405 instead of a scary error card.
 */
function OptionalFeature({
  title,
  description,
  icon: Icon,
  query,
  unit,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  query: OptionalQuery;
  unit: string;
}) {
  let status: React.ReactNode;
  if (query.isLoading) {
    status = <Badge variant="outline">Checking</Badge>;
  } else if (query.error) {
    status = isUnavailable(query.error) ? (
      <span className="text-xs text-muted-foreground">
        Not available on this node
      </span>
    ) : (
      <Badge variant="destructive">Error</Badge>
    );
  } else if (query.data === null || query.data === undefined) {
    status = (
      <span className="text-xs text-muted-foreground">
        Not available on this node
      </span>
    );
  } else {
    const isArray = Array.isArray(query.data);
    status = (
      <Badge variant="secondary">
        {isArray ? `${(query.data as unknown[]).length} ${unit}` : "Configured"}
      </Badge>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="rounded-lg bg-muted p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{status}</div>
    </div>
  );
}

/**
 * Firewall management page.
 * Renders the nftables ruleset as a filterable code viewer, network sysctls,
 * and a graceful capability list for optional NAT/conntrack/group features.
 * Covers dawos-agent endpoints: firewall/rules, firewall/sysctl, firewall/save,
 * firewall/nat/*, firewall/conntrack/config, firewall/groups.
 */
export default function FirewallPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [filter, setFilter] = useState("");
  // Tracks whether the pending ruleset passed validation, to nudge validate-before-save.
  const [validated, setValidated] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  // --- Sysctl form state ---
  const [ipForward, setIpForward] = useState(true);
  const [ip6Forward, setIp6Forward] = useState(false);

  // --- NAT Egress form state ---
  const [egressTarget, setEgressTarget] = useState("");
  const [egressPublicIp, setEgressPublicIp] = useState("");
  const [deleteEgressIp, setDeleteEgressIp] = useState<string | null>(null);

  // --- NAT Masquerade form state ---
  const [masqInterface, setMasqInterface] = useState("");
  const [confirmDisableMasq, setConfirmDisableMasq] = useState(false);

  // --- Conntrack form state ---
  const [conntrackMax, setConntrackMax] = useState("");

  // --- Groups form state ---
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState("address");
  const [groupElements, setGroupElements] = useState("");
  const [deleteGroupName, setDeleteGroupName] = useState<string | null>(null);

  const rules = useNodeProxy<{ raw_output: string; rules_count: number }>(
    nodeId,
    "firewall/rules",
  );
  const sysctl = useNodeProxy<{ status?: unknown }>(nodeId, "firewall/sysctl");
  const natEgress = useNodeProxy<unknown[]>(nodeId, "firewall/nat/egress", {
    extract: "entries",
    retry: false,
  });
  const natMasq = useNodeProxy<unknown[]>(nodeId, "firewall/nat/masquerade", {
    extract: "entries",
    retry: false,
  });
  const conntrack = useNodeProxy<Record<string, unknown>>(
    nodeId,
    "firewall/conntrack/config",
    { retry: false },
  );
  const groups = useNodeProxy<unknown[]>(nodeId, "firewall/groups", {
    extract: "groups",
    retry: false,
  });

  const saveMutation = useNodeProxyMutation(nodeId, "firewall/save", {
    onSuccess: () => {
      toast.success("Firewall rules saved");
      // A saved ruleset is now live; require a fresh validation before the next save.
      setValidated(false);
    },
  });
  const validateMutation = useNodeProxyMutation(nodeId, "firewall/validate");

  // --- Sysctl mutation ---
  const sysctlMutation = useNodeProxyMutation<{
    ip_forward: boolean;
    ip6_forward: boolean;
  }>(nodeId, "firewall/sysctl", {
    method: "PUT",
    invalidates: ["firewall"],
    onSuccess: () => toast.success("Sysctl settings updated"),
  });

  // --- NAT Egress mutations ---
  const addEgressMutation = useNodeProxyMutation<{
    target: string;
    public_ip: string;
  }>(nodeId, "firewall/nat/egress", {
    invalidates: ["firewall"],
    onSuccess: () => {
      toast.success("NAT egress rule added");
      setEgressTarget("");
      setEgressPublicIp("");
    },
  });

  const deleteEgressPath = deleteEgressIp
    ? `firewall/nat/egress/${encodeURIComponent(deleteEgressIp)}`
    : "firewall/nat/egress";
  const deleteEgressMutation = useNodeProxyMutation(
    nodeId,
    deleteEgressPath,
    {
      method: "DELETE",
      invalidates: ["firewall"],
      onSuccess: () => {
        toast.success("NAT egress rule removed");
        setDeleteEgressIp(null);
      },
    },
  );

  // --- NAT Masquerade mutations ---
  const enableMasqMutation = useNodeProxyMutation<{
    wan_interface: string;
  }>(nodeId, "firewall/nat/masquerade", {
    invalidates: ["firewall"],
    onSuccess: () => {
      toast.success("NAT masquerade enabled");
      setMasqInterface("");
    },
  });

  const disableMasqMutation = useNodeProxyMutation(
    nodeId,
    "firewall/nat/masquerade",
    {
      method: "DELETE",
      invalidates: ["firewall"],
      onSuccess: () => toast.success("NAT masquerade disabled"),
    },
  );

  // --- Conntrack mutation ---
  const conntrackMutation = useNodeProxyMutation<{ max_value: number }>(
    nodeId,
    "firewall/conntrack",
    {
      method: "PUT",
      invalidates: ["firewall"],
      onSuccess: () => toast.success("Conntrack max updated"),
    },
  );

  // --- Groups mutations ---
  const createGroupMutation = useNodeProxyMutation<{
    name: string;
    group_type: string;
    elements: string[];
  }>(nodeId, "firewall/groups", {
    invalidates: ["firewall"],
    onSuccess: () => {
      toast.success("Firewall group created");
      setGroupName("");
      setGroupType("address");
      setGroupElements("");
    },
  });

  const deleteGroupPath = deleteGroupName
    ? `firewall/groups/${encodeURIComponent(deleteGroupName)}`
    : "firewall/groups";
  const deleteGroupMutation = useNodeProxyMutation(
    nodeId,
    deleteGroupPath,
    {
      method: "DELETE",
      invalidates: ["firewall"],
      onSuccess: () => {
        toast.success("Firewall group deleted");
        setDeleteGroupName(null);
      },
    },
  );

  /** Validate the pending ruleset; success unlocks the "safe to save" hint. */
  async function handleValidate() {
    try {
      await validateMutation.mutateAsync({});
      setValidated(true);
      toast.success("Ruleset valid");
    } catch (err) {
      setValidated(false);
      const msg =
        err instanceof Error ? err.message : "Ruleset validation failed.";
      toast.error("Validation failed", { description: msg });
    }
  }

  function handleSysctlUpdate() {
    sysctlMutation.mutate({ ip_forward: ipForward, ip6_forward: ip6Forward });
  }

  function handleAddEgress() {
    if (!egressTarget.trim() || !egressPublicIp.trim()) {
      toast.error("Both customer IP and public IP are required");
      return;
    }
    addEgressMutation.mutate({
      target: egressTarget.trim(),
      public_ip: egressPublicIp.trim(),
    });
  }

  function handleEnableMasquerade() {
    if (!masqInterface.trim()) {
      toast.error("WAN interface is required");
      return;
    }
    enableMasqMutation.mutate({ wan_interface: masqInterface.trim() });
  }

  function handleConntrackUpdate() {
    const val = parseInt(conntrackMax, 10);
    if (!conntrackMax.trim() || isNaN(val) || val < 16384) {
      toast.error("Conntrack max must be at least 16384");
      return;
    }
    conntrackMutation.mutate({ max_value: val });
  }

  /** Parse comma-separated elements for group creation. */
  function parseElements(text: string): string[] {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleCreateGroup() {
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }
    createGroupMutation.mutate({
      name: groupName.trim(),
      group_type: groupType,
      elements: parseElements(groupElements),
    });
  }

  const rawOutput = rules.data?.raw_output ?? "";
  const term = filter.trim();
  const allLines = rawOutput.split("\n");
  const shownLines = term
    ? allLines.filter((line) => line.toLowerCase().includes(term.toLowerCase()))
    : allLines;

  const sysctlPairs = parseSysctl(sysctl.data?.status);

  return (
    <div className="space-y-6">
      {/* nftables ruleset — filterable code viewer */}
      <NodePageShell
        title="Firewall Rules"
        isLoading={rules.isLoading}
        error={rules.error}
        onRetry={() => rules.refetch()}
        isEmpty={!rules.data?.raw_output}
        emptyMessage="No firewall rules configured."
        actions={
          <>
            <Badge variant="secondary" className="font-mono">
              {rules.data?.rules_count ?? 0} rules
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={validateMutation.isPending}
            >
              {validateMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              Validate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSave(true)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Rules
            </Button>
            <Button variant="outline" size="sm" onClick={() => rules.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p
            className={`flex items-center gap-1.5 text-xs ${
              validated ? "text-success" : "text-muted-foreground"
            }`}
          >
            {validated ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Info className="h-3.5 w-3.5 shrink-0" />
            )}
            {validated
              ? "Ruleset validated — safe to save."
              : "Tip: click Validate to check the ruleset before saving."}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter rules (dport, accept, snat)..."
                className="pl-8 font-mono"
                aria-label="Filter firewall rules"
              />
            </div>
            {term && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {shownLines.length} of {allLines.length} lines
              </span>
            )}
          </div>
          {term && shownLines.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              No lines match &quot;{term}&quot;.
            </p>
          ) : (
            <pre className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
              {shownLines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  <HighlightedLine line={line} term={term} />
                </div>
              ))}
            </pre>
          )}
        </div>
      </NodePageShell>

      {/* Network sysctls */}
      <NodePageShell
        title="Network Sysctls"
        isLoading={sysctl.isLoading}
        error={sysctl.error}
        onRetry={() => sysctl.refetch()}
        isEmpty={sysctlPairs.length === 0}
        emptyMessage="No network sysctl values reported."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {sysctlPairs.map((pair) => (
            <div
              key={pair.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {pair.key}
              </span>
              {pair.value === "true" ? (
                <Badge variant="secondary" className="border-success/30 text-success">
                  true
                </Badge>
              ) : pair.value === "false" ? (
                <Badge variant="outline">false</Badge>
              ) : (
                <span className="font-mono text-xs font-medium">
                  {pair.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Sysctl update form */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Toggle IPv4/IPv6 forwarding. Changes take effect immediately.</span>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ipForward}
                onChange={(e) => setIpForward(e.target.checked)}
              />
              IPv4 Forwarding
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ip6Forward}
                onChange={(e) => setIp6Forward(e.target.checked)}
              />
              IPv6 Forwarding
            </label>
            <Button
              size="sm"
              onClick={handleSysctlUpdate}
              disabled={sysctlMutation.isPending}
            >
              {sysctlMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Update Sysctls
            </Button>
          </div>
        </div>
      </NodePageShell>

      {/* Optional capabilities — status summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Advanced Firewall Features
          </CardTitle>
        </CardHeader>
        <CardContent className="content-fade-in">
          <p className="mb-4 text-sm text-muted-foreground">
            Optional capabilities that depend on the node&apos;s dawos-agent
            build. Features not supported by this node are marked unavailable.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionalFeature
              title="NAT Egress"
              description="Source NAT for outbound subscriber traffic."
              icon={ArrowRightLeft}
              query={natEgress}
              unit="rules"
            />
            <OptionalFeature
              title="NAT Masquerade"
              description="Masquerade rules on WAN uplinks."
              icon={ArrowRightLeft}
              query={natMasq}
              unit="rules"
            />
            <OptionalFeature
              title="Conntrack"
              description="Connection tracking tuning and limits."
              icon={Activity}
              query={conntrack}
              unit="entries"
            />
            <OptionalFeature
              title="Firewall Groups"
              description="Named address / port groups used by rules."
              icon={Boxes}
              query={groups}
              unit="groups"
            />
          </div>
        </CardContent>
      </Card>

      {/* NAT Egress Management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">NAT Egress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {natEgress.data && Array.isArray(natEgress.data) && natEgress.data.length > 0 ? (
            <div className="space-y-1">
              {(natEgress.data as Record<string, unknown>[]).map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border border-border bg-card/40 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono">
                    {String(entry.target ?? entry.customer_ip ?? "")} → {String(entry.public_ip ?? "")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() =>
                      setDeleteEgressIp(
                        String(entry.target ?? entry.customer_ip ?? ""),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !natEgress.isLoading && !isUnavailable(natEgress.error) ? (
            <p className="text-xs text-muted-foreground">No egress rules.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="egress-target">Customer IP</Label>
              <Input
                id="egress-target"
                placeholder="10.0.0.1"
                className="font-mono"
                value={egressTarget}
                onChange={(e) => setEgressTarget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="egress-public">Public IP</Label>
              <Input
                id="egress-public"
                placeholder="203.0.113.10"
                className="font-mono"
                value={egressPublicIp}
                onChange={(e) => setEgressPublicIp(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleAddEgress}
                disabled={addEgressMutation.isPending}
              >
                {addEgressMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NAT Masquerade Management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">NAT Masquerade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="masq-iface">WAN Interface</Label>
              <Input
                id="masq-iface"
                placeholder="eth0"
                className="font-mono"
                value={masqInterface}
                onChange={(e) => setMasqInterface(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleEnableMasquerade}
                disabled={enableMasqMutation.isPending}
              >
                {enableMasqMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Enable
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDisableMasq(true)}
                disabled={disableMasqMutation.isPending}
              >
                {disableMasqMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Disable
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conntrack Management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Conntrack Tuning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {conntrack.data && (
            <dl className="grid gap-1 text-sm">
              {Object.entries(conntrack.data).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="conntrack-max">Max Connections (≥ 16384)</Label>
              <Input
                id="conntrack-max"
                type="number"
                min={16384}
                placeholder="262144"
                value={conntrackMax}
                onChange={(e) => setConntrackMax(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleConntrackUpdate}
                disabled={conntrackMutation.isPending}
              >
                {conntrackMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Firewall Groups Management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Firewall Groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.data && Array.isArray(groups.data) && groups.data.length > 0 ? (
            <div className="space-y-1">
              {(groups.data as Record<string, unknown>[]).map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border border-border bg-card/40 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono">
                    {String(g.name ?? "")}
                    <Badge variant="outline" className="ml-2">
                      {String(g.type ?? g.group_type ?? "")}
                    </Badge>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteGroupName(String(g.name ?? ""))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !groups.isLoading && !isUnavailable(groups.error) ? (
            <p className="text-xs text-muted-foreground">No firewall groups.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="my-group"
                className="font-mono"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-type">Type</Label>
              <select
                id="group-type"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
              >
                <option value="address">address</option>
                <option value="network">network</option>
                <option value="port">port</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-elements">Elements (comma-separated)</Label>
              <Input
                id="group-elements"
                placeholder="10.0.0.1, 10.0.0.2"
                className="font-mono"
                value={groupElements}
                onChange={(e) => setGroupElements(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleCreateGroup}
                disabled={createGroupMutation.isPending}
              >
                {createGroupMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmSave}
        onOpenChange={(open) => !open && setConfirmSave(false)}
        title="Save Firewall Rules"
        description="This persists the live nftables ruleset to disk so it survives a reboot. A wrong ruleset can lock operators or subscribers out of this BNG — validate first. Save now?"
        confirmLabel="Save Rules"
        onConfirm={async () => {
          await saveMutation.mutateAsync({});
          setConfirmSave(false);
        }}
      />

      {deleteEgressIp && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleteEgressIp(null)}
          title="Remove NAT Egress Rule"
          description={`This will remove the egress NAT mapping for customer IP "${deleteEgressIp}". That subscriber's outbound traffic will fall back to the default NAT path.`}
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={async () => {
            await deleteEgressMutation.mutateAsync({});
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDisableMasq}
        onOpenChange={(open) => !open && setConfirmDisableMasq(false)}
        title="Disable NAT Masquerade"
        description="This will remove the masquerade rule from the WAN interface. Outbound subscriber traffic may lose internet connectivity until masquerade is re-enabled or another NAT rule is in place."
        confirmLabel="Disable Masquerade"
        variant="destructive"
        onConfirm={async () => {
          await disableMasqMutation.mutateAsync({});
          setConfirmDisableMasq(false);
        }}
      />

      {deleteGroupName && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleteGroupName(null)}
          title="Delete Firewall Group"
          description={`This will delete the firewall group "${deleteGroupName}". Any rules referencing this group may stop matching traffic.`}
          confirmLabel="Delete Group"
          variant="destructive"
          onConfirm={async () => {
            await deleteGroupMutation.mutateAsync({});
          }}
        />
      )}
    </div>
  );
}
