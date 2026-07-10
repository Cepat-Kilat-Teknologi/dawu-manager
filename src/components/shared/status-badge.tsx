import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { type NodeStatus, NODE_STATUS } from "@/lib/constants";

/** Visual style configuration for each node status (label, badge colors, dot color). */
const statusConfig: Record<
  NodeStatus,
  { label: string; className: string; dot: string }
> = {
  [NODE_STATUS.ONLINE]: {
    label: "Online",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  [NODE_STATUS.OFFLINE]: {
    label: "Offline",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    dot: "bg-red-500",
  },
  [NODE_STATUS.DEGRADED]: {
    label: "Degraded",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  [NODE_STATUS.UNKNOWN]: {
    label: "Unknown",
    className: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

interface StatusBadgeProps {
  status: NodeStatus | string;
  className?: string;
  showDot?: boolean;
}

/**
 * Colored badge indicating a node's operational status (online/offline/degraded/unknown).
 * Includes an optional animated dot indicator and uses color-coded styles for quick identification.
 * @param status - Node status value (online | offline | degraded | unknown)
 * @param className - Additional CSS classes to apply to the badge
 * @param showDot - Whether to render the colored dot indicator (default: true)
 */
export function StatusBadge({
  status,
  className,
  showDot = true,
}: StatusBadgeProps) {
  const config = statusConfig[status as NodeStatus] ?? statusConfig.unknown;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", config.className, className)}
    >
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
          aria-hidden="true"
        />
      )}
      {config.label}
    </Badge>
  );
}
