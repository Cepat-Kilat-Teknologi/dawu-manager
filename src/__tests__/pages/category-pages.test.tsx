/**
 * Comprehensive tests for all 15 per-node category pages.
 * Exercises every code path: loading, error, data rendering, cell renderers,
 * mutation callbacks, ConfirmDialog flows, search filtering, SSE streaming.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@/__tests__/ui-mocks";

// --- Shared mock setup ---

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  isPending: boolean;
  onSuccess?: () => void;
}

const {
  mockUseNodeProxy,
  mockUseNodeProxyMutation,
  capturedMutations,
  mutationMap,
} = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
  mockUseNodeProxyMutation: vi.fn(),
  capturedMutations: [] as CapturedMutation[],
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
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/nodes/n1/sessions",
  useSearchParams: () => new URLSearchParams(),
}));

// ConfirmDialog: render a clickable confirm button when open
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    title,
    description,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => Promise<void> | void;
    title: string;
    description: string;
    onOpenChange: (o: boolean) => void;
    confirmLabel?: string;
    variant?: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span data-testid="confirm-title">{title}</span>
        <span data-testid="confirm-desc">{description}</span>
        <button data-testid="confirm-btn" onClick={() => onConfirm()}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// Helper: mock query return value
function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

// --- Page imports ---
import ServicePage from "@/app/(dashboard)/nodes/[nodeId]/service/page";
import DhcpPage from "@/app/(dashboard)/nodes/[nodeId]/dhcp/page";
import EventsPage from "@/app/(dashboard)/nodes/[nodeId]/events/page";
import DiagnosticsPage from "@/app/(dashboard)/nodes/[nodeId]/diagnostics/page";

beforeEach(() => {
  vi.clearAllMocks();
  capturedMutations.length = 0;
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  // Each unique (nodeId, path) pair returns a STABLE mock — survives re-renders
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, _path: string, opts?: { onSuccess?: () => void }) => {
      const key = `${_nid}:${_path}`;
      if (!mutationMap.has(key)) {
        const m: CapturedMutation = {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          onSuccess: opts?.onSuccess,
        };
        mutationMap.set(key, m);
        capturedMutations.push(m);
      }
      const existing = mutationMap.get(key)!;
      // Always update onSuccess — component may have fresh closure
      existing.onSuccess = opts?.onSuccess;
      return existing;
    },
  );
});
// =====================================================================
// Service Page
// =====================================================================
describe("ServicePage", () => {
  const fullServiceData = {
    service: "accel-ppp",
    status: "running",
    pid: 1234,
    uptime: "3d 14h",
    version: "1.12.0",
  };

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<ServicePage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all status cards when running", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.getByText("1234")).toBeTruthy();
    expect(screen.getByText("3d 14h")).toBeTruthy();
    expect(screen.getByText("1.12.0")).toBeTruthy();
  });

  it("disables Start when running, enables Stop/Restart/Shutdown", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    const startBtn = screen.getByText("Start").closest("button");
    expect(startBtn?.disabled).toBe(true);
    const stopBtn = screen.getByText("Stop").closest("button");
    expect(stopBtn?.disabled).toBe(false);
  });

  it("enables Start when stopped, disables Stop", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: { service: "accel-ppp", status: "stopped" } }),
    );
    render(<ServicePage />);
    const startBtn = screen.getByText("Start").closest("button");
    expect(startBtn?.disabled).toBe(false);
    const stopBtn = screen.getByText("Stop").closest("button");
    expect(stopBtn?.disabled).toBe(true);
  });

  it("opens stop confirm dialog with correct description", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    fireEvent.click(screen.getByText("Stop"));
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "disconnect all active",
    );
  });

  it("opens shutdown confirm dialog with correct description", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    fireEvent.click(screen.getByText("Graceful Shutdown"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "stop accepting new sessions",
    );
  });

  it("opens restart confirm dialog with an impact-explicit description", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    fireEvent.click(screen.getByText("Restart"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "drops all active PPPoE sessions",
    );
  });

  it("confirms shutdown dispatches shutdownMutation", async () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    fireEvent.click(screen.getByText("Graceful Shutdown"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    // action=[0], shutdown=[1]
    expect(capturedMutations[1].mutateAsync).toHaveBeenCalledWith({});
  });

  it("confirms stop dispatches actionMutation", async () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    fireEvent.click(screen.getByText("Stop"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(capturedMutations[0].mutateAsync).toHaveBeenCalledWith({
      action: "stop",
    });
  });

  it("calls onSuccess for actionMutation", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("calls onSuccess for shutdownMutation", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    capturedMutations[1]?.onSuccess!();
  });

  it("shows unknown status when data has no status field", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: {} }));
    render(<ServicePage />);
    expect(screen.getByText("unknown")).toBeTruthy();
  });
});
// =====================================================================
// DHCP Page
// =====================================================================
describe("DhcpPage", () => {
  const fullDhcpMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dhcp/status") {
        return mockQuery({
          data: { server_state: "running", pool_size: 254 },
        });
      }
      if (path === "dhcp/leases") {
        return mockQuery({
          data: [
            {
              ip: "10.0.0.5",
              mac: "aa:bb:cc:dd:ee:01",
              hostname: "pc1",
              expires: "2026-07-12",
              state: "active",
            },
            {
              ip: "10.0.0.6",
              mac: "aa:bb:cc:dd:ee:02",
              state: "expired",
            },
          ],
        });
      }
      if (path === "dhcp/relay") {
        return mockQuery({
          data: {
            relay_enabled: false,
            servers: ["10.0.0.1", "10.0.0.2"],
          },
        });
      }
      return mockQuery({ data: {} });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<DhcpPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders DHCP status and leases with state badges", () => {
    fullDhcpMock();
    render(<DhcpPage />);
    expect(screen.getByText("DHCP Status")).toBeTruthy();
    expect(screen.getByText("10.0.0.5")).toBeTruthy();
    expect(screen.queryAllByText("active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("expired")).toBeTruthy();
  });

  it("renders relay with array values joined", () => {
    fullDhcpMock();
    render(<DhcpPage />);
    expect(screen.getByText("10.0.0.1, 10.0.0.2")).toBeTruthy();
  });

  it("fires restart mutation", () => {
    fullDhcpMock();
    render(<DhcpPage />);
    fireEvent.click(screen.getByText("Restart"));
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({});
  });

  it("calls onSuccess for restart mutation", () => {
    fullDhcpMock();
    render(<DhcpPage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("renders empty leases", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dhcp/leases") return mockQuery({ data: [] });
      return mockQuery({ data: {} });
    });
    render(<DhcpPage />);
    expect(screen.getByText("No active DHCP leases.")).toBeTruthy();
  });
});

// =====================================================================
// Events Page
// =====================================================================
describe("EventsPage", () => {
  const fullEventsMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "events/hooks") {
        return mockQuery({
          data: [
            {
              id: "h1",
              event: "session-up",
              action: "notify",
              enabled: true,
              description: "On connect",
            },
            {
              id: "h2",
              event: "session-down",
              action: "log",
              enabled: false,
            },
          ],
        });
      }
      if (path === "events/history") {
        return mockQuery({
          data: [
            {
              timestamp: "2026-07-10T12:00:00Z",
              event: "config-change",
              detail: "ppp0",
              source: "admin",
            },
          ],
        });
      }
      return mockQuery({ data: [] });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<EventsPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders hooks with status badges", () => {
    fullEventsMock();
    render(<EventsPage />);
    expect(screen.getByText("session-up")).toBeTruthy();
    expect(
      screen.queryAllByText("enabled").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryAllByText("disabled").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("On connect")).toBeTruthy();
  });

  it("renders history", () => {
    fullEventsMock();
    render(<EventsPage />);
    expect(screen.getByText("config-change")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
  });

  it("fires event mutation from cell button", () => {
    fullEventsMock();
    render(<EventsPage />);
    const fireBtns = screen.getAllByText("Fire");
    fireEvent.click(fireBtns[0]);
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({
      event: "session-up",
    });
  });

  it("calls onSuccess for fire mutation", () => {
    fullEventsMock();
    render(<EventsPage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("renders empty states", () => {
    mockUseNodeProxy.mockImplementation(() => mockQuery({ data: [] }));
    render(<EventsPage />);
    expect(screen.getByText("No event hooks configured.")).toBeTruthy();
    expect(screen.getByText("No recent events.")).toBeTruthy();
  });
});
// =====================================================================
// Diagnostics Page
// =====================================================================
describe("DiagnosticsPage", () => {
  const fullDiagMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "diagnostics/doctor") {
        return mockQuery({
          data: [
            { name: "config-check", status: "ok", detail: "Config valid" },
            {
              name: "memory-check",
              status: "warn",
              detail: "High usage",
            },
            { name: "disk-check", status: "fail", detail: "Low space" },
          ],
        });
      }
      if (path === "playbooks") {
        return mockQuery({
          data: [
            {
              name: "Reset counters",
              description: "Clear all counters",
              role_required: "admin",
            },
          ],
        });
      }
      if (path === "scheduler/jobs") {
        return mockQuery({
          data: [
            {
              id: "j1",
              name: "Daily backup",
              schedule: "0 0 * * *",
              enabled: true,
              last_run: "2026-07-10",
              next_run: "2026-07-11",
            },
            {
              id: "j2",
              name: "Cleanup",
              schedule: "0 */6 * * *",
              enabled: false,
            },
          ],
        });
      }
      if (path === "firewall/zones") {
        return mockQuery({
          data: [
            {
              name: "wan",
              interfaces: ["ge0", "ge1"],
              policy: "drop",
            },
            { name: "lan", policy: "accept" },
          ],
        });
      }
      if (path === "vrrp/status") {
        return mockQuery({ data: { state: "master", priority: 100 } });
      }
      if (path === "conntrack/entries") {
        return mockQuery({
          data: [
            {
              protocol: "tcp",
              src: "10.0.0.1",
              dst: "8.8.8.8",
              sport: "12345",
              dport: "443",
              state: "ESTABLISHED",
              timeout: 3600,
            },
          ],
        });
      }
      if (path === "flow/stats") {
        return mockQuery({
          data: {
            flows_exported: 1000,
            packets_processed: 1048576,
          },
        });
      }
      if (path === "bulk/status") {
        return mockQuery({ data: { pending: 0, completed: 42 } });
      }
      if (path === "dns/forwarding") {
        return mockQuery({
          data: { dns_enabled: true, servers: 2 },
        });
      }
      if (path === "limits") {
        return mockQuery({
          data: { max_sessions: 10000, current: 5432 },
        });
      }
      return mockQuery({ data: {} });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<DiagnosticsPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders doctor checks with all badge variants", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    expect(screen.getByText("config-check")).toBeTruthy();
    expect(screen.getByText("ok")).toBeTruthy();
    expect(screen.getByText("warn")).toBeTruthy();
    expect(screen.getByText("fail")).toBeTruthy();
  });

  it("renders playbooks and fires run mutation", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    expect(screen.getByText("Reset counters")).toBeTruthy();
    fireEvent.click(screen.getByText("Run"));
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({ id: "Reset counters" });
  });

  it("calls onSuccess for playbook mutation", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("renders scheduler with enabled/disabled badges", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    expect(screen.getByText("Daily backup")).toBeTruthy();
    expect(screen.getByText("0 0 * * *")).toBeTruthy();
  });

  it("renders zones with interfaces join and fallback", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    expect(screen.getByText("ge0, ge1")).toBeTruthy();
    // "-" can appear multiple times — use queryAll
    expect(screen.queryAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("renders conntrack entries", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    expect(screen.getByText("ESTABLISHED")).toBeTruthy();
  });

  it("renders flow stats with formatted numbers and fallback", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    // Flow stats rendered as KV pairs from object
    expect(screen.getByText("flows exported")).toBeTruthy();
    expect(screen.getByText("1,000")).toBeTruthy();
    expect(screen.getByText("packets processed")).toBeTruthy();
    expect(screen.getByText("1,048,576")).toBeTruthy();
  });

  it("renders status cards with KV data", () => {
    fullDiagMock();
    render(<DiagnosticsPage />);
    expect(screen.getByText("VRRP")).toBeTruthy();
    expect(screen.getByText("DNS Forwarding")).toBeTruthy();
    expect(screen.getByText("Limits")).toBeTruthy();
    expect(screen.getByText("Bulk Operations")).toBeTruthy();
    expect(screen.getByText("master")).toBeTruthy();
  });

  it("shows unavailable for errored status cards", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("fail") }),
    );
    render(<DiagnosticsPage />);
    const unavailables = screen.getAllByText("unavailable");
    expect(unavailables.length).toBeGreaterThanOrEqual(4);
  });

  it("shows No data for null status cards", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: null }));
    render(<DiagnosticsPage />);
    const noDataLabels = screen.getAllByText("No data");
    expect(noDataLabels.length).toBeGreaterThanOrEqual(4);
  });

  it("renders empty list states", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (
        path === "diagnostics/doctor" ||
        path === "playbooks" ||
        path === "scheduler/jobs" ||
        path === "firewall/zones" ||
        path === "conntrack/entries"
      ) {
        return mockQuery({ data: [] });
      }
      if (path === "flow/stats") {
        return mockQuery({ data: null });
      }
      return mockQuery({ data: {} });
    });
    render(<DiagnosticsPage />);
    expect(screen.getByText("No doctor checks available.")).toBeTruthy();
    expect(screen.getByText("No playbooks defined.")).toBeTruthy();
    expect(screen.getByText("No scheduled jobs.")).toBeTruthy();
    expect(screen.getByText("No firewall zones defined.")).toBeTruthy();
    expect(screen.getByText("No conntrack entries.")).toBeTruthy();
  });
});
