import { describe, it, expect } from "vitest";
import {
  ALERT_METRICS,
  evaluateRule,
  metricLabel,
  metricUnit,
  snapshotValue,
  type AlertMetric,
  type NodeSnapshot,
} from "@/lib/alerts";

const online: NodeSnapshot = {
  online: true,
  cpu_percent: 40,
  mem_percent: 55,
  disk_percent: 70,
  session_count: 12,
};
const offline: NodeSnapshot = {
  online: false,
  cpu_percent: 0,
  mem_percent: 0,
  disk_percent: 0,
  session_count: 0,
};

describe("metricLabel", () => {
  it("returns the label for a known metric", () => {
    expect(metricLabel("cpu_percent")).toBe("CPU usage");
  });
  it("falls back to the raw metric when unknown", () => {
    expect(metricLabel("bogus" as AlertMetric)).toBe("bogus");
  });
});

describe("metricUnit", () => {
  it("returns the unit for a known metric", () => {
    expect(metricUnit("cpu_percent")).toBe("%");
    expect(metricUnit("session_count")).toBe("");
  });
  it("falls back to an empty string when unknown", () => {
    expect(metricUnit("bogus" as AlertMetric)).toBe("");
  });
});

describe("snapshotValue", () => {
  it("reads each threshold metric", () => {
    expect(snapshotValue("cpu_percent", online)).toBe(40);
    expect(snapshotValue("mem_percent", online)).toBe(55);
    expect(snapshotValue("disk_percent", online)).toBe(70);
    expect(snapshotValue("session_count", online)).toBe(12);
  });
  it("maps node_offline to 0 when online and 1 when offline", () => {
    expect(snapshotValue("node_offline", online)).toBe(0);
    expect(snapshotValue("node_offline", offline)).toBe(1);
  });
});

describe("evaluateRule", () => {
  it("node_offline: no breach when online, breach when offline", () => {
    expect(
      evaluateRule({ metric: "node_offline", operator: "gt", threshold: 0 }, online),
    ).toBeNull();
    expect(
      evaluateRule({ metric: "node_offline", operator: "gt", threshold: 0 }, offline),
    ).toEqual({ value: 1, message: "Node is offline" });
  });

  it("gt: breaches above threshold, includes unit in the message", () => {
    const breach = evaluateRule(
      { metric: "cpu_percent", operator: "gt", threshold: 30 },
      online,
    );
    expect(breach).toEqual({ value: 40, message: "CPU usage 40% > 30%" });
  });

  it("gt: no breach at or below threshold", () => {
    expect(
      evaluateRule({ metric: "cpu_percent", operator: "gt", threshold: 40 }, online),
    ).toBeNull();
  });

  it("lt: breaches below threshold", () => {
    const breach = evaluateRule(
      { metric: "session_count", operator: "lt", threshold: 20 },
      online,
    );
    expect(breach).toEqual({ value: 12, message: "Active sessions 12 < 20" });
  });

  it("lt: no breach at or above threshold", () => {
    expect(
      evaluateRule({ metric: "session_count", operator: "lt", threshold: 12 }, online),
    ).toBeNull();
  });
});

describe("ALERT_METRICS", () => {
  it("marks node_offline as threshold-less and the rest as threshold metrics", () => {
    const offlineMeta = ALERT_METRICS.find((m) => m.value === "node_offline");
    expect(offlineMeta?.threshold).toBe(false);
    expect(ALERT_METRICS.filter((m) => m.threshold)).toHaveLength(4);
  });
});
