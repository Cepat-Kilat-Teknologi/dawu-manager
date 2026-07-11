import type { NodeSnapshot } from "@/lib/alerts";

/** Snapshot returned when a node is unreachable. */
const OFFLINE: NodeSnapshot = {
  online: false,
  cpu_percent: 0,
  mem_percent: 0,
  disk_percent: 0,
  session_count: 0,
};

/**
 * Build a {@link NodeSnapshot} for one node by querying its metrics and session
 * stats through the BFF proxy. A failed/`!ok` metrics fetch is treated as the
 * node being offline (which is what the `node_offline` alert watches for).
 */
export async function fetchNodeSnapshot(nodeId: string): Promise<NodeSnapshot> {
  try {
    const res = await fetch(`/api/nodes/${nodeId}/proxy/system/metrics`);
    if (!res.ok) return OFFLINE;
    const m = (await res.json()) as {
      cpu?: { percent?: number };
      memory?: { percent?: number };
      disk?: { percent?: number };
    };

    let session_count = 0;
    try {
      const s = await fetch(`/api/nodes/${nodeId}/proxy/sessions/stats`);
      if (s.ok) {
        const stats = (await s.json()) as { active?: number | string };
        session_count = Number(stats.active) || 0;
      }
    } catch {
      // Session stats are best-effort — leave at 0.
    }

    return {
      online: true,
      cpu_percent: m.cpu?.percent ?? 0,
      mem_percent: m.memory?.percent ?? 0,
      disk_percent: m.disk?.percent ?? 0,
      session_count,
    };
  } catch {
    return OFFLINE;
  }
}
