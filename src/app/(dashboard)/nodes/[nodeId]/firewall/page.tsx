"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useNodeProxy,
  useNodeProxyMutation,
  ProxyError,
} from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  RefreshCw,
  Save,
  Loader2,
  Filter,
  Activity,
  ArrowRightLeft,
  Boxes,
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
    onSuccess: () => toast.success("Firewall rules saved"),
  });

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
              onClick={() => saveMutation.mutate({})}
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
      </NodePageShell>

      {/* Optional capabilities — hidden gracefully when unsupported */}
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
    </div>
  );
}
