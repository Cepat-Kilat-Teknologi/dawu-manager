/**
 * Alerting domain logic — metric definitions + pure rule evaluation.
 * Shared by the /alerts UI, the client-side evaluator, and the API routes.
 */

export type AlertMetric =
  | "node_offline"
  | "cpu_percent"
  | "mem_percent"
  | "disk_percent"
  | "session_count";

export type AlertOperator = "gt" | "lt";

/** A point-in-time view of one node, assembled from health + metrics + stats. */
export interface NodeSnapshot {
  online: boolean;
  cpu_percent: number;
  mem_percent: number;
  disk_percent: number;
  session_count: number;
}

/** Minimal rule shape needed to evaluate (a DB AlertRule is a superset). */
export interface EvaluableRule {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
}

/** UI metadata for each supported metric. */
export const ALERT_METRICS: {
  value: AlertMetric;
  label: string;
  unit: string;
  /** node_offline is a boolean condition — no threshold/operator needed. */
  threshold: boolean;
}[] = [
  { value: "node_offline", label: "Node offline", unit: "", threshold: false },
  { value: "cpu_percent", label: "CPU usage", unit: "%", threshold: true },
  { value: "mem_percent", label: "Memory usage", unit: "%", threshold: true },
  { value: "disk_percent", label: "Disk usage", unit: "%", threshold: true },
  { value: "session_count", label: "Active sessions", unit: "", threshold: true },
];

/** Human label for a metric value (used in messages/UI). */
export function metricLabel(metric: AlertMetric): string {
  return ALERT_METRICS.find((m) => m.value === metric)?.label ?? metric;
}

/** Unit suffix for a metric value (e.g. `%`); empty string when unitless. */
export function metricUnit(metric: AlertMetric): string {
  return ALERT_METRICS.find((m) => m.value === metric)?.unit ?? "";
}

/** Read the numeric value of a threshold metric from a snapshot. */
export function snapshotValue(metric: AlertMetric, snap: NodeSnapshot): number {
  switch (metric) {
    case "cpu_percent":
      return snap.cpu_percent;
    case "mem_percent":
      return snap.mem_percent;
    case "disk_percent":
      return snap.disk_percent;
    case "session_count":
      return snap.session_count;
    case "node_offline":
      return snap.online ? 0 : 1;
  }
}

export interface Breach {
  value: number;
  message: string;
}

/**
 * Evaluate a rule against a node snapshot.
 * @returns a {@link Breach} when the condition is met, otherwise `null`.
 */
export function evaluateRule(
  rule: EvaluableRule,
  snap: NodeSnapshot,
): Breach | null {
  if (rule.metric === "node_offline") {
    return snap.online ? null : { value: 1, message: "Node is offline" };
  }

  const value = snapshotValue(rule.metric, snap);
  const breached =
    rule.operator === "gt" ? value > rule.threshold : value < rule.threshold;
  if (!breached) return null;

  const unit = metricUnit(rule.metric);
  const cmp = rule.operator === "gt" ? ">" : "<";
  return {
    value,
    message: `${metricLabel(rule.metric)} ${value}${unit} ${cmp} ${rule.threshold}${unit}`,
  };
}
