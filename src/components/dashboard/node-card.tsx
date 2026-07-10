import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { MapPin, ExternalLink } from "lucide-react";

/** Props for the NodeCard component. */
interface NodeCardProps {
  /** Unique node identifier (used for the detail page link). */
  id: string;
  /** Human-readable node name (e.g. "bng-jakarta-1"). */
  name: string;
  /** dawos-agent base URL (e.g. "http://192.168.1.10:8470"). */
  url: string;
  /** Current health status — online, offline, degraded, or unknown. */
  status: string;
  /** Optional physical location label. */
  location?: string | null;
  /** Timestamp of the last successful health check. */
  lastSeen?: Date | string | null;
}

/**
 * Card component for displaying a dawos-agent node in a grid.
 * Shows name, URL, health status badge, location, and last-seen timestamp.
 * The entire card is a link to the node detail page.
 */
export function NodeCard({
  id,
  name,
  url,
  status,
  location,
  lastSeen,
}: NodeCardProps) {
  return (
    <Link href={`/nodes/${id}`} className="block group">
      <Card className="transition-colors hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {name}
            </CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              {url}
            </p>
          </div>
          <StatusBadge status={status} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 truncate">
              {location && (
                <>
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {location}
                </>
              )}
              {!location && "No location set"}
            </span>
            {lastSeen && (
              <span className="shrink-0 ml-2">
                Last seen: {formatDate(lastSeen)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
