import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    node: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

// Mock child components
vi.mock("@/components/dashboard/stat-card", () => ({
  StatCard: ({ title, value, description }: { title: string; value: number; description: string }) => (
    <div data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <span>{title}</span>
      <span data-testid="stat-value">{value}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock("@/components/dashboard/node-card", () => ({
  NodeCard: ({ name, status }: { name: string; status: string }) => (
    <div data-testid="node-card" data-status={status}>
      {name}
    </div>
  ),
}));

vi.mock("@/components/dashboard/fleet-overview", () => ({
  FleetOverview: () => <div data-testid="fleet-overview-component">Fleet Overview</div>,
}));

import DashboardPage from "@/app/(dashboard)/page";

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty state when no nodes", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("No nodes configured")).toBeTruthy();
    expect(screen.getByText("Add your first node")).toBeTruthy();
    // FleetOverview should NOT render when no nodes
    expect(screen.queryByTestId("fleet-overview-component")).toBeNull();
  });

  it("renders fleet overview and node cards when nodes exist", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "bng-1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "2", name: "bng-2", url: "http://2:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "3", name: "bng-3", url: "http://3:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    // FleetOverview renders when nodes exist
    expect(screen.getByTestId("fleet-overview-component")).toBeTruthy();

    // Node cards render
    const cards = screen.getAllByTestId("node-card");
    expect(cards).toHaveLength(3);
  });

  it("renders node cards for each node", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "bng-1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "2", name: "bng-2", url: "http://2:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    const cards = screen.getAllByTestId("node-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("bng-1")).toBeTruthy();
    expect(screen.getByText("bng-2")).toBeTruthy();
  });

  it("shows page heading and description", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Overview of all managed BNG nodes.")).toBeTruthy();
  });

  it("shows Nodes section heading", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "n1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Nodes")).toBeTruthy();
  });
});
