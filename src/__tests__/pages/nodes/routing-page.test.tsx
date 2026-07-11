/**
 * Dedicated tests for the Routing page (rewritten against real accel-2 shapes).
 * Exercises: loading / error+retry / refresh, summary cards driven by
 * `configured` (Active vs Not configured vs Unavailable), configured detail
 * fields (present / null / "" / undefined branches), raw_output <pre>, the
 * not-configured message, and the static BFD "Not available" note.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockUseNodeProxy } = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
}));

vi.mock("@/hooks/use-node-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-node-proxy")>();
  return { ...actual, useNodeProxy: mockUseNodeProxy };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ nodeId: "n1" }),
}));

import RoutingPage from "@/app/(dashboard)/nodes/[nodeId]/routing/page";

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNodeProxy.mockReturnValue(mockQuery());
});

describe("RoutingPage", () => {
  it("shows loading state (skeletons + shells)", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<RoutingPage />);
    expect(screen.getByText("BGP")).toBeTruthy();
    expect(screen.getByText("OSPF")).toBeTruthy();
    expect(screen.getByText("RIP")).toBeTruthy();
    expect(document.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Unavailable badges and retries on error", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(mockQuery({ error: new Error("no frr"), refetch }));
    render(<RoutingPage />);
    expect(screen.getAllByText("Unavailable").length).toBe(3);
    const retries = screen.getAllByText("Retry");
    expect(retries.length).toBe(3);
    retries.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it("renders configured protocols with fields + raw_output, and not-configured state", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "routing/bgp/status") {
        return mockQuery({
          data: {
            configured: true,
            router_id: "10.0.0.1",
            local_as: 65001,
            neighbors: [{}, {}],
            total_prefixes: 0,
            raw_output: "BGP router identifier 10.0.0.1",
          },
        });
      }
      if (path === "routing/ospf/status") {
        return mockQuery({
          data: {
            configured: true,
            router_id: "",
            local_as: null,
            total_prefixes: null,
            version: 2,
            networks: [{}],
            raw_output: "",
          },
        });
      }
      if (path === "routing/rip/status") {
        return mockQuery({ data: { configured: false, version: 2, networks: [] } });
      }
      return mockQuery();
    });
    render(<RoutingPage />);

    // Summary badges: BGP + OSPF Active, RIP Not configured
    expect(screen.getAllByText("Active").length).toBe(2);
    expect(screen.getByText("Not configured")).toBeTruthy();

    // BGP detail fields (present values, incl. total_prefixes 0) + raw_output
    expect(screen.getByText("Router ID")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    expect(screen.getByText("Local AS")).toBeTruthy();
    expect(screen.getByText("65001")).toBeTruthy();
    expect(screen.getByText("Neighbors")).toBeTruthy();
    expect(screen.getByText("Total Prefixes")).toBeTruthy();
    expect(screen.getByText("BGP router identifier 10.0.0.1")).toBeTruthy();

    // OSPF: version + networks kept; empty/null/undefined fields dropped
    expect(screen.getByText("Version")).toBeTruthy();
    expect(screen.getByText("Networks")).toBeTruthy();

    // RIP not configured → explanatory message
    expect(screen.getByText("RIP is not configured on this node.")).toBeTruthy();
  });

  it("refreshes every detail section when data is present", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ data: { configured: false }, refetch }),
    );
    render(<RoutingPage />);
    const refresh = screen.getAllByText("Refresh");
    expect(refresh.length).toBe(3);
    refresh.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it("always shows the static BFD not-available note", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ data: { configured: false } }));
    render(<RoutingPage />);
    expect(screen.getByText("BFD")).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(
      screen.getByText(/Bidirectional Forwarding Detection status is not exposed/),
    ).toBeTruthy();
  });
});
