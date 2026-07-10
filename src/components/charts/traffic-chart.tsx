"use client";

import { useEffect, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { useTheme } from "next-themes";
import { useNodeSSE, type SSEStatus } from "@/hooks/use-node-sse";
import { cn } from "@/lib/utils";

/** One traffic sample streamed from dawos-agent /traffic/sse. */
export interface TrafficSample {
  /** Unix epoch (seconds or ms) or ISO string; defaults to "now" if absent. */
  timestamp?: number | string;
  /** Download rate in Mbps (accepts rx_mbps, download_mbps, or rx bytes/s). */
  rx_mbps?: number;
  download_mbps?: number;
  rx_bps?: number;
  /** Upload rate in Mbps (accepts tx_mbps, upload_mbps, or tx bytes/s). */
  tx_mbps?: number;
  upload_mbps?: number;
  tx_bps?: number;
}

/** Rolling buffer size — 5 minutes at 1 sample/second (spec). */
const MAX_POINTS = 300;

/** Normalize a sample's timestamp into epoch milliseconds. */
function toEpochMs(ts: TrafficSample["timestamp"]): number {
  if (ts === undefined) return Date.now();
  if (typeof ts === "string") return new Date(ts).getTime();
  // Heuristic: values before year 2286 in seconds are < 1e10
  return ts < 1e10 ? ts * 1000 : ts;
}

/** Extract download Mbps from whichever field the agent provides. */
function rxMbps(s: TrafficSample): number {
  return s.rx_mbps ?? s.download_mbps ?? (s.rx_bps !== undefined ? (s.rx_bps * 8) / 1e6 : 0);
}

/** Extract upload Mbps from whichever field the agent provides. */
function txMbps(s: TrafficSample): number {
  return s.tx_mbps ?? s.upload_mbps ?? (s.tx_bps !== undefined ? (s.tx_bps * 8) / 1e6 : 0);
}

/** Format a Mbps value for tooltips/axis: "125.4 Mbps". */
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
  /** Chart height (default 380px; use "100%" inside sized containers). */
  height?: number | string;
  className?: string;
}

/**
 * Real-time traffic chart — streams download/upload rates from the node's
 * SSE endpoint through the BFF proxy and renders a two-series ECharts area
 * chart with a time axis, zoom slider, and PNG export.
 *
 * Keeps a rolling 300-point buffer (~5 min at 1s interval) in a ref and
 * pushes updates through setOption, so React never re-renders per sample.
 */
export function TrafficChart({ nodeId, height = 380, className }: TrafficChartProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const chartRef = useRef<ReactECharts | null>(null);
  const bufferRef = useRef<{ rx: [number, number][]; tx: [number, number][] }>({
    rx: [],
    tx: [],
  });

  const { status } = useNodeSSE<TrafficSample>(nodeId, "traffic/sse", {
    onMessage: (sample) => {
      if (typeof sample !== "object" || sample === null) return;
      const t = toEpochMs(sample.timestamp);
      const buf = bufferRef.current;
      buf.rx.push([t, rxMbps(sample)]);
      buf.tx.push([t, txMbps(sample)]);
      if (buf.rx.length > MAX_POINTS) buf.rx.splice(0, buf.rx.length - MAX_POINTS);
      if (buf.tx.length > MAX_POINTS) buf.tx.splice(0, buf.tx.length - MAX_POINTS);
      chartRef.current?.getEchartsInstance().setOption({
        series: [{ data: buf.rx }, { data: buf.tx }],
      });
    },
  });

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

  return (
    <div className={cn("relative content-fade-in", className)}>
      {/* Live status indicator */}
      <div className="absolute left-0 top-0 z-10 flex items-center gap-1.5 text-xs text-muted-foreground">
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
      </div>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge={false}
        lazyUpdate
        // Re-render axes/colors when theme flips; data lives in the ref
        theme={undefined}
      />
    </div>
  );
}
