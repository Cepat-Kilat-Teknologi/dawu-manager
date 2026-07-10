"use client";

import dynamic from "next/dynamic";

/**
 * Lazily loaded traffic chart — ECharts is heavy (~1MB), so it is
 * code-split and only fetched on pages that render it. SSR is disabled
 * because ECharts requires a real canvas.
 */
export const TrafficChartLazy = dynamic(
  () => import("@/components/charts/traffic-chart").then((m) => m.TrafficChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="skeleton-shimmer aspect-video w-full rounded-xl"
        role="status"
        aria-label="Loading chart"
      />
    ),
  },
);
