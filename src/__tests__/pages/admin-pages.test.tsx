import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

class RedirectError extends Error {
  constructor(public url: string) {
    super("NEXT_REDIRECT");
  }
}

const { mockRequireAuth } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/users",
}));

import UsersPage from "@/app/(dashboard)/users/page";
import SettingsPage from "@/app/(dashboard)/settings/page";

describe("Admin placeholder pages", () => {
  it("UsersPage renders Coming Soon", async () => {
    mockRequireAuth.mockResolvedValue({ user: { role: "admin" } });
    const jsx = await UsersPage();
    render(jsx);
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(mockRequireAuth).toHaveBeenCalledWith("admin");
  });

  it("SettingsPage renders Coming Soon", async () => {
    mockRequireAuth.mockResolvedValue({ user: { role: "admin" } });
    const jsx = await SettingsPage();
    render(jsx);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("UsersPage requires admin role", async () => {
    mockRequireAuth.mockResolvedValue({ user: { role: "admin" } });
    await UsersPage();
    expect(mockRequireAuth).toHaveBeenCalledWith("admin");
  });
});
