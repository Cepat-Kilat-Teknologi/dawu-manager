/**
 * Dedicated tests for the redesigned Sessions page (real accel-2 shapes).
 * Exercises: the live-counter StatCard tiles (string values, "0%" CPU,
 * "used / total" pool, dashed empty/missing fields, extra unknown keys),
 * the sessions table + state badges, username/IP/MAC search (including rows
 * with missing fields), restart (idle + pending), the terminate confirm
 * dialog (confirm / cancel / open=true), success toasts, and the
 * loading / error+retry / empty / refresh states.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  onSuccess?: () => void;
}

const { mockUseNodeProxy, mockUseNodeProxyMutation, mutations, pending } =
  vi.hoisted(() => ({
    mockUseNodeProxy: vi.fn(),
    mockUseNodeProxyMutation: vi.fn(),
    mutations: new Map<string, CapturedMutation>(),
    pending: new Set<string>(),
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
}));

// ConfirmDialog: expose confirm / cancel / open=true triggers when open.
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    description,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => Promise<void> | void;
    description: string;
    onOpenChange: (o: boolean) => void;
    title?: string;
    confirmLabel?: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span data-testid="confirm-desc">{description}</span>
        <button data-testid="confirm-btn" onClick={() => onConfirm()}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button data-testid="open-true" onClick={() => onOpenChange(true)}>
          OpenTrue
        </button>
      </div>
    ) : null,
}));

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

/** Session rows covering: active/closing/undefined state, empty + present sid. */
function sessionRows() {
  return [
    {
      username: "alice",
      ip: "10.0.0.1",
      sid: "s1",
      ifname: "ppp0",
      calling_sid: "aa:bb:cc:dd:ee:01",
      rate_limit: "10M/20M",
      uptime: "1h",
      state: "active",
    },
    {
      username: "bob",
      ip: "10.0.0.2",
      sid: "", // falsy → getRowKey falls back to username
      ifname: "ppp1",
      calling_sid: "11:22:33:44:55:66",
      rate_limit: "5M/10M",
      uptime: "30m",
      state: "closing",
    },
    // Minimal row: no username/ip/calling_sid/state → optional-chain + "?? active".
    { sid: "s3", ifname: "ppp2" },
  ];
}

/** Mock useNodeProxy per path (sessions list + sessions/stats). */
function mockPaths(opts: {
  sessions?: unknown;
  stats?: unknown;
  refetch?: () => void;
}) {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "sessions")
      return mockQuery({ data: opts.sessions ?? null, refetch: opts.refetch ?? vi.fn() });
    if (path === "sessions/stats") return mockQuery({ data: opts.stats ?? null });
    return mockQuery();
  });
}

import SessionsPage, {
  parseUsernames,
} from "@/app/(dashboard)/nodes/[nodeId]/sessions/page";

beforeEach(() => {
  vi.clearAllMocks();
  mutations.clear();
  pending.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, path: string, opts?: { onSuccess?: () => void }) => {
      if (!mutations.has(path)) {
        mutations.set(path, {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          onSuccess: opts?.onSuccess,
        });
      }
      const m = mutations.get(path)!;
      m.onSuccess = opts?.onSuccess;
      return { mutate: m.mutate, mutateAsync: m.mutateAsync, isPending: pending.has(path) };
    },
  );
});

describe("SessionsPage stat tiles", () => {
  it("renders live-counter tiles from real-shape (string) stats", () => {
    mockPaths({
      sessions: [],
      stats: {
        active: "42",
        starting: "1",
        finishing: "0",
        cpu_percent: "0",
        pool_used: "0",
        pool_total: "253",
        uptime: "3d 4h",
      },
    });
    render(<SessionsPage />);
    expect(screen.getByText("Active sessions")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Starting")).toBeTruthy();
    expect(screen.getByText("Finishing")).toBeTruthy();
    // cpu_percent "0" → "0%"
    expect(screen.getByText("0%")).toBeTruthy();
    // pool_used / pool_total
    expect(screen.getByText("0 / 253")).toBeTruthy();
    expect(screen.getByText("3d 4h")).toBeTruthy();
    // muted RADIUS note under the pool tile
    expect(
      screen.getByText("Local pool — subscriber IPs are RADIUS-assigned"),
    ).toBeTruthy();
  });

  it("dashes empty, undefined and null stat fields", () => {
    mockPaths({
      sessions: [],
      stats: {
        active: "", // empty string → "—"
        starting: undefined, // undefined → "—"
        finishing: null, // null → "—"
        cpu_percent: "", // empty → cpuText "—"
        pool_used: undefined,
        pool_total: null,
        uptime: "",
      },
    });
    render(<SessionsPage />);
    // active/starting/finishing/cpu/uptime → 5 standalone "—" tiles
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(5);
    // pool combines both dashes
    expect(screen.getByText("— / —")).toBeTruthy();
  });

  it("surfaces unrecognised stat keys as extra chips", () => {
    mockPaths({
      sessions: [],
      stats: { active: "5", total: 12, sessions_peak: 30 },
    });
    render(<SessionsPage />);
    // known key still a tile
    expect(screen.getByText("Active sessions")).toBeTruthy();
    // unknown keys fall through to extras (label underscores → spaces)
    expect(screen.getByText("total")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("sessions peak")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
  });

  it("omits the tiles entirely when stats are unavailable", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    expect(screen.queryByText("Active sessions")).toBeNull();
    // table still renders
    expect(screen.getByText("alice")).toBeTruthy();
  });
});

describe("SessionsPage table", () => {
  it("renders rows with state badges (active / closing / defaulted)", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    expect(screen.getByText("aa:bb:cc:dd:ee:01")).toBeTruthy();
    // alice("active") + minimal row (state undefined → "active")
    expect(screen.queryAllByText("active").length).toBe(2);
    expect(screen.getByText("closing")).toBeTruthy();
  });

  it("filters by username, IP and MAC and ignores rows missing those fields", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    const input = screen.getByPlaceholderText("Search username, IP, MAC...");

    fireEvent.change(input, { target: { value: "alice" } });
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.queryByText("bob")).toBeNull();

    fireEvent.change(input, { target: { value: "10.0.0.2" } });
    expect(screen.queryByText("alice")).toBeNull();
    expect(screen.getByText("bob")).toBeTruthy();

    fireEvent.change(input, { target: { value: "11:22:33" } });
    expect(screen.queryByText("alice")).toBeNull();
    expect(screen.getByText("bob")).toBeTruthy();
  });
});

describe("SessionsPage actions", () => {
  it("fires the restart mutation from the action cell", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    const btn = screen.getAllByText("Restart")[0].closest("button");
    fireEvent.click(btn!);
    expect(mutations.get("sessions/restart")!.mutate).toHaveBeenCalledWith({
      username: "alice",
    });
  });

  it("disables the restart button while the mutation is pending", () => {
    pending.add("sessions/restart");
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    const btn = screen.getAllByText("Restart")[0].closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("opens the terminate dialog, confirms, and calls mutateAsync", async () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    fireEvent.click(screen.getAllByText("Terminate")[0].closest("button")!);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(screen.getByTestId("confirm-desc").textContent).toContain("alice");
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(mutations.get("sessions/terminate")!.mutateAsync).toHaveBeenCalledWith({
      username: "alice",
    });
    // onConfirm sets the target back to null → dialog closes
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("closes the terminate dialog via cancel", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    fireEvent.click(screen.getAllByText("Terminate")[0].closest("button")!);
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("keeps the dialog open when onOpenChange reports open=true", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    fireEvent.click(screen.getAllByText("Terminate")[0].closest("button")!);
    fireEvent.click(screen.getByTestId("open-true"));
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
  });

  it("shows a toast when terminate and restart succeed", () => {
    mockPaths({ sessions: sessionRows(), stats: null });
    render(<SessionsPage />);
    mutations.get("sessions/terminate")!.onSuccess!();
    mutations.get("sessions/restart")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Session terminated");
    expect(toast.success).toHaveBeenCalledWith("Session restarted");
  });
});

describe("SessionsPage states", () => {
  it("shows the loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<SessionsPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the error state and retries", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("boom"), refetch }),
    );
    render(<SessionsPage />);
    expect(screen.getAllByText("boom").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty state", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    expect(screen.getByText("No active PPPoE sessions.")).toBeTruthy();
  });

  it("refreshes the session list", () => {
    const refetch = vi.fn();
    mockPaths({ sessions: sessionRows(), stats: null, refetch });
    render(<SessionsPage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("parseUsernames", () => {
  it("splits, trims, deduplicates and filters empty lines", () => {
    expect(parseUsernames("alice\n bob \nalice\n\ncharlie\n")).toEqual([
      "alice",
      "bob",
      "charlie",
    ]);
  });

  it("returns empty array for blank input", () => {
    expect(parseUsernames("")).toEqual([]);
    expect(parseUsernames("  \n  \n  ")).toEqual([]);
  });
});

describe("SessionsPage bulk operations", () => {
  it("renders the bulk operations card with subscriber count", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    expect(screen.getByText("Bulk Operations")).toBeTruthy();
    expect(screen.getByText("0 subscriber(s) selected")).toBeTruthy();

    const textarea = screen.getByLabelText("Usernames (one per line)");
    fireEvent.change(textarea, { target: { value: "alice\nbob" } });
    expect(screen.getByText("2 subscriber(s) selected")).toBeTruthy();
  });

  it("disables all bulk buttons when no usernames are entered", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    expect(
      screen.getByText("Bulk Terminate").closest("button")?.disabled,
    ).toBe(true);
    expect(
      screen.getByText("Apply Rate Limit").closest("button")?.disabled,
    ).toBe(true);
    expect(
      screen.getByText("Restore Shaper").closest("button")?.disabled,
    ).toBe(true);
  });

  it("disables Apply Rate Limit when rate is empty even with usernames", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "alice" },
    });
    expect(
      screen.getByText("Bulk Terminate").closest("button")?.disabled,
    ).toBe(false);
    expect(
      screen.getByText("Apply Rate Limit").closest("button")?.disabled,
    ).toBe(true);
    expect(
      screen.getByText("Restore Shaper").closest("button")?.disabled,
    ).toBe(false);
  });

  it("enables Apply Rate Limit when both usernames and rate are provided", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Rate (for rate limit)"), {
      target: { value: "5M/20M" },
    });
    expect(
      screen.getByText("Apply Rate Limit").closest("button")?.disabled,
    ).toBe(false);
  });

  it("opens terminate confirm and fires the bulk terminate mutation", async () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "alice\nbob" },
    });
    fireEvent.click(screen.getByText("Bulk Terminate"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "disconnect 2 subscriber(s) immediately",
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(mutations.get("bulk/terminate")!.mutateAsync).toHaveBeenCalledWith({
      usernames: ["alice", "bob"],
    });
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("opens ratelimit confirm and fires the mutation with rate", async () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Rate (for rate limit)"), {
      target: { value: "5M/20M" },
    });
    fireEvent.click(screen.getByText("Apply Rate Limit"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "bandwidth allocation for 1 subscriber(s)",
    );
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "5M/20M",
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(mutations.get("bulk/ratelimit")!.mutateAsync).toHaveBeenCalledWith({
      usernames: ["alice"],
      rate: "5M/20M",
    });
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("opens shaper-restore confirm and fires the mutation", async () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "charlie" },
    });
    fireEvent.click(screen.getByText("Restore Shaper"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "restore RADIUS-assigned shaper settings for 1 subscriber(s)",
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(
      mutations.get("bulk/shaper-restore")!.mutateAsync,
    ).toHaveBeenCalledWith({ usernames: ["charlie"] });
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("closes the bulk confirm dialog on cancel", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("Bulk Terminate"));
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("shows toasts when bulk operations succeed", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    mutations.get("bulk/terminate")!.onSuccess!();
    mutations.get("bulk/ratelimit")!.onSuccess!();
    mutations.get("bulk/shaper-restore")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Sessions terminated");
    expect(toast.success).toHaveBeenCalledWith("Rate limits applied");
    expect(toast.success).toHaveBeenCalledWith("Shaper settings restored");
  });

  it("disables bulk buttons while their mutations are pending", () => {
    pending.add("bulk/terminate");
    pending.add("bulk/ratelimit");
    pending.add("bulk/shaper-restore");
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Usernames (one per line)"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Rate (for rate limit)"), {
      target: { value: "5M/20M" },
    });
    expect(
      screen.getByText("Bulk Terminate").closest("button")?.disabled,
    ).toBe(true);
    expect(
      screen.getByText("Apply Rate Limit").closest("button")?.disabled,
    ).toBe(true);
    expect(
      screen.getByText("Restore Shaper").closest("button")?.disabled,
    ).toBe(true);
  });

  it("renders the info note about entering usernames", () => {
    mockPaths({ sessions: [], stats: null });
    render(<SessionsPage />);
    expect(
      screen.getByText(
        "Enter one PPPoE username per line. Actions apply to all listed subscribers at once.",
      ),
    ).toBeTruthy();
  });
});
