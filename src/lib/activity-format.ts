/**
 * Human-readable presentation for an AuditLog `action` string.
 * Actions look like `node.create`, `node.delete`, or
 * `proxy.<method>.<agent/path>` (e.g. `proxy.post.sessions/terminate`).
 */

export type ActivityTone = "default" | "create" | "destructive" | "update";

export interface FormattedActivity {
  label: string;
  tone: ActivityTone;
}

const NODE_ACTIONS: Record<string, FormattedActivity> = {
  "node.create": { label: "Registered node", tone: "create" },
  "node.update": { label: "Updated node connection", tone: "update" },
  "node.delete": { label: "Removed node", tone: "destructive" },
};

/** Verb + tone for an HTTP method used in a proxy action. */
function methodVerb(method: string): { verb: string; tone: ActivityTone } {
  switch (method) {
    case "post":
      return { verb: "Ran", tone: "create" };
    case "put":
    case "patch":
      return { verb: "Updated", tone: "update" };
    case "delete":
      return { verb: "Deleted", tone: "destructive" };
    default:
      return { verb: "Called", tone: "default" };
  }
}

/** Turn a dawos-agent path into a readable phrase: `sessions/terminate` → "sessions terminate". */
function prettyPath(path: string): string {
  return path.replace(/\//g, " ").replace(/-/g, " ").replace(/_/g, " ").trim();
}

/**
 * Format an audit action into a label + semantic tone for the activity feed.
 */
export function formatActivity(action: string): FormattedActivity {
  if (action in NODE_ACTIONS) return NODE_ACTIONS[action];

  const proxy = /^proxy\.(get|post|put|patch|delete)\.(.+)$/.exec(action);
  if (proxy) {
    const [, method, path] = proxy;
    const { verb, tone } = methodVerb(method);
    return { label: `${verb} ${prettyPath(path)}`, tone };
  }

  // Unknown/legacy action — show it verbatim.
  return { label: action.replace(/[._]/g, " "), tone: "default" };
}

/** Parse the JSON `detail` blob into a compact, human string (best-effort). */
export function formatDetail(detail: string | null): string | null {
  if (!detail) return null;
  try {
    const obj = JSON.parse(detail) as Record<string, unknown>;
    if ("status" in obj) {
      const ok = obj.ok === true || obj.status === 200 || obj.status === 204;
      return `${ok ? "ok" : "failed"} · HTTP ${String(obj.status)}`;
    }
    return Object.entries(obj)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" · ");
  } catch {
    return detail.length > 80 ? `${detail.slice(0, 80)}…` : detail;
  }
}
