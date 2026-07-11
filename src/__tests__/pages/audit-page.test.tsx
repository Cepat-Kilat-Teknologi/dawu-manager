import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockRequireAuth, mockPrisma } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockPrisma: {
    node: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: (r?: string) => mockRequireAuth(r) }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/components/activity/activity-feed", () => ({
  ActivityFeed: ({
    nodes,
    users,
    actions,
  }: {
    nodes: { id: string; name: string }[];
    users: { id: string; name: string }[];
    actions: string[];
  }) => (
    <div data-testid="activity-feed">
      <span data-testid="feed-nodes">{nodes.map((n) => n.name).join(",")}</span>
      <span data-testid="feed-users">{users.map((u) => u.name).join(",")}</span>
      <span data-testid="feed-actions">{actions.join(",")}</span>
    </div>
  ),
}));

import AuditPage from "@/app/(dashboard)/audit/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { role: "admin" } });
  mockPrisma.node.findMany.mockResolvedValue([{ id: "n1", name: "accel-2" }]);
  mockPrisma.user.findMany.mockResolvedValue([{ id: "u1", name: "admin" }]);
  mockPrisma.auditLog.findMany.mockResolvedValue([{ action: "node.create" }]);
});

describe("AuditPage", () => {
  it("guards admin and renders the activity feed with nodes, users, and actions", async () => {
    const jsx = await AuditPage();
    render(jsx);
    expect(mockRequireAuth).toHaveBeenCalledWith("admin");
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByTestId("feed-nodes").textContent).toBe("accel-2");
    expect(screen.getByTestId("feed-users").textContent).toBe("admin");
    expect(screen.getByTestId("feed-actions").textContent).toBe("node.create");
  });

  it("passes multiple users and actions", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "admin" },
      { id: "u2", name: "operator" },
    ]);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { action: "node.create" },
      { action: "node.delete" },
    ]);
    const jsx = await AuditPage();
    render(jsx);
    expect(screen.getByTestId("feed-users").textContent).toBe("admin,operator");
    expect(screen.getByTestId("feed-actions").textContent).toBe(
      "node.create,node.delete",
    );
  });
});
