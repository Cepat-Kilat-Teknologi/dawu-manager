import { StatCardSkeleton } from "@/components/dashboard/stat-card";
import { SkeletonTile } from "@/components/shared/skeleton-blocks";

/**
 * Loading skeleton for the dashboard page.
 * Mirrors the final layout (stat card row + node grid) to avoid layout shift.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-32 rounded-md" />
        <div className="skeleton-shimmer h-4 w-56 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTile key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}
