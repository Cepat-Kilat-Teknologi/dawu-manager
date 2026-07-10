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

import DashboardPage from "@/app/(dashboard)/page";

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty state when no nodes", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getAllByText("No nodes configured").length).toBeGreaterThan(0);
    expect(screen.getByText("Add your first node")).toBeTruthy();
  });

  it("renders stats with node counts", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "bng-1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "2", name: "bng-2", url: "http://2:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "3", name: "bng-3", url: "http://3:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByTestId("stat-total-nodes")).toBeTruthy();
    expect(screen.getByTestId("stat-online")).toBeTruthy();
    expect(screen.getByTestId("stat-offline")).toBeTruthy();
    expect(screen.getByTestId("stat-degraded")).toBeTruthy();
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

  it("shows correct availability percentage", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "n1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "2", name: "n2", url: "http://2:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    // 1 of 2 online = 50% availability
    expect(screen.getByText("50% availability")).toBeTruthy();
  });

  it("shows degraded count", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "n1", url: "http://1:8470", status: "degraded", location: null, lastSeen: new Date() },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Partial service")).toBeTruthy();
  });

  it("shows healthy messages when no offline/degraded", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "n1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("All nodes healthy")).toBeTruthy();
    expect(screen.getByText("No degraded nodes")).toBeTruthy();
  });

  it("shows no-nodes description for online stat", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getAllByText("No nodes configured").length).toBeGreaterThanOrEqual(2);
  });

  it("shows needs attention for offline nodes", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "n1", url: "http://1:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Needs attention")).toBeTruthy();
  });
});
