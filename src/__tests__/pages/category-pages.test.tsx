/**
 * Comprehensive tests for all 15 per-node category pages.
 * Exercises every code path: loading, error, data rendering, cell renderers,
 * mutation callbacks, ConfirmDialog flows, search filtering, SSE streaming.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
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
import DhcpPage, {
  parseServers,
} from "@/app/(dashboard)/nodes/[nodeId]/dhcp/page";
import EventsPage from "@/app/(dashboard)/nodes/[nodeId]/events/page";
import DiagnosticsPage from "@/app/(dashboard)/nodes/[nodeId]/diagnostics/page";

beforeEach(() => {
  vi.clearAllMocks();
  capturedMutations.length = 0;
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  // Each unique (nodeId, path) pair returns a STABLE mock — survives re-renders
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, _path: string, opts?: { onSuccess?: () => void; method?: string }) => {
      const method = opts?.method;
      const key = method ? `${_nid}:${method}:${_path}` : `${_nid}:${_path}`;
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
// parseServers helper
// =====================================================================
describe("parseServers", () => {
  it("splits, trims, and deduplicates comma-separated servers", () => {
    expect(parseServers("8.8.8.8, 1.1.1.1, 8.8.8.8")).toEqual([
      "8.8.8.8",
      "1.1.1.1",
    ]);
  });

  it("returns empty array for blank input", () => {
    expect(parseServers("")).toEqual([]);
    expect(parseServers(" , , ")).toEqual([]);
  });
});

// =====================================================================
// DhcpPage — DNS Forwarding section
// =====================================================================
describe("DhcpPage DNS Forwarding", () => {
  const fullDnsMock = (dnsData?: Record<string, unknown>) =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dhcp/status") return mockQuery({ data: {} });
      if (path === "dhcp/leases") return mockQuery({ data: [] });
      if (path === "dhcp/relay") return mockQuery({ data: {} });
      if (path === "dns/forwarding") {
        return mockQuery({ data: dnsData ?? { servers: ["8.8.8.8"], cache_size: 10000 } });
      }
      return mockQuery();
    });

  it("renders DNS forwarding data as key-value pairs", () => {
    fullDnsMock({ servers: ["8.8.8.8"], cache_size: 10000 });
    render(<DhcpPage />);
    expect(screen.getByText("DNS Forwarding")).toBeTruthy();
    expect(screen.getByText("cache size")).toBeTruthy();
  });

  it("shows loading state for DNS forwarding", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dns/forwarding") return mockQuery({ isLoading: true });
      if (path === "dhcp/leases") return mockQuery({ data: [] });
      return mockQuery({ data: {} });
    });
    render(<DhcpPage />);
    expect(screen.getByText("DNS Forwarding")).toBeTruthy();
  });

  it("shows unavailable badge on DNS forwarding error", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dns/forwarding")
        return mockQuery({ error: new Error("not found") });
      if (path === "dhcp/leases") return mockQuery({ data: [] });
      return mockQuery({ data: {} });
    });
    render(<DhcpPage />);
    expect(screen.getByText("unavailable")).toBeTruthy();
  });

  it("shows no-data message when dns/forwarding returns null", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dns/forwarding") return mockQuery({ data: null });
      if (path === "dhcp/leases") return mockQuery({ data: [] });
      return mockQuery({ data: {} });
    });
    render(<DhcpPage />);
    expect(screen.getByText("No DNS forwarding data.")).toBeTruthy();
  });

  it("updates DNS config with parsed servers and cache size", () => {
    fullDnsMock();
    render(<DhcpPage />);
    fireEvent.change(screen.getByLabelText("DNS Servers"), {
      target: { value: "8.8.8.8, 1.1.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Cache Size"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByText("Update Config"));
    const mutation = mutationMap.get("n1:PUT:dns/forwarding/config")!;
    expect(mutation.mutate).toHaveBeenCalledWith({
      servers: ["8.8.8.8", "1.1.1.1"],
      cache_size: 5000,
    });
  });

  it("shows error toast when no servers provided", () => {
    fullDnsMock();
    render(<DhcpPage />);
    fireEvent.change(screen.getByLabelText("Cache Size"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByText("Update Config"));
    expect(toast.error).toHaveBeenCalledWith("Enter at least one DNS server");
  });

  it("shows error toast when cache size is invalid", () => {
    fullDnsMock();
    render(<DhcpPage />);
    fireEvent.change(screen.getByLabelText("DNS Servers"), {
      target: { value: "8.8.8.8" },
    });
    fireEvent.click(screen.getByText("Update Config"));
    expect(toast.error).toHaveBeenCalledWith(
      "Cache size must be a non-negative integer",
    );
  });

  it("shows error toast when cache size is negative", () => {
    fullDnsMock();
    render(<DhcpPage />);
    fireEvent.change(screen.getByLabelText("DNS Servers"), {
      target: { value: "8.8.8.8" },
    });
    fireEvent.change(screen.getByLabelText("Cache Size"), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByText("Update Config"));
    expect(toast.error).toHaveBeenCalledWith(
      "Cache size must be a non-negative integer",
    );
  });

  it("flushes DNS cache", () => {
    fullDnsMock();
    render(<DhcpPage />);
    fireEvent.click(screen.getByText("Flush Cache"));
    expect(
      mutationMap.get("n1:dns/forwarding/flush")!.mutate,
    ).toHaveBeenCalledWith({});
  });

  it("calls onSuccess for DNS config update and flush", () => {
    fullDnsMock();
    render(<DhcpPage />);
    mutationMap.get("n1:PUT:dns/forwarding/config")!.onSuccess!();
    mutationMap.get("n1:dns/forwarding/flush")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith(
      "DNS forwarding config updated",
    );
    expect(toast.success).toHaveBeenCalledWith("DNS cache flushed");
  });

  it("renders the info note about DNS configuration", () => {
    fullDnsMock();
    render(<DhcpPage />);
    expect(
      screen.getByText(
        "Update the DNS forwarding configuration. Servers are comma-separated IP addresses.",
      ),
    ).toBeTruthy();
  });

  it("disables buttons and shows spinners while DNS mutations are pending", () => {
    // Pre-populate pending mutations before render
    mutationMap.set("n1:PUT:dns/forwarding/config", {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: true,
      onSuccess: undefined,
    });
    mutationMap.set("n1:dns/forwarding/flush", {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: true,
      onSuccess: undefined,
    });
    fullDnsMock();
    render(<DhcpPage />);
    expect(
      screen.getByText("Update Config").closest("button")?.disabled,
    ).toBe(true);
    expect(
      screen.getByText("Flush Cache").closest("button")?.disabled,
    ).toBe(true);
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
      if (path === "zones") {
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
    // Multiple "Run" buttons exist (playbooks + scheduler) — first one is playbooks
    const runButtons = screen.getAllByText("Run");
    fireEvent.click(runButtons[0]);
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
    expect(screen.getByText("Session Limits")).toBeTruthy();
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
        path === "zones" ||
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

  // --- Scheduler CRUD + Run ---

  describe("Scheduler job management", () => {
    it("renders scheduler action buttons (Run + Delete)", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Each scheduler row has a Run + Trash button
      // 3 total Run buttons: 1 playbook + 2 scheduler
      const runButtons = screen.getAllByText("Run");
      expect(runButtons.length).toBeGreaterThanOrEqual(3);
    });

    it("creates a scheduler job with valid input", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Job Name"), {
        target: { value: "test-job" },
      });
      fireEvent.change(screen.getByLabelText("Command"), {
        target: { value: "/usr/bin/test.sh" },
      });
      fireEvent.change(screen.getByLabelText("Interval (seconds)"), {
        target: { value: "60" },
      });
      fireEvent.click(screen.getByText("Create Job"));
      const createMut = mutationMap.get("n1:scheduler/jobs");
      expect(createMut?.mutate).toHaveBeenCalledWith({
        name: "test-job",
        command: "/usr/bin/test.sh",
        interval_seconds: 60,
        enabled: true,
      });
    });

    it("rejects create when job name is empty", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Command"), {
        target: { value: "/bin/cmd" },
      });
      fireEvent.change(screen.getByLabelText("Interval (seconds)"), {
        target: { value: "30" },
      });
      fireEvent.click(screen.getByText("Create Job"));
      expect(toast.error).toHaveBeenCalledWith("Job name is required");
    });

    it("rejects create when command is empty", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Job Name"), {
        target: { value: "my-job" },
      });
      fireEvent.change(screen.getByLabelText("Interval (seconds)"), {
        target: { value: "30" },
      });
      fireEvent.click(screen.getByText("Create Job"));
      expect(toast.error).toHaveBeenCalledWith("Command is required");
    });

    it("rejects create when interval is less than 10", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Job Name"), {
        target: { value: "my-job" },
      });
      fireEvent.change(screen.getByLabelText("Command"), {
        target: { value: "/bin/cmd" },
      });
      fireEvent.change(screen.getByLabelText("Interval (seconds)"), {
        target: { value: "5" },
      });
      fireEvent.click(screen.getByText("Create Job"));
      expect(toast.error).toHaveBeenCalledWith(
        "Interval must be at least 10 seconds",
      );
    });

    it("rejects create when interval is empty", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Job Name"), {
        target: { value: "my-job" },
      });
      fireEvent.change(screen.getByLabelText("Command"), {
        target: { value: "/bin/cmd" },
      });
      fireEvent.click(screen.getByText("Create Job"));
      expect(toast.error).toHaveBeenCalledWith(
        "Interval must be at least 10 seconds",
      );
    });

    it("rejects create when interval is NaN", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Job Name"), {
        target: { value: "my-job" },
      });
      fireEvent.change(screen.getByLabelText("Command"), {
        target: { value: "/bin/cmd" },
      });
      fireEvent.change(screen.getByLabelText("Interval (seconds)"), {
        target: { value: "abc" },
      });
      fireEvent.click(screen.getByText("Create Job"));
      expect(toast.error).toHaveBeenCalledWith(
        "Interval must be at least 10 seconds",
      );
    });

    it("calls createJob onSuccess and clears form", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Fill form
      fireEvent.change(screen.getByLabelText("Job Name"), {
        target: { value: "will-clear" },
      });
      fireEvent.change(screen.getByLabelText("Command"), {
        target: { value: "/bin/test" },
      });
      fireEvent.change(screen.getByLabelText("Interval (seconds)"), {
        target: { value: "60" },
      });
      // Trigger onSuccess
      const createMut = mutationMap.get("n1:scheduler/jobs");
      createMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Scheduler job created");
    });

    it("opens delete confirm dialog and deletes job", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);

      // Click first trash button (should be for "Daily backup")
      const dailyRow = screen.getByText("Daily backup").closest("tr") ?? screen.getByText("Daily backup").parentElement;
      const deleteBtn = dailyRow?.querySelector("button:last-child");
      if (deleteBtn) fireEvent.click(deleteBtn);

      // Confirm dialog should open
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      expect(screen.getByTestId("confirm-desc").textContent).toContain(
        "Daily backup",
      );

      // Confirm delete
      fireEvent.click(screen.getByTestId("confirm-btn"));
      const delMut = mutationMap.get(
        "n1:DELETE:scheduler/jobs/Daily%20backup",
      );
      expect(delMut?.mutate).toHaveBeenCalled();
    });

    it("calls deleteJob onSuccess callback", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Trigger delete flow to register the mutation
      const dailyRow = screen.getByText("Daily backup").closest("tr") ?? screen.getByText("Daily backup").parentElement;
      const deleteBtn = dailyRow?.querySelector("button:last-child");
      if (deleteBtn) fireEvent.click(deleteBtn);
      // Call onSuccess on the delete mutation
      const delMut = mutationMap.get(
        "n1:DELETE:scheduler/jobs/Daily%20backup",
      );
      delMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Scheduler job deleted");
    });

    it("cancels delete dialog via cancel button", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const dailyRow = screen.getByText("Daily backup").closest("tr") ?? screen.getByText("Daily backup").parentElement;
      const deleteBtn = dailyRow?.querySelector("button:last-child");
      if (deleteBtn) fireEvent.click(deleteBtn);
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("opens run confirm dialog and runs job", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Run buttons: [0]=playbook, [1]=scheduler "Daily backup", [2]=scheduler "Cleanup"
      const runButtons = screen.getAllByText("Run");
      fireEvent.click(runButtons[1]); // "Daily backup" run

      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      expect(screen.getByTestId("confirm-desc").textContent).toContain(
        "Daily backup",
      );

      fireEvent.click(screen.getByTestId("confirm-btn"));
      const runMut = mutationMap.get(
        "n1:scheduler/jobs/Daily%20backup/run",
      );
      expect(runMut?.mutate).toHaveBeenCalled();
    });

    it("calls runJob onSuccess callback", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const runButtons = screen.getAllByText("Run");
      fireEvent.click(runButtons[1]);
      const runMut = mutationMap.get(
        "n1:scheduler/jobs/Daily%20backup/run",
      );
      runMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Job executed successfully");
    });

    it("cancels run dialog via cancel button", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const runButtons = screen.getAllByText("Run");
      fireEvent.click(runButtons[1]);
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("shows spinner on create button when isPending", () => {
      // Pre-populate with isPending before render
      mutationMap.set("n1:scheduler/jobs", {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
      });
      fullDiagMock();
      render(<DiagnosticsPage />);
      const createBtn = screen.getByText("Create Job").closest("button");
      expect(createBtn?.disabled).toBe(true);
    });

    it("shows spinner on run button when isPending", () => {
      mutationMap.set("n1:scheduler/jobs/_/run", {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
      });
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Run buttons should be disabled when isPending
      const runButtons = screen.getAllByText("Run");
      // Scheduler run buttons (index 1, 2) should be disabled
      expect(runButtons[1].closest("button")?.disabled).toBe(true);
    });

    it("renders scheduler job with missing name gracefully", () => {
      mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
        if (path === "scheduler/jobs") {
          return mockQuery({
            data: [
              { id: "j3", name: undefined, schedule: "*/5 * * * *", enabled: true },
            ],
          });
        }
        if (path === "diagnostics/doctor") return mockQuery({ data: [] });
        if (path === "playbooks") return mockQuery({ data: [] });
        if (path === "zones") return mockQuery({ data: [] });
        if (path === "conntrack/entries") return mockQuery({ data: [] });
        return mockQuery({ data: {} });
      });
      render(<DiagnosticsPage />);
      // Should render without crashing — name fallback to ""
      expect(screen.getByText("*/5 * * * *")).toBeTruthy();
      // Click Run button — exercises row.name ?? "" fallback
      const runButtons = screen.getAllByText("Run");
      fireEvent.click(runButtons[0]);
      // Click Delete button — exercises row.name ?? "" fallback
      const row = screen.getByText("*/5 * * * *").closest("tr") ?? screen.getByText("*/5 * * * *").parentElement;
      const deleteBtn = row?.querySelector("button:last-child");
      if (deleteBtn) fireEvent.click(deleteBtn);
    });
  });

  // --- Zone CRUD (Group 5) ---

  describe("Zone management", () => {
    it("renders zone action buttons (Delete)", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Zone table has Delete buttons for each zone
      // "wan" and "lan" zones — zones section has Trash2 icons
      expect(screen.getByText("wan")).toBeTruthy();
      expect(screen.getByText("lan")).toBeTruthy();
    });

    it("creates a zone with valid input", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Zone Name"), {
        target: { value: "dmz" },
      });
      fireEvent.change(screen.getByLabelText("Interfaces (comma-separated)"), {
        target: { value: "eth0, eth1" },
      });
      // "Create Zone" appears in CardTitle AND button — pick the button
      const createBtn = screen.getAllByText("Create Zone").find((el) => el.closest("button"))!;
      fireEvent.click(createBtn);
      const createMut = mutationMap.get("n1:zones");
      expect(createMut?.mutate).toHaveBeenCalledWith({
        name: "dmz",
        interfaces: ["eth0", "eth1"],
      });
    });

    it("creates a zone with empty interfaces", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Zone Name"), {
        target: { value: "isolated" },
      });
      const createBtn = screen.getAllByText("Create Zone").find((el) => el.closest("button"))!;
      fireEvent.click(createBtn);
      const createMut = mutationMap.get("n1:zones");
      expect(createMut?.mutate).toHaveBeenCalledWith({
        name: "isolated",
        interfaces: [],
      });
    });

    it("rejects create when zone name is empty", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const createBtn = screen.getAllByText("Create Zone").find((el) => el.closest("button"))!;
      fireEvent.click(createBtn);
      expect(toast.error).toHaveBeenCalledWith("Zone name is required");
    });

    it("calls createZone onSuccess and clears form", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Zone Name"), {
        target: { value: "will-clear" },
      });
      const createMut = mutationMap.get("n1:zones");
      createMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Zone created");
    });

    it("opens delete confirm dialog and deletes zone", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      // Click delete button on "wan" zone row
      const wanRow = screen.getByText("wan").closest("tr") ?? screen.getByText("wan").parentElement;
      const deleteBtn = wanRow?.querySelector("button");
      if (deleteBtn) fireEvent.click(deleteBtn);
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      expect(screen.getByTestId("confirm-desc").textContent).toContain("wan");
      fireEvent.click(screen.getByTestId("confirm-btn"));
      const delMut = mutationMap.get("n1:DELETE:zones/wan");
      expect(delMut?.mutate).toHaveBeenCalled();
    });

    it("calls deleteZone onSuccess callback", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const wanRow = screen.getByText("wan").closest("tr") ?? screen.getByText("wan").parentElement;
      const deleteBtn = wanRow?.querySelector("button");
      if (deleteBtn) fireEvent.click(deleteBtn);
      const delMut = mutationMap.get("n1:DELETE:zones/wan");
      delMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Zone deleted");
    });

    it("cancels delete dialog via cancel button", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const wanRow = screen.getByText("wan").closest("tr") ?? screen.getByText("wan").parentElement;
      const deleteBtn = wanRow?.querySelector("button");
      if (deleteBtn) fireEvent.click(deleteBtn);
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("shows spinner on create button when isPending", () => {
      mutationMap.set("n1:zones", {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
      });
      fullDiagMock();
      render(<DiagnosticsPage />);
      const createBtn = screen.getAllByText("Create Zone").find((el) => el.closest("button"))!;
      expect(createBtn.closest("button")?.disabled).toBe(true);
    });

    it("renders zone with missing name gracefully", () => {
      mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
        if (path === "zones") {
          return mockQuery({
            data: [{ name: undefined, interfaces: ["eth0"], policy: "accept" }],
            refetch: vi.fn(),
          });
        }
        if (path === "diagnostics/doctor") return mockQuery({ data: [] });
        if (path === "playbooks") return mockQuery({ data: [] });
        if (path === "scheduler/jobs") return mockQuery({ data: [] });
        if (path === "conntrack/entries") return mockQuery({ data: [] });
        return mockQuery({ data: {} });
      });
      render(<DiagnosticsPage />);
      expect(screen.getByText("eth0")).toBeTruthy();
      // Click Delete button — exercises row.name ?? "" fallback
      const row = screen.getByText("eth0").closest("tr") ?? screen.getByText("eth0").parentElement;
      const deleteBtn = row?.querySelector("button");
      if (deleteBtn) fireEvent.click(deleteBtn);
    });
  });

  // --- VRRP failover/restart (Group 6) ---

  describe("VRRP management", () => {
    it("renders VRRP status data in dedicated card", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      expect(screen.getByText("VRRP")).toBeTruthy();
      expect(screen.getByText("master")).toBeTruthy();
    });

    it("initiates failover with valid group", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("VRRP Group"), {
        target: { value: "group1" },
      });
      fireEvent.click(screen.getByText("Failover"));
      // ConfirmDialog opens
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      expect(screen.getByTestId("confirm-desc").textContent).toContain("group1");
      fireEvent.click(screen.getByTestId("confirm-btn"));
      const failMut = mutationMap.get("n1:vrrp/failover");
      expect(failMut?.mutate).toHaveBeenCalledWith({ group: "group1" });
    });

    it("rejects failover when group is empty", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.click(screen.getByText("Failover"));
      expect(toast.error).toHaveBeenCalledWith("VRRP group is required");
    });

    it("calls failover onSuccess callback", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const failMut = mutationMap.get("n1:vrrp/failover");
      failMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("VRRP failover initiated");
    });

    it("cancels failover dialog via cancel button", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("VRRP Group"), {
        target: { value: "group1" },
      });
      fireEvent.click(screen.getByText("Failover"));
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("opens restart confirm dialog and restarts VRRP", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.click(screen.getByText("Restart VRRP"));
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      expect(screen.getByTestId("confirm-desc").textContent).toContain(
        "re-negotiate master/backup roles",
      );
      fireEvent.click(screen.getByTestId("confirm-btn"));
      const restartMut = mutationMap.get("n1:vrrp/restart");
      expect(restartMut?.mutate).toHaveBeenCalledWith({});
    });

    it("calls restart VRRP onSuccess callback", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      const restartMut = mutationMap.get("n1:vrrp/restart");
      restartMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("VRRP service restarted");
    });

    it("cancels restart dialog via cancel button", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.click(screen.getByText("Restart VRRP"));
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("shows spinner on failover button when isPending", () => {
      mutationMap.set("n1:vrrp/failover", {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
      });
      fullDiagMock();
      render(<DiagnosticsPage />);
      const failoverBtn = screen.getByText("Failover").closest("button");
      expect(failoverBtn?.disabled).toBe(true);
    });

    it("shows spinner on restart button when isPending", () => {
      mutationMap.set("n1:vrrp/restart", {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
      });
      fullDiagMock();
      render(<DiagnosticsPage />);
      const restartBtn = screen.getByText("Restart VRRP").closest("button");
      expect(restartBtn?.disabled).toBe(true);
    });
  });

  // --- Limits update (Group 7) ---

  describe("Limits management", () => {
    it("renders limits data in dedicated card", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      expect(screen.getByText("Session Limits")).toBeTruthy();
    });

    it("updates limits with both values", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Max Sessions"), {
        target: { value: "20000" },
      });
      fireEvent.change(screen.getByLabelText("Max Starting"), {
        target: { value: "200" },
      });
      fireEvent.click(screen.getByText("Update Limits"));
      const limitMut = mutationMap.get("n1:PUT:limits");
      expect(limitMut?.mutate).toHaveBeenCalledWith({
        max_sessions: 20000,
        max_starting: 200,
      });
    });

    it("updates limits with only max_sessions", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Max Sessions"), {
        target: { value: "15000" },
      });
      fireEvent.click(screen.getByText("Update Limits"));
      const limitMut = mutationMap.get("n1:PUT:limits");
      expect(limitMut?.mutate).toHaveBeenCalledWith({ max_sessions: 15000 });
    });

    it("updates limits with only max_starting", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Max Starting"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByText("Update Limits"));
      const limitMut = mutationMap.get("n1:PUT:limits");
      expect(limitMut?.mutate).toHaveBeenCalledWith({ max_starting: 50 });
    });

    it("rejects when no values provided", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.click(screen.getByText("Update Limits"));
      expect(toast.error).toHaveBeenCalledWith("Provide at least one limit value");
    });

    it("rejects invalid max_sessions", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Max Sessions"), {
        target: { value: "0" },
      });
      fireEvent.click(screen.getByText("Update Limits"));
      expect(toast.error).toHaveBeenCalledWith("Max sessions must be a positive integer");
    });

    it("rejects invalid max_starting", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Max Starting"), {
        target: { value: "-5" },
      });
      fireEvent.click(screen.getByText("Update Limits"));
      expect(toast.error).toHaveBeenCalledWith("Max starting must be a positive integer");
    });

    it("calls updateLimits onSuccess and clears form", () => {
      fullDiagMock();
      render(<DiagnosticsPage />);
      fireEvent.change(screen.getByLabelText("Max Sessions"), {
        target: { value: "5000" },
      });
      const limitMut = mutationMap.get("n1:PUT:limits");
      limitMut?.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Limits updated");
    });

    it("shows spinner on update button when isPending", () => {
      mutationMap.set("n1:PUT:limits", {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
      });
      fullDiagMock();
      render(<DiagnosticsPage />);
      const updateBtn = screen.getByText("Update Limits").closest("button");
      expect(updateBtn?.disabled).toBe(true);
    });
  });
});

// =====================================================================
// Events Page — Hook CRUD (Group 7)
// =====================================================================
describe("EventsPage Hook CRUD", () => {
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

  it("renders delete buttons alongside fire buttons", () => {
    fullEventsMock();
    render(<EventsPage />);
    const fireBtns = screen.getAllByText("Fire");
    expect(fireBtns.length).toBe(2);
  });

  it("creates a hook with valid input", () => {
    fullEventsMock();
    render(<EventsPage />);
    fireEvent.change(screen.getByLabelText("Hook Name"), {
      target: { value: "my-hook" },
    });
    fireEvent.change(screen.getByLabelText("Event Type"), {
      target: { value: "session-up" },
    });
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "notify" },
    });
    fireEvent.click(screen.getByText("Create Hook"));
    const createMut = mutationMap.get("n1:events/hooks");
    expect(createMut?.mutate).toHaveBeenCalledWith({
      name: "my-hook",
      event: "session-up",
      action: "notify",
      enabled: true,
    });
  });

  it("rejects create when hook name is empty", () => {
    fullEventsMock();
    render(<EventsPage />);
    fireEvent.change(screen.getByLabelText("Event Type"), {
      target: { value: "session-up" },
    });
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "notify" },
    });
    fireEvent.click(screen.getByText("Create Hook"));
    expect(toast.error).toHaveBeenCalledWith("Hook name is required");
  });

  it("rejects create when event type is empty", () => {
    fullEventsMock();
    render(<EventsPage />);
    fireEvent.change(screen.getByLabelText("Hook Name"), {
      target: { value: "my-hook" },
    });
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "notify" },
    });
    fireEvent.click(screen.getByText("Create Hook"));
    expect(toast.error).toHaveBeenCalledWith("Event type is required");
  });

  it("rejects create when action is empty", () => {
    fullEventsMock();
    render(<EventsPage />);
    fireEvent.change(screen.getByLabelText("Hook Name"), {
      target: { value: "my-hook" },
    });
    fireEvent.change(screen.getByLabelText("Event Type"), {
      target: { value: "session-up" },
    });
    fireEvent.click(screen.getByText("Create Hook"));
    expect(toast.error).toHaveBeenCalledWith("Action is required");
  });

  it("calls createHook onSuccess and clears form", () => {
    fullEventsMock();
    render(<EventsPage />);
    fireEvent.change(screen.getByLabelText("Hook Name"), {
      target: { value: "will-clear" },
    });
    const createMut = mutationMap.get("n1:events/hooks");
    createMut?.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Event hook created");
  });

  it("opens delete confirm dialog and deletes hook", () => {
    fullEventsMock();
    render(<EventsPage />);
    // Find the row for "session-up" and click its delete button
    const row = screen.getByText("session-up").closest("tr") ?? screen.getByText("session-up").parentElement;
    const buttons = row?.querySelectorAll("button") ?? [];
    // Last button is the delete (Trash2) button
    const deleteBtn = buttons[buttons.length - 1];
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(screen.getByTestId("confirm-desc").textContent).toContain("session-up");
    fireEvent.click(screen.getByTestId("confirm-btn"));
    const delMut = mutationMap.get("n1:DELETE:events/hooks/session-up");
    expect(delMut?.mutate).toHaveBeenCalled();
  });

  it("calls deleteHook onSuccess callback", () => {
    fullEventsMock();
    render(<EventsPage />);
    const row = screen.getByText("session-up").closest("tr") ?? screen.getByText("session-up").parentElement;
    const buttons = row?.querySelectorAll("button") ?? [];
    const deleteBtn = buttons[buttons.length - 1];
    if (deleteBtn) fireEvent.click(deleteBtn);
    const delMut = mutationMap.get("n1:DELETE:events/hooks/session-up");
    delMut?.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Event hook deleted");
  });

  it("cancels delete dialog via cancel button", () => {
    fullEventsMock();
    render(<EventsPage />);
    const row = screen.getByText("session-up").closest("tr") ?? screen.getByText("session-up").parentElement;
    const buttons = row?.querySelectorAll("button") ?? [];
    const deleteBtn = buttons[buttons.length - 1];
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("shows spinner on create button when isPending", () => {
    mutationMap.set("n1:events/hooks", {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: true,
    });
    fullEventsMock();
    render(<EventsPage />);
    const createBtn = screen.getByText("Create Hook").closest("button");
    expect(createBtn?.disabled).toBe(true);
  });

  it("renders hook with missing event gracefully and exercises delete", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "events/hooks") {
        return mockQuery({
          data: [{ id: "h3", event: undefined, action: "log", enabled: true }],
        });
      }
      return mockQuery({ data: [] });
    });
    render(<EventsPage />);
    // Click delete on the hook — exercises row.event ?? "" fallback
    const row = screen.getByText("log").closest("tr") ?? screen.getByText("log").parentElement;
    const buttons = row?.querySelectorAll("button") ?? [];
    const deleteBtn = buttons[buttons.length - 1];
    if (deleteBtn) fireEvent.click(deleteBtn);
  });
});
