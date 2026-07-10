import { cn } from "@/lib/utils";

interface BlockProps {
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Shimmer skeleton tile sized for a stat card (h-24 rounded-xl).
 * Uses the `.skeleton-shimmer` utility for a zero-layout-shift placeholder.
 */
export function SkeletonTile({ className }: BlockProps) {
  return (
    <div
      className={cn("skeleton-shimmer h-24 rounded-xl", className)}
      aria-hidden="true"
      data-testid="skeleton-tile"
    />
  );
}

/**
 * Shimmer skeleton for a data table — a header row plus `rows` body rows (h-12 each).
 * @param rows - Number of body rows to render (default: 10).
 */
export function SkeletonTable({
  rows = 10,
  className,
}: BlockProps & { rows?: number }) {
  return (
    <div
      className={cn("space-y-2", className)}
      aria-hidden="true"
      data-testid="skeleton-table"
    >
      <div className="skeleton-shimmer h-10 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-12 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Shimmer skeleton for a chart region (aspect-video).
 */
export function SkeletonChart({ className }: BlockProps) {
  return (
    <div
      className={cn("skeleton-shimmer aspect-video w-full rounded-xl", className)}
      aria-hidden="true"
      data-testid="skeleton-chart"
    />
  );
}

/**
 * Shimmer skeleton for a block of text — `lines` bars, the last one shortened.
 * @param lines - Number of text lines to render (default: 3).
 */
export function SkeletonText({
  lines = 3,
  className,
}: BlockProps & { lines?: number }) {
  return (
    <div
      className={cn("space-y-2", className)}
      aria-hidden="true"
      data-testid="skeleton-text"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "skeleton-shimmer h-4 rounded",
            i === lines - 1 ? "w-2/3" : "w-full",
          )}
        />
      ))}
    </div>
  );
}
