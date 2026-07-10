import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

/** Semantic color variants for stat card icons. */
type StatVariant = "default" | "success" | "warning" | "danger";

const variantStyles: Record<StatVariant, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  danger: "text-destructive bg-destructive/10",
};

/**
 * Build an SVG polyline `points` string from a series of numbers,
 * normalized into a 100×32 viewbox. Flat series render as a centered line.
 */
export function sparklinePoints(
  data: number[],
  width = 100,
  height = 32,
): string {
  if (data.length === 0) return "";
  if (data.length === 1) return `0,${height / 2} ${width},${height / 2}`;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  return data
    .map((value, i) => {
      const x = i * step;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Props for the StatCard component. */
interface StatCardProps {
  /** Metric label displayed above the value. */
  title: string;
  /** Primary numeric or text value shown prominently. */
  value: string | number;
  /** Optional description shown below the value. */
  description?: string;
  /** Optional Lucide icon shown in an accent chip (top-right). */
  icon?: LucideIcon;
  /** Semantic color variant for the icon chip (default: "default"). */
  variant?: StatVariant;
  /** Optional trend indicator: positive → green ↑, negative → red ↓. */
  trend?: {
    /** Percentage change — positive, negative, or zero. */
    value: number;
    /** Short description of the trend period (e.g. "from last hour"). */
    label?: string;
  };
  /** Optional sparkline series rendered as a tiny inline SVG. */
  sparkline?: number[];
  /** Additional CSS classes for the card container. */
  className?: string;
}

/**
 * Dashboard statistic card.
 * Shows a large heading-font value, an optional accent icon chip, a trend
 * badge with directional arrow, and an optional inline sparkline. Hover lifts
 * the card border via `.card-glow`.
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  trend,
  sparkline,
  className,
}: StatCardProps) {
  const trendPositive = trend ? trend.value > 0 : false;
  const trendNegative = trend ? trend.value < 0 : false;

  return (
    <Card className={cn("card-glow relative overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                variantStyles[variant],
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-heading text-3xl font-bold tracking-tight">
            {value}
          </p>
          {sparkline && sparkline.length > 0 && (
            <svg
              viewBox="0 0 100 32"
              preserveAspectRatio="none"
              className="h-8 w-20 text-primary"
              aria-hidden="true"
              data-testid="stat-sparkline"
            >
              <polyline
                points={sparklinePoints(sparkline)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {(description || trend) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trendPositive && "text-success",
                  trendNegative && "text-destructive",
                )}
              >
                {trendPositive && (
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {trendNegative && (
                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
            )}
            {(description || trend?.label) && (
              <span>{description || trend?.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton placeholder matching the StatCard footprint.
 * Renders a shimmering tile for zero-layout-shift loading states.
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="skeleton-shimmer h-4 w-20 rounded" />
          <div className="skeleton-shimmer h-9 w-9 rounded-lg" />
        </div>
        <div className="skeleton-shimmer h-8 w-16 rounded" />
        <div className="skeleton-shimmer h-3 w-28 rounded" />
      </CardContent>
    </Card>
  );
}
