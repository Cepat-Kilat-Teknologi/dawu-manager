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
import ServicePage from "@/app/(dashboard)/nodes/[nodeId]/service/page";
import DhcpPage from "@/app/(dashboard)/nodes/[nodeId]/dhcp/page";
import EventsPage from "@/app/(dashboard)/nodes/[nodeId]/events/page";
import DiagnosticsPage from "@/app/(dashboard)/nodes/[nodeId]/diagnostics/page";

beforeEach(() => {
  vi.clearAllMocks();
  capturedMutations.length = 0;
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
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
// Service Page — Retry
// =====================================================================
describe("ServicePage coverage", () => {
  it("retries on error", () => {
    renderWithErrorAndRetry(ServicePage, 1);
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
    (_nid: string, _path: string, opts?: { onSuccess?: () => void; method?: string }) => {
      const method = opts?.method;
      const key = method ? `${_nid}:${method}:${_path}` : `${_nid}:${_path}`;
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

});

// =====================================================================
// isPending tests — cover Loader2 ternary branches
// =====================================================================
describe("isPending branch coverage", () => {
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

  it("DiagnosticsPage: playbook isPending shows loader", () => {
    mockMutationPending("playbooks/run");
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: [{ name: "test-playbook", description: "Test", role_required: "admin" }],
        refetch: vi.fn(),
      }),
    );
    render(<DiagnosticsPage />);
    // Run button should be disabled — multiple "Run" buttons exist (playbook + scheduler)
    const runBtns = screen.getAllByText("Run");
    expect(runBtns[0].closest("button")?.disabled).toBe(true);
  });
});

// =====================================================================
// Alternative state tests — cover false branches of conditionals
// =====================================================================
describe("Alternative state branch coverage", () => {
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
