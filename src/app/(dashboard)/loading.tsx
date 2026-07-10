import {
  SkeletonStatCard,
  SkeletonNodeCard,
} from "@/components/shared/loading-skeleton";

/**
 * Loading skeleton for the dashboard page.
 * Shows placeholder stat cards and node cards while data is being fetched.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonNodeCard key={i} />
        ))}
      </div>
    </div>
  );
}
