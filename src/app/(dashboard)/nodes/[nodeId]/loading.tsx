import { StatCardSkeleton } from "@/components/dashboard/stat-card";
import { SkeletonText } from "@/components/shared/skeleton-blocks";

/**
 * Loading skeleton for the node detail page.
 * Renders a stat card row plus an info-card text skeleton to match the layout.
 */
export default function NodeDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
