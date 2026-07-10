import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatUptime } from "@/lib/utils";
import { Clock, Server, MapPin, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

interface NodeDetailPageProps {
  params: Promise<{ nodeId: string }>;
}

/**
 * Safely parse a JSON string as an array of strings.
 * Returns an empty array if the input is null, undefined, or invalid JSON.
 */
function safeParseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Node overview page (server component).
 * Displays health stats, version info, uptime, and metadata.
 * The header and sub-navigation are rendered by the parent layout.
 */
export default async function NodeDetailPage({ params }: NodeDetailPageProps) {
  const { nodeId } = await params;

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
  });

  if (!node) {
    notFound();
  }

  // Attempt to fetch live health data
  let healthData: Record<string, unknown> | null = null;
  try {
    const healthUrl = `${node.url.replace(/\/+$/, "")}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(healthUrl, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      healthData = await res.json();
    }
  } catch {
    // Node unreachable — show stored data only
  }

  const version = healthData?.version as string | undefined;
  const uptime = healthData?.uptime_seconds as number | undefined;
  const accelVersion = healthData?.accel_version as string | undefined;
  const tags = safeParseTags(node.tags);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              dawos-agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {version ?? "Unknown"}
            </p>
            {accelVersion && (
              <p className="text-xs text-muted-foreground mt-1">
                accel-ppp: {accelVersion}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {uptime ? formatUptime(uptime) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {node.location || "Not set"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Last Seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {node.lastSeen ? formatDate(node.lastSeen) : "Never"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Node information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Node Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Node ID</dt>
              <dd className="font-mono text-xs mt-1">{node.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1">{formatDate(node.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Last Seen</dt>
              <dd className="mt-1">
                {node.lastSeen ? formatDate(node.lastSeen) : "Never"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Tags</dt>
              <dd className="mt-1">
                {tags.length > 0 ? tags.join(", ") : "None"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
