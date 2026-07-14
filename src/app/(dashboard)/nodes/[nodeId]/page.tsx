import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
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

  // Attempt to fetch live health data from both public endpoints concurrently
  let healthData: Record<string, unknown> | null = null;
  let readyData: Record<string, unknown> | null = null;
  try {
    const baseUrl = node.url.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const [healthRes, readyRes] = await Promise.all([
      fetch(`${baseUrl}/health`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null),
      fetch(`${baseUrl}/health/ready`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null),
    ]);

    clearTimeout(timer);

    if (healthRes?.ok) {
      healthData = await healthRes.json();
    }
    if (readyRes?.ok) {
      readyData = await readyRes.json();
    }
  } catch {
    // Node unreachable — show stored data only
  }

  // Update DB status based on health check result (single source of truth)
  const isReachable = healthData !== null;
  const newStatus = isReachable ? "online" : "offline";
  if (node.status !== newStatus || isReachable) {
    await prisma.node.update({
      where: { id: node.id },
      data: {
        status: newStatus,
        ...(isReachable ? { lastSeen: new Date() } : {}),
      },
    });
  }

  const version = healthData?.version as string | undefined;
  const uptime = healthData?.uptime_seconds as number | undefined;
  // accel-ppp version comes from /health/ready checks array
  const checks = (readyData?.checks ?? []) as Array<{
    service?: string;
    detail?: string;
  }>;
  const accelCheck = checks.find((c) => c.service === "accel-ppp");
  const accelVersion = accelCheck?.detail as string | undefined;
  const tags = safeParseTags(node.tags);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="dawos-agent"
          value={version ?? "Unknown"}
          icon={Server}
          variant="default"
          description={accelVersion ? `accel-ppp: ${accelVersion}` : undefined}
        />
        <StatCard
          title="Uptime"
          value={uptime ? formatUptime(uptime) : "—"}
          icon={Clock}
          variant="success"
        />
        <StatCard
          title="Location"
          value={node.location || "Not set"}
          icon={MapPin}
          variant="warning"
        />
        <StatCard
          title="Last Seen"
          value={node.lastSeen ? formatDate(node.lastSeen) : "Never"}
          icon={Activity}
          variant="default"
        />
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
