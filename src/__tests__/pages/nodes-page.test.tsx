import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    node: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

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

  it("renders the empty state when there are no nodes", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await NodesPage();
    render(jsx);

    expect(screen.getByText("No nodes yet")).toBeTruthy();
    expect(
      screen.getByText("Add your first dawos-agent node to get started."),
    ).toBeTruthy();
  });

  it("renders node rows when nodes exist", async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "1", name: "bng-1", url: "http://1:8470", status: "online", location: null, lastSeen: new Date() },
      { id: "2", name: "bng-2", url: "http://2:8470", status: "offline", location: null, lastSeen: null },
    ]);
    const jsx = await NodesPage();
    render(jsx);

    const table = screen.getByTestId("table");
    expect(within(table).getByText("bng-1")).toBeTruthy();
    expect(within(table).getByText("bng-2")).toBeTruthy();
  });

  it("has an add-node link in the header", async () => {
    mockPrisma.node.findMany.mockResolvedValue([]);
    const jsx = await NodesPage();
    const { container } = render(jsx);

    const addLinks = container.querySelectorAll('a[href="/nodes/new"]');
    expect(addLinks.length).toBeGreaterThan(0);
  });
});
