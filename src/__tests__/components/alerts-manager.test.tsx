import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";
import { AlertsManager } from "@/components/alerts/alerts-manager";
import type { RunnerRule } from "@/lib/alert-runner";

type AlertRule = RunnerRule & { webhookUrl: string | null };

const NODES = [
  { id: "n1", name: "accel-2" },
  { id: "n2", name: "dawos-dev" },
];

function rule(over: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "r1",
    name: "Rule",
    nodeId: null,
    metric: "cpu_percent",
    operator: "gt",
    threshold: 90,
    enabled: true,
    webhookUrl: null,
    ...over,
  };
}

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

interface FetchConfig {
  rules?: AlertRule[];
  events?: unknown[];
  metrics?: Record<string, { ok: boolean; body?: unknown }>;
  save?: () => Response;
  eventsPostReject?: boolean;
}

function buildFetch(cfg: FetchConfig = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/alerts/rules") && method === "GET") {
      return Promise.resolve(res({ rules: cfg.rules ?? [] }));
    }
    if (url.endsWith("/api/alerts/events") && method === "GET") {
      return Promise.resolve(res({ events: cfg.events ?? [] }));
    }
    if (url.includes("/api/alerts/rules")) {
      return Promise.resolve(cfg.save ? cfg.save() : res({ id: "r1" }, true, 201));
    }
    if (url.endsWith("/api/alerts/events") && method === "POST") {
      return cfg.eventsPostReject
        ? Promise.reject(new Error("events down"))
        : Promise.resolve(res({ id: "e1" }, true, 201));
    }
    if (url.includes("system/metrics")) {
      const id = url.split("/api/nodes/")[1].split("/")[0];
      const m = cfg.metrics?.[id] ?? { ok: true, body: {} };
      return Promise.resolve(res(m.body ?? {}, m.ok));
    }
    if (url.includes("sessions/stats")) return Promise.resolve(res({ active: 0 }));
    return Promise.resolve(res({}));
  });
  return fn as unknown as typeof fetch;
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const w = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return render(ui, { wrapper: w });
}

const fetchMock = () => global.fetch as ReturnType<typeof vi.fn>;
function findCall(pred: (c: [string, RequestInit?]) => boolean) {
  return [...fetchMock().mock.calls].reverse().find(pred as never) as
    | [string, RequestInit]
    | undefined;
}
function bodyOf(call?: [string, RequestInit]) {
  return call ? JSON.parse(String(call[1].body)) : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = buildFetch();
});
afterEach(() => vi.restoreAllMocks());

describe("AlertsManager — rendering", () => {
  it("renders rules with conditions, scope, paused state, and history", async () => {
    global.fetch = buildFetch({
      rules: [
        rule({ id: "r1", name: "CPU rule", nodeId: null, metric: "cpu_percent", threshold: 90 }),
        rule({ id: "r2", name: "Offline rule", nodeId: "n1", metric: "node_offline", enabled: false }),
        rule({ id: "r3", name: "Sessions rule", nodeId: "nX", metric: "session_count", operator: "lt", threshold: 5 }),
      ],
      events: [
        { id: "e1", ruleName: "CPU rule", nodeName: "accel-2", metric: "cpu_percent", value: 95, threshold: 90, message: "CPU usage 95% > 90%", createdAt: "2026-07-10T00:00:00Z" },
        { id: "e2", ruleName: "Offline rule", nodeName: null, metric: "node_offline", value: 1, threshold: 0, message: "Node is offline", createdAt: "2026-07-10T00:00:00Z" },
      ],
    });
    wrap(<AlertsManager nodes={NODES} />);

    expect(await screen.findByText(/CPU usage > 90%/)).toBeTruthy();
    expect(screen.getByText(/Node goes offline/)).toBeTruthy();
    expect(screen.getByText(/Active sessions < 5/)).toBeTruthy();
    expect(screen.getByText(/all nodes/)).toBeTruthy();
    expect(screen.getByText(/one node/)).toBeTruthy();
    expect(screen.getByText("paused")).toBeTruthy();
    // enabled rules get a "Disable" toggle; the disabled one gets "Enable".
    expect(screen.getAllByLabelText("Disable rule")).toHaveLength(2);
    expect(screen.getByLabelText("Enable rule")).toBeTruthy();
    // History
    expect(screen.getByText("CPU usage 95% > 90%")).toBeTruthy();
    expect(screen.getByText("Node is offline")).toBeTruthy();
    expect(screen.getAllByText(/accel-2/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty states when there are no rules or events", async () => {
    global.fetch = buildFetch({ rules: [], events: [] });
    wrap(<AlertsManager nodes={NODES} />);
    expect(await screen.findByText(/No alert rules yet/)).toBeTruthy();
    expect(screen.getByText("No alerts have fired.")).toBeTruthy();
  });

  it("renders skeletons while loading", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;
    wrap(<AlertsManager nodes={NODES} />);
    expect(screen.getAllByTestId("skeleton-text")).toHaveLength(2);
  });

  it("falls back to empty states when the queries fail", async () => {
    global.fetch = vi.fn(() => Promise.resolve(res({}, false))) as typeof fetch;
    wrap(<AlertsManager nodes={NODES} />);
    expect(await screen.findByText(/No alert rules yet/)).toBeTruthy();
    expect(screen.getByText("No alerts have fired.")).toBeTruthy();
  });
});

describe("AlertsManager — create", () => {
  it("creates a rule with all fields via POST", async () => {
    global.fetch = buildFetch({ rules: [] });
    const { container } = wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText(/No alert rules yet/);

    fireEvent.click(screen.getByText("New Rule"));
    expect(screen.getByText("New Alert Rule")).toBeTruthy();
    // Submit is disabled until a name is entered.
    expect(screen.getByText("Create rule")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "High CPU" } });
    fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "n1" } });
    fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "lt" } });
    fireEvent.change(screen.getByLabelText("Threshold"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText(/Webhook URL/), {
      target: { value: "https://h.test" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rule created"));
    const body = bodyOf(
      findCall((c) => c[0].endsWith("/api/alerts/rules") && c[1]?.method === "POST"),
    );
    expect(body).toMatchObject({
      name: "High CPU",
      nodeId: "n1",
      metric: "cpu_percent",
      operator: "lt",
      threshold: 80,
      webhookUrl: "https://h.test",
    });
  });

  it("defaults scope/webhook to null and a blank threshold to 0", async () => {
    global.fetch = buildFetch({ rules: [] });
    const { container } = wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText(/No alert rules yet/);

    fireEvent.click(screen.getByText("New Rule"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Zero" } });
    fireEvent.change(screen.getByLabelText("Threshold"), { target: { value: "" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const body = bodyOf(
      findCall((c) => c[0].endsWith("/api/alerts/rules") && c[1]?.method === "POST"),
    );
    expect(body).toMatchObject({ nodeId: null, threshold: 0, webhookUrl: null });
  });

  it("closes the create dialog on cancel", async () => {
    global.fetch = buildFetch({ rules: [] });
    wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText(/No alert rules yet/);

    fireEvent.click(screen.getByText("New Rule"));
    expect(screen.getByText("New Alert Rule")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("New Alert Rule")).toBeNull();
  });

  it("hides the threshold when the metric is node_offline", async () => {
    global.fetch = buildFetch({ rules: [] });
    wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText(/No alert rules yet/);

    fireEvent.click(screen.getByText("New Rule"));
    expect(screen.getByLabelText("Threshold")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Metric"), {
      target: { value: "node_offline" },
    });
    expect(screen.queryByLabelText("Threshold")).toBeNull();
    expect(screen.queryByLabelText("Condition")).toBeNull();
  });

  it("surfaces a server error message on save failure", async () => {
    global.fetch = buildFetch({
      rules: [],
      save: () => res({ error: "boom" }, false, 400),
    });
    const { container } = wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText(/No alert rules yet/);

    fireEvent.click(screen.getByText("New Rule"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not save rule", {
        description: "boom",
      }),
    );
  });

  it("handles a save failure whose body is not JSON", async () => {
    global.fetch = buildFetch({
      rules: [],
      save: () =>
        ({ ok: false, json: () => Promise.reject(new Error("nope")) }) as Response,
    });
    const { container } = wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText(/No alert rules yet/);

    fireEvent.click(screen.getByText("New Rule"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not save rule", {
        description: undefined,
      }),
    );
  });
});

describe("AlertsManager — edit, toggle, delete", () => {
  it("edits an existing rule via PUT, prefilling its fields", async () => {
    global.fetch = buildFetch({
      rules: [
        rule({
          id: "r1",
          name: "Edit me",
          nodeId: "n1",
          metric: "cpu_percent",
          threshold: 80,
          webhookUrl: "https://w",
        }),
      ],
    });
    const { container } = wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText("Edit me");

    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Alert Rule")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("Edit me");
    expect(screen.getByLabelText("Scope")).toHaveValue("n1");
    expect(screen.getByLabelText("Threshold")).toHaveValue("80");
    expect(screen.getByLabelText(/Webhook URL/)).toHaveValue("https://w");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Edited" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rule updated"));
    expect(
      findCall((c) => c[0].includes("/api/alerts/rules/r1") && c[1]?.method === "PUT"),
    ).toBeTruthy();
  });

  it("prefills blank scope and webhook for an all-nodes offline rule", async () => {
    global.fetch = buildFetch({
      rules: [
        rule({ id: "r2", name: "NoScope", nodeId: null, metric: "node_offline", webhookUrl: null }),
      ],
    });
    wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText("NoScope");

    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByLabelText("Scope")).toHaveValue("");
    expect(screen.getByLabelText(/Webhook URL/)).toHaveValue("");
    expect(screen.queryByLabelText("Threshold")).toBeNull();
  });

  it("toggles a rule's enabled state via PUT", async () => {
    global.fetch = buildFetch({ rules: [rule({ id: "r1", enabled: true })] });
    wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText("Rule");

    fireEvent.click(screen.getByLabelText("Disable rule"));
    await waitFor(() =>
      expect(
        findCall((c) => c[0].includes("/api/alerts/rules/r1") && c[1]?.method === "PUT"),
      ).toBeTruthy(),
    );
    const body = bodyOf(
      findCall((c) => c[0].includes("/api/alerts/rules/r1") && c[1]?.method === "PUT"),
    );
    expect(body).toEqual({ enabled: false });
  });

  it("deletes a rule after confirmation", async () => {
    global.fetch = buildFetch({ rules: [rule({ id: "r1", name: "Del" })] });
    wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText("Del");

    fireEvent.click(screen.getByText("Delete"));
    const dialog = screen.getByTestId("dialog");
    fireEvent.click(within(dialog).getByText("Delete"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rule deleted"));
    expect(
      findCall(
        (c) => c[0].includes("/api/alerts/rules/r1") && c[1]?.method === "DELETE",
      ),
    ).toBeTruthy();
  });

  it("closes the confirm dialog on cancel without deleting", async () => {
    global.fetch = buildFetch({ rules: [rule({ id: "r1", name: "Keep" })] });
    wrap(<AlertsManager nodes={NODES} />);
    await screen.findByText("Keep");

    fireEvent.click(screen.getByText("Delete"));
    const dialog = screen.getByTestId("dialog");
    fireEvent.click(within(dialog).getByText("Cancel"));

    await waitFor(() => expect(screen.queryByTestId("dialog")).toBeNull());
    expect(
      findCall(
        (c) => c[0].includes("/api/alerts/rules/r1") && c[1]?.method === "DELETE",
      ),
    ).toBeUndefined();
  });
});

describe("AlertsManager — evaluation", () => {
  it("fires an alert and records an event when a rule breaches", async () => {
    global.fetch = buildFetch({
      rules: [rule({ id: "r1", name: "Node down", nodeId: null, metric: "node_offline" })],
      metrics: { n1: { ok: false } },
    });
    wrap(<AlertsManager nodes={[NODES[0]]} />);
    await screen.findByText(/Node goes offline/);

    fireEvent.click(screen.getByText("Check now"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(
      findCall((c) => c[0].endsWith("/api/alerts/events") && c[1]?.method === "POST"),
    ).toBeTruthy();
  });

  it("reports an all-clear when nothing breaches", async () => {
    global.fetch = buildFetch({
      rules: [rule({ id: "r1", nodeId: null, metric: "cpu_percent", operator: "gt", threshold: 90 })],
      metrics: { n1: { ok: true, body: { cpu: { percent: 5 } } } },
    });
    wrap(<AlertsManager nodes={[NODES[0]]} />);
    await screen.findByText(/CPU usage > 90%/);

    fireEvent.click(screen.getByText("Check now"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "No alerts triggered",
        expect.objectContaining({ description: expect.any(String) }),
      ),
    );
  });

  it("still fires locally when the event POST fails", async () => {
    global.fetch = buildFetch({
      rules: [rule({ id: "r1", name: "Node down", nodeId: null, metric: "node_offline" })],
      metrics: { n1: { ok: false } },
      eventsPostReject: true,
    });
    wrap(<AlertsManager nodes={[NODES[0]]} />);
    await screen.findByText(/Node goes offline/);

    fireEvent.click(screen.getByText("Check now"));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("evaluates automatically on the mount interval", async () => {
    global.fetch = buildFetch({
      rules: [rule({ id: "r1", nodeId: null, metric: "cpu_percent", operator: "gt", threshold: 90 })],
      metrics: { n1: { ok: true, body: { cpu: { percent: 5 } } } },
    });
    const spy = vi.spyOn(globalThis, "setInterval");
    wrap(<AlertsManager nodes={[NODES[0]]} />);
    await screen.findByText(/CPU usage > 90%/);

    const entry = spy.mock.calls.find((c) => c[1] === 60000);
    expect(entry).toBeTruthy();
    const tick = entry![0] as () => void;
    await act(async () => {
      tick();
    });

    await waitFor(() =>
      expect(
        fetchMock().mock.calls.some((c) => String(c[0]).includes("system/metrics")),
      ).toBe(true),
    );
  });
});
