"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useTheme } from "next-themes";
import { Radio, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNodeSSE, type SSEStatus } from "@/hooks/use-node-sse";
import { cn } from "@/lib/utils";

/** One per-session sample inside an aggregate traffic event. */
export interface SessionTraffic {
  username: string;
  ip: string;
  rate_limit: string;
  download_mbps: number;
  upload_mbps: number;
}

/**
 * Aggregate traffic event streamed from dawos-agent `/traffic/stream`.
 * When the node has no active PPPoE sessions the agent emits
 * `{ "error": "no active sessions" }` and closes the stream.
 */
export interface AggregateTrafficEvent {
  sessions?: SessionTraffic[];
  session_count?: number;
  total_download_mbps?: number;
  total_upload_mbps?: number;
  timestamp?: string;
  error?: string;
}

/** Rolling buffer size — 10 minutes at the agent's 2s default interval. */
const MAX_POINTS = 300;

/**
 * Chart update cadence options. The SSE stream always arrives at the agent's
 * ~2s rate; these downsample how often a new point is appended to the chart.
 * `0` = realtime (append every event).
 */
export const REFRESH_INTERVALS: { label: string; ms: number }[] = [
  { label: "Realtime", ms: 0 },
  { label: "5s", ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 300_000 },
];

/** Format a Mbps value for tooltips/labels: "125.4 Mbps". */
export function formatMbps(value: number): string {
  return `${value.toFixed(1)} Mbps`;
}

/** Human label for the SSE connection status indicator. */
const STATUS_LABEL: Record<SSEStatus, string> = {
  connecting: "Connecting…",
  open: "Live",
  error: "Reconnecting…",
  closed: "Stopped",
};

interface TrafficChartProps {
  nodeId: string;
  /** Chart height (default 380px). */
  height?: number | string;
  className?: string;
}

/**
 * Real-time aggregate traffic chart — streams total download/upload Mbps
 * for all active PPPoE sessions from the node's `/traffic/stream` SSE
 * endpoint (via the BFF stream proxy) into a two-series ECharts area chart,
 * plus a live "top sessions by throughput" list.
 *
 * Chart data lives in a ref and is pushed via setOption so React never
 * re-renders per sample; only the lightweight session list uses state.
 */
export function TrafficChart(props: TrafficChartProps) {
  // Remount the live subtree on retry so the EventSource reconnects fresh.
  const [attempt, setAttempt] = useState(0);
  return (
    <LiveTrafficChart
      key={attempt}
      {...props}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function LiveTrafficChart({
  nodeId,
  height = 380,
  className,
  onRetry,
}: TrafficChartProps & { onRetry: () => void }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const chartRef = useRef<ReactECharts | null>(null);
  const bufferRef = useRef<{ rx: [number, number][]; tx: [number, number][] }>({
    rx: [],
    tx: [],
  });
  const [streamEnded, setStreamEnded] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [topSessions, setTopSessions] = useState<SessionTraffic[]>([]);
  const [intervalMs, setIntervalMs] = useState(0);
  // Server timestamp of the last point appended to the chart (for downsampling).
  const lastAppendRef = useRef(0);

  // useNodeSSE keeps the latest onMessage (re-created each render), so the
  // callback below closes over the current `intervalMs` without re-subscribing.
  const { status, close } = useNodeSSE<AggregateTrafficEvent>(
    nodeId,
    "traffic/stream",
    {
      enabled: streamEnded === null,
      onMessage: (event) => {
        if (typeof event !== "object" || event === null) return;
        // Agent emits {error} and closes when no sessions are active —
        // stop reconnect churn and show a friendly empty state instead.
        if (event.error) {
          close();
          setStreamEnded(event.error);
          return;
        }
        // Data events always carry an ISO timestamp (see dawos-agent
        // aggregate_traffic_events); skip malformed payloads.
        if (!event.timestamp) return;
        const t = new Date(event.timestamp).getTime();

        // Session count/list stay live regardless of chart cadence.
        setSessionCount(event.session_count ?? event.sessions?.length ?? 0);
        setTopSessions((event.sessions ?? []).slice(0, 5));

        // Downsample chart appends to the selected refresh interval.
        if (intervalMs !== 0 && t - lastAppendRef.current < intervalMs) return;
        lastAppendRef.current = t;

        const buf = bufferRef.current;
        buf.rx.push([t, event.total_download_mbps ?? 0]);
        buf.tx.push([t, event.total_upload_mbps ?? 0]);
        if (buf.rx.length > MAX_POINTS) buf.rx.splice(0, buf.rx.length - MAX_POINTS);
        if (buf.tx.length > MAX_POINTS) buf.tx.splice(0, buf.tx.length - MAX_POINTS);
        chartRef.current?.getEchartsInstance().setOption({
          series: [{ data: buf.rx }, { data: buf.tx }],
        });
      },
    },
  );

  const option = useMemo(() => {
    const text = dark ? "#FAFAFA" : "#09090B";
    const muted = "#71717A";
    const grid = dark ? "#1E1E1E" : "#E5E5E5";
    const indigo = dark ? "#818CF8" : "#6366F1";
    const emerald = dark ? "#34D399" : "#10B981";

    return {
      backgroundColor: "transparent",
      animationDurationUpdate: 300,
      animationEasingUpdate: "cubicOut",
      textStyle: { color: text, fontFamily: "var(--font-inter), sans-serif" },
      legend: {
        top: 0,
        right: 48,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 6,
        textStyle: { color: muted },
        data: ["Download", "Upload"],
      },
      toolbox: {
        right: 0,
        iconStyle: { borderColor: muted },
        feature: {
          saveAsImage: { title: "PNG", backgroundColor: dark ? "#0A0A0A" : "#FAFAFA" },
          restore: { title: "Reset" },
          dataZoom: { title: { zoom: "Zoom", back: "Back" } },
        },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: dark ? "#141414" : "#FFFFFF",
        borderColor: grid,
        textStyle: { color: text, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 12 },
        // "14:30:25 — DL: 125.4 Mbps / UL: 48.2 Mbps"
        formatter: (params: Array<{ value: [number, number] }>) => {
          const [dl, ul] = params;
          const time = new Date(dl.value[0]).toLocaleTimeString("en-GB");
          return `${time} — DL: ${formatMbps(dl.value[1])} / UL: ${formatMbps(ul?.value[1] ?? 0)}`;
        },
      },
      grid: { left: 8, right: 8, top: 36, bottom: 56, containLabel: true },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: grid } },
        axisLabel: { color: muted, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "Mbps",
        nameTextStyle: { color: muted },
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: grid, type: "dashed" } },
      },
      dataZoom: [
        { type: "inside", throttle: 50 },
        {
          type: "slider",
          height: 24,
          bottom: 8,
          borderColor: grid,
          fillerColor: dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.10)",
          handleStyle: { color: indigo },
          textStyle: { color: muted },
        },
      ],
      series: [
        {
          name: "Download",
          type: "line",
          showSymbol: false,
          smooth: 0.3,
          lineStyle: { width: 2, color: indigo },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: dark ? "rgba(129,140,248,0.35)" : "rgba(99,102,241,0.25)" },
                { offset: 1, color: "rgba(99,102,241,0)" },
              ],
            },
          },
          data: [] as [number, number][],
        },
        {
          name: "Upload",
          type: "line",
          showSymbol: false,
          smooth: 0.3,
          lineStyle: { width: 2, color: emerald },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: dark ? "rgba(52,211,153,0.30)" : "rgba(16,185,129,0.20)" },
                { offset: 1, color: "rgba(16,185,129,0)" },
              ],
            },
          },
          data: [] as [number, number][],
        },
      ],
    };
  }, [dark]);

  // Re-apply the rolling buffer after the option object is replaced
  // (e.g. theme flip re-creates axes/colors with empty series data).
  useEffect(() => {
    const buf = bufferRef.current;
    chartRef.current?.getEchartsInstance().setOption({
      series: [{ data: buf.rx }, { data: buf.tx }],
    });
  }, [option]);

  // Stream ended (no active sessions) — friendly empty state with retry.
  if (streamEnded) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed",
          className,
        )}
      >
        <Radio className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div className="text-center">
          <p className="text-sm font-medium">No active PPPoE sessions</p>
          <p className="text-xs text-muted-foreground">
            Traffic streaming starts as soon as a subscriber connects.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("content-fade-in", className)}>
      {/* Header: live status + session count (left) · refresh cadence (right) */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                status === "open" && "bg-success animate-led-pulse",
                status === "connecting" && "bg-warning",
                status === "error" && "bg-warning animate-pulse",
                status === "closed" && "bg-muted-foreground",
              )}
              aria-hidden="true"
            />
            {STATUS_LABEL[status]}
          </span>
          {sessionCount !== null && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {sessionCount} session{sessionCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Refresh</span>
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            aria-label="Chart refresh interval"
            className="rounded-md border bg-card px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {REFRESH_INTERVALS.map((o) => (
              <option key={o.ms} value={o.ms}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge={false}
        lazyUpdate
      />

      {/* Live top talkers */}
      {topSessions.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            Top sessions by download
          </div>
          <ul className="divide-y divide-border">
            {topSessions.map((s) => (
              <li
                key={s.username}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.username}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {s.ip}
                    {s.rate_limit ? ` · ${s.rate_limit}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs">
                  <span className="block text-chart-1">↓ {formatMbps(s.download_mbps)}</span>
                  <span className="block text-chart-2">↑ {formatMbps(s.upload_mbps)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
