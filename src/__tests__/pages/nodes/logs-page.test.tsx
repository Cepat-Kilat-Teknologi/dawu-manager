/**
 * Dedicated tests for the node Logs page.
 * Exercises every branch: loading, error+retry, full untrimmed line rendering
 * with severity colour coding, empty tail, line-count selector switching,
 * copy/download actions (clipboard present + absent), refresh, and the SSE
 * live-stream start/message/error/stop lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";

const { mockUseNodeProxy } = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
}));

vi.mock("@/hooks/use-node-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-node-proxy")>();
  return {
    ...actual,
    useNodeProxy: mockUseNodeProxy,
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
  usePathname: () => "/nodes/n1/logs",
  useSearchParams: () => new URLSearchParams(),
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

/** Build a `logs/tail` response object. */
function tail(lines: string[], source = "accel-ppp") {
  return { source, count: lines.length, lines };
}

import LogsPage from "@/app/(dashboard)/nodes/[nodeId]/logs/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNodeProxy.mockReturnValue(mockQuery());
});

describe("LogsPage", () => {
  it("shows the loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<LogsPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the error state and retries", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("tail failed"), refetch }),
    );
    render(<LogsPage />);
    expect(screen.getAllByText("tail failed").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders full untrimmed lines with severity colours, source and count", () => {
    const longLine = `12:04 [info] Connected ${"x".repeat(300)}`;
    mockUseNodeProxy.mockReturnValue(
      mockQuery({
        data: tail([
          "12:00 [error] Connection lost",
          "12:01 [crit] operation failed",
          "12:02 [warn] High latency",
          "12:03 [debug] Packet sent",
          longLine,
        ]),
      }),
    );
    render(<LogsPage />);

    // Header shows the source and the returned line count.
    expect(screen.getByText("accel-ppp")).toBeTruthy();
    expect(screen.getByText("5 lines")).toBeTruthy();

    // Severity colour coding (covers every lineColor branch).
    expect(
      screen.getByText("12:00 [error] Connection lost").className,
    ).toContain("text-red-500");
    expect(
      screen.getByText("12:01 [crit] operation failed").className,
    ).toContain("text-red-500");
    expect(screen.getByText("12:02 [warn] High latency").className).toContain(
      "text-amber-500",
    );
    expect(screen.getByText("12:03 [debug] Packet sent").className).toContain(
      "text-gray-400",
    );

    // Long info line is rendered in full and wraps (no truncation/ellipsis).
    const infoEl = screen.getByText(longLine);
    expect(infoEl.className).toContain("text-foreground");
    expect(infoEl.className).toContain("whitespace-pre-wrap");
    expect(infoEl.className).toContain("break-all");
  });

  it("notes when the tail is empty", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]) }));
    render(<LogsPage />);
    expect(screen.getByText("No log lines returned.")).toBeTruthy();
    expect(screen.getByText("0 lines")).toBeTruthy();
  });

  it("defaults to 500 lines and switches the tail size", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]) }));
    render(<LogsPage />);

    expect(screen.getByText("500").closest("button")?.getAttribute("data-variant")).toBe("default");
    expect(screen.getByText("100").closest("button")?.getAttribute("data-variant")).toBe("outline");

    fireEvent.click(screen.getByText("1000"));
    expect(screen.getByText("1000").closest("button")?.getAttribute("data-variant")).toBe("default");
    expect(screen.getByText("500").closest("button")?.getAttribute("data-variant")).toBe("outline");
  });

  it("copies the visible logs when the clipboard API is available", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail(["line-a", "line-b"]) }));
    render(<LogsPage />);
    fireEvent.click(screen.getByLabelText("Copy logs"));
    expect(writeText).toHaveBeenCalledWith("line-a\nline-b");
    expect(toast.success).toHaveBeenCalledWith("Copied 2 log lines to clipboard");
  });

  it("copies gracefully when the clipboard API is unavailable", () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail(["only-line"]) }));
    render(<LogsPage />);
    fireEvent.click(screen.getByLabelText("Copy logs"));
    expect(toast.success).toHaveBeenCalledWith("Copied 1 log lines to clipboard");
  });

  it("downloads the visible logs as a text file", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail(["l1", "l2"]) }));
    render(<LogsPage />);
    fireEvent.click(screen.getByLabelText("Download logs"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    clickSpy.mockRestore();
  });

  it("refreshes the tail", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]), refetch }));
    render(<LogsPage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalled();
  });

  it("appends the selected systemd unit to the tail request", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]) }));
    render(<LogsPage />);
    // Default unit is accel-ppp.
    expect(
      mockUseNodeProxy.mock.calls.some(
        (c) => c[1] === "logs/tail?lines=500&unit=accel-ppp",
      ),
    ).toBe(true);
    // Switching the unit re-keys the tail query with the new unit.
    fireEvent.change(screen.getByLabelText("Systemd unit"), {
      target: { value: "ssh" },
    });
    expect(
      mockUseNodeProxy.mock.calls.some(
        (c) => c[1] === "logs/tail?lines=500&unit=ssh",
      ),
    ).toBe(true);
  });

  it("notes the journald limitation for the selected unit", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]) }));
    render(<LogsPage />);
    expect(
      screen.getByText(/systemd journal for unit "accel-ppp"/),
    ).toBeTruthy();
    // The note tracks the selected unit.
    fireEvent.change(screen.getByLabelText("Systemd unit"), {
      target: { value: "cron" },
    });
    expect(screen.getByText(/systemd journal for unit "cron"/)).toBeTruthy();
  });

  it("streams live log events then stops", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]) }));

    let esInstance: {
      onmessage: ((event: { data: string }) => void) | null;
      onerror: (() => void) | null;
      close: ReturnType<typeof vi.fn>;
    } | null = null;

    class MockEventSource {
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        esInstance = this;
      }
    }
    vi.stubGlobal("EventSource", MockEventSource);

    render(<LogsPage />);
    fireEvent.click(screen.getByText("Live Stream"));
    expect(screen.getByText("Stop Stream")).toBeTruthy();
    expect(screen.getByText("Waiting for log events...")).toBeTruthy();

    act(() => {
      esInstance?.onmessage?.({ data: "2026-07-11 live event" });
    });
    expect(screen.getByText("2026-07-11 live event")).toBeTruthy();
    expect(screen.queryByText("Waiting for log events...")).toBeNull();

    fireEvent.click(screen.getByText("Stop Stream"));
    expect(screen.getByText("Live Stream")).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("stops streaming on SSE error", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: tail([]) }));

    let esInstance: {
      onmessage: ((event: { data: string }) => void) | null;
      onerror: (() => void) | null;
      close: ReturnType<typeof vi.fn>;
    } | null = null;

    class MockEventSource {
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        esInstance = this;
      }
    }
    vi.stubGlobal("EventSource", MockEventSource);

    render(<LogsPage />);
    fireEvent.click(screen.getByText("Live Stream"));
    act(() => {
      esInstance?.onerror?.();
    });
    expect(screen.getByText("Live Stream")).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("hides the static tail while streaming", () => {
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: tail(["12:00 [info] Static line"]) }),
    );

    class MockEventSource {
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    vi.stubGlobal("EventSource", MockEventSource);

    render(<LogsPage />);
    expect(screen.getByText("12:00 [info] Static line")).toBeTruthy();

    fireEvent.click(screen.getByText("Live Stream"));
    expect(screen.queryByText("12:00 [info] Static line")).toBeNull();

    vi.unstubAllGlobals();
  });
});
