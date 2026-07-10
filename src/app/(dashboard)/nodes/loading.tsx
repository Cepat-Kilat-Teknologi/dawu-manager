import { SkeletonTable } from "@/components/shared/skeleton-blocks";

/**
 * Loading skeleton for the nodes list page.
 * Shows a header placeholder and a table skeleton while data is fetched.
 */
export default function NodesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-24 rounded-md" />
          <div className="skeleton-shimmer h-4 w-48 rounded-md" />
        </div>
        <div className="skeleton-shimmer h-9 w-28 rounded-md" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
