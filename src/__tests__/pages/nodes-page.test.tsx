import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    node: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/components/dashboard/node-card", () => ({
  NodeCard: ({ name, status }: { name: string; status: string }) => (
    <div data-testid="node-card" data-status={status}>
      {name}
    </div>
  ),
}));

import NodesPage from "@/app/(dashboard)/nodes/page";

describe("NodesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders page title and add button", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await NodesPage();
    render(jsx);

    expect(screen.getByText("Nodes")).toBeTruthy();
    expect(screen.getByText("Manage your dawos-agent BNG nodes.")).toBeTruthy();
  });

  it("renders empty state when no nodes", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await NodesPage();
    render(jsx);

    expect(screen.getByText("No nodes yet")).toBeTruthy();
    expect(
      screen.getByText("Add your first dawos-agent node to get started."),
    ).toBeTruthy();
  });

  it("renders node cards when nodes exist", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "bng-1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "2", name: "bng-2", url: "http://2:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await NodesPage();
    render(jsx);

    const cards = screen.getAllByTestId("node-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("bng-1")).toBeTruthy();
    expect(screen.getByText("bng-2")).toBeTruthy();
  });

  it("has add node link", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await NodesPage();
    const { container } = render(jsx);

    const addLinks = container.querySelectorAll('a[href="/nodes/new"]');
    expect(addLinks.length).toBeGreaterThan(0);
  });
});
