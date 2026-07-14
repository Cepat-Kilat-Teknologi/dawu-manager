/**
 * Tests for the Session History page.
 * Covers: history stats grid, history table, snapshot creation, CSV export,
 * purge confirmation, loading/error/empty states, and refresh.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  isPending: boolean;
  onSuccess?: () => void;
}

const { mockUseNodeProxy, mockUseNodeProxyMutation, mutationMap } = vi.hoisted(
  () => ({
    mockUseNodeProxy: vi.fn(),
    mockUseNodeProxyMutation: vi.fn(),
    mutationMap: new Map<string, CapturedMutation>(),
  }),
);

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

import HistoryPage from "@/app/(dashboard)/nodes/[nodeId]/history/page";

function mockPaths(opts: {
  history?: unknown;
  stats?: unknown;
  refetch?: () => void;
}) {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "sessions/history")
      return mockQuery({
        data: opts.history ?? null,
        refetch: opts.refetch ?? vi.fn(),
      });
    if (path === "sessions/history/stats")
      return mockQuery({ data: opts.stats ?? null });
    return mockQuery();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, path: string, opts?: { onSuccess?: () => void }) => {
      if (!mutationMap.has(path)) {
        mutationMap.set(path, {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          onSuccess: opts?.onSuccess,
        });
      }
      const m = mutationMap.get(path)!;
      m.onSuccess = opts?.onSuccess;
      return {
        mutate: m.mutate,
        mutateAsync: m.mutateAsync,
        isPending: m.isPending,
      };
    },
  );
});

const sampleHistory = [
  {
    username: "alice",
    ip: "10.0.0.1",
    calling_sid: "aa:bb:cc:dd:ee:01",
    ifname: "ppp0",
    start_time: "2026-07-01 10:00:00",
    end_time: "2026-07-01 11:00:00",
    duration: "1h",
    terminate_cause: "User-Request",
  },
  {
    username: "bob",
    ip: "10.0.0.2",
    calling_sid: "11:22:33:44:55:66",
    ifname: "ppp1",
    start_time: "2026-07-01 09:00:00",
    end_time: "2026-07-01 09:30:00",
    duration: "30m",
    terminate_cause: "Admin-Reset",
  },
];

describe("HistoryPage", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<HistoryPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state and retries", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("history error"), refetch }),
    );
    render(<HistoryPage />);
    expect(
      screen.getAllByText("history error").length,
    ).toBeGreaterThanOrEqual(1);
    const retries = screen.getAllByText("Retry");
    retries.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows empty state for history", () => {
    mockPaths({ history: [], stats: null });
    render(<HistoryPage />);
    expect(
      screen.getByText(
        "No session history entries. Create a snapshot to capture current sessions.",
      ),
    ).toBeTruthy();
  });

  it("renders history table with session entries", () => {
    mockPaths({ history: sampleHistory, stats: null });
    render(<HistoryPage />);
    expect(screen.getByText("Session History (2)")).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    expect(screen.getByText("aa:bb:cc:dd:ee:01")).toBeTruthy();
    expect(screen.getByText("User-Request")).toBeTruthy();
    expect(screen.getByText("Admin-Reset")).toBeTruthy();
  });

  it("renders history statistics", () => {
    mockPaths({
      history: [],
      stats: { total_sessions: 150, avg_duration: "45m", peak_concurrent: 42 },
    });
    render(<HistoryPage />);
    expect(screen.getByText("History Statistics")).toBeTruthy();
    expect(screen.getByText("total sessions")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.getByText("avg duration")).toBeTruthy();
    expect(screen.getByText("45m")).toBeTruthy();
    expect(screen.getByText("peak concurrent")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("shows empty state for stats with only skipped keys", () => {
    mockPaths({ history: [], stats: { raw_output: "hidden" } });
    render(<HistoryPage />);
    expect(
      screen.getByText("No history statistics available."),
    ).toBeTruthy();
  });

  it("fires snapshot mutation", () => {
    mockPaths({ history: sampleHistory, stats: null });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText("Snapshot"));
    expect(mutationMap.get("sessions/snapshot")!.mutate).toHaveBeenCalledWith(
      {},
    );
  });

  it("shows spinner while snapshot is pending", () => {
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, _path: string, opts?: { onSuccess?: () => void }) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
        onSuccess: opts?.onSuccess,
      }),
    );
    mockPaths({ history: [], stats: null });
    render(<HistoryPage />);
    // When isPending is true the button text is still "Snapshot" but disabled
    const btn = screen.getByText("Snapshot").closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("shows toast on snapshot success", () => {
    mockPaths({ history: [], stats: null });
    render(<HistoryPage />);
    mutationMap.get("sessions/snapshot")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Session snapshot created");
  });

  it("exports history as CSV via anchor download", () => {
    mockPaths({ history: sampleHistory, stats: null });
    render(<HistoryPage />);
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: clickSpy });
      }
      return el;
    });
    fireEvent.click(screen.getByText("Export CSV"));
    expect(clickSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("opens purge confirmation and fires purge mutation", async () => {
    mockPaths({ history: sampleHistory, stats: null });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText("Purge"));
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "permanently delete all session history",
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });
    expect(
      mutationMap.get("sessions/history/purge")!.mutateAsync,
    ).toHaveBeenCalledWith({});
  });

  it("closes purge dialog on cancel", () => {
    mockPaths({ history: sampleHistory, stats: null });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText("Purge"));
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("shows toast on purge success", () => {
    mockPaths({ history: [], stats: null });
    render(<HistoryPage />);
    mutationMap.get("sessions/history/purge")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Session history purged");
  });

  it("refreshes history list", () => {
    const refetch = vi.fn();
    mockPaths({ history: sampleHistory, stats: null, refetch });
    render(<HistoryPage />);
    const refreshButtons = screen.getAllByText("Refresh");
    fireEvent.click(refreshButtons[refreshButtons.length - 1]);
    expect(refetch).toHaveBeenCalled();
  });

  it("refreshes history stats", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "sessions/history")
        return mockQuery({ data: [] });
      if (path === "sessions/history/stats")
        return mockQuery({ data: { total: 10 }, refetch });
      return mockQuery();
    });
    render(<HistoryPage />);
    const refreshButtons = screen.getAllByText("Refresh");
    fireEvent.click(refreshButtons[0]);
    expect(refetch).toHaveBeenCalled();
  });
});
