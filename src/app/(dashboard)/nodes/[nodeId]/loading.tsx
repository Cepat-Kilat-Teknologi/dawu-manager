import { SkeletonDetail } from "@/components/shared/loading-skeleton";

/**
 * Loading skeleton for the node detail page.
 * Renders a SkeletonDetail placeholder while the node data is being fetched.
 */
export default function NodeDetailLoading() {
  return <SkeletonDetail />;
}
