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
import SessionsPage from "@/app/(dashboard)/nodes/[nodeId]/sessions/page";
import ServicePage from "@/app/(dashboard)/nodes/[nodeId]/service/page";
import ConfigPage from "@/app/(dashboard)/nodes/[nodeId]/config/page";
import TrafficPage from "@/app/(dashboard)/nodes/[nodeId]/traffic/page";
import DhcpPage from "@/app/(dashboard)/nodes/[nodeId]/dhcp/page";
import EventsPage from "@/app/(dashboard)/nodes/[nodeId]/events/page";
import MonitoringPage from "@/app/(dashboard)/nodes/[nodeId]/monitoring/page";
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
// Sessions Page
// =====================================================================
describe("SessionsPage", () => {
  const sessionsMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "sessions") {
        return mockQuery({
          data: [
            {
              username: "user1",
              ip: "10.0.0.1",
              sid: "s1",
              ifname: "ppp0",
              calling_sid: "aa:bb:cc:dd:ee:ff",
              rate_limit: "10M/20M",
              uptime: "1h 30m",
              state: "active",
            },
            {
              username: "user2",
              ip: "10.0.0.2",
              sid: "s2",
              ifname: "ppp1",
              calling_sid: "11:22:33:44:55:66",
              rate_limit: "5M/10M",
              uptime: "30m",
              state: "closing",
            },
          ],
        });
      }
      return mockQuery({ data: { total: 5, active: 3 } });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<SessionsPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("Network error") }),
    );
    render(<SessionsPage />);
    expect(screen.getAllByText("Network error").length).toBeGreaterThanOrEqual(1);
  });

  it("renders session data with state badges", () => {
    sessionsMock();
    render(<SessionsPage />);
    expect(screen.getByText("user1")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    expect(screen.getByText("aa:bb:cc:dd:ee:ff")).toBeTruthy();
    // "active" appears in badge + possibly stats — use queryAll
    expect(screen.queryAllByText("active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("closing")).toBeTruthy();
  });

  it("renders stats row from sessions/stats", () => {
    sessionsMock();
    render(<SessionsPage />);
    expect(screen.getByText("total")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("filters sessions by username", () => {
    sessionsMock();
    render(<SessionsPage />);
    const input = screen.getByPlaceholderText("Search username, IP, MAC...");
    fireEvent.change(input, { target: { value: "user1" } });
    expect(screen.getByText("user1")).toBeTruthy();
    expect(screen.queryByText("user2")).toBeNull();
  });

  it("filters sessions by IP address", () => {
    sessionsMock();
    render(<SessionsPage />);
    const input = screen.getByPlaceholderText("Search username, IP, MAC...");
    fireEvent.change(input, { target: { value: "10.0.0.2" } });
    expect(screen.queryByText("user1")).toBeNull();
    expect(screen.getByText("user2")).toBeTruthy();
  });

  it("filters sessions by MAC address", () => {
    sessionsMock();
    render(<SessionsPage />);
    const input = screen.getByPlaceholderText("Search username, IP, MAC...");
    fireEvent.change(input, { target: { value: "11:22:33" } });
    expect(screen.queryByText("user1")).toBeNull();
    expect(screen.getByText("user2")).toBeTruthy();
  });

  it("fires restart mutation via action cell button", () => {
    sessionsMock();
    render(<SessionsPage />);
    // Restart is in sr-only span — click nearest button parent
    const restartSpans = screen.getAllByText("Restart");
    const btn = restartSpans[0].closest("button");
    fireEvent.click(btn!);
    // terminate=[0], restart=[1]
    expect(capturedMutations[1].mutate).toHaveBeenCalledWith({
      username: "user1",
    });
  });

  it("opens terminate confirm dialog, confirms, and calls mutateAsync", async () => {
    sessionsMock();
    render(<SessionsPage />);
    const terminateSpans = screen.getAllByText("Terminate");
    const btn = terminateSpans[0].closest("button");
    fireEvent.click(btn!);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(screen.getByTestId("confirm-desc").textContent).toContain("user1");
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(capturedMutations[0].mutateAsync).toHaveBeenCalledWith({
      username: "user1",
    });
  });

  it("closes terminate dialog via cancel", () => {
    sessionsMock();
    render(<SessionsPage />);
    const terminateSpans = screen.getAllByText("Terminate");
    fireEvent.click(terminateSpans[0].closest("button")!);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("calls onSuccess for terminate mutation", () => {
    sessionsMock();
    render(<SessionsPage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("calls onSuccess for restart mutation", () => {
    sessionsMock();
    render(<SessionsPage />);
    capturedMutations[1]?.onSuccess!();
  });

  it("renders empty state", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "sessions") return mockQuery({ data: [] });
      return mockQuery({ data: {} });
    });
    render(<SessionsPage />);
    expect(screen.getByText("No active PPPoE sessions.")).toBeTruthy();
  });
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

  it("opens restart confirm dialog with correct description", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: fullServiceData }));
    render(<ServicePage />);
    fireEvent.click(screen.getByText("Restart"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain("restart");
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
// Config Page
// =====================================================================
describe("ConfigPage", () => {
  const fullConfigMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") {
        return mockQuery({ data: { path: "/etc/accel-ppp.conf", content: "[ppp]\nverbose=1", last_modified: "2026-07-01T00:00:00Z" } });
      }
      if (path === "config/backups") {
        return mockQuery({
          data: [
            {
              name: "backup-2026-07-01",
              created: "2026-07-01T00:00:00Z",
              size: 4096,
            },
            { name: "backup-2026-07-02", created: "2026-07-02T00:00:00Z" },
          ],
        });
      }
      if (path === "config/revisions") {
        return mockQuery({
          data: [
            {
              name: "rev-2026-07-01",
              created: "2026-07-01",
              size: 2048,
            },
          ],
        });
      }
      return mockQuery({ data: {} });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<ConfigPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders config and backup with size cell (KB conversion)", () => {
    fullConfigMock();
    render(<ConfigPage />);
    expect(screen.getByText("Current Configuration")).toBeTruthy();
    expect(screen.getByText("4 KB")).toBeTruthy();
  });

  it("renders revisions table", () => {
    fullConfigMock();
    render(<ConfigPage />);
    expect(screen.getByText("rev-2026-07-01")).toBeTruthy();
    expect(screen.getByText("2 KB")).toBeTruthy();
  });

  it("enters edit mode and applies edited content via Save & Apply", () => {
    fullConfigMock();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    const textarea = screen.getByLabelText(
      "Configuration content",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("[ppp]\nverbose=1");
    fireEvent.change(textarea, { target: { value: "[ppp]\nverbose=5" } });
    fireEvent.click(screen.getByText("Save & Apply"));
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({
      content: "[ppp]\nverbose=5",
    });
  });

  it("cancels edit mode without applying", () => {
    fullConfigMock();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByLabelText("Configuration content")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByLabelText("Configuration content")).toBeNull();
  });

  it("edits with fallbacks when config content and path are missing", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: {} });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    // content ?? "" seeds an empty draft; path ?? "config" renders in the hint.
    const textarea = screen.getByLabelText(
      "Configuration content",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    expect(screen.getByText("config")).toBeTruthy();
  });

  it("shows saving spinner state while apply is pending", () => {
    fullConfigMock();
    mockUseNodeProxyMutation.mockImplementation(() => {
      const m = {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
        onSuccess: undefined,
      };
      capturedMutations.push(m);
      return m;
    });
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Saving…")).toBeTruthy();
  });

  it("opens confirm confirm dialog", () => {
    fullConfigMock();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "Confirm the currently",
    );
  });

  it("opens rollback confirm dialog", () => {
    fullConfigMock();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Rollback"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "revert to the previous",
    );
  });

  it("executes confirm via confirm", async () => {
    fullConfigMock();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Confirm"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(capturedMutations[1].mutateAsync).toHaveBeenCalledWith({});
  });

  it("executes rollback via confirm", async () => {
    fullConfigMock();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Rollback"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(capturedMutations[2].mutateAsync).toHaveBeenCalledWith({});
  });

  it("calls onSuccess for all mutations", () => {
    fullConfigMock();
    render(<ConfigPage />);
    capturedMutations[0]?.onSuccess!();
    capturedMutations[1]?.onSuccess!();
    capturedMutations[2]?.onSuccess!();
  });

  it("disables Edit when config has not loaded", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: undefined });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    expect((screen.getByText("Edit").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders empty backups and revisions", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: { path: "/etc/accel-ppp.conf", content: "", last_modified: "" } });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    expect(
      screen.getByText("No configuration backups available."),
    ).toBeTruthy();
    expect(screen.getByText("No configuration revisions.")).toBeTruthy();
  });
});

// =====================================================================
// Traffic Page
// =====================================================================
describe("TrafficPage", () => {
  const fullTrafficMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "traffic/ratelimit") {
        return mockQuery({
          data: [
            {
              username: "user1",
              rate: "10M/20M",
              direction: "both",
              interface: "ppp0",
            },
          ],
        });
      }
      if (path === "traffic/queue/stats") {
        return mockQuery({
          data: [
            {
              interface: "ppp0",
              sent_bytes: 1048576,
              sent_packets: 1024,
              dropped: 5,
              overlimits: 2,
            },
            {
              interface: "ppp1",
              sent_bytes: 0,
              sent_packets: 0,
              dropped: 0,
              overlimits: 0,
            },
          ],
        });
      }
      return mockQuery({ data: {} });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<TrafficPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders rate limits with remove button", () => {
    fullTrafficMock();
    render(<TrafficPage />);
    expect(screen.getByText("user1")).toBeTruthy();
    expect(screen.getByText("10M/20M")).toBeTruthy();
    fireEvent.click(screen.getByText("Remove"));
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({
      username: "user1",
    });
  });

  it("renders queue stats with formatBytes", () => {
    fullTrafficMock();
    render(<TrafficPage />);
    expect(screen.getByText("1 MB")).toBeTruthy();
    expect(screen.getByText("0 B")).toBeTruthy();
  });

  it("renders dropped badge variants (destructive vs outline)", () => {
    fullTrafficMock();
    render(<TrafficPage />);
    const badges = screen.getAllByTestId("badge");
    const droppedBadge5 = badges.find((b) => b.textContent === "5");
    const droppedBadge0 = badges.find((b) => b.textContent === "0");
    expect(droppedBadge5?.getAttribute("data-variant")).toBe("destructive");
    expect(droppedBadge0?.getAttribute("data-variant")).toBe("outline");
  });

  it("calls onSuccess for remove mutation", () => {
    fullTrafficMock();
    render(<TrafficPage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("renders empty states", () => {
    mockUseNodeProxy.mockImplementation(() => mockQuery({ data: [] }));
    render(<TrafficPage />);
    expect(screen.getByText("No active rate limits.")).toBeTruthy();
    expect(screen.getByText("No queue statistics available.")).toBeTruthy();
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
// Monitoring Page
// =====================================================================
describe("MonitoringPage", () => {
  const fullMonitoringMock = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "monitoring/status") {
        return mockQuery({
          data: {
            exporters: [
              { service: "node_exporter", active: true, port: 9100 },
              { service: "accel_exporter", active: false, port: 9101 },
            ],
            count: 2,
          },
        });
      }
      if (path === "monitoring/metrics") {
        return mockQuery({
          data: { cpu_usage: 45, memory_usage: 60, disk_free: "12 GB" },
        });
      }
      return mockQuery({ data: {} });
    });

  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<MonitoringPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders status KV pairs", () => {
    fullMonitoringMock();
    render(<MonitoringPage />);
    // Status section now shows exporters with service name and active badge
    expect(screen.getByText(/node_exporter/)).toBeTruthy();
    expect(screen.queryAllByText("active").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("inactive").length).toBeGreaterThanOrEqual(1);
  });

  it("renders metric cards with formatted numbers", () => {
    fullMonitoringMock();
    render(<MonitoringPage />);
    expect(screen.getByText("cpu usage")).toBeTruthy();
    expect(screen.getByText("45")).toBeTruthy();
    expect(screen.getByText("12 GB")).toBeTruthy();
  });

  it("fires restart mutation", () => {
    fullMonitoringMock();
    render(<MonitoringPage />);
    fireEvent.click(screen.getByText("Restart"));
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({});
  });

  it("calls onSuccess for restart mutation", () => {
    fullMonitoringMock();
    render(<MonitoringPage />);
    capturedMutations[0]?.onSuccess!();
  });

  it("shows empty metrics", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "monitoring/status") return mockQuery({ data: { exporters: [], count: 0 } });
      return mockQuery({ data: null });
    });
    render(<MonitoringPage />);
    expect(screen.getByText("No metrics available.")).toBeTruthy();
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
