/**
 * Alert evaluation cycle — pure orchestration, decoupled from timers and I/O so
 * it can be unit-tested in isolation. The hook wires real fetches + a setInterval
 * to this; tests inject fakes.
 */
import { evaluateRule, type AlertMetric, type NodeSnapshot } from "@/lib/alerts";

export interface RunnerRule {
  id: string;
  name: string;
  nodeId: string | null;
  metric: AlertMetric;
  operator: "gt" | "lt";
  threshold: number;
  enabled: boolean;
}

export interface RunnerNode {
  id: string;
  name: string;
}

/** Payload recorded when a rule breaches on a node. */
export interface FiredAlert {
  ruleId: string;
  ruleName: string;
  nodeId: string;
  nodeName: string;
  metric: AlertMetric;
  value: number;
  threshold: number;
  message: string;
}

export interface RunCycleDeps {
  rules: RunnerRule[];
  nodes: RunnerNode[];
  /** Assemble a snapshot for a node (must resolve; unreachable → online:false). */
  getSnapshot: (nodeId: string) => Promise<NodeSnapshot>;
  /** Called once per NEW breach (past the cooldown). */
  onFire: (alert: FiredAlert) => Promise<void> | void;
  /** Per (rule,node) suppression window in ms. */
  cooldownMs: number;
  /** Mutable last-fired map keyed by `ruleId:nodeId`. */
  cooldown: Map<string, number>;
  /** Current time in ms (injected for determinism). */
  now: number;
}

/**
 * Run one evaluation pass across all nodes × enabled rules, firing (and
 * cooling down) any breaches. Returns the alerts fired this cycle.
 */
export async function runAlertCycle(deps: RunCycleDeps): Promise<FiredAlert[]> {
  const { rules, nodes, getSnapshot, onFire, cooldownMs, cooldown, now } = deps;
  const enabled = rules.filter((r) => r.enabled);
  const fired: FiredAlert[] = [];

  for (const node of nodes) {
    const applicable = enabled.filter(
      (r) => r.nodeId === null || r.nodeId === node.id,
    );
    if (applicable.length === 0) continue;

    const snap = await getSnapshot(node.id);

    for (const rule of applicable) {
      const breach = evaluateRule(rule, snap);
      if (!breach) continue;

      const key = `${rule.id}:${node.id}`;
      if (now - (cooldown.get(key) ?? -Infinity) < cooldownMs) continue;
      cooldown.set(key, now);

      const alert: FiredAlert = {
        ruleId: rule.id,
        ruleName: rule.name,
        nodeId: node.id,
        nodeName: node.name,
        metric: rule.metric,
        value: breach.value,
        threshold: rule.threshold,
        message: breach.message,
      };
      fired.push(alert);
      await onFire(alert);
    }
  }

  return fired;
}
