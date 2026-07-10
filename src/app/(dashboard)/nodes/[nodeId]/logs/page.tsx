"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Log viewer page.
 * Displays log tail and supports live streaming via SSE.
 * Covers dawos-agent endpoints: logs/tail, logs/stream (SSE).
 */
export default function LogsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [streaming, setStreaming] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const logs = useNodeProxy<string[]>(nodeId, "logs/tail", { extract: "lines" });

  // SSE streaming
  useEffect(() => {
    if (!streaming) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const es = new EventSource(`/api/nodes/${nodeId}/proxy/logs/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      setStreamLines((prev) => [...prev.slice(-500), event.data]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    es.onerror = () => {
      setStreaming(false);
    };

    return () => {
      es.close();
    };
  }, [streaming, nodeId]);

  const lineColor = (line: string) => {
    const lower = line.toLowerCase();
    if (lower.includes("error") || lower.includes("fail")) return "text-red-500";
    if (lower.includes("warn")) return "text-amber-500";
    if (lower.includes("debug")) return "text-gray-400";
    return "text-foreground";
  };

  return (
    <div className="space-y-4">
      <NodePageShell
        title="Logs"
        isLoading={logs.isLoading}
        error={logs.error}
        onRetry={() => logs.refetch()}
        actions={
          <div className="flex gap-2">
            <Button
              variant={streaming ? "destructive" : "default"}
              size="sm"
              onClick={() => {
                if (streaming) {
                  setStreaming(false);
                } else {
                  setStreamLines([]);
                  setStreaming(true);
                }
              }}
            >
              {streaming ? "Stop Stream" : "Live Stream"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => logs.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      >
        <div className="rounded-md bg-muted/50 p-3 font-mono text-xs max-h-[600px] overflow-y-auto space-y-0.5">
          {/* Static log entries */}
          {!streaming &&
            logs.data?.map((line, i) => (
              <div key={i} className={lineColor(line)}>
                {line}
              </div>
            ))}

          {/* Streaming lines */}
          {streaming &&
            streamLines.map((line, i) => (
              <div key={i} className="text-emerald-400">
                {line}
              </div>
            ))}

          {streaming && streamLines.length === 0 && (
            <div className="text-muted-foreground animate-pulse">
              Waiting for log events...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </NodePageShell>
    </div>
  );
}
