/**
 * Dedicated tests for the redesigned PPPoE page.
 * Covers loading / error+retry / empty / data (interface cards with option
 * chips + "default options") and the MAC filter status card (colon + no-colon
 * parsing, enabled/disabled badge variants).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

import PppoePage from "@/app/(dashboard)/nodes/[nodeId]/pppoe/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNodeProxy.mockReturnValue(mockQuery());
});

describe("PppoePage", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<PppoePage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders interface cards with option chips and default-options fallback", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "pppoe/interfaces") {
        return mockQuery({
          data: [
            { name: "ens19", options: "mtu 1492 mru 1492 start-session" },
            { name: "ens20", options: "" },
          ],
        });
      }
      if (path === "pppoe/mac-filter") {
        return mockQuery({
          data: { raw_output: "filter type: disabled", count: 0 },
        });
      }
      return mockQuery();
    });
    render(<PppoePage />);

    // Count in title + both interface names.
    expect(screen.getByText("PPPoE Interfaces (2)")).toBeTruthy();
    expect(screen.getByText("ens19")).toBeTruthy();
    expect(screen.getByText("ens20")).toBeTruthy();

    // Option string split into chips.
    expect(screen.getByText("mtu")).toBeTruthy();
    expect(screen.getByText("mru")).toBeTruthy();
    expect(screen.getByText("start-session")).toBeTruthy();
    expect(screen.getAllByText("1492").length).toBe(2);

    // Interface with empty options shows the fallback, not chips.
    expect(screen.getByText("default options")).toBeTruthy();

    // MAC filter parsed to "disabled" with a non-enabled (secondary) badge.
    const macBadge = screen.getByText("disabled");
    expect(macBadge.getAttribute("data-variant")).toBe("secondary");
  });

  it("renders MAC filter enabled status from a colon-less raw_output", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "pppoe/interfaces") {
        return mockQuery({ data: [{ name: "ens19", options: "" }] });
      }
      if (path === "pppoe/mac-filter") {
        return mockQuery({ data: { raw_output: "enabled", count: 3 } });
      }
      return mockQuery();
    });
    render(<PppoePage />);
    const macBadge = screen.getByText("enabled");
    expect(macBadge.getAttribute("data-variant")).toBe("default");
  });

  it("renders empty states for both sections", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "pppoe/interfaces") return mockQuery({ data: [] });
      if (path === "pppoe/mac-filter") {
        return mockQuery({ data: { raw_output: "", count: 0 } });
      }
      return mockQuery();
    });
    render(<PppoePage />);
    expect(screen.getByText("No PPPoE interfaces configured.")).toBeTruthy();
    expect(
      screen.getByText("MAC filter status not reported by this node."),
    ).toBeTruthy();
  });

  it("retries both sections on error", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("Network error"), refetch }),
    );
    render(<PppoePage />);
    const retryButtons = screen.getAllByText("Retry");
    expect(retryButtons.length).toBe(2);
    retryButtons.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes the interfaces section", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "pppoe/interfaces") {
        return mockQuery({
          data: [{ name: "ens19", options: "" }],
          refetch,
        });
      }
      return mockQuery({
        data: { raw_output: "filter type: disabled", count: 0 },
      });
    });
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
