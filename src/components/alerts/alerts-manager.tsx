"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SkeletonText } from "@/components/shared/skeleton-blocks";
import {
  ALERT_METRICS,
  metricLabel,
  metricUnit,
  type AlertMetric,
  type AlertOperator,
} from "@/lib/alerts";
import { runAlertCycle, type RunnerRule } from "@/lib/alert-runner";
import { fetchNodeSnapshot } from "@/lib/alert-snapshot";
import {
  BellRing,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Play,
  AlertTriangle,
} from "lucide-react";

interface AlertRule extends RunnerRule {
  webhookUrl: string | null;
}
interface AlertEvent {
  id: string;
  ruleName: string;
  nodeName: string | null;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  createdAt: string;
}
export interface AlertsNodeOption {
  id: string;
  name: string;
}

/** How often the in-page evaluator runs while the Alerts page is open. */
const CYCLE_MS = 60_000;
/** Per (rule,node) suppression window. */
const COOLDOWN_MS = 5 * 60_000;

const EMPTY_FORM = {
  id: "",
  name: "",
  nodeId: "",
  metric: "cpu_percent" as AlertMetric,
  operator: "gt" as AlertOperator,
  threshold: "90",
  webhookUrl: "",
};

/** Readable one-line condition for a rule. */
function ruleCondition(rule: AlertRule): string {
  if (rule.metric === "node_offline") return "Node goes offline";
  const cmp = rule.operator === "gt" ? ">" : "<";
  return `${metricLabel(rule.metric)} ${cmp} ${rule.threshold}${metricUnit(rule.metric)}`;
}

/**
 * Alerting control centre: manage threshold rules per node, evaluate them
 * against live node metrics while the page is open (client-side; server-side
 * scheduling is a future step), and review fired-alert history.
 */
export function AlertsManager({ nodes }: { nodes: AlertsNodeOption[] }) {
  const queryClient = useQueryClient();
  const cooldown = useRef(new Map<string, number>());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const rulesQuery = useQuery<{ rules: AlertRule[] }>({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/rules");
      if (!res.ok) throw new Error("Failed to load rules");
      return res.json();
    },
  });
  const eventsQuery = useQuery<{ events: AlertEvent[] }>({
    queryKey: ["alert-events"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/events");
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const rules = rulesQuery.data?.rules ?? [];
  const events = eventsQuery.data?.events ?? [];
  const needsThreshold = form.metric !== "node_offline";

  /** Evaluate every enabled rule against live node metrics once. */
  async function runCycle(manual: boolean) {
    if (manual) setChecking(true);
    try {
      const fired = await runAlertCycle({
        rules,
        nodes,
        getSnapshot: fetchNodeSnapshot,
        cooldownMs: COOLDOWN_MS,
        cooldown: cooldown.current,
        now: Date.now(),
        onFire: async (alert) => {
          toast.error(`Alert: ${alert.ruleName}`, {
            description: `${alert.nodeName} — ${alert.message}`,
          });
          await fetch("/api/alerts/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alert),
          }).catch(() => {});
        },
      });
      if (fired.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      } else if (manual) {
        toast.success("No alerts triggered", {
          description: "All monitored metrics are within their thresholds.",
        });
      }
    } finally {
      if (manual) setChecking(false);
    }
  }

  // Auto-evaluate on an interval while the page is mounted. Keep a latest-ref of
  // runCycle so the fixed interval always calls the current closure (fresh rules)
  // without resubscribing every render.
  const runRef = useRef(runCycle);
  useEffect(() => {
    runRef.current = runCycle;
  });
  useEffect(() => {
    const id = setInterval(() => runRef.current(false), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }
  function openEdit(rule: AlertRule) {
    setForm({
      id: rule.id,
      name: rule.name,
      nodeId: rule.nodeId ?? "",
      metric: rule.metric,
      operator: rule.operator,
      threshold: String(rule.threshold),
      webhookUrl: rule.webhookUrl ?? "",
    });
    setDialogOpen(true);
  }

  async function saveRule() {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        nodeId: form.nodeId || null,
        metric: form.metric,
        operator: form.operator,
        threshold: Number(form.threshold) || 0,
        webhookUrl: form.webhookUrl || null,
      };
      const res = await fetch(
        form.id ? `/api/alerts/rules/${form.id}` : "/api/alerts/rules",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not save rule", { description: data.error });
        return;
      }
      toast.success(form.id ? "Rule updated" : "Rule created");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: AlertRule) {
    await fetch(`/api/alerts/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
  }

  async function deleteRule(id: string) {
    await fetch(`/api/alerts/rules/${id}`, { method: "DELETE" });
    toast.success("Rule deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
  }

  return (
    <div className="space-y-6">
      {/* Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Alert Rules
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCycle(true)}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Check now
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rulesQuery.isLoading ? (
            <SkeletonText lines={4} />
          ) : rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No alert rules yet. Create one to be notified when a node goes
              offline or a metric crosses a threshold.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleRule(rule)}
                    aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${rule.enabled ? "bg-success" : "bg-muted-foreground"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ruleCondition(rule)} ·{" "}
                      {rule.nodeId
                        ? (nodes.find((n) => n.id === rule.nodeId)?.name ?? "one node")
                        : "all nodes"}
                    </p>
                  </div>
                  {!rule.enabled && <Badge variant="outline">paused</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(rule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {eventsQuery.isLoading ? (
            <div className="p-4">
              <SkeletonText lines={4} />
            </div>
          ) : events.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No alerts have fired.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{ev.ruleName}</span>{" "}
                      <span className="text-muted-foreground">{ev.message}</span>
                    </p>
                    {ev.nodeName && (
                      <p className="text-xs text-muted-foreground">{ev.nodeName}</p>
                    )}
                  </div>
                  <time
                    className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                    dateTime={ev.createdAt}
                  >
                    {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Alert Rule" : "New Alert Rule"}</DialogTitle>
            <DialogDescription>
              Get notified when a node goes offline or a metric crosses a threshold.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveRule();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="High CPU on core BNG"
                required
                disabled={saving}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-node">Scope</Label>
                <select
                  id="rule-node"
                  value={form.nodeId}
                  onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All nodes</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-metric">Metric</Label>
                <select
                  id="rule-metric"
                  value={form.metric}
                  onChange={(e) =>
                    setForm({ ...form, metric: e.target.value as AlertMetric })
                  }
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {ALERT_METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {needsThreshold && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rule-op">Condition</Label>
                  <select
                    id="rule-op"
                    value={form.operator}
                    onChange={(e) =>
                      setForm({ ...form, operator: e.target.value as AlertOperator })
                    }
                    className="h-9 w-full rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="gt">Greater than</option>
                    <option value="lt">Less than</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-threshold">Threshold</Label>
                  <Input
                    id="rule-threshold"
                    inputMode="numeric"
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rule-webhook">
                Webhook URL{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="rule-webhook"
                type="url"
                value={form.webhookUrl}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                placeholder="https://hooks.example.com/…"
                disabled={saving}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.name}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.id ? "Save changes" : "Create rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deleteId && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteId(null)}
          title="Delete alert rule"
          description="This rule and its fired-alert history will be removed."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => deleteRule(deleteId)}
        />
      )}
    </div>
  );
}
