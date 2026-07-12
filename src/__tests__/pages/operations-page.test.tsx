import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockRequireAuth } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: (r?: string) => mockRequireAuth(r),
}));
vi.mock("@/components/fleet/operations-manager", () => ({
  OperationsManager: () => (
    <div data-testid="operations-manager">Operations Manager</div>
  ),
}));

import OperationsPage from "@/app/(dashboard)/operations/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { role: "operator" } });
});

describe("OperationsPage", () => {
  it("guards operator role and renders operations manager", async () => {
    const jsx = await OperationsPage();
    render(jsx);
    expect(mockRequireAuth).toHaveBeenCalledWith("operator");
    expect(screen.getByTestId("operations-manager")).toBeTruthy();
  });
});
