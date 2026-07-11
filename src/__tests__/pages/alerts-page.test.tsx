import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockRequireAuth, mockPrisma } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockPrisma: { node: { findMany: vi.fn() } },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: (r?: string) => mockRequireAuth(r),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/components/alerts/alerts-manager", () => ({
  AlertsManager: ({ nodes }: { nodes: { id: string; name: string }[] }) => (
    <div data-testid="alerts-manager">{nodes.map((n) => n.name).join(",")}</div>
  ),
}));

import AlertsPage from "@/app/(dashboard)/alerts/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { role: "operator" } });
  mockPrisma.node.findMany.mockResolvedValue([
    { id: "n1", name: "accel-2" },
    { id: "n2", name: "dawos-dev" },
  ]);
});

describe("AlertsPage", () => {
  it("guards operator and renders the alerts manager with nodes", async () => {
    const jsx = await AlertsPage();
    render(jsx);
    expect(mockRequireAuth).toHaveBeenCalledWith("operator");
    expect(mockPrisma.node.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    expect(screen.getByText("Alerts")).toBeTruthy();
    expect(screen.getByTestId("alerts-manager").textContent).toBe(
      "accel-2,dawos-dev",
    );
  });
});
