/**
 * Coverage gap tests for all 15 per-node category pages.
 * Targets uncovered onRetry callbacks (error + click Retry) and
 * Refresh button onClick handlers (data + click Refresh).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@/__tests__/ui-mocks";

// --- Shared mock setup (identical to category-pages.test.tsx) ---

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
import SessionsPage from "@/app/(dashboard)/nodes/[nodeId]/sessions/page";
import ServicePage from "@/app/(dashboard)/nodes/[nodeId]/service/page";
import FirewallPage from "@/app/(dashboard)/nodes/[nodeId]/firewall/page";
import NetworkPage from "@/app/(dashboard)/nodes/[nodeId]/network/page";
import ConfigPage from "@/app/(dashboard)/nodes/[nodeId]/config/page";
import TrafficPage from "@/app/(dashboard)/nodes/[nodeId]/traffic/page";
import IpPoolPage from "@/app/(dashboard)/nodes/[nodeId]/ip-pool/page";
import PppoePage from "@/app/(dashboard)/nodes/[nodeId]/pppoe/page";
import RoutingPage from "@/app/(dashboard)/nodes/[nodeId]/routing/page";
import DhcpPage from "@/app/(dashboard)/nodes/[nodeId]/dhcp/page";
import EventsPage from "@/app/(dashboard)/nodes/[nodeId]/events/page";
import LogsPage from "@/app/(dashboard)/nodes/[nodeId]/logs/page";
import MonitoringPage from "@/app/(dashboard)/nodes/[nodeId]/monitoring/page";
import SystemPage from "@/app/(dashboard)/nodes/[nodeId]/system/page";
import DiagnosticsPage from "@/app/(dashboard)/nodes/[nodeId]/diagnostics/page";

beforeEach(() => {
  vi.clearAllMocks();
  capturedMutations.length = 0;
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
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
      existing.onSuccess = opts?.onSuccess;
      return existing;
    },
  );
});

// =====================================================================
// Helper: render with error state, click all Retry buttons
// =====================================================================
function renderWithErrorAndRetry(
  Component: React.FC,
  expectedRetryCount: number,
) {
  const refetchFn = vi.fn();
  mockUseNodeProxy.mockReturnValue(
    mockQuery({ error: new Error("Network error"), refetch: refetchFn }),
  );
  render(<Component />);
  const retryButtons = screen.getAllByText("Retry");
  expect(retryButtons.length).toBe(expectedRetryCount);
  retryButtons.forEach((btn) => fireEvent.click(btn));
  expect(refetchFn).toHaveBeenCalledTimes(expectedRetryCount);
}

// =====================================================================
// Sessions Page — Retry + Refresh
// =====================================================================
describe("SessionsPage coverage", () => {
  it("retries on error", () => {
    renderWithErrorAndRetry(SessionsPage, 1);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            username: "user1",
            ip: "10.0.0.1",
            sid: "s1",
            ifname: "ppp0",
            calling_sid: "aa:bb:cc:dd:ee:ff",
            rate_limit: "10M/20M",
            uptime: "1h",
            state: "active",
          },
        ],
        refetch: refetchFn,
      }),
    );
    render(<SessionsPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// Service Page — Retry
// =====================================================================
describe("ServicePage coverage", () => {
  it("retries on error", () => {
    renderWithErrorAndRetry(ServicePage, 1);
  });
});

// =====================================================================
// Firewall Page — Retry + Refresh
// =====================================================================
describe("FirewallPage coverage", () => {
  it("retries all sections on error", () => {
    // Firewall has 6 NodePageShell sections, all with onRetry
    renderWithErrorAndRetry(FirewallPage, 6);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({
          data: {
            raw_output: "table inet filter { chain input { accept } }",
            rules_count: 1,
          },
          refetch: refetchFn,
        });
      }
      return mockQuery({ data: [], refetch: refetchFn });
    });
    render(<FirewallPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// Network Page — Retry + Refresh
// =====================================================================
describe("NetworkPage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(NetworkPage, 4);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            name: "eth0",
            state: "UP",
            mtu: 1500,
            mac: "aa:bb:cc:dd:ee:ff",
            ipv4: "10.0.0.1",
          },
        ],
        refetch: refetchFn,
      }),
    );
    render(<NetworkPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// Config Page — Retry + Refresh
// =====================================================================
describe("ConfigPage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(ConfigPage, 3);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          { name: "backup-2026-07-10.conf", created: "2026-07-10T00:00:00Z", size: 1024 },
          { name: "backup-old.conf", created: "2026-07-09T00:00:00Z" },
        ],
        refetch: refetchFn,
      }),
    );
    render(<ConfigPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
    // Covers row.size falsy branch → "—"
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});

// =====================================================================
// Traffic Page — Retry + Refresh
// =====================================================================
describe("TrafficPage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(TrafficPage, 2);
  });

  it("clicks Refresh buttons", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            username: "user1",
            rate: "10M/20M",
            direction: "down",
            interface: "ppp0",
          },
        ],
        refetch: refetchFn,
      }),
    );
    render(<TrafficPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    expect(refreshBtns.length).toBe(2);
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalledTimes(2);
  });
});

// =====================================================================
// IP Pool Page — Retry + Refresh
// =====================================================================
describe("IpPoolPage coverage", () => {
  it("retries on error", () => {
    renderWithErrorAndRetry(IpPoolPage, 1);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          { name: "pool1", range: "10.0.0.0/24", used: 100, available: 156, total: 256 },
        ],
        refetch: refetchFn,
      }),
    );
    render(<IpPoolPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// PPPoE Page — Retry + Refresh
// =====================================================================
describe("PppoePage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(PppoePage, 3);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          { name: "pppoe0", state: "active", sessions: 42, mtu: 1492, mac: "aa:bb:cc:dd:ee:ff" },
        ],
        refetch: refetchFn,
      }),
    );
    render(<PppoePage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// Routing Page — Retry + Refresh
// =====================================================================
describe("RoutingPage coverage", () => {
  it("retries all detail sections on error", () => {
    // Routing has 4 detail NodePageShell sections (BGP, OSPF, RIP, BFD), each with onRetry
    renderWithErrorAndRetry(RoutingPage, 4);
  });

  it("clicks Refresh buttons", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: { status: "active", neighbors: 2 },
        refetch: refetchFn,
      }),
    );
    render(<RoutingPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    expect(refreshBtns.length).toBe(4);
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalledTimes(4);
  });
});

// =====================================================================
// DHCP Page — Retry + Refresh
// =====================================================================
describe("DhcpPage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(DhcpPage, 3);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [{ ip: "10.0.0.100", mac: "aa:bb:cc:dd:ee:ff", hostname: "client1", expires: "1h", state: "active" }],
        refetch: refetchFn,
      }),
    );
    render(<DhcpPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// Events Page — Retry + Refresh
// =====================================================================
describe("EventsPage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(EventsPage, 2);
  });

  it("clicks Refresh buttons", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [{ id: "h1", event: "session-up", action: "log", enabled: true, description: "Log session" }],
        refetch: refetchFn,
      }),
    );
    render(<EventsPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    expect(refreshBtns.length).toBe(2);
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalledTimes(2);
  });
});

// =====================================================================
// Logs Page — Retry + Refresh
// =====================================================================
describe("LogsPage coverage", () => {
  it("retries on error", () => {
    renderWithErrorAndRetry(LogsPage, 1);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: ["2026-07-10 [info] Started"],
        refetch: refetchFn,
      }),
    );
    render(<LogsPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// Monitoring Page — Retry + Refresh
// =====================================================================
describe("MonitoringPage coverage", () => {
  it("retries all sections on error", () => {
    renderWithErrorAndRetry(MonitoringPage, 2);
  });

  it("clicks Refresh button", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: {
          exporters: [
            { service: "node_exporter", active: true, port: 9100 },
          ],
          count: 1,
        },
        refetch: refetchFn,
      }),
    );
    render(<MonitoringPage />);
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalled();
  });
});

// =====================================================================
// System Page — Retry + Refresh
// =====================================================================
describe("SystemPage coverage", () => {
  it("retries all sections on error", () => {
    // System has 6 NodePageShell sections, all with onRetry
    renderWithErrorAndRetry(SystemPage, 6);
  });

  it("clicks Refresh buttons", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            local_port: "ge0",
            remote_system: "sw1",
            remote_port: "ge1",
            remote_description: "Core",
            ttl: 120,
          },
        ],
        refetch: refetchFn,
      }),
    );
    render(<SystemPage />);
    // System has 2 Refresh buttons (LLDP and Audit Log sections)
    const refreshBtns = screen.getAllByText("Refresh");
    expect(refreshBtns.length).toBe(2);
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalledTimes(2);
  });
});

// =====================================================================
// Diagnostics Page — Retry + Refresh
// =====================================================================
describe("DiagnosticsPage coverage", () => {
  it("retries all sections on error", () => {
    // Diagnostics has 5 NodePageShell sections with onRetry:
    // Doctor, Playbooks, Scheduler, Zones, Conntrack, Flow
    renderWithErrorAndRetry(DiagnosticsPage, 6);
  });

  it("clicks Refresh buttons", () => {
    const refetchFn = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          { name: "test-check", status: "ok", detail: "OK" },
        ],
        refetch: refetchFn,
      }),
    );
    render(<DiagnosticsPage />);
    // Diagnostics has 3 Refresh buttons: Run Checks, Conntrack Refresh, Flow Refresh
    const runChecksBtn = screen.getAllByText("Run Checks");
    runChecksBtn.forEach((btn) => fireEvent.click(btn));
    const refreshBtns = screen.getAllByText("Refresh");
    refreshBtns.forEach((btn) => fireEvent.click(btn));
    expect(refetchFn).toHaveBeenCalledTimes(runChecksBtn.length + refreshBtns.length);
  });
});

// =====================================================================
// Helper: mock a specific mutation path as isPending=true
// =====================================================================
function mockMutationPending(pendingPath: string) {
  mutationMap.clear();
  capturedMutations.length = 0;
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, _path: string, opts?: { onSuccess?: () => void }) => {
      const key = `${_nid}:${_path}`;
      if (!mutationMap.has(key)) {
        const m: CapturedMutation = {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: _path === pendingPath,
          onSuccess: opts?.onSuccess,
        };
        mutationMap.set(key, m);
        capturedMutations.push(m);
      }
      const existing = mutationMap.get(key)!;
      existing.onSuccess = opts?.onSuccess;
      return existing;
    },
  );
}

// =====================================================================
// Cancel dialog tests — cover onOpenChange(false) callbacks
// =====================================================================
describe("Cancel dialog coverage", () => {
  it("ConfigPage: Cancel dialog covers onOpenChange", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: { key: "value" } });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<ConfigPage />);
    // Click "Apply" to open the dialog
    const applyBtn = screen.getByText("Apply");
    fireEvent.click(applyBtn);
    // Dialog should be open
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    // Click Cancel to close — triggers onOpenChange(false) → !open && setConfirmAction(null)
    fireEvent.click(screen.getByTestId("cancel-btn"));
    // Dialog should be closed
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("ServicePage: Cancel dialog covers onOpenChange", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: { service: "accel-ppp", status: "stopped" } }),
    );
    render(<ServicePage />);
    // Click "Start" button (not disabled when stopped)
    const startBtn = screen.getByText("Start");
    fireEvent.click(startBtn);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    // Click Cancel
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("SessionsPage: Cancel dialog covers onOpenChange", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            username: "user1",
            ip: "10.0.0.1",
            sid: "s1",
            ifname: "ppp0",
            calling_sid: "aa:bb:cc:dd:ee:ff",
            rate_limit: "10M/20M",
            uptime: "1h",
            state: "active",
          },
        ],
        refetch: vi.fn(),
      }),
    );
    render(<SessionsPage />);
    // Click Terminate button on a session row
    const terminateBtn = screen.getByText("Terminate");
    fireEvent.click(terminateBtn);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    // Click Cancel
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });
});

// =====================================================================
// isPending tests — cover Loader2 ternary branches
// =====================================================================
describe("isPending branch coverage", () => {
  it("SessionsPage: restart isPending shows loader", () => {
    mockMutationPending("sessions/restart");
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            username: "user1",
            ip: "10.0.0.1",
            sid: "s1",
            ifname: "ppp0",
            calling_sid: "aa:bb:cc:dd:ee:ff",
            rate_limit: "10M/20M",
            uptime: "1h",
            state: "active",
          },
        ],
        refetch: vi.fn(),
      }),
    );
    render(<SessionsPage />);
    // The restart button should be disabled with isPending=true
    const restartBtn = screen.getByText("Restart");
    expect(restartBtn.closest("button")?.disabled).toBe(true);
  });

  it("ServicePage: action isPending disables buttons", () => {
    mockMutationPending("service/action");
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: { service: "accel-ppp", status: "running" } }),
    );
    render(<ServicePage />);
    // All action buttons should be disabled when actionMutation.isPending=true
    const restartBtn = screen.getByText("Restart");
    expect(restartBtn.closest("button")?.disabled).toBe(true);
  });

  it("ConfigPage: apply isPending shows loader", () => {
    mockMutationPending("config/apply");
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: { key: "value" } });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<ConfigPage />);
    // Apply button should be disabled
    const applyBtn = screen.getByText("Apply");
    expect(applyBtn.closest("button")?.disabled).toBe(true);
  });

  it("DhcpPage: restart isPending shows loader", () => {
    mockMutationPending("dhcp/restart");
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "dhcp/status") return mockQuery({ data: { enabled: true } });
      if (path === "dhcp/leases") return mockQuery({ data: [] });
      if (path === "dhcp/relay") return mockQuery({ data: {} });
      return mockQuery();
    });
    render(<DhcpPage />);
    // Restart button should be disabled
    const restartBtn = screen.getByText("Restart");
    expect(restartBtn.closest("button")?.disabled).toBe(true);
  });

  it("MonitoringPage: restart isPending shows loader", () => {
    mockMutationPending("monitoring/restart");
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: {
          exporters: [
            { service: "node_exporter", active: true, port: 9100 },
          ],
          count: 1,
        },
      }),
    );
    render(<MonitoringPage />);
    // Restart button should be disabled
    const restartBtn = screen.getByText("Restart");
    expect(restartBtn.closest("button")?.disabled).toBe(true);
  });

  it("FirewallPage: save isPending shows loader", () => {
    mockMutationPending("firewall/save");
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({
          data: {
            raw_output: "table inet filter { chain input { accept } }",
            rules_count: 1,
          },
          refetch: vi.fn(),
        });
      }
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<FirewallPage />);
    // Save Rules button should be disabled
    const saveBtn = screen.getByText("Save Rules");
    expect(saveBtn.closest("button")?.disabled).toBe(true);
  });

  it("DiagnosticsPage: playbook isPending shows loader", () => {
    mockMutationPending("playbooks/run");
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [{ name: "test-playbook", description: "Test", role_required: "admin" }],
        refetch: vi.fn(),
      }),
    );
    render(<DiagnosticsPage />);
    // Run button should be disabled
    const runBtn = screen.getByText("Run");
    expect(runBtn.closest("button")?.disabled).toBe(true);
  });
});

// =====================================================================
// Alternative state tests — cover false branches of conditionals
// =====================================================================
describe("Alternative state branch coverage", () => {
  it("SessionsPage: non-active state renders outline badge", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            username: "user1",
            ip: "10.0.0.1",
            sid: "s1",
            ifname: "ppp0",
            calling_sid: "aa:bb:cc:dd:ee:ff",
            rate_limit: "10M/20M",
            uptime: "1h",
            state: "closing",
          },
        ],
        refetch: vi.fn(),
      }),
    );
    render(<SessionsPage />);
    expect(screen.getByText("closing")).toBeTruthy();
  });

  it("SessionsPage: undefined state renders fallback 'active'", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          {
            username: "user2",
            ip: "10.0.0.2",
            sid: "s2",
            ifname: "ppp1",
            calling_sid: "11:22:33:44:55:66",
            rate_limit: "5M/10M",
            uptime: "2h",
          },
        ],
        refetch: vi.fn(),
      }),
    );
    render(<SessionsPage />);
    // The ?? "active" fallback should render
    expect(screen.getByText("active")).toBeTruthy();
  });

  it("SessionsPage: no stats data hides stats row", () => {
    // Use path-based mock: sessions returns data, sessions/stats returns null
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "sessions") {
        return mockQuery({
          data: [
            {
              username: "u1",
              ip: "10.0.0.1",
              sid: "s1",
              ifname: "ppp0",
              calling_sid: "aa:bb:cc:dd:ee:ff",
              rate_limit: "10M/20M",
              uptime: "1h",
              state: "active",
            },
          ],
          refetch: vi.fn(),
        });
      }
      return mockQuery(); // null data for stats
    });
    render(<SessionsPage />);
    expect(screen.getByText("u1")).toBeTruthy();
  });

  it("ServicePage: non-running status shows disabled action buttons", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: { service: "accel-ppp", status: "stopped" },
      }),
    );
    render(<ServicePage />);
    // Stop should be disabled (only enabled when running)
    const stopBtn = screen.getByText("Stop");
    expect(stopBtn.closest("button")?.disabled).toBe(true);
    // Start should be enabled
    const startBtn = screen.getByText("Start");
    expect(startBtn.closest("button")?.disabled).toBe(false);
  });

  it("ServicePage: missing optional fields (no pid/uptime/version)", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: { service: "accel-ppp", status: "stopped" },
      }),
    );
    render(<ServicePage />);
    // PID, Uptime, Version cards should NOT be rendered
    expect(screen.queryByText("PID")).toBeNull();
    expect(screen.queryByText("Uptime")).toBeNull();
    expect(screen.queryByText("Version")).toBeNull();
    // Status should show "stopped" with destructive badge
    expect(screen.getByText("stopped")).toBeTruthy();
  });

  it("ServicePage: status unknown when data has no status field", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: { service: "accel-ppp" } }),
    );
    render(<ServicePage />);
    // status ?? "unknown" — the fallback
    expect(screen.getByText("unknown")).toBeTruthy();
  });

  it("NetworkPage: non-UP interface state renders outline badge", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "network/interfaces") return mockQuery({ data: [{ name: "eth0", state: "DOWN", mtu: 1500, mac: "aa:bb:cc:dd:ee:ff" }], refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<NetworkPage />);
    expect(screen.getByText("DOWN")).toBeTruthy();
  });

  it("NetworkPage: VLAN with undefined state shows dash fallback", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "network/vlans") return mockQuery({ data: [{ id: 100, parent: "eth0", name: "eth0.100" }], refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<NetworkPage />);
    // state ?? "—" fallback
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("NetworkPage: VLAN with non-UP state renders outline badge", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "network/vlans") return mockQuery({ data: [{ id: 100, parent: "eth0", name: "eth0.100", state: "DOWN" }], refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<NetworkPage />);
    expect(screen.getByText("DOWN")).toBeTruthy();
  });

  it("FirewallPage: NAT with non-active status renders outline", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/nat/egress") return mockQuery({ data: [{ type: "snat", interface: "eth0", source: "10.0.0.0/8", status: "inactive" }], refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<FirewallPage />);
    expect(screen.getByText("inactive")).toBeTruthy();
  });

  it("FirewallPage: NAT with undefined status shows dash fallback", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/nat/masquerade") return mockQuery({ data: [{ type: "masq", interface: "eth0", source: "10.0.0.0/8" }], refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<FirewallPage />);
    // status ?? "—" fallback
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("DhcpPage: non-active lease state renders outline badge", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [{ ip: "10.0.0.100", mac: "aa:bb:cc:dd:ee:ff", state: "expired" }],
        refetch: vi.fn(),
      }),
    );
    render(<DhcpPage />);
    expect(screen.getByText("expired")).toBeTruthy();
  });

  it("DhcpPage: undefined lease state renders fallback 'active'", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [{ ip: "10.0.0.100", mac: "aa:bb:cc:dd:ee:ff" }],
        refetch: vi.fn(),
      }),
    );
    render(<DhcpPage />);
    expect(screen.getByText("active")).toBeTruthy();
  });

  it("MonitoringPage: boolean false value renders inactive badge", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: {
          exporters: [
            { service: "node_exporter", active: false, port: 9100 },
          ],
          count: 1,
        },
        refetch: vi.fn(),
      }),
    );
    render(<MonitoringPage />);
    expect(screen.getByText("inactive")).toBeTruthy();
  });

  it("DiagnosticsPage: warn and error doctor statuses", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          { name: "check-ok", status: "ok", detail: "All good" },
          { name: "check-warn", status: "warn", detail: "Watch out" },
          { name: "check-fail", status: "fail", detail: "Broken" },
        ],
        refetch: vi.fn(),
      }),
    );
    render(<DiagnosticsPage />);
    expect(screen.getByText("ok")).toBeTruthy();
    expect(screen.getByText("warn")).toBeTruthy();
    expect(screen.getByText("fail")).toBeTruthy();
  });

  it("DiagnosticsPage: disabled scheduler job", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [
          { id: "j1", name: "job1", schedule: "*/5 * * * *", enabled: false, last_run: "never" },
        ],
        refetch: vi.fn(),
      }),
    );
    render(<DiagnosticsPage />);
    expect(screen.getByText("disabled")).toBeTruthy();
  });

  it("DiagnosticsPage: zone with no interfaces", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/zones") return mockQuery({ data: [{ name: "dmz", policy: "drop" }], refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<DiagnosticsPage />);
    // interfaces?.join(", ") ?? "-" → "-"
    expect(screen.getByText("-")).toBeTruthy();
  });

  it("DiagnosticsPage: flow with undefined values renders dash placeholder", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "flow/stats") return mockQuery({ data: { flows_exported: undefined, packets_processed: undefined }, refetch: vi.fn() });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<DiagnosticsPage />);
    // formatValue(undefined) renders as "—"
    const dashTexts = screen.getAllByText("—");
    expect(dashTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("DiagnosticsPage: status cards with loading state", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ isLoading: true }),
    );
    render(<DiagnosticsPage />);
    // Status cards show loading skeleton when isLoading=true
    expect(screen.getByText("VRRP")).toBeTruthy();
  });

  it("DiagnosticsPage: status cards with null data", () => {
    // Query returns no error but also no data
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: null }),
    );
    render(<DiagnosticsPage />);
    // status cards should show "No data" for null
    const noDataElements = screen.getAllByText("No data");
    expect(noDataElements.length).toBeGreaterThanOrEqual(1);
  });
});

// =====================================================================
// Remaining branch coverage — testable branches
// =====================================================================
describe("Remaining branch coverage", () => {
  it("SessionsPage: row without sid falls back to username key", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "sessions") {
        return mockQuery({
          data: [
            {
              username: "user-no-sid",
              ip: "10.0.0.3",
              ifname: "ppp2",
              calling_sid: "aa:bb:cc:dd:ee:ff",
              rate_limit: "5M/10M",
              uptime: "30m",
              state: "active",
            },
          ],
          refetch: vi.fn(),
        });
      }
      return mockQuery();
    });
    render(<SessionsPage />);
    expect(screen.getByText("user-no-sid")).toBeTruthy();
  });

  it("ConfigPage: rollback confirm triggers rollback mutation", async () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: { key: "value" } });
      return mockQuery({ data: [], refetch: vi.fn() });
    });
    render(<ConfigPage />);
    // Click "Rollback" to open dialog
    const rollbackBtn = screen.getByText("Rollback");
    fireEvent.click(rollbackBtn);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    // Click Confirm to trigger rollback mutation — wrap in act to flush async onConfirm
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    const rollbackMut = mutationMap.get("n1:config/rollback");
    expect(rollbackMut?.mutateAsync).toHaveBeenCalled();
  });

  it("ServicePage: isPending with matching confirmAction shows Loader2", () => {
    let actionCallCount = 0;
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, _path: string, opts?: { onSuccess?: () => void }) => {
        if (_path === "service/action") {
          actionCallCount++;
          const m: CapturedMutation = {
            mutate: vi.fn(),
            mutateAsync: vi.fn().mockReturnValue(new Promise(() => {})),
            isPending: actionCallCount > 1,
            onSuccess: opts?.onSuccess,
          };
          return m;
        }
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          onSuccess: opts?.onSuccess,
        };
      },
    );
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: { service: "accel-ppp", status: "running" } }),
    );
    render(<ServicePage />);
    // First render: isPending=false, buttons enabled
    const restartBtn = screen.getByText("Restart");
    fireEvent.click(restartBtn);
    // After click: confirmAction="restart", re-render with isPending=true
    // The ternary `isPending && confirmAction === action.key` is true for "restart"
    expect(restartBtn.closest("button")?.disabled).toBe(true);
  });
});
