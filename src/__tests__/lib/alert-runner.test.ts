import { describe, it, expect, vi } from "vitest";
import { runAlertCycle, type RunnerRule } from "@/lib/alert-runner";
import type { NodeSnapshot } from "@/lib/alerts";

const NODES = [
  { id: "n1", name: "accel-2" },
  { id: "n2", name: "dawos-dev" },
];

const offlineSnap: NodeSnapshot = {
  online: false,
  cpu_percent: 0,
  mem_percent: 0,
  disk_percent: 0,
  session_count: 0,
};
const onlineSnap: NodeSnapshot = {
  online: true,
  cpu_percent: 10,
  mem_percent: 10,
  disk_percent: 10,
  session_count: 1,
};

function rule(over: Partial<RunnerRule> = {}): RunnerRule {
  return {
    id: "r1",
    name: "Offline",
    nodeId: null,
    metric: "node_offline",
    operator: "gt",
    threshold: 0,
    enabled: true,
    ...over,
  };
}

describe("runAlertCycle", () => {
  it("fires an alert per breaching node and returns them", async () => {
    const onFire = vi.fn();
    const fired = await runAlertCycle({
      rules: [rule()],
      nodes: NODES,
      getSnapshot: async () => offlineSnap,
      onFire,
      cooldownMs: 60_000,
      cooldown: new Map(),
      now: 1_000,
    });
    expect(fired).toHaveLength(2);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(fired[0]).toMatchObject({
      ruleId: "r1",
      nodeId: "n1",
      nodeName: "accel-2",
      message: "Node is offline",
    });
  });

  it("skips disabled rules", async () => {
    const getSnapshot = vi.fn(async () => offlineSnap);
    const fired = await runAlertCycle({
      rules: [rule({ enabled: false })],
      nodes: NODES,
      getSnapshot,
      onFire: vi.fn(),
      cooldownMs: 60_000,
      cooldown: new Map(),
      now: 0,
    });
    expect(fired).toHaveLength(0);
    // No enabled rules → snapshot never fetched.
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("only evaluates node-scoped rules on their node", async () => {
    const getSnapshot = vi.fn(async () => offlineSnap);
    const fired = await runAlertCycle({
      rules: [rule({ nodeId: "n1" })],
      nodes: NODES,
      getSnapshot,
      onFire: vi.fn(),
      cooldownMs: 60_000,
      cooldown: new Map(),
      now: 0,
    });
    expect(fired.map((f) => f.nodeId)).toEqual(["n1"]);
    // n2 has no applicable rule → its snapshot is never fetched.
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledWith("n1");
  });

  it("does not fire when nothing breaches", async () => {
    const onFire = vi.fn();
    const fired = await runAlertCycle({
      rules: [rule({ metric: "cpu_percent", operator: "gt", threshold: 90 })],
      nodes: [NODES[0]],
      getSnapshot: async () => onlineSnap,
      onFire,
      cooldownMs: 60_000,
      cooldown: new Map(),
      now: 0,
    });
    expect(fired).toHaveLength(0);
    expect(onFire).not.toHaveBeenCalled();
  });

  it("suppresses repeat alerts within the cooldown window, then re-fires after it", async () => {
    const cooldown = new Map<string, number>();
    const base = {
      rules: [rule({ nodeId: "n1" })],
      nodes: [NODES[0]],
      getSnapshot: async () => offlineSnap,
      onFire: vi.fn(),
      cooldownMs: 60_000,
      cooldown,
    };
    const first = await runAlertCycle({ ...base, now: 1_000 });
    expect(first).toHaveLength(1);

    // 30s later — still inside the 60s cooldown.
    const second = await runAlertCycle({ ...base, now: 31_000 });
    expect(second).toHaveLength(0);

    // 61s after the first — cooldown elapsed.
    const third = await runAlertCycle({ ...base, now: 62_000 });
    expect(third).toHaveLength(1);
  });
});
