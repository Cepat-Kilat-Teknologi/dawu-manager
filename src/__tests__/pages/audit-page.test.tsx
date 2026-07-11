import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockRequireAuth, mockPrisma } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockPrisma: { node: { findMany: vi.fn() } },
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: (r?: string) => mockRequireAuth(r) }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/components/activity/activity-feed", () => ({
  ActivityFeed: ({ nodes }: { nodes: { id: string; name: string }[] }) => (
    <div data-testid="activity-feed">{nodes.map((n) => n.name).join(",")}</div>
  ),
}));

import AuditPage from "@/app/(dashboard)/audit/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { role: "admin" } });
  mockPrisma.node.findMany.mockResolvedValue([{ id: "n1", name: "accel-2" }]);
});

describe("AuditPage", () => {
  it("guards admin and renders the activity feed with nodes", async () => {
    const jsx = await AuditPage();
    render(jsx);
    expect(mockRequireAuth).toHaveBeenCalledWith("admin");
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByTestId("activity-feed").textContent).toBe("accel-2");
  });
});
