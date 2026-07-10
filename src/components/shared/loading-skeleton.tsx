import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton placeholder with pulse animation.
 * Used as a building block for all other skeleton variants.
 * @param className - Controls the skeleton's dimensions (h-*, w-*)
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton placeholder for a generic card with title, value, and description lines.
 * @param className - Additional CSS classes
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-3", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

/**
 * Skeleton placeholder for a dashboard stat card (icon + value + description).
 * @param className - Additional CSS classes
 */
export function SkeletonStatCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

/**
 * Skeleton placeholder for a node card (name, URL, status badge, last-seen).
 * @param className - Additional CSS classes
 */
export function SkeletonNodeCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for a data table with configurable rows and columns.
 * @param rows - Number of body rows to display (default: 5)
 * @param cols - Number of columns per row (default: 4)
 * @param className - Additional CSS classes
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: SkeletonProps & { rows?: number; cols?: number }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {/* Header */}
      <div className="flex gap-4 border-b p-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-4 border-b last:border-0 p-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`r-${r}-c-${c}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for a detail page (header with icon + stat grid + info card).
 * Used as the loading state for node detail pages.
 * @param className - Additional CSS classes
 */
export function SkeletonDetail({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      {/* Info card */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
