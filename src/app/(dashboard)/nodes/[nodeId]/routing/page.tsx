"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

/**
 * Dynamic routing protocol status as returned by
 * `routing/{bgp,ospf,rip}/status`. Every protocol reports `configured` — when
 * false the remaining fields are empty and the protocol is simply not running.
 */
interface RoutingStatus {
  configured?: boolean;
  router_id?: string;
  local_as?: number | string | null;
  neighbors?: unknown[];
  total_prefixes?: number | null;
  version?: number | string | null;
  networks?: unknown[];
  raw_output?: string;
}

/** True when a value is worth showing (present and non-empty), keeping `0`. */
function isPresent(value: string | number | null | undefined): value is string | number {
  if (value === undefined) return false;
  if (value === null) return false;
  if (value === "") return false;
  return true;
}

/** Build the labelled rows shown for a configured protocol, dropping absent fields. */
function detailFields(data: RoutingStatus): { label: string; value: string | number }[] {
  const candidates: { label: string; value: string | number | null | undefined }[] = [
    { label: "Router ID", value: data.router_id },
    { label: "Local AS", value: data.local_as },
    { label: "Version", value: data.version },
    { label: "Neighbors", value: data.neighbors?.length },
    { label: "Networks", value: data.networks?.length },
    { label: "Total Prefixes", value: data.total_prefixes },
  ];
  return candidates.filter((f): f is { label: string; value: string | number } =>
    isPresent(f.value),
  );
}

/**
 * Routing protocols page.
 * BGP / OSPF / RIP status driven by the real `configured` flag (not just error),
 * plus a static note for BFD whose status endpoint is not exposed by the agent.
 * Covers: routing/bgp/status, routing/ospf/status, routing/rip/status.
 */
export default function RoutingPage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const bgp = useNodeProxy<RoutingStatus>(nodeId, "routing/bgp/status");
  const ospf = useNodeProxy<RoutingStatus>(nodeId, "routing/ospf/status");
  const rip = useNodeProxy<RoutingStatus>(nodeId, "routing/rip/status");

  const protocols = [
    { key: "bgp", label: "BGP", query: bgp },
    { key: "ospf", label: "OSPF", query: ospf },
    { key: "rip", label: "RIP", query: rip },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards — driven by `configured`, so idle protocols read as such */}
      <div className="grid gap-4 sm:grid-cols-3">
        {protocols.map(({ key, label, query }) => {
          const configured = query.data?.configured ?? false;
          return (
            <Card key={key} className="rounded-xl border-border">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {query.isLoading ? (
                  <div className="skeleton-shimmer h-6 w-28 rounded" />
                ) : query.error ? (
                  <Badge variant="outline">Unavailable</Badge>
                ) : (
                  <Badge variant={configured ? "default" : "outline"}>
                    {configured ? "Active" : "Not configured"}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-protocol detail */}
      {protocols.map(({ key, label, query }) => (
        <NodePageShell
          key={key}
          title={`${label} Status`}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          actions={
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          }
        >
          {query.data?.configured ? (
            <div className="space-y-4 content-fade-in">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {detailFields(query.data).map((f) => (
                  <div
                    key={f.label}
                    className="flex justify-between gap-4 border-b py-1.5 last:border-0"
                  >
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-mono text-xs">{f.value}</dd>
                  </div>
                ))}
              </dl>
              {query.data.raw_output ? (
                <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs whitespace-pre-wrap max-h-96">
                  {query.data.raw_output}
                </pre>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {label} is not configured on this node.
            </p>
          )}
        </NodePageShell>
      ))}

      {/* BFD — status endpoint returns 404 on this agent; shown as unavailable */}
      <Card className="rounded-xl border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">BFD</CardTitle>
          <Badge variant="outline">Not available</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bidirectional Forwarding Detection status is not exposed by this dawos-agent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
