"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { formatValue } from "@/lib/utils";

/**
 * Routing protocols page.
 * Displays BGP, OSPF, RIP, and BFD status and neighbors.
 * Covers dawos-agent endpoints: routing/bgp/*, routing/ospf/*,
 * routing/rip/*, routing/bfd/*.
 */
export default function RoutingPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const bgp = useNodeProxy<Record<string, unknown>>(nodeId, "routing/bgp/status");
  const ospf = useNodeProxy<Record<string, unknown>>(nodeId, "routing/ospf/status");
  const rip = useNodeProxy<Record<string, unknown>>(nodeId, "routing/rip/status");
  const bfd = useNodeProxy<Record<string, unknown>>(nodeId, "routing/bfd/status");

  const protocols = [
    { name: "BGP", query: bgp },
    { name: "OSPF", query: ospf },
    { name: "RIP", query: rip },
    { name: "BFD", query: bfd },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {protocols.map(({ name, query }) => (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{name}</CardTitle>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <div className="animate-pulse h-6 w-16 rounded bg-muted" />
              ) : query.error ? (
                <Badge variant="outline">unavailable</Badge>
              ) : (
                <Badge variant="default">active</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {protocols.map(({ name, query }) => (
        <NodePageShell
          key={name}
          title={`${name} Details`}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          actions={
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          }
        >
          <dl className="grid gap-2 text-sm">
            {query.data &&
              Object.entries(query.data).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b py-1.5 last:border-0">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-xs">
                    {formatValue(val)}
                  </dd>
                </div>
              ))}
          </dl>
        </NodePageShell>
      ))}
    </div>
  );
}
