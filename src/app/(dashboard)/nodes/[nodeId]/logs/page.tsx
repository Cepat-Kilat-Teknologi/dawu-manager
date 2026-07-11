"use client";

import { useParams } from "next/navigation";
import { useNodeProxy } from "@/hooks/use-node-proxy";
import { NodePageShell } from "@/components/node/node-page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Download, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Selectable tail sizes for the log viewer. */
const LINE_OPTIONS = [100, 500, 1000, 5000] as const;

/**
 * Preset systemd units offered as datalist suggestions. accel-ppp is the
 * default even though it barely logs to journald (see the note in the body).
 * The field is free-text, so any systemd unit name is accepted.
 */
const UNIT_OPTIONS = [
  "accel-ppp",
  "ssh",
  "systemd-networkd",
  "cron",
  "kernel",
] as const;

/** Shape of the dawos-agent `logs/tail` response. */
interface LogTail {
  lines: string[];
  count: number;
  source: string;
}

/**
 * Colour class for a single log line based on its severity keywords.
 * Falls back to the default foreground colour for informational lines.
 */
function lineColor(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("fail")) return "text-red-500";
  if (lower.includes("warn")) return "text-amber-500";
  if (lower.includes("debug")) return "text-gray-400";
  return "text-foreground";
}

/**
 * Log viewer page.
 * Renders the full, untrimmed log tail (selectable 100/500/1000/5000 lines)
 * and supports live streaming via SSE. Lines are never truncated — long lines
 * wrap inside a tall scroll region and keep per-severity colour coding.
 * Covers dawos-agent endpoints: logs/tail, logs/stream (SSE).
 */
export default function LogsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [lineCount, setLineCount] = useState<number>(500);
  const [unit, setUnit] = useState<string>("accel-ppp");
  const [streaming, setStreaming] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Passing the size + unit through the path query string re-keys the query so
  // the tail refetches automatically whenever either selector changes.
  const logs = useNodeProxy<LogTail>(
    nodeId,
    `logs/tail?lines=${lineCount}&unit=${unit}`,
  );

  // SSE streaming — kept intact from the original implementation.
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

  const tailLines = logs.data?.lines ?? [];
  const source = logs.data?.source ?? "—";
  const visibleLines = streaming ? streamLines : tailLines;

  const handleCopy = () => {
    const text = visibleLines.join("\n");
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    toast.success(`Copied ${visibleLines.length} log lines to clipboard`);
  };

  const handleDownload = () => {
    const text = visibleLines.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `logs-${nodeId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <NodePageShell
        title="Logs"
        isLoading={logs.isLoading}
        error={logs.error}
        onRetry={() => logs.refetch()}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Source:{" "}
              <span className="font-mono text-foreground">{source}</span>
            </span>
            <Badge variant="outline">{tailLines.length} lines</Badge>
            <Input
              aria-label="Systemd unit"
              list="log-units"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="systemd unit"
              className="h-9 w-40"
            />
            <datalist id="log-units">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Line count"
            >
              {LINE_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={lineCount === n ? "default" : "outline"}
                  size="sm"
                  aria-pressed={lineCount === n}
                  onClick={() => setLineCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              aria-label="Copy logs"
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              aria-label="Download logs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </Button>
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
        <p className="mb-3 text-xs text-muted-foreground">
          {`systemd journal for unit "${unit}". accel-ppp writes detailed session logs to `}
          <span className="font-mono text-foreground">
            /var/log/accel-ppp/accel-ppp.log
          </span>
          {" (not exposed via journald)."}
        </p>
        <div className="rounded-md bg-muted/50 p-3 font-mono text-xs max-h-[600px] overflow-auto space-y-0.5">
          {/* Static log entries — full, untrimmed, wrapped, colour-coded */}
          {!streaming &&
            tailLines.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all ${lineColor(line)}`}
              >
                {line}
              </div>
            ))}

          {!streaming && tailLines.length === 0 && (
            <div className="text-muted-foreground">No log lines returned.</div>
          )}

          {/* Streaming lines */}
          {streaming &&
            streamLines.map((line, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap break-all text-emerald-400"
              >
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
