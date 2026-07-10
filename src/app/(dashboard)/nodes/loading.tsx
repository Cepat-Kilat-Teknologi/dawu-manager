import { SkeletonNodeCard } from "@/components/shared/loading-skeleton";

/**
 * Loading skeleton for the nodes list page.
 * Shows placeholder node cards while data is being fetched.
 */
export default function NodesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonNodeCard key={i} />
        ))}
      </div>
    </div>
  );
}
