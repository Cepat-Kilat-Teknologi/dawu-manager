"use client";

import { useParams } from "next/navigation";
import { useNodeProxy, useNodeProxyMutation } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Save, Loader2 } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface NatEntry {
  type: string;
  interface?: string;
  source?: string;
  destination?: string;
  status?: string;
}

/**
 * Firewall management page.
 * Displays nftables rules, groups, NAT (egress/masquerade/public-ip),
 * conntrack settings, sysctl, and SNMP status.
 * Covers dawos-agent endpoints: firewall/rules, firewall/groups,
 * firewall/nat/*, firewall/conntrack/*, firewall/sysctl, firewall/snmp,
 * firewall/save, firewall/validate.
 */
export default function FirewallPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const rules = useNodeProxy<{ raw_output: string; rules_count: number }>(nodeId, "firewall/rules");
  const groups = useNodeProxy<Record<string, unknown>[]>(nodeId, "firewall/groups", { extract: "groups" });
  const natEgress = useNodeProxy<NatEntry[]>(nodeId, "firewall/nat/egress", { extract: "entries" });
  const natMasq = useNodeProxy<NatEntry[]>(nodeId, "firewall/nat/masquerade", { extract: "entries" });
  const conntrack = useNodeProxy<Record<string, unknown>>(nodeId, "firewall/conntrack/config");
  const sysctl = useNodeProxy<Record<string, unknown>>(nodeId, "firewall/sysctl");

  const saveMutation = useNodeProxyMutation(nodeId, "firewall/save", {
    onSuccess: () => toast.success("Firewall rules saved"),
  });

  const natColumns: ProxyColumn<NatEntry>[] = [
    { header: "Type", accessorKey: "type" },
    { header: "Interface", accessorKey: "interface" },
    { header: "Source", accessorKey: "source" },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant={row.status === "active" ? "default" : "outline"}>
          {row.status ?? "—"}
        </Badge>
      ),
    },
  ];

  const isLoading = rules.isLoading;
  const error = rules.error;

  return (
    <div className="space-y-6">
      {/* Firewall rules */}
      <NodePageShell
        title={`Firewall Rules (${rules.data?.rules_count ?? 0})`}
        isLoading={isLoading}
        error={error}
        onRetry={() => rules.refetch()}
        isEmpty={!rules.data?.raw_output}
        emptyMessage="No firewall rules configured."
        actions={
          <div className="flex gap-2">
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
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      >
        <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
          {rules.data?.raw_output ?? "No data"}
        </pre>
      </NodePageShell>

      {/* Firewall groups */}
      <NodePageShell
        title={`Firewall Groups (${groups.data?.length ?? 0})`}
        isLoading={groups.isLoading}
        error={groups.error}
        onRetry={() => groups.refetch()}
        isEmpty={groups.data?.length === 0}
        emptyMessage="No firewall groups defined."
      >
        <ProxyDataTable
          columns={[
            { header: "Name", accessorKey: "name" },
            { header: "Type", accessorKey: "group_type" },
            { header: "Members", accessorKey: "members" },
          ]}
          data={groups.data ?? []}
        />
      </NodePageShell>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* NAT Egress */}
        <NodePageShell
          title="NAT Egress"
          isLoading={natEgress.isLoading}
          error={natEgress.error}
          onRetry={() => natEgress.refetch()}
          isEmpty={natEgress.data?.length === 0}
          emptyMessage="No NAT egress rules."
        >
          <ProxyDataTable columns={natColumns} data={natEgress.data ?? []} />
        </NodePageShell>

        {/* NAT Masquerade */}
        <NodePageShell
          title="NAT Masquerade"
          isLoading={natMasq.isLoading}
          error={natMasq.error}
          onRetry={() => natMasq.refetch()}
          isEmpty={natMasq.data?.length === 0}
          emptyMessage="No NAT masquerade rules."
        >
          <ProxyDataTable columns={natColumns} data={natMasq.data ?? []} />
        </NodePageShell>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conntrack config */}
        <NodePageShell
          title="Conntrack"
          isLoading={conntrack.isLoading}
          error={conntrack.error}
          onRetry={() => conntrack.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {conntrack.data &&
              Object.entries(conntrack.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
          </dl>
        </NodePageShell>

        {/* Sysctl */}
        <NodePageShell
          title="Sysctl (Network)"
          isLoading={sysctl.isLoading}
          error={sysctl.error}
          onRetry={() => sysctl.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {sysctl.data &&
              Object.entries(sysctl.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground font-mono text-xs">{key}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
          </dl>
        </NodePageShell>
      </div>
    </div>
  );
}
