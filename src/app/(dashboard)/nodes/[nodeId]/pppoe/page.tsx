"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface PppoeInterface {
  name: string;
  state: string;
  sessions?: number;
  mtu?: number;
  mac?: string;
}

/**
 * PPPoE configuration page.
 * Displays PPPoE interfaces, MAC filter, and PADO delay settings.
 * Covers dawos-agent endpoints: pppoe/interfaces, pppoe/mac-filter,
 * pppoe/pado-delay.
 */
export default function PppoePage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const interfaces = useNodeProxy<PppoeInterface[]>(nodeId, "pppoe/interfaces", { extract: "interfaces" });
  const macFilter = useNodeProxy<{ raw_output: string; count: number }>(nodeId, "pppoe/mac-filter");
  const padoDelay = useNodeProxy<Record<string, unknown>>(nodeId, "pppoe/pado-delay");

  const ifColumns: ProxyColumn<PppoeInterface>[] = [
    { header: "Name", accessorKey: "name", className: "font-medium" },
    {
      header: "State",
      cell: (row) => (
        <Badge variant={row.state === "active" || row.state === "up" ? "default" : "outline"}>
          {row.state}
        </Badge>
      ),
    },
    { header: "Sessions", accessorKey: "sessions" },
    { header: "MTU", accessorKey: "mtu" },
    { header: "MAC", accessorKey: "mac", className: "font-mono text-xs" },
  ];

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
        <ProxyDataTable columns={ifColumns} data={interfaces.data ?? []} getRowKey={(r) => r.name} />
      </NodePageShell>

      <div className="grid gap-6 lg:grid-cols-2">
        <NodePageShell
          title="MAC Filter"
          isLoading={macFilter.isLoading}
          error={macFilter.error}
          onRetry={() => macFilter.refetch()}
          isEmpty={!macFilter.data?.raw_output}
          emptyMessage="No MAC filter entries."
        >
          <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
            {macFilter.data?.raw_output ?? "No data"}
          </pre>
        </NodePageShell>

        <NodePageShell
          title="PADO Delay"
          isLoading={padoDelay.isLoading}
          error={padoDelay.error}
          onRetry={() => padoDelay.refetch()}
        >
          <dl className="grid gap-2 text-sm">
            {padoDelay.data &&
              Object.entries(padoDelay.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">{formatValue(val)}</dd>
                </div>
              ))}
          </dl>
        </NodePageShell>
      </div>
    </div>
  );
}
