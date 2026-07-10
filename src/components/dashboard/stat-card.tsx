import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

/** Semantic color variants for stat card icons. */
type StatVariant = "default" | "success" | "warning" | "danger";

const variantStyles: Record<StatVariant, string> = {
  default: "text-primary bg-primary/10",
  success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  danger: "text-red-600 bg-red-500/10 dark:text-red-400",
};

/** Props for the StatCard component. */
interface StatCardProps {
  /** Metric label displayed in the card header. */
  title: string;
  /** Primary numeric or text value to display prominently. */
  value: string | number;
  /** Optional description shown below the value. */
  description?: string;
  /** Optional Lucide icon displayed in the card header. */
  icon?: LucideIcon;
  /** Semantic color variant for the icon (default: "default"). */
  variant?: StatVariant;
  /** Optional trend indicator with percentage value and label. */
  trend?: {
    /** Percentage change — positive, negative, or zero. */
    value: number;
    /** Short description of the trend period (e.g. "from last month"). */
    label: string;
  };
  /** Additional CSS classes for the card container. */
  className?: string;
}

/**
 * Dashboard statistic card component.
 * Displays a key metric with optional icon, description, and trend indicator.
 * Icons are color-coded by variant for quick visual scanning.
 * Trend values are color-coded: green for positive, red for negative.
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", variantStyles[variant])}>
            <Icon
              className="h-4 w-4"
              aria-hidden="true"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend && (
              <span
                className={cn(
                  "font-medium mr-1",
                  trend.value > 0
                    ? "text-emerald-600"
                    : trend.value < 0
                      ? "text-red-600"
                      : "text-muted-foreground",
                )}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
            )}
            {description || trend?.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
