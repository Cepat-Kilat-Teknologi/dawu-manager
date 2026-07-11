/**
 * Dedicated tests for the node Monitoring page: exporter cards with
 * enable/disable + restart, and the metrics section that guides the operator
 * to enable node_exporter when metrics are unavailable.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import { ProxyError } from "@/hooks/use-node-proxy";
import "@/__tests__/ui-mocks";

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  isPending: boolean;
  onSuccess?: () => void;
}

const { mockUseNodeProxy, mockUseNodeProxyMutation, mutationMap } = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
  mockUseNodeProxyMutation: vi.fn(),
  mutationMap: new Map<string, CapturedMutation>(),
}));

vi.mock("@/hooks/use-node-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-node-proxy")>();
  return {
    ...actual,
    useNodeProxy: mockUseNodeProxy,
    useNodeProxyMutation: mockUseNodeProxyMutation,
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ nodeId: "n1" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/nodes/n1/monitoring",
  useSearchParams: () => new URLSearchParams(),
}));

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

import MonitoringPage from "@/app/(dashboard)/nodes/[nodeId]/monitoring/page";

let pending = false;
beforeEach(() => {
  vi.clearAllMocks();
  mutationMap.clear();
  pending = false;
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, path: string, opts?: { onSuccess?: () => void }) => {
      if (!mutationMap.has(path)) {
        mutationMap.set(path, {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: pending,
          onSuccess: opts?.onSuccess,
        });
      }
      const m = mutationMap.get(path)!;
      m.onSuccess = opts?.onSuccess;
      return m;
    },
  );
});

/** node_exporter inactive, snmpd active; metrics endpoint 404. */
const withExporters = (metricsError = new ProxyError("404", 404)) =>
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "monitoring/status")
      return mockQuery({
        data: {
          exporters: [
            { service: "node_exporter", active: false, port: 9100 },
            { service: "snmpd", active: true, port: 161 },
          ],
          count: 2,
        },
      });
    if (path === "monitoring/metrics") return mockQuery({ error: metricsError });
    return mockQuery();
  });

describe("MonitoringPage", () => {
  it("shows loading", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<MonitoringPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error + retry on both sections", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("mon err"), refetch }),
    );
    render(<MonitoringPage />);
    const retries = screen.getAllByText("Retry");
    expect(retries.length).toBe(2);
    retries.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("renders exporter cards with active/inactive badges", () => {
    withExporters();
    render(<MonitoringPage />);
    // "node_exporter" appears in the card AND the metrics guidance hint.
    expect(screen.getAllByText("node_exporter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("snmpd")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    // "inactive" appears in the node_exporter badge AND the guidance hint.
    expect(screen.getAllByText("inactive").length).toBeGreaterThanOrEqual(1);
  });

  it("toggles an exporter via configure", () => {
    withExporters();
    render(<MonitoringPage />);
    // node_exporter is inactive → its card button says "Enable".
    const enableButtons = screen.getAllByText("Enable");
    fireEvent.click(enableButtons[0]);
    expect(mutationMap.get("monitoring/configure")!.mutate).toHaveBeenCalledWith({
      service: "node_exporter",
      enable: true,
    });
  });

  it("disables an active exporter", () => {
    withExporters();
    render(<MonitoringPage />);
    fireEvent.click(screen.getByText("Disable"));
    expect(mutationMap.get("monitoring/configure")!.mutate).toHaveBeenCalledWith({
      service: "snmpd",
      enable: false,
    });
  });

  it("restarts and refreshes", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "monitoring/status")
        return mockQuery({ data: { exporters: [], count: 0 }, refetch });
      return mockQuery({ error: new ProxyError("404", 404) });
    });
    render(<MonitoringPage />);
    fireEvent.click(screen.getByText("Restart"));
    expect(mutationMap.get("monitoring/restart")!.mutate).toHaveBeenCalledWith({});
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalled();
  });

  it("guides the operator to enable node_exporter when metrics are down", () => {
    withExporters();
    render(<MonitoringPage />);
    expect(screen.getByText(/Metrics are exposed by/)).toBeTruthy();
    fireEvent.click(screen.getByText("Enable node_exporter"));
    expect(mutationMap.get("monitoring/configure")!.mutate).toHaveBeenCalledWith({
      service: "node_exporter",
      enable: true,
    });
  });

  it("shows the alternate hint when node_exporter is active", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "monitoring/status")
        return mockQuery({
          data: { exporters: [{ service: "node_exporter", active: true, port: 9100 }], count: 1 },
        });
      if (path === "monitoring/metrics")
        return mockQuery({ error: new ProxyError("404", 404) });
      return mockQuery();
    });
    render(<MonitoringPage />);
    expect(screen.getByText(/isn’t exposed by this dawos-agent build/)).toBeTruthy();
  });

  it("renders metric cards when metrics are available", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "monitoring/status")
        return mockQuery({ data: { exporters: [], count: 0 } });
      if (path === "monitoring/metrics")
        return mockQuery({ data: { cpu_load: 1024, build_info: "v1.2" } });
      return mockQuery();
    });
    render(<MonitoringPage />);
    expect(screen.getByText("cpu load")).toBeTruthy();
    expect(screen.getByText("1,024")).toBeTruthy(); // number → toLocaleString
    expect(screen.getByText("v1.2")).toBeTruthy(); // non-number → String(value)
  });

  it("shows pending spinners and fires success toasts", () => {
    pending = true;
    withExporters();
    render(<MonitoringPage />);
    expect(screen.getAllByText("Enable").length).toBeGreaterThanOrEqual(1);
    mutationMap.get("monitoring/restart")!.onSuccess!();
    mutationMap.get("monitoring/configure")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Monitoring service restarted");
    expect(toast.success).toHaveBeenCalledWith("Exporter updated");
  });
});
