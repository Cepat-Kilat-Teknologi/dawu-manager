import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

class RedirectError extends Error {
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: { count: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

// Mock layout sub-components
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ userRole }: { userRole: string }) => (
    <div data-testid="sidebar" data-role={userRole}>
      Sidebar
    </div>
  ),
}));
vi.mock("@/components/layout/header", () => ({
  Header: () => <div data-testid="header">Header</div>,
}));
vi.mock("@/components/layout/bottom-nav", () => ({
  BottomNav: () => <div data-testid="bottom-nav" />,
}));
vi.mock("@/components/command-palette", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));

import DashboardLayout from "@/app/(dashboard)/layout";

describe("DashboardLayout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /setup when no users exist", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    await expect(
      DashboardLayout({ children: <div>Content</div> }),
    ).rejects.toThrow("NEXT_REDIRECT:/setup");
  });

  it("redirects to /login when not authenticated", async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    mockAuth.mockResolvedValue(null);

    await expect(
      DashboardLayout({ children: <div>Content</div> }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders layout with sidebar, header, and children when authenticated", async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" },
    });

    const jsx = await DashboardLayout({
      children: <div data-testid="child">Dashboard Content</div>,
    });
    render(jsx);

    expect(screen.getByTestId("sidebar")).toBeTruthy();
    expect(screen.getByTestId("header")).toBeTruthy();
    expect(screen.getByTestId("child")).toBeTruthy();
    expect(screen.getByText("Dashboard Content")).toBeTruthy();
  });

  it("passes user role to sidebar", async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Op", email: "o@t.com", role: "operator" },
    });

    const jsx = await DashboardLayout({ children: <div>Content</div> });
    render(jsx);

    expect(screen.getByTestId("sidebar").getAttribute("data-role")).toBe("operator");
  });
});
