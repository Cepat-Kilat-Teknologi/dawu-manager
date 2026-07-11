import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Mock StatusBadge
vi.mock("@/components/shared/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

// Mock stat-card
vi.mock("@/components/dashboard/stat-card", () => ({
  StatCard: ({
    title,
    value,
    description,
  }: {
    title: string;
    value: string | number;
    description: string;
  }) => (
    <div data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <span>{title}</span>
      <span data-testid="stat-value">{value}</span>
      <span>{description}</span>
    </div>
  ),
  StatCardSkeleton: () => <div data-testid="stat-skeleton" />,
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  HEALTH_POLL_INTERVAL: 30_000,
}));

// TanStack Query wrapper
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FleetOverview } from "@/components/dashboard/fleet-overview";

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const OVERVIEW_DATA = {
  nodes: { total: 3, online: 2, offline: 1, degraded: 0, unknown: 0 },
  sessions: { total: 500 },
  topNodes: [
    { id: "n1", name: "bng-1", status: "online", sessions: 300, cpu: 45, memory: 60, disk: 20 },
    { id: "n2", name: "bng-2", status: "online", sessions: 200, cpu: 30, memory: 40, disk: 15 },
    { id: "n3", name: "bng-3", status: "offline", sessions: 0, cpu: 0, memory: 0, disk: 0 },
  ],
};

describe("FleetOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  it("shows loading skeletons initially", () => {
    // Never resolve the fetch — stay in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<FleetOverview />, { wrapper: Wrapper });
    expect(screen.getByTestId("fleet-loading")).toBeTruthy();
    expect(screen.getAllByTestId("stat-skeleton")).toHaveLength(4);
  });

  it("renders live stats after successful fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(OVERVIEW_DATA),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("fleet-overview")).toBeTruthy();
    });

    // Stat cards
    expect(screen.getByTestId("stat-active-subscribers")).toBeTruthy();
    expect(screen.getByTestId("stat-online")).toBeTruthy();
    expect(screen.getByTestId("stat-offline")).toBeTruthy();
    expect(screen.getByTestId("stat-degraded")).toBeTruthy();

    // Descriptions
    expect(screen.getByText("Across 2 reachable nodes")).toBeTruthy();
    expect(screen.getByText("67% availability")).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText("No degraded nodes")).toBeTruthy();
  });

  it("renders top nodes ranked list", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(OVERVIEW_DATA),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Top Nodes by Load")).toBeTruthy();
    });

    const rows = screen.getAllByTestId("top-node-row");
    expect(rows).toHaveLength(3);
    expect(screen.getByText("bng-1")).toBeTruthy();
    expect(screen.getByText("300 sess")).toBeTruthy();
    expect(screen.getByText("45% CPU")).toBeTruthy();
    expect(screen.getByText("60% RAM")).toBeTruthy();
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal Server Error" }),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("fleet-error")).toBeTruthy();
    });
    expect(screen.getByText(/Unable to load live fleet stats/)).toBeTruthy();
  });

  it("shows singular reachable node text when only one online", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          nodes: { total: 1, online: 1, offline: 0, degraded: 0, unknown: 0 },
          sessions: { total: 50 },
          topNodes: [
            { id: "n1", name: "bng-1", status: "online", sessions: 50, cpu: 10, memory: 20, disk: 5 },
          ],
        }),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Across 1 reachable node")).toBeTruthy();
    });
    expect(screen.getByText("100% availability")).toBeTruthy();
    expect(screen.getByText("All reachable")).toBeTruthy();
  });

  it("handles zero-total nodes availability description", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          nodes: { total: 0, online: 0, offline: 0, degraded: 0, unknown: 0 },
          sessions: { total: 0 },
          topNodes: [],
        }),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("No nodes")).toBeTruthy();
    });
  });

  it("shows partial service text when degraded nodes exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          nodes: { total: 2, online: 1, offline: 0, degraded: 1, unknown: 0 },
          sessions: { total: 100 },
          topNodes: [
            { id: "n1", name: "bng-1", status: "online", sessions: 100, cpu: 20, memory: 30, disk: 10 },
          ],
        }),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Partial service")).toBeTruthy();
    });
  });

  it("does not render top nodes section when list is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          nodes: { total: 0, online: 0, offline: 0, degraded: 0, unknown: 0 },
          sessions: { total: 0 },
          topNodes: [],
        }),
    });

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("fleet-overview")).toBeTruthy();
    });
    expect(screen.queryByText("Top Nodes by Load")).toBeNull();
  });

  it("shows network error state", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    render(<FleetOverview />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("fleet-error")).toBeTruthy();
    });
  });
});
